import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DocumentCategory, DocumentStatus, Prisma } from "@prisma/client";
import * as crypto from "crypto";
import { ScopedPrismaService } from "../authz/scoped-prisma.service";
import { OrgAuditService } from "../organizations/org-audit.service";
import { ActiveOrgContext } from "../authz/guards/active-org-context.guard";
import {
  DOCUMENT_FILE_VERSION_SELECT_BY_ROLE,
  DOCUMENT_SELECT_BY_ROLE,
} from "../authz/permissions";
import {
  DocumentStorageService,
  NoOpDocumentMalwareScanner,
} from "./document-storage.service";
import {
  buildSafeContentDisposition,
  inspectAndValidateUploadedFile,
} from "./file-signature.util";
import {
  CreateDocumentDto,
  QueryDocumentDto,
  UpdateDocumentMetadataDto,
  UploadDocumentVersionDto,
} from "./dto/document.dto";

export interface UploadedDiskFile {
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}

@Injectable()
export class DocumentsManagementService {
  constructor(
    private readonly scopedPrisma: ScopedPrismaService,
    private readonly auditService: OrgAuditService,
    private readonly storage: DocumentStorageService,
    private readonly malwareScanner: NoOpDocumentMalwareScanner,
  ) {}

  private async validateAssociations(
    tx: Prisma.TransactionClient,
    organizationId: string,
    refs: {
      expedienteId?: string | null;
      clientId?: string | null;
      movimientoProcesalId?: string | null;
    },
  ): Promise<void> {
    if (refs.expedienteId) {
      const exp = await tx.expediente.findFirst({
        where: { id: refs.expedienteId, organizationId },
        select: { id: true },
      });
      if (!exp) {
        throw new NotFoundException("Expediente no encontrado");
      }
    }

    if (refs.clientId) {
      const cli = await tx.client.findFirst({
        where: { id: refs.clientId, organizationId },
        select: { id: true },
      });
      if (!cli) {
        throw new NotFoundException("Cliente no encontrado");
      }
    }

    if (refs.movimientoProcesalId) {
      const mov = await tx.movimientoProcesal.findFirst({
        where: { id: refs.movimientoProcesalId, organizationId },
        select: { id: true, expedienteId: true },
      });
      if (!mov) {
        throw new NotFoundException("Movimiento procesal no encontrado");
      }
      if (refs.expedienteId && mov.expedienteId !== refs.expedienteId) {
        throw new BadRequestException(
          "El movimiento procesal indicado no pertenece al expediente especificado",
        );
      }
    }
  }

  /**
   * Flujo coordinado seguro:
   * 1. Validar archivo (magic bytes, extensión, tamaño, escaneo).
   * 2. Validar asociaciones dentro del tenant.
   * 3. Calcular SHA-256 en backend.
   * 4. Promover a almacenamiento privado exclusivo (wx).
   * 5. Persistir Document + DocumentFileVersion (v1) + AuditLog atómicamente.
   * 6. Compensar eliminando objeto promovido si falla PostgreSQL/auditoría; limpiar .tmp siempre.
   */
  async createWithFile(
    dto: CreateDocumentDto,
    file: UploadedDiskFile | undefined,
    ctx: ActiveOrgContext,
  ) {
    if (!file) {
      throw new BadRequestException("Debe adjuntar un archivo válido");
    }

    const docSelect = DOCUMENT_SELECT_BY_ROLE[ctx.orgRole];
    let promotedStorageKey: string | null = null;

    try {
      const validated = await inspectAndValidateUploadedFile(
        file.path,
        file.originalname,
        file.size,
      );

      const scanResult = await this.malwareScanner.scanFile(file.path);
      if (!scanResult.clean) {
        throw new BadRequestException(
          scanResult.reason || "Archivo rechazado por política de seguridad",
        );
      }

      const sha256 = await this.storage.computeFileSha256(file.path);
      const docId = crypto.randomUUID();
      const storageKey = this.storage.buildStorageKey(
        ctx.organizationId,
        docId,
        1,
      );

      // Verificar asociaciones antes de promover archivo al storage definitivo
      await this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
        await this.validateAssociations(tx, ctx.organizationId, {
          expedienteId: dto.expedienteId,
          clientId: dto.clientId,
          movimientoProcesalId: dto.movimientoProcesalId,
        });
      });

      await this.storage.promoteTempFile(file.path, storageKey);
      promotedStorageKey = storageKey;

