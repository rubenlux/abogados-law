import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DocumentStatus,
  EstadoVencimiento,
  OrganizationRole,
} from "@prisma/client";
import { ScopedPrismaService } from "../authz/scoped-prisma.service";
import { ActiveOrgContext } from "../authz/guards/active-org-context.guard";
import { DocumentTextExtractorService } from "./document-text-extractor.service";

export interface VerifiedExpedienteRef {
  id: string;
  caratula: string;
  numeroExpediente: string;
  juzgado: string;
  jurisdiccion: string;
  fuero: string | null;
  estado: string;
  partesCount: number;
}

export interface VerifiedMovimientoRef {
  id: string;
  tipo: string;
  titulo: string;
  fechaActuacion: string;
}

export interface VerifiedVencimientoRef {
  id: string;
  titulo: string;
  tipo: string;
  fechaLimite: string;
  prioridad: string;
  estado: string;
}

export interface VerifiedDocumentRef {
  id: string;
  title: string;
  category: string;
  versionNumber: number;
  textExtracted: boolean;
}

export interface VerifiedContextReferences {
  expediente: VerifiedExpedienteRef | null;
  movimientos: VerifiedMovimientoRef[];
  vencimientos?: VerifiedVencimientoRef[];
  documents: VerifiedDocumentRef[];
  hasAuthorizedNotes?: boolean;
  maxContextChars?: number;
  limitations: string[];
  usedGeneralKnowledge: boolean;
  validSourceIds: string[];
}

export interface BuiltAssistantContext {
  contextPromptBlock: string;
  references: VerifiedContextReferences;
  truncatedSources: string[];
}

@Injectable()
export class LegalAiContextService {
  private readonly maxContextChars: number;

  constructor(
    private readonly scopedPrisma: ScopedPrismaService,
    private readonly configService: ConfigService,
    private readonly textExtractor: DocumentTextExtractorService,
  ) {
    const rawMax = Number(
      this.configService.get<string>("LEGAL_AI_MAX_CONTEXT_CHARS") || 24000,
    );
    this.maxContextChars =
      Number.isFinite(rawMax) && rawMax >= 2000 ? rawMax : 24000;
  }

