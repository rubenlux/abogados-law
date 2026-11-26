import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { LegalSearchService } from "../legal/legal-search.service";
import { JurisprudenceSearchService } from "../jurisprudence/jurisprudence-search.service";
import { ScopedPrismaService } from "../../authz/scoped-prisma.service";
import { ActiveOrgContext } from "../../authz/guards/active-org-context.guard";

@Injectable()
export class ChatContextService {
  private readonly logger = new Logger(ChatContextService.name);

  constructor(
    private readonly scopedPrisma: ScopedPrismaService,
    private readonly legalSearch: LegalSearchService,
    private readonly jurisprudenceSearch: JurisprudenceSearchService,
  ) {}

  async buildContext(
    expedienteId: string,
    query: string,
    historySummary: string | null,
    ctx: ActiveOrgContext,
  ): Promise<string> {
    let expedienteInfo = "";

    if (expedienteId === "general-workspace-user") {
      expedienteInfo = `
[CONTEXTO GENERAL]
Este es un chat de asistencia legal general.
No estás analizando un expediente específico en este momento.
`.trim();
    } else {
      const expediente = await this.scopedPrisma.runInOrgContext(ctx, (tx) =>
        tx.expediente.findFirst({
          where: { id: expedienteId, organizationId: ctx.organizationId },
          select: {
            caratula: true,
            numeroExpediente: true,
            jurisdiccion: true,
            juzgado: true,
            estado: true,
          },
        }),
      );

      if (!expediente) {
        throw new NotFoundException(`Expediente ${expedienteId} no encontrado`);
      }

      expedienteInfo = `
[EXPEDIENTE ACTUAL]
Carátula: ${expediente.caratula}
Número: ${expediente.numeroExpediente}
Jurisdicción: ${expediente.jurisdiccion}
Juzgado: ${expediente.juzgado}
Estado: ${expediente.estado}
`.trim();
    }

    let leyesInfo = "";
    try {
      if (query.length > 5) {
        const leyes = await this.legalSearch.search({
          query,
          limit: 2,
          threshold: 0.7,
        });
        if (leyes.length > 0) {
          leyesInfo =
            `\n[LEYES SUGERIDAS]\n` +
            leyes
              .map(
                (l) =>
                  `- ${l.nombre} Art. ${l.articulo} (${l.metadata.estado}): ${l.textoCompleto.substring(0, 300)}...`,
              )
              .join("\n");
        }
      }
    } catch (error) {
      this.logger.warn(`Error buscando leyes: ${error.message}`);
    }

    let jurisprudenceInfo = "";
    try {
      if (query.length > 5) {
        const searchResult: any = await this.jurisprudenceSearch.search({
          query,
          limit: 2,
          threshold: 0.7,
        });
        const fallos = searchResult.results || [];

        if (fallos.length > 0) {
          jurisprudenceInfo =
            `\n[JURISPRUDENCIA SUGERIDA]\n` +
            fallos
              .map((f: any) => {
                const score = f.precedent_score
                  ? `[Score: ${f.precedent_score}]`
                  : "";
                return `- ${f.caratula} (${f.tribunal}, ${new Date(f.fecha).getFullYear()}) ${score}: ${f.resumen ? f.resumen.substring(0, 300) : ""}...`;
              })
              .join("\n");
        }
      }
    } catch (error) {
      this.logger.warn(`Error buscando jurisprudencia: ${error.message}`);
    }

    const memInfo = historySummary
      ? `\n[RESUMEN CONVERSACIÓN PREVIA]\n${historySummary}`
      : "";

    return `${expedienteInfo}\n${leyesInfo}\n${jurisprudenceInfo}\n${memInfo}`;
  }
}