      const created = await this.scopedPrisma.runInOrgContext(
        ctx,
        async (tx) => {
          const doc = await tx.document.create({
            data: {
              id: docId,
              organization: { connect: { id: ctx.organizationId } },
              createdBy: { connect: { id: ctx.userId } },
              ...(dto.expedienteId
                ? { expediente: { connect: { id: dto.expedienteId } } }
                : {}),
              ...(dto.clientId
                ? { client: { connect: { id: dto.clientId } } }
                : {}),
              ...(dto.movimientoProcesalId
                ? {
                    movimientoProcesal: {
                      connect: { id: dto.movimientoProcesalId },
                    },
                  }
                : {}),
              title: dto.title.trim(),
              description: dto.description?.trim() || null,
              category: dto.category ?? DocumentCategory.OTRO,
              documentDate: dto.documentDate
                ? new Date(dto.documentDate)
                : null,
              status: DocumentStatus.ACTIVE,
              currentVersionNumber: 1,
              versions: {
                create: {
                  organization: { connect: { id: ctx.organizationId } },
                  uploadedBy: { connect: { id: ctx.userId } },
                  versionNumber: 1,
                  originalFilename: validated.originalFilename,
                  storageKey,
                  mimeType: validated.detectedMimeType,
                  sizeBytes: file.size,
                  sha256,
                  changeNote: dto.changeNote?.trim() || null,
                },
              },
            },
            select: docSelect,
          });

          await this.auditService.record(
            {
              actorId: ctx.userId,
              organizationId: ctx.organizationId,
              action: "DOCUMENT_CREATED",
              result: "SUCCESS",
              entityTable: "Document",
              entityId: docId,
              newValues: {
                title: dto.title.trim(),
                category: dto.category ?? DocumentCategory.OTRO,
                versionNumber: 1,
                mimeType: validated.detectedMimeType,
                sizeBytes: file.size,
                sha256,
              },
              correlationId: ctx.correlationId,
            },
            tx,
          );

          return doc;
        },
      );

