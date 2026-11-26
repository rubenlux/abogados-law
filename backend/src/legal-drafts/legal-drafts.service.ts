import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DocumentCategory,
  LegalDraftDocumentType,
  LegalDraftExportFormat,
  LegalDraftExportStatus,
  LegalDraftReviewStatus,
  LegalDraftStatus,
  MembershipStatus,
  Prisma,
} from "@prisma/client";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { ScopedPrismaService } from "../authz/scoped-prisma.service";
import { ActiveOrgContext } from "../authz/guards/active-org-context.guard";
import { OrgAuditService } from "../organizations/org-audit.service";
import { DocumentStorageService } from "../documents/document-storage.service";
import { DocumentsManagementService } from "../documents/documents-management.service";
import {
  buildDefaultLegalStructure,
  LegalDocRoot,
  validateAndSanitizeLegalContent,
} from "./content-ast.util";
import { findCatalogItem } from "./legal-draft-catalog";
import {
  hashExportOptions,
  LegalDraftExportGeneratorService,
  normalizeExportOptions,
} from "./export-generator.service";
import {
  ApproveDraftDto,
  CreateLegalDraftDto,
  CreateLegalDraftVersionDto,
  ExportLegalDraftDto,
  FinalizeDraftDto,
  QueryLegalDraftDto,
  RequestChangesDto,
  SubmitReviewDto,
  UpdateLegalDraftDto,
} from "./dto/legal-draft.dto";

const USER_SUMMARY_SELECT = {
  id: true,
  fullName: true,
  email: true,
};

const VERSION_SELECT: Prisma.LegalDraftVersionSelect = {
  id: true,
  legalDraftId: true,
  versionNumber: true,
  content: true,
  contentFormat: true,
  plainText: true,
  changeNote: true,
  generatedByAi: true,
  aiMetadata: true,
  createdById: true,
  createdBy: { select: USER_SUMMARY_SELECT },
  createdAt: true,
};

const REVIEW_SELECT: Prisma.LegalDraftReviewSelect = {
  id: true,
  legalDraftId: true,
  versionId: true,
  requestedById: true,
  requestedBy: { select: USER_SUMMARY_SELECT },
  reviewerId: true,
  reviewer: { select: USER_SUMMARY_SELECT },
  status: true,
  comments: true,
  requestedAt: true,
  reviewedAt: true,
};

const EXPORT_SELECT: Prisma.LegalDraftExportSelect = {
  id: true,
  legalDraftId: true,
  versionId: true,
  format: true,
  storageDocumentId: true,
  generatedById: true,
  generatedBy: { select: USER_SUMMARY_SELECT },
  generatedAt: true,
  sha256: true,
  status: true,
  idempotencyKey: true,
  exportOptions: true,
  version: {
    select: {
      id: true,
      versionNumber: true,
    },
  },
};

const DRAFT_LIST_SELECT: Prisma.LegalWritingSelect = {
  id: true,
  expedienteId: true,
  clientId: true,
  sourceTemplateId: true,
  title: true,
  category: true,
  documentType: true,
  jurisdiction: true,
  courtName: true,
  caseNumber: true,
  status: true,
  currentVersionNumber: true,
  isAiGenerated: true,
  aiMetadata: true,
  createdById: true,
  createdBy: { select: USER_SUMMARY_SELECT },
  archivedAt: true,
  archivedById: true,
  createdAt: true,
  updatedAt: true,
  expediente: {
    select: {
      id: true,
      caratula: true,
      numeroExpediente: true,
      juzgado: true,
      jurisdiccion: true,
    },
  },
  client: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      personType: true,
    },
  },
  sourceTemplate: {
    select: {
      id: true,
      name: true,
      isSystemTemplate: true,
    },
  },
};

const DRAFT_DETAIL_SELECT: Prisma.LegalWritingSelect = {
  ...DRAFT_LIST_SELECT,
  versions: {
    orderBy: { versionNumber: "desc" },
    select: VERSION_SELECT,
  },
  reviews: {
    orderBy: { requestedAt: "desc" },
    select: REVIEW_SELECT,
  },
  exports: {
    orderBy: { generatedAt: "desc" },
    select: EXPORT_SELECT,
  },
};

function mapDraftTypeToDocumentCategory(
  docType: LegalDraftDocumentType,
): DocumentCategory {
  if (docType === LegalDraftDocumentType.DEMANDA) {
    return DocumentCategory.DEMANDA;
  }
  if (
    docType === LegalDraftDocumentType.CONTESTACION_DEMANDA ||
    docType === LegalDraftDocumentType.CONTESTACION_TRASLADO ||
    docType === LegalDraftDocumentType.CONTESTACION_AGRAVIOS
  ) {
    return DocumentCategory.CONTESTACION;
  }
  return DocumentCategory.ESCRITO_JUDICIAL;
}

