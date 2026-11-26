import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import * as crypto from "crypto";
import { ScopedPrismaService } from "../authz/scoped-prisma.service";
import { ActiveOrgContext } from "../authz/guards/active-org-context.guard";
import {
  buildCanonicalStoragePath,
  DOCUMENTO_SELECT_BY_ROLE,
  DOCUMENT_VERSION_SELECT_BY_ROLE,
} from "../authz/permissions";

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private readonly scopedPrisma: ScopedPrismaService) {}

  /**
   * Crea una nueva versión de documento dentro de la organización activa.
   * Genera storagePath canónico orgs/{orgId}/expedientes/{expId}/documents/{docId}/v{n}/{uuid}
   * y nunca retorna storagePath al cliente.
   */
  async uploadVersion(
    documentId: string,
    fileData: {
      originalName: string;
      size: number;
      mimetype: string;
      buffer?: Buffer;
    },
    ctx: ActiveOrgContext,
  ) {
    const versionSelect = DOCUMENT_VERSION_SELECT_BY_ROLE[ctx.orgRole];
    if (!versionSelect) {
      throw new ForbiddenException("Role cannot access documents");
    }

    const version = await this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const document = await tx.documento.findFirst({
        where: {
          id: documentId,
          organizationId: ctx.organizationId,
        },
        include: {
          versions: {
            where: { organizationId: ctx.organizationId },
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
        },
      });

      if (!document) {
        throw new NotFoundException("Document not found");
      }
      if (document.isLocked) {
        throw new BadRequestException("Document is locked (WORM compliant)");
      }

      const hash = fileData.buffer
        ? crypto.createHash("sha256").update(fileData.buffer).digest("hex")
        : crypto
            .createHash("sha256")
            .update(`${ctx.organizationId}:${documentId}:${Date.now()}`)
            .digest("hex");

      const lastVersion = document.versions[0];
      const newVersionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;

      const canonicalStoragePath = buildCanonicalStoragePath({
        organizationId: ctx.organizationId,
        expedienteId: document.expedienteId,
        documentId,
        versionNumber: newVersionNumber,
      });

      const createdVersion = await tx.documentVersion.create({
        data: {
          documentId,
          organizationId: ctx.organizationId,
          versionNumber: newVersionNumber,
          storagePath: canonicalStoragePath,
          fileName: fileData.originalName,
          mimeType: fileData.mimetype,
          fileSize: fileData.size,
          hashSha256: hash,
          uploadedBy: ctx.userId,
        },
        select: versionSelect,
      });

      await tx.documento.updateMany({
        where: {
          id: documentId,
          organizationId: ctx.organizationId,
        },
        data: {
          hashSha256: hash,
          fileName: fileData.originalName,
          fileSize: fileData.size,
        },
      });

      return createdVersion;
    });

    this.triggerOCR(ctx.organizationId, version.id);
    return version;
  }

  /**
   * Programa el procesamiento OCR propagando explícitamente organizationId.
   */
  triggerOCR(organizationId: string, versionId: string) {
    const timer = setTimeout(() => {
      this.processOCR(organizationId, versionId).catch((err) => {
        this.logger.error(
          `OCR processing failed for version ${versionId}`,
          err,
        );
      });
    }, 50);
    // No impedir el cierre limpio del proceso/tests
    if (typeof timer.unref === "function") {
      timer.unref();
    }
  }

  /**
   * Ejecuta la actualización OCR dentro de ScopedPrismaService (RLS + filtro organizationId).
   */
  async processOCR(
    organizationId: string,
    versionId: string,
  ): Promise<{ updatedCount: number }> {
    this.logger.log(`Processing OCR for version ${versionId}...`);
    return this.scopedPrisma.runInOrgContext({ organizationId }, async (tx) => {
      const res = await tx.documentVersion.updateMany({
        where: {
          id: versionId,
          organizationId,
        },
        data: {
          ocrContent: "Contenido extraído mediante OCR simulado...",
        },
      });
      return { updatedCount: res.count };
    });
  }

  /**
   * Toggle Legal Hold (Litigation Hold) — requiere documents:sensitive y valida pertenencia a org activa.
   */
  async setLegalHold(
    documentId: string,
    status: boolean,
    reason: string | undefined,
    ctx: ActiveOrgContext,
  ) {
    const docSelect = DOCUMENTO_SELECT_BY_ROLE[ctx.orgRole];
    if (!docSelect) {
      throw new ForbiddenException("Role cannot access documents");
    }

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const updated = await tx.documento.updateMany({
        where: {
          id: documentId,
          organizationId: ctx.organizationId,
        },
        data: {
          legalHold: status,
          legalHoldReason: status ? (reason ?? null) : null,
        },
      });

      if (updated.count === 0) {
        throw new NotFoundException("Document not found");
      }

      const doc = await tx.documento.findFirst({
        where: {
          id: documentId,
          organizationId: ctx.organizationId,
        },
        select: docSelect,
      });
      if (!doc) {
        throw new NotFoundException("Document not found");
      }
      return doc;
    });
  }

  /**
   * Compara dos versiones validando que ambas pertenezcan a la organización activa.
   */
  async compareVersions(v1Id: string, v2Id: string, ctx: ActiveOrgContext) {
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const [v1, v2] = await Promise.all([
        tx.documentVersion.findFirst({
          where: { id: v1Id, organizationId: ctx.organizationId },
          select: {
            id: true,
            hashSha256: true,
            fileSize: true,
            ocrContent: true,
          },
        }),
        tx.documentVersion.findFirst({
          where: { id: v2Id, organizationId: ctx.organizationId },
          select: {
            id: true,
            hashSha256: true,
            fileSize: true,
            ocrContent: true,
          },
        }),
      ]);

      if (!v1 || !v2) {
        throw new NotFoundException("Versions not found");
      }

      if (v1.ocrContent && v2.ocrContent) {
        return {
          identical: v1.hashSha256 === v2.hashSha256,
          v1Size: v1.fileSize,
          v2Size: v2.fileSize,
          diffSummary:
            v1.hashSha256 === v2.hashSha256
              ? "Identical content"
              : "Content modified",
        };
      }

      return { message: "OCR content not available for comparison" };
    });
  }
}