      // Transacción confirmada: desactivar compensación
      promotedStorageKey = null;
      return created;
    } catch (err) {
      if (promotedStorageKey) {
        await this.storage.deletePromotedObject(promotedStorageKey);
      }
      throw err;
    } finally {
      await this.storage.removeTempFile(file.path);
    }
  }

  async uploadNewVersion(
    documentId: string,
    dto: UploadDocumentVersionDto,
    file: UploadedDiskFile | undefined,
    ctx: ActiveOrgContext,
  ) {
    if (!file) {
      throw new BadRequestException("Debe adjuntar un archivo válido");
    }

    const versionSelect = DOCUMENT_FILE_VERSION_SELECT_BY_ROLE[ctx.orgRole];
    if (!versionSelect) {
      await this.storage.removeTempFile(file.path);
      throw new ForbiddenException("El rol actual no puede cargar versiones");
    }

    let promotedStorageKey: string | null = null;

    try {
      const validated = await inspectAndValidateUploadedFile(
        file.path,
        file.originalname,
        file.size,
      );

      const scanResult = await this.malwareScanner.scanFile(file.path);
      if (!scanResult.clean) {
        throw new BadRequestException(
          scanResult.reason || "Archivo rechazado por política de seguridad",
        );
      }

      const sha256 = await this.storage.computeFileSha256(file.path);

      // Validar existencia y estado ACTIVE antes de promover archivo
      const nextVersionNumber = await this.scopedPrisma.runInOrgContext(
        ctx,
        async (tx) => {
          const existing = await tx.document.findFirst({
            where: { id: documentId, organizationId: ctx.organizationId },
            select: { id: true, status: true, currentVersionNumber: true },
          });
          if (!existing) {
            throw new NotFoundException("Documento no encontrado");
          }
          if (existing.status === DocumentStatus.ARCHIVED) {
            throw new ConflictException(
              "No se pueden cargar nuevas versiones en un documento archivado",
            );
          }
          return existing.currentVersionNumber + 1;
        },
      );

      const storageKey = this.storage.buildStorageKey(
        ctx.organizationId,
        documentId,
        nextVersionNumber,
      );
      await this.storage.promoteTempFile(file.path, storageKey);
      promotedStorageKey = storageKey;

      const createdVersion = await this.scopedPrisma.runInOrgContext(
        ctx,
        async (tx) => {
          const version = await tx.documentFileVersion.create({
            data: {
              organization: { connect: { id: ctx.organizationId } },
              document: { connect: { id: documentId } },
              uploadedBy: { connect: { id: ctx.userId } },
              versionNumber: nextVersionNumber,
              originalFilename: validated.originalFilename,
              storageKey,
              mimeType: validated.detectedMimeType,
              sizeBytes: file.size,
              sha256,
              changeNote: dto?.changeNote?.trim() || null,
            },
            select: versionSelect,
          });

          await tx.document.update({
            where: { id: documentId },
            data: { currentVersionNumber: nextVersionNumber },
          });

          await this.auditService.record(
            {
              actorId: ctx.userId,
              organizationId: ctx.organizationId,
              action: "DOCUMENT_VERSION_UPLOADED",
              result: "SUCCESS",
              entityTable: "Document",
              entityId: documentId,
              newValues: {
                versionId: (version as any).id,
                versionNumber: nextVersionNumber,
                mimeType: validated.detectedMimeType,
                sizeBytes: file.size,
                sha256,
              },
              correlationId: ctx.correlationId,
            },
            tx,
          );

          return version;
        },
      );

      promotedStorageKey = null;
      return createdVersion;
    } catch (err) {
      if (promotedStorageKey) {
        await this.storage.deletePromotedObject(promotedStorageKey);
      }
      throw err;
    } finally {
      await this.storage.removeTempFile(file.path);
    }
  }

  async findAll(query: QueryDocumentDto, ctx: ActiveOrgContext) {
    const select = DOCUMENT_SELECT_BY_ROLE[ctx.orgRole];
    const page = Math.max(1, query?.page || 1);
    const limit = Math.min(100, Math.max(1, query?.limit || 20));
    const skip = (page - 1) * limit;

    const fromDate = query?.from ? new Date(query.from) : undefined;
    const toDate = query?.to ? new Date(query.to) : undefined;
    if (
      (fromDate && Number.isNaN(fromDate.getTime())) ||
      (toDate && Number.isNaN(toDate.getTime()))
    ) {
      throw new BadRequestException("Rango de fechas inválido");
    }
    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException(
        "El parámetro 'from' no puede ser posterior a 'to'",
      );
    }

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const where: Prisma.DocumentWhereInput = {
        organizationId: ctx.organizationId,
        status: query?.status ?? DocumentStatus.ACTIVE,
      };

      if (query?.expedienteId) where.expedienteId = query.expedienteId;
      if (query?.clientId) where.clientId = query.clientId;
      if (query?.movimientoProcesalId) {
        where.movimientoProcesalId = query.movimientoProcesalId;
      }
      if (query?.category) where.category = query.category;

      if (fromDate || toDate) {
        where.createdAt = {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        };
      }

      if (query?.search?.trim()) {
        const s = query.search.trim();
        where.OR = [
          { title: { contains: s, mode: "insensitive" } },
          { description: { contains: s, mode: "insensitive" } },
        ];
      }

      const [total, data] = await Promise.all([
        tx.document.count({ where }),
        tx.document.findMany({
          where,
          select,
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          skip,
          take: limit,
        }),
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    });
  }

  async findById(id: string, ctx: ActiveOrgContext) {
    const select = DOCUMENT_SELECT_BY_ROLE[ctx.orgRole];
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const doc = await tx.document.findFirst({
        where: { id, organizationId: ctx.organizationId },
        select,
      });

      if (!doc) {
        throw new NotFoundException("Documento no encontrado");
      }

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "DOCUMENT_VIEWED",
          result: "SUCCESS",
          entityTable: "Document",
          entityId: id,
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return doc;
    });
  }

  async listVersions(documentId: string, ctx: ActiveOrgContext) {
    const versionSelect = DOCUMENT_FILE_VERSION_SELECT_BY_ROLE[ctx.orgRole];
    if (!versionSelect) {
      throw new ForbiddenException(
        "El rol actual no tiene acceso al historial de versiones",
      );
    }

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const doc = await tx.document.findFirst({
        where: { id: documentId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!doc) {
        throw new NotFoundException("Documento no encontrado");
      }

      return tx.documentFileVersion.findMany({
        where: { documentId: doc.id, organizationId: ctx.organizationId },
        select: versionSelect,
        orderBy: { versionNumber: "desc" },
      });
    });
  }

  async findVersionById(
    documentId: string,
    versionId: string,
    ctx: ActiveOrgContext,
  ) {
    const versionSelect = DOCUMENT_FILE_VERSION_SELECT_BY_ROLE[ctx.orgRole];
    if (!versionSelect) {
      throw new ForbiddenException(
        "El rol actual no tiene acceso al historial de versiones",
      );
    }

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const version = await tx.documentFileVersion.findFirst({
        where: {
          id: versionId,
          documentId,
          organizationId: ctx.organizationId,
        },
        select: versionSelect,
      });

      if (!version) {
        throw new NotFoundException("Versión documental no encontrada");
      }

      return version;
    });
  }

  async prepareDownload(
    documentId: string,
    versionId: string | null,
    ctx: ActiveOrgContext,
  ) {
    const version = await this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const doc = await tx.document.findFirst({
        where: { id: documentId, organizationId: ctx.organizationId },
        select: { id: true, status: true, currentVersionNumber: true },
      });

      if (!doc) {
        throw new NotFoundException("Documento no encontrado");
      }
      if (doc.status === DocumentStatus.ARCHIVED) {
        throw new ConflictException(
          "El documento se encuentra archivado; restaure antes de descargar",
        );
      }

      const targetVersion = versionId
        ? await tx.documentFileVersion.findFirst({
            where: {
              id: versionId,
              documentId: doc.id,
              organizationId: ctx.organizationId,
            },
          })
        : await tx.documentFileVersion.findFirst({
            where: {
              documentId: doc.id,
              organizationId: ctx.organizationId,
              versionNumber: doc.currentVersionNumber,
            },
          });

      if (!targetVersion) {
        throw new NotFoundException("Versión documental no encontrada");
      }

      return targetVersion;
    });

    // Verificar existencia + integridad SHA-256 en disco ANTES de auditar/entregar
    const stream = await this.storage.verifyAndOpenReadStream(
      version.storageKey,
      version.sha256,
    );

    await this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "DOCUMENT_DOWNLOADED",
          result: "SUCCESS",
          entityTable: "Document",
          entityId: documentId,
          newValues: {
            versionId: version.id,
            versionNumber: version.versionNumber,
            sha256: version.sha256,
          },
          correlationId: ctx.correlationId,
        },
        tx,
      );
    });

    return {
      stream,
      mimeType: version.mimeType,
      sizeBytes: version.sizeBytes,
      contentDisposition: buildSafeContentDisposition(version.originalFilename),
    };
  }

  async updateMetadata(
    id: string,
    dto: UpdateDocumentMetadataDto,
    ctx: ActiveOrgContext,
  ) {
    const select = DOCUMENT_SELECT_BY_ROLE[ctx.orgRole];

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const existing = await tx.document.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new NotFoundException("Documento no encontrado");
      }

      const nextExpedienteId =
        dto.expedienteId !== undefined
          ? dto.expedienteId
          : existing.expedienteId;
      const nextClientId =
        dto.clientId !== undefined ? dto.clientId : existing.clientId;
      const nextMovId =
        dto.movimientoProcesalId !== undefined
          ? dto.movimientoProcesalId
          : existing.movimientoProcesalId;

      await this.validateAssociations(tx, ctx.organizationId, {
        expedienteId: nextExpedienteId,
        clientId: nextClientId,
        movimientoProcesalId: nextMovId,
      });

      const data: Prisma.DocumentUpdateInput = {};
      if (dto.title !== undefined) data.title = dto.title.trim();
      if (dto.description !== undefined)
        data.description = dto.description ? dto.description.trim() : null;
      if (dto.category !== undefined) data.category = dto.category;
      if (dto.documentDate !== undefined) {
        data.documentDate = dto.documentDate
          ? new Date(dto.documentDate)
          : null;
      }
      if (dto.expedienteId !== undefined) {
        data.expediente = dto.expedienteId
          ? { connect: { id: dto.expedienteId } }
          : { disconnect: true };
      }
      if (dto.clientId !== undefined) {
        data.client = dto.clientId
          ? { connect: { id: dto.clientId } }
          : { disconnect: true };
      }
      if (dto.movimientoProcesalId !== undefined) {
        data.movimientoProcesal = dto.movimientoProcesalId
          ? { connect: { id: dto.movimientoProcesalId } }
          : { disconnect: true };
      }

      const updated = await tx.document.update({
        where: { id: existing.id },
        data,
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "DOCUMENT_METADATA_UPDATED",
          result: "SUCCESS",
          entityTable: "Document",
          entityId: existing.id,
          oldValues: {
            title: existing.title,
            category: existing.category,
          },
          newValues: {
            title: (updated as any).title,
            category: (updated as any).category,
          },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return updated;
    });
  }

  async archive(id: string, ctx: ActiveOrgContext) {
    const select = DOCUMENT_SELECT_BY_ROLE[ctx.orgRole];
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const existing = await tx.document.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new NotFoundException("Documento no encontrado");
      }

      const archived = await tx.document.update({
        where: { id: existing.id },
        data: {
          status: DocumentStatus.ARCHIVED,
          archivedAt: new Date(),
          archivedBy: { connect: { id: ctx.userId } },
        },
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "DOCUMENT_ARCHIVED",
          result: "SUCCESS",
          entityTable: "Document",
          entityId: existing.id,
          oldValues: { status: existing.status },
          newValues: { status: DocumentStatus.ARCHIVED },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return archived;
    });
  }

  async restore(id: string, ctx: ActiveOrgContext) {
    const select = DOCUMENT_SELECT_BY_ROLE[ctx.orgRole];
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const existing = await tx.document.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new NotFoundException("Documento no encontrado");
      }

      const restored = await tx.document.update({
        where: { id: existing.id },
        data: {
          status: DocumentStatus.ACTIVE,
          archivedAt: null,
          archivedBy: { disconnect: true },
        },
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "DOCUMENT_RESTORED",
          result: "SUCCESS",
          entityTable: "Document",
          entityId: existing.id,
          oldValues: { status: existing.status },
          newValues: { status: DocumentStatus.ACTIVE },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return restored;
    });
  }
}