function buildExportFilename(
  title: string,
  versionNumber: number,
  format: LegalDraftExportFormat,
): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  const base = slug || "escrito_juridico";
  const ext = format === LegalDraftExportFormat.DOCX ? "docx" : "pdf";
  return `${base}_v${versionNumber}.${ext}`;
}

@Injectable()
export class LegalDraftsService {
  constructor(
    private readonly scopedPrisma: ScopedPrismaService,
    private readonly auditService: OrgAuditService,
    private readonly exportGenerator: LegalDraftExportGeneratorService,
    private readonly documentStorage: DocumentStorageService,
    private readonly documentsManagement: DocumentsManagementService,
  ) {}

  private async lockWritingOrThrow(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<void> {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "LegalWriting" WHERE id = ${id} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new NotFoundException("Escrito jurídico no encontrado");
    }
  }

  async findAll(query: QueryLegalDraftDto, ctx: ActiveOrgContext) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.LegalWritingWhereInput = {
      organizationId: ctx.organizationId,
      ...(query.expedienteId ? { expedienteId: query.expedienteId } : {}),
      ...(query.documentType ? { documentType: query.documentType } : {}),
      ...(query.status
        ? { status: query.status }
        : { status: { not: LegalDraftStatus.ARCHIVED } }),
      ...(query.createdById ? { createdById: query.createdById } : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { title: { contains: query.search.trim(), mode: "insensitive" } },
              {
                caseNumber: {
                  contains: query.search.trim(),
                  mode: "insensitive",
                },
              },
              {
                courtName: {
                  contains: query.search.trim(),
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const [data, total] = await Promise.all([
        tx.legalWriting.findMany({
          where,
          select: DRAFT_LIST_SELECT,
          orderBy: { updatedAt: "desc" },
          skip,
          take: limit,
        }),
        tx.legalWriting.count({ where }),
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    });
  }

  async findById(id: string, ctx: ActiveOrgContext) {
    const draft = await this.scopedPrisma.runInOrgContext(ctx, (tx) =>
      tx.legalWriting.findFirst({
        where: { id, organizationId: ctx.organizationId },
        select: DRAFT_DETAIL_SELECT,
      }),
    );

    if (!draft) {
      throw new NotFoundException("Escrito jurídico no encontrado");
    }
    return draft;
  }

  async create(dto: CreateLegalDraftDto, ctx: ActiveOrgContext) {
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      let exp: {
        id: string;
        caratula: string;
        numeroExpediente: string;
        juzgado: string;
        jurisdiccion: string;
      } | null = null;

      if (dto.expedienteId) {
        exp = await tx.expediente.findFirst({
          where: { id: dto.expedienteId, organizationId: ctx.organizationId },
          select: {
            id: true,
            caratula: true,
            numeroExpediente: true,
            juzgado: true,
            jurisdiccion: true,
          },
        });
        if (!exp) {
          throw new NotFoundException("Expediente no encontrado");
        }
      }

      if (dto.clientId) {
        const cli = await tx.client.findFirst({
          where: { id: dto.clientId, organizationId: ctx.organizationId },
          select: { id: true },
        });
        if (!cli) {
          throw new NotFoundException("Cliente no encontrado");
        }
      }

      let rawContent: unknown = dto.content;
      let resolvedDocType = dto.documentType ?? LegalDraftDocumentType.OTRO;

      if (dto.sourceTemplateId) {
        const template = await tx.legalDraftTemplate.findFirst({
          where: {
            id: dto.sourceTemplateId,
            isActive: true,
            OR: [
              { organizationId: ctx.organizationId },
              { isSystemTemplate: true, organizationId: null },
            ],
          },
          select: {
            id: true,
            content: true,
            documentType: true,
          },
        });
        if (!template) {
          throw new NotFoundException("Plantilla de origen no encontrada");
        }
        // Copia independiente del contenido de la plantilla (sin dependencia mutable)
        if (!rawContent) {
          rawContent = JSON.parse(JSON.stringify(template.content));
        }
        if (!dto.documentType) {
          resolvedDocType = template.documentType;
        }
      }

      if (!rawContent) {
        rawContent = buildDefaultLegalStructure({
          title: dto.title.trim(),
          documentType: resolvedDocType,
          caratula: exp?.caratula,
          numeroExpediente: exp?.numeroExpediente,
          juzgado: exp?.juzgado,
        });
      }

      const { content, plainText } =
        validateAndSanitizeLegalContent(rawContent);
      const resolvedCategory =
        dto.category ?? findCatalogItem(resolvedDocType).category;

      const created = await tx.legalWriting.create({
        data: {
          organization: { connect: { id: ctx.organizationId } },
          ...(exp ? { expediente: { connect: { id: exp.id } } } : {}),
          ...(dto.clientId
            ? { client: { connect: { id: dto.clientId } } }
            : {}),
          ...(dto.sourceTemplateId
            ? { sourceTemplate: { connect: { id: dto.sourceTemplateId } } }
            : {}),
          createdBy: { connect: { id: ctx.userId } },
          title: dto.title.trim(),
          category: resolvedCategory,
          documentType: resolvedDocType,
          jurisdiction: dto.jurisdiction?.trim() || exp?.jurisdiccion || null,
          courtName: dto.courtName?.trim() || exp?.juzgado || null,
          caseNumber: dto.caseNumber?.trim() || exp?.numeroExpediente || null,
          status: LegalDraftStatus.DRAFT,
          currentVersionNumber: 1,
          versions: {
            create: {
              organization: { connect: { id: ctx.organizationId } },
              createdBy: { connect: { id: ctx.userId } },
              versionNumber: 1,
              content: content as unknown as Prisma.InputJsonValue,
              plainText,
              changeNote: dto.changeNote?.trim() || "Versión inicial",
            },
          },
        },
        select: DRAFT_DETAIL_SELECT,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "LEGAL_DRAFT_CREATED",
          result: "SUCCESS",
          entityTable: "LegalWriting",
          entityId: created.id,
          newValues: {
            title: created.title,
            expedienteId: created.expedienteId,
            documentType: created.documentType,
            sourceTemplateId: created.sourceTemplateId,
            versionNumber: 1,
          },
        },
        tx,
      );

      return created;
    });
  }

  async updateMetadata(
    id: string,
    dto: UpdateLegalDraftDto,
    ctx: ActiveOrgContext,
  ) {
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      await this.lockWritingOrThrow(tx, id);

      const existing = await tx.legalWriting.findFirst({
        where: { id, organizationId: ctx.organizationId },
        select: { id: true, status: true, title: true, documentType: true },
      });
      if (!existing) {
        throw new NotFoundException("Escrito jurídico no encontrado");
      }
      if (existing.status === LegalDraftStatus.ARCHIVED) {
        throw new BadRequestException(
          "No se pueden modificar metadatos de un escrito archivado",
        );
      }

      if (dto.clientId) {
        const cli = await tx.client.findFirst({
          where: { id: dto.clientId, organizationId: ctx.organizationId },
          select: { id: true },
        });
        if (!cli) {
          throw new NotFoundException("Cliente no encontrado");
        }
      }

      const updated = await tx.legalWriting.update({
        where: { id: existing.id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.documentType !== undefined
            ? { documentType: dto.documentType }
            : {}),
          ...(dto.clientId !== undefined
            ? dto.clientId
              ? { client: { connect: { id: dto.clientId } } }
              : { client: { disconnect: true } }
            : {}),
          ...(dto.jurisdiction !== undefined
            ? { jurisdiction: dto.jurisdiction?.trim() || null }
            : {}),
          ...(dto.courtName !== undefined
            ? { courtName: dto.courtName?.trim() || null }
            : {}),
          ...(dto.caseNumber !== undefined
            ? { caseNumber: dto.caseNumber?.trim() || null }
            : {}),
        },
        select: DRAFT_DETAIL_SELECT,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "LEGAL_DRAFT_METADATA_UPDATED",
          result: "SUCCESS",
          entityTable: "LegalWriting",
          entityId: updated.id,
          oldValues: {
            title: existing.title,
            documentType: existing.documentType,
          },
          newValues: {
            title: updated.title,
            documentType: updated.documentType,
          },
        },
        tx,
      );

      return updated;
    });
  }

  async archive(id: string, ctx: ActiveOrgContext) {
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      await this.lockWritingOrThrow(tx, id);

      const existing = await tx.legalWriting.findFirst({
        where: { id, organizationId: ctx.organizationId },
        select: { id: true, status: true },
      });
      if (!existing) {
        throw new NotFoundException("Escrito jurídico no encontrado");
      }
      if (existing.status === LegalDraftStatus.ARCHIVED) {
        throw new ConflictException("El escrito ya se encuentra archivado");
      }

      const archived = await tx.legalWriting.update({
        where: { id: existing.id },
        data: {
          status: LegalDraftStatus.ARCHIVED,
          archivedAt: new Date(),
          archivedBy: { connect: { id: ctx.userId } },
        },
        select: DRAFT_DETAIL_SELECT,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "LEGAL_DRAFT_ARCHIVED",
          result: "SUCCESS",
          entityTable: "LegalWriting",
          entityId: archived.id,
          oldValues: { status: existing.status },
          newValues: { status: LegalDraftStatus.ARCHIVED },
        },
        tx,
      );

      return archived;
    });
  }

  async listVersions(id: string, ctx: ActiveOrgContext) {
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const exists = await tx.legalWriting.findFirst({
        where: { id, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!exists) {
        throw new NotFoundException("Escrito jurídico no encontrado");
      }

      return tx.legalDraftVersion.findMany({
        where: { legalDraftId: id, organizationId: ctx.organizationId },
        orderBy: { versionNumber: "desc" },
        select: VERSION_SELECT,
      });
    });
  }

  async findVersionById(
    draftId: string,
    versionId: string,
    ctx: ActiveOrgContext,
  ) {
    const version = await this.scopedPrisma.runInOrgContext(ctx, (tx) =>
      tx.legalDraftVersion.findFirst({
        where: {
          id: versionId,
          legalDraftId: draftId,
          organizationId: ctx.organizationId,
        },
        select: VERSION_SELECT,
      }),
    );

    if (!version) {
      throw new NotFoundException("Versión del escrito no encontrada");
    }
    return version;
  }

  /**
   * Crea una nueva versión inmutable serializada por lock de fila (FOR UPDATE).
   * Regla de flujo (§7): crear una nueva versión cuando el escrito estaba en
   * CHANGES_REQUESTED, APPROVED o FINALIZED regresa el estado a DRAFT,
   * conservando intactas las revisiones/aprobaciones históricas vinculadas
   * a versiones anteriores e impidiendo que una aprobación vieja cubra esta nueva versión.
   */
  async createVersion(
    draftId: string,
    dto: CreateLegalDraftVersionDto,
    ctx: ActiveOrgContext,
  ) {
    const { content, plainText } = validateAndSanitizeLegalContent(dto.content);

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      await this.lockWritingOrThrow(tx, draftId);

      const draft = await tx.legalWriting.findFirst({
        where: { id: draftId, organizationId: ctx.organizationId },
        select: { id: true, status: true, currentVersionNumber: true },
      });
      if (!draft) {
        throw new NotFoundException("Escrito jurídico no encontrado");
      }
      if (draft.status === LegalDraftStatus.ARCHIVED) {
        throw new BadRequestException(
          "No se pueden crear nuevas versiones sobre un escrito archivado",
        );
      }
      if (draft.status === LegalDraftStatus.IN_REVIEW) {
        throw new ConflictException(
          "El escrito está en revisión. Solicite cambios o resuelva la revisión antes de guardar una nueva versión.",
        );
      }

      const nextVersionNumber = draft.currentVersionNumber + 1;
      const version = await tx.legalDraftVersion.create({
        data: {
          organization: { connect: { id: ctx.organizationId } },
          legalDraft: { connect: { id: draft.id } },
          createdBy: { connect: { id: ctx.userId } },
          versionNumber: nextVersionNumber,
          content: content as unknown as Prisma.InputJsonValue,
          plainText,
          changeNote: dto.changeNote?.trim() || null,
        },
        select: VERSION_SELECT,
      });

      const nextStatus =
        draft.status === LegalDraftStatus.DRAFT
          ? LegalDraftStatus.DRAFT
          : LegalDraftStatus.DRAFT;

      await tx.legalWriting.update({
        where: { id: draft.id },
        data: {
          currentVersionNumber: nextVersionNumber,
          status: nextStatus,
        },
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "LEGAL_DRAFT_VERSION_CREATED",
          result: "SUCCESS",
          entityTable: "LegalDraftVersion",
          entityId: version.id,
          oldValues: {
            status: draft.status,
            versionNumber: draft.currentVersionNumber,
          },
          newValues: {
            legalDraftId: draft.id,
            versionNumber: nextVersionNumber,
            status: nextStatus,
            invalidatedPreviousApproval:
              draft.status === LegalDraftStatus.APPROVED ||
              draft.status === LegalDraftStatus.FINALIZED,
          },
        },
        tx,
      );

      return version;
    });
  }

  async submitForReview(
    draftId: string,
    dto: SubmitReviewDto,
    ctx: ActiveOrgContext,
  ) {
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      await this.lockWritingOrThrow(tx, draftId);

      const draft = await tx.legalWriting.findFirst({
        where: { id: draftId, organizationId: ctx.organizationId },
        select: {
          id: true,
          status: true,
          currentVersionNumber: true,
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            select: { id: true, versionNumber: true },
          },
        },
      });
      if (!draft) {
        throw new NotFoundException("Escrito jurídico no encontrado");
      }
      if (
        draft.status !== LegalDraftStatus.DRAFT &&
        draft.status !== LegalDraftStatus.CHANGES_REQUESTED
      ) {
        throw new BadRequestException(
          `Transición inválida: no se puede enviar a revisión desde estado ${draft.status}`,
        );
      }

      const currentVersion = draft.versions[0];
      if (!currentVersion) {
        throw new BadRequestException("El escrito no posee versión vigente");
      }

      if (dto.reviewerId) {
        const reviewerMembership = await tx.organizationMembership.findFirst({
          where: {
            userId: dto.reviewerId,
            organizationId: ctx.organizationId,
            status: MembershipStatus.ACTIVE,
          },
          select: { id: true },
        });
        if (!reviewerMembership) {
          throw new BadRequestException(
            "El revisor designado no posee membresía activa en la organización",
          );
        }
      }

      await tx.legalDraftReview.create({
        data: {
          organization: { connect: { id: ctx.organizationId } },
          legalDraft: { connect: { id: draft.id } },
          version: { connect: { id: currentVersion.id } },
          requestedBy: { connect: { id: ctx.userId } },
          ...(dto.reviewerId
            ? { reviewer: { connect: { id: dto.reviewerId } } }
            : {}),
          status: LegalDraftReviewStatus.PENDING,
          comments: dto.comments?.trim() || null,
        },
      });

      const updated = await tx.legalWriting.update({
        where: { id: draft.id },
        data: { status: LegalDraftStatus.IN_REVIEW },
        select: DRAFT_DETAIL_SELECT,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "LEGAL_DRAFT_SUBMITTED_FOR_REVIEW",
          result: "SUCCESS",
          entityTable: "LegalWriting",
          entityId: draft.id,
          oldValues: { status: draft.status },
          newValues: {
            status: LegalDraftStatus.IN_REVIEW,
            versionId: currentVersion.id,
            reviewerId: dto.reviewerId || null,
          },
        },
        tx,
      );

      return updated;
    });
  }

  async requestChanges(
    draftId: string,
    dto: RequestChangesDto,
    ctx: ActiveOrgContext,
  ) {
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      await this.lockWritingOrThrow(tx, draftId);

      const draft = await tx.legalWriting.findFirst({
        where: { id: draftId, organizationId: ctx.organizationId },
        select: {
          id: true,
          status: true,
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            select: { id: true },
          },
        },
      });
      if (!draft) {
        throw new NotFoundException("Escrito jurídico no encontrado");
      }
      if (draft.status !== LegalDraftStatus.IN_REVIEW) {
        throw new BadRequestException(
          `Transición inválida: solo se pueden solicitar cambios cuando el escrito está en estado IN_REVIEW (actual: ${draft.status})`,
        );
      }

      const pendingReview = await tx.legalDraftReview.findFirst({
        where: {
          legalDraftId: draft.id,
          organizationId: ctx.organizationId,
          status: LegalDraftReviewStatus.PENDING,
        },
        orderBy: { requestedAt: "desc" },
        select: { id: true, versionId: true },
      });

      const now = new Date();
      if (pendingReview) {
        await tx.legalDraftReview.update({
          where: { id: pendingReview.id },
          data: {
            status: LegalDraftReviewStatus.CHANGES_REQUESTED,
            reviewer: { connect: { id: ctx.userId } },
            comments: dto.comments.trim(),
            reviewedAt: now,
          },
        });
      } else if (draft.versions[0]) {
        await tx.legalDraftReview.create({
          data: {
            organization: { connect: { id: ctx.organizationId } },
            legalDraft: { connect: { id: draft.id } },
            version: { connect: { id: draft.versions[0].id } },
            requestedBy: { connect: { id: ctx.userId } },
            reviewer: { connect: { id: ctx.userId } },
            status: LegalDraftReviewStatus.CHANGES_REQUESTED,
            comments: dto.comments.trim(),
            reviewedAt: now,
          },
        });
      }

      const updated = await tx.legalWriting.update({
        where: { id: draft.id },
        data: { status: LegalDraftStatus.CHANGES_REQUESTED },
        select: DRAFT_DETAIL_SELECT,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "LEGAL_DRAFT_CHANGES_REQUESTED",
          result: "SUCCESS",
          entityTable: "LegalWriting",
          entityId: draft.id,
          oldValues: { status: LegalDraftStatus.IN_REVIEW },
          newValues: {
            status: LegalDraftStatus.CHANGES_REQUESTED,
            comments: dto.comments.trim(),
          },
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Aprueba una versión concreta con política conservadora de segregación de funciones:
   * ningún usuario (incluidos ORG_ADMIN y ORG_OWNER) puede aprobar su propio escrito/versión.
   */
  async approve(draftId: string, dto: ApproveDraftDto, ctx: ActiveOrgContext) {
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      await this.lockWritingOrThrow(tx, draftId);

      const draft = await tx.legalWriting.findFirst({
        where: { id: draftId, organizationId: ctx.organizationId },
        select: {
          id: true,
          status: true,
          createdById: true,
          currentVersionNumber: true,
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            select: { id: true, versionNumber: true, createdById: true },
          },
        },
      });
      if (!draft) {
        throw new NotFoundException("Escrito jurídico no encontrado");
      }

      if (
        draft.status === LegalDraftStatus.APPROVED ||
        draft.status === LegalDraftStatus.FINALIZED
      ) {
        throw new ConflictException(
          `El escrito ya fue transicionado a estado ${draft.status}`,
        );
      }
      if (draft.status !== LegalDraftStatus.IN_REVIEW) {
        throw new BadRequestException(
          `Transición inválida: solo se puede aprobar un escrito en estado IN_REVIEW (actual: ${draft.status})`,
        );
      }

      const currentVersion = draft.versions[0];
      if (!currentVersion || currentVersion.id !== dto.versionId) {
        throw new BadRequestException(
          "La versión indicada no corresponde a la versión vigente enviada a revisión",
        );
      }

      // Política conservadora de segregación de funciones (§7 y §11)
      if (
        currentVersion.createdById === ctx.userId ||
        draft.createdById === ctx.userId
      ) {
        throw new ForbiddenException(
          "Política de segregación de funciones: el autor no puede autoaprobar su propio escrito o versión",
        );
      }

      const pendingReview = await tx.legalDraftReview.findFirst({
        where: {
          legalDraftId: draft.id,
          versionId: currentVersion.id,
          organizationId: ctx.organizationId,
          status: LegalDraftReviewStatus.PENDING,
        },
        orderBy: { requestedAt: "desc" },
        select: { id: true },
      });

      const now = new Date();
      if (pendingReview) {
        await tx.legalDraftReview.update({
          where: { id: pendingReview.id },
          data: {
            status: LegalDraftReviewStatus.APPROVED,
            reviewer: { connect: { id: ctx.userId } },
            comments: dto.comments?.trim() || "Aprobado",
            reviewedAt: now,
          },
        });
      } else {
        await tx.legalDraftReview.create({
          data: {
            organization: { connect: { id: ctx.organizationId } },
            legalDraft: { connect: { id: draft.id } },
            version: { connect: { id: currentVersion.id } },
            requestedBy: { connect: { id: currentVersion.createdById } },
            reviewer: { connect: { id: ctx.userId } },
            status: LegalDraftReviewStatus.APPROVED,
            comments: dto.comments?.trim() || "Aprobado",
            reviewedAt: now,
          },
        });
      }

      const updated = await tx.legalWriting.update({
        where: { id: draft.id },
        data: { status: LegalDraftStatus.APPROVED },
        select: DRAFT_DETAIL_SELECT,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "LEGAL_DRAFT_APPROVED",
          result: "SUCCESS",
          entityTable: "LegalWriting",
          entityId: draft.id,
          oldValues: { status: LegalDraftStatus.IN_REVIEW },
          newValues: {
            status: LegalDraftStatus.APPROVED,
            versionId: currentVersion.id,
            versionNumber: currentVersion.versionNumber,
          },
        },
        tx,
      );

      return updated;
    });
  }

  async finalize(
    draftId: string,
    dto: FinalizeDraftDto,
    ctx: ActiveOrgContext,
  ) {
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      await this.lockWritingOrThrow(tx, draftId);

      const draft = await tx.legalWriting.findFirst({
        where: { id: draftId, organizationId: ctx.organizationId },
        select: {
          id: true,
          status: true,
          currentVersionNumber: true,
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            select: { id: true },
          },
        },
      });
      if (!draft) {
        throw new NotFoundException("Escrito jurídico no encontrado");
      }
      if (draft.status !== LegalDraftStatus.APPROVED) {
        throw new BadRequestException(
          `Transición inválida: solo se puede finalizar un escrito previamente APPROVED (actual: ${draft.status})`,
        );
      }

      const currentVersion = draft.versions[0];
      if (!currentVersion) {
        throw new BadRequestException("El escrito no posee versión vigente");
      }

      const approvedForCurrent = await tx.legalDraftReview.findFirst({
        where: {
          legalDraftId: draft.id,
          versionId: currentVersion.id,
          organizationId: ctx.organizationId,
          status: LegalDraftReviewStatus.APPROVED,
        },
        select: { id: true },
      });
      if (!approvedForCurrent) {
        throw new BadRequestException(
          "La versión vigente no cuenta con aprobación registrada",
        );
      }

      const updated = await tx.legalWriting.update({
        where: { id: draft.id },
        data: { status: LegalDraftStatus.FINALIZED },
        select: DRAFT_DETAIL_SELECT,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "LEGAL_DRAFT_FINALIZED",
          result: "SUCCESS",
          entityTable: "LegalWriting",
          entityId: draft.id,
          oldValues: { status: LegalDraftStatus.APPROVED },
          newValues: {
            status: LegalDraftStatus.FINALIZED,
            versionId: currentVersion.id,
            comments: dto.comments?.trim() || null,
          },
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Genera DOCX o PDF real de una versión inmutable, lo guarda en AUTH-08
   * (sin duplicar storage) y registra LegalDraftExport de forma idempotente y serializada.
   * No crea ningún MovimientoProcesal automático.
   */
  async exportDraft(
    draftId: string,
    dto: ExportLegalDraftDto,
    ctx: ActiveOrgContext,
  ) {
    const normalizedOptions = normalizeExportOptions(dto.options);
    const optionsHash = hashExportOptions(normalizedOptions);
    const trimmedKey = dto.idempotencyKey?.trim() || null;

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      await this.lockWritingOrThrow(tx, draftId);

      // 1. Verificar idempotencia explícita por idempotencyKey
      if (trimmedKey) {
        const byKey = await tx.legalDraftExport.findFirst({
          where: {
            organizationId: ctx.organizationId,
            idempotencyKey: trimmedKey,
          },
          select: EXPORT_SELECT,
        });
        if (byKey) {
          return byKey;
        }
      }

      // 2. Verificar escrito y versión objetivo dentro del tenant
      const draft = await tx.legalWriting.findFirst({
        where: { id: draftId, organizationId: ctx.organizationId },
        select: {
          id: true,
          title: true,
          documentType: true,
          status: true,
          expedienteId: true,
          clientId: true,
          courtName: true,
          caseNumber: true,
          expediente: {
            select: {
              caratula: true,
              numeroExpediente: true,
              juzgado: true,
            },
          },
        },
      });
      if (!draft) {
        throw new NotFoundException("Escrito jurídico no encontrado");
      }
      if (draft.status === LegalDraftStatus.ARCHIVED) {
        throw new BadRequestException(
          "No se pueden generar nuevas exportaciones de un escrito archivado",
        );
      }

      const version = await tx.legalDraftVersion.findFirst({
        where: {
          id: dto.versionId,
          legalDraftId: draft.id,
          organizationId: ctx.organizationId,
        },
        select: {
          id: true,
          versionNumber: true,
          content: true,
        },
      });
      if (!version) {
        throw new NotFoundException("Versión objetivo no encontrada");
      }

      // 3. Deduplicar exportación idéntica (misma versión + formato + opciones) si ya existe COMPLETED
      const existingSame = await tx.legalDraftExport.findFirst({
        where: {
          organizationId: ctx.organizationId,
          legalDraftId: draft.id,
          versionId: version.id,
          format: dto.format,
          optionsHash,
          status: LegalDraftExportStatus.COMPLETED,
        },
        select: EXPORT_SELECT,
      });
      if (existingSame) {
        return existingSame;
      }

      // 4. Generar archivo real DOCX o PDF desde el mismo AST inmutable
      const ast = version.content as unknown as LegalDocRoot;
      const meta = {
        title: draft.title,
        versionNumber: version.versionNumber,
        caseNumber: draft.caseNumber || draft.expediente?.numeroExpediente,
        caratula: draft.expediente?.caratula,
        courtName: draft.courtName || draft.expediente?.juzgado,
      };

      const fileBuffer =
        dto.format === LegalDraftExportFormat.DOCX
          ? await this.exportGenerator.generateDocxBuffer(
              ast,
              meta,
              normalizedOptions,
            )
          : await this.exportGenerator.generatePdfBuffer(
              ast,
              meta,
              normalizedOptions,
            );

      const originalname = buildExportFilename(
        draft.title,
        version.versionNumber,
        dto.format,
      );
      const mimetype =
        dto.format === LegalDraftExportFormat.DOCX
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf";

      const tempFilePath = path.join(
        this.documentStorage.getTempDir(),
        `draft-export-${crypto.randomUUID()}.${dto.format.toLowerCase()}`,
      );

      let auth08DocId: string | null = null;
      try {
        await fs.promises.writeFile(tempFilePath, fileBuffer, { mode: 0o600 });

        // 5. Persistir en almacenamiento privado AUTH-08 (sin duplicar storage)
        const auth08Doc = (await this.documentsManagement.createWithFile(
          {
            title: `${draft.title} (v${version.versionNumber} — ${dto.format})`,
            description: `Exportación ${dto.format} generada desde Escrito Jurídico v${version.versionNumber}. No constituye presentación judicial automática.`,
            category: mapDraftTypeToDocumentCategory(draft.documentType),
            expedienteId: draft.expedienteId ?? undefined,
            clientId: draft.clientId ?? undefined,
            changeNote: `Exportación automática desde Escrito ${draft.id} v${version.versionNumber}`,
          },
          {
            originalname,
            mimetype,
            size: fileBuffer.length,
            path: tempFilePath,
          },
          ctx,
        )) as { id: string; versions?: Array<{ sha256: string }> };

        auth08DocId = auth08Doc.id;
        const sha256 =
          auth08Doc.versions?.[0]?.sha256 ||
          crypto.createHash("sha256").update(fileBuffer).digest("hex");

        const createdExport = await tx.legalDraftExport.create({
          data: {
            organization: { connect: { id: ctx.organizationId } },
            legalDraft: { connect: { id: draft.id } },
            version: { connect: { id: version.id } },
            storageDocument: { connect: { id: auth08Doc.id } },
            generatedBy: { connect: { id: ctx.userId } },
            format: dto.format,
            sha256,
            status: LegalDraftExportStatus.COMPLETED,
            idempotencyKey: trimmedKey,
            optionsHash,
            exportOptions:
              normalizedOptions as unknown as Prisma.InputJsonValue,
          },
          select: EXPORT_SELECT,
        });

        await this.auditService.record(
          {
            actorId: ctx.userId,
            organizationId: ctx.organizationId,
            action: "LEGAL_DRAFT_EXPORTED",
            result: "SUCCESS",
            entityTable: "LegalDraftExport",
            entityId: createdExport.id,
            newValues: {
              legalDraftId: draft.id,
              versionId: version.id,
              versionNumber: version.versionNumber,
              format: dto.format,
              storageDocumentId: auth08Doc.id,
              sha256,
            },
          },
          tx,
        );

        return createdExport;
      } catch (err) {
        if (auth08DocId) {
          // Compensar archivando el documento AUTH-08 si falló el registro de exportación
          await this.documentsManagement
            .archive(auth08DocId, ctx)
            .catch(() => undefined);
        }
        throw err;
      } finally {
        await this.documentStorage.removeTempFile(tempFilePath);
      }
    });
  }

  async listExports(draftId: string, ctx: ActiveOrgContext) {
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const exists = await tx.legalWriting.findFirst({
        where: { id: draftId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!exists) {
        throw new NotFoundException("Escrito jurídico no encontrado");
      }

      return tx.legalDraftExport.findMany({
        where: { legalDraftId: draftId, organizationId: ctx.organizationId },
        orderBy: { generatedAt: "desc" },
        select: EXPORT_SELECT,
      });
    });
  }

  async prepareExportDownload(
    draftId: string,
    exportId: string,
    ctx: ActiveOrgContext,
  ) {
    const exp = await this.scopedPrisma.runInOrgContext(ctx, (tx) =>
      tx.legalDraftExport.findFirst({
        where: {
          id: exportId,
          legalDraftId: draftId,
          organizationId: ctx.organizationId,
        },
        select: {
          id: true,
          storageDocumentId: true,
        },
      }),
    );

    if (!exp) {
      throw new NotFoundException("Exportación no encontrada");
    }

    return this.documentsManagement.prepareDownload(
      exp.storageDocumentId,
      undefined,
      ctx,
    );
  }
}