  /**
   * Recupera EXCLUSIVAMENTE contexto autorizado dentro de ctx.organizationId:
   * - Expediente activo (si la conversación tiene causa seleccionada), partes,
   *   movimientos procesales NO anulados y notas internas autorizadas.
   * - Documentos AUTH-08 expresamente seleccionados y activos en el tenant.
   * Envuelve todo dato no confiable en delimitadores explícitos anti-prompt-injection.
   */
  async buildAuthorizedContext(
    ctx: ActiveOrgContext,
    params: {
      expedienteId?: string | null;
      documentIds?: string[];
      includeVencimientos?: boolean;
    },
  ): Promise<BuiltAssistantContext> {
    const limitations: string[] = [];
    const truncatedSources: string[] = [];
    const validSourceIds: string[] = [];

    const dbData = await this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      let expediente: {
        id: string;
        caratula: string;
        numeroExpediente: string;
        juzgado: string;
        jurisdiccion: string;
        fuero: string | null;
        estado: string;
        descripcion: string | null;
        partes: Array<{
          nombre: string;
          rol: string;
          tipoParte: string;
          caracter: string | null;
          esCliente: boolean;
        }>;
      } | null = null;

      let movimientos: Array<{
        id: string;
        tipo: string;
        titulo: string;
        descripcion: string | null;
        fechaActuacion: Date;
        referencia: string | null;
      }> = [];

      let vencimientos: Array<{
        id: string;
        titulo: string;
        tipo: string;
        fechaLimite: Date;
        prioridad: string;
        estado: string;
      }> = [];

      if (params.expedienteId) {
        expediente = await tx.expediente.findFirst({
          where: {
            id: params.expedienteId,
            organizationId: ctx.organizationId,
          },
          select: {
            id: true,
            caratula: true,
            numeroExpediente: true,
            juzgado: true,
            jurisdiccion: true,
            fuero: true,
            estado: true,
            descripcion: ctx.orgRole !== OrganizationRole.STAFF,
            partes: {
              select: {
                nombre: true,
                rol: true,
                tipoParte: true,
                caracter: true,
                esCliente: true,
              },
              take: 30,
            },
          },
        });

        if (!expediente) {
          throw new NotFoundException("Expediente no encontrado");
        }

        movimientos = await tx.movimientoProcesal.findMany({
          where: {
            expedienteId: expediente.id,
            organizationId: ctx.organizationId,
            anuladoAt: null,
          },
          orderBy: { fechaActuacion: "desc" },
          take: 25,
          select: {
            id: true,
            tipo: true,
            titulo: true,
            descripcion: true,
            fechaActuacion: true,
            referencia: true,
          },
        });

        if (params.includeVencimientos) {
          vencimientos = await tx.vencimiento.findMany({
            where: {
              expedienteId: expediente.id,
              organizationId: ctx.organizationId,
              estado: { not: EstadoVencimiento.CANCELADO },
            },
            orderBy: { fechaLimite: "asc" },
            take: 20,
            select: {
              id: true,
              titulo: true,
              tipo: true,
              fechaLimite: true,
              prioridad: true,
              estado: true,
            },
          });
        }
      }

      const uniqueDocIds = Array.from(new Set(params.documentIds || []));
      let documents: Array<{
        id: string;
        title: string;
        category: string;
        description: string | null;
        currentVersionNumber: number;
      }> = [];

      if (uniqueDocIds.length > 0) {
        if (ctx.orgRole === OrganizationRole.STAFF) {
          throw new NotFoundException("Documentos no autorizados");
        }
        documents = await tx.document.findMany({
          where: {
            id: { in: uniqueDocIds },
            organizationId: ctx.organizationId,
            status: DocumentStatus.ACTIVE,
          },
          select: {
            id: true,
            title: true,
            category: true,
            description: true,
            currentVersionNumber: true,
          },
        });

        if (documents.length !== uniqueDocIds.length) {
          throw new NotFoundException(
            "Uno o más documentos seleccionados no existen o no pertenecen a la organización activa",
          );
        }
      }

      return { expediente, movimientos, vencimientos, documents };
    });

    const blocks: string[] = [];
    let currentBudget = this.maxContextChars;

    const appendWithinBudget = (label: string, text: string): boolean => {
      if (currentBudget <= 200) {
        limitations.push(
          `Fuente "${label}" excluida por límite máximo de contexto (${this.maxContextChars} caracteres).`,
        );
        truncatedSources.push(label);
        return false;
      }
      if (text.length <= currentBudget) {
        blocks.push(text);
        currentBudget -= text.length;
        return true;
      }
      blocks.push(
        `${text.slice(0, currentBudget)}\n[CONTENIDO ACOTADO POR LÍMITE DE CONTEXTO]`,
      );
      limitations.push(
        `Fuente "${label}" acotada parcialmente por límite máximo de contexto.`,
      );
      truncatedSources.push(label);
      currentBudget = 0;
      return true;
    };

    let expedienteRef: VerifiedExpedienteRef | null = null;
    const movimientoRefs: VerifiedMovimientoRef[] = [];
    const vencimientoRefs: VerifiedVencimientoRef[] = [];
    const documentRefs: VerifiedDocumentRef[] = [];
    let hasAuthorizedNotes = false;

    if (dbData.expediente) {
      const exp = dbData.expediente;
      expedienteRef = {
        id: exp.id,
        caratula: exp.caratula,
        numeroExpediente: exp.numeroExpediente,
        juzgado: exp.juzgado,
        jurisdiccion: exp.jurisdiccion,
        fuero: exp.fuero,
        estado: exp.estado,
        partesCount: exp.partes.length,
      };
      validSourceIds.push(exp.id);

      const expBlock = [
        `<UNTRUSTED_CASE_DATA sourceId="${exp.id}">`,
        `Expediente: ${exp.caratula}`,
        `Número: ${exp.numeroExpediente}`,
        `Tribunal: ${exp.juzgado} | Jurisdicción: ${exp.jurisdiccion} | Fuero: ${exp.fuero || "No informado"} | Estado: ${exp.estado}`,
        `Partes registradas (${exp.partes.length}): ${
          exp.partes.map((p) => `${p.nombre} [${p.rol}]`).join("; ") ||
          "Sin partes registradas"
        }`,
        `</UNTRUSTED_CASE_DATA>`,
      ].join("\n");
      appendWithinBudget("Expediente", expBlock);

      if (dbData.movimientos.length > 0) {
        const movLines: string[] = [];
        for (const m of dbData.movimientos) {
          const isoDate = m.fechaActuacion.toISOString().slice(0, 10);
          movimientoRefs.push({
            id: m.id,
            tipo: m.tipo,
            titulo: m.titulo,
            fechaActuacion: isoDate,
          });
          validSourceIds.push(m.id);
          movLines.push(
            `- [${isoDate}] (id=${m.id}, ${m.tipo}) ${m.titulo}${m.descripcion ? `: ${m.descripcion.slice(0, 350)}` : ""}`,
          );
        }
        appendWithinBudget(
          "Movimientos procesales",
          `<UNTRUSTED_MOVEMENTS_DATA>\n${movLines.join("\n")}\n</UNTRUSTED_MOVEMENTS_DATA>`,
        );
      }

      if (dbData.vencimientos.length > 0) {
        const vencLines: string[] = [];
        for (const v of dbData.vencimientos) {
          const isoDate = v.fechaLimite.toISOString().slice(0, 10);
          vencimientoRefs.push({
            id: v.id,
            titulo: v.titulo,
            tipo: v.tipo,
            fechaLimite: isoDate,
            prioridad: v.prioridad,
            estado: v.estado,
          });
          validSourceIds.push(v.id);
          vencLines.push(
            `- [${isoDate}] (id=${v.id}, ${v.tipo}, prioridad=${v.prioridad}, estado=${v.estado}) ${v.titulo}`,
          );
        }
        appendWithinBudget(
          "Vencimientos registrados manualmente",
          `<UNTRUSTED_DEADLINES_DATA note="Fechas registradas manualmente. NO calcular plazos automáticos ni afirmar vencimiento sin verificación.">\n${vencLines.join("\n")}\n</UNTRUSTED_DEADLINES_DATA>`,
        );
      }

      if (exp.descripcion?.trim()) {
        hasAuthorizedNotes = true;
        appendWithinBudget(
          "Notas internas del expediente",
          `<UNTRUSTED_INTERNAL_NOTES>\n${exp.descripcion.trim().slice(0, 3000)}\n</UNTRUSTED_INTERNAL_NOTES>`,
        );
      }
    } else {
      blocks.push(
        "MODO SIN CAUSA: No existe expediente seleccionado. No asumas ni inventes datos de ninguna causa.",
      );
    }

    // Extracción textual segura de documentos AUTH-08 seleccionados
    for (const doc of dbData.documents) {
      validSourceIds.push(doc.id);
      const extraction = await this.textExtractor.extractAuthorizedText(
        doc.id,
        ctx,
        Math.min(5000, Math.max(1000, currentBudget - 500)),
      );
      if (extraction.limitation) {
        limitations.push(extraction.limitation);
      }
      if (extraction.truncated) {
        truncatedSources.push(`Documento:${doc.title}`);
      }

      documentRefs.push({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        versionNumber: doc.currentVersionNumber,
        textExtracted: Boolean(extraction.extractedText),
      });

      const docBlock = [
        `<UNTRUSTED_DOCUMENT_DATA sourceId="${doc.id}" title="${doc.title}" version="v${doc.currentVersionNumber}" category="${doc.category}">`,
        doc.description ? `Descripción: ${doc.description.slice(0, 400)}` : "",
        extraction.extractedText
          ? `Contenido textual extraído:\n${extraction.extractedText}`
          : "Contenido textual no extraíble localmente (usar solo metadatos registrados).",
        `</UNTRUSTED_DOCUMENT_DATA>`,
      ]
        .filter(Boolean)
        .join("\n");

      appendWithinBudget(`Documento: ${doc.title}`, docBlock);
    }

    return {
      contextPromptBlock: blocks.join("\n\n"),
      references: {
        expediente: expedienteRef,
        movimientos: movimientoRefs,
        ...(params.includeVencimientos
          ? {
              vencimientos: vencimientoRefs,
              hasAuthorizedNotes,
              maxContextChars: this.maxContextChars,
            }
          : {}),
        documents: documentRefs,
        limitations,
        usedGeneralKnowledge: false,
        validSourceIds,
      },
      truncatedSources,
    };
  }
}
