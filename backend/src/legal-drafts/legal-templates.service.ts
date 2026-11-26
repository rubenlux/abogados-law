import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  LegalDraftCategory,
  LegalDraftDocumentType,
  Prisma,
} from "@prisma/client";
import { ScopedPrismaService } from "../authz/scoped-prisma.service";
import { ActiveOrgContext } from "../authz/guards/active-org-context.guard";
import { OrgAuditService } from "../organizations/org-audit.service";
import { validateAndSanitizeLegalContent } from "./content-ast.util";
import { findCatalogItem } from "./legal-draft-catalog";
import {
  CreateLegalTemplateDto,
  QueryLegalTemplateDto,
  UpdateLegalTemplateDto,
} from "./dto/legal-template.dto";

const TEMPLATE_SELECT: Prisma.LegalDraftTemplateSelect = {
  id: true,
  organizationId: true,
  name: true,
  description: true,
  category: true,
  documentType: true,
  versionNumber: true,
  baseInstructions: true,
  variables: true,
  requiredInfo: true,
  jurisdiction: true,
  fuero: true,
  content: true,
  contentFormat: true,
  isSystemTemplate: true,
  isActive: true,
  createdById: true,
  createdBy: {
    select: { id: true, fullName: true, email: true },
  },
  archivedAt: true,
  archivedById: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class LegalTemplatesService {
  constructor(
    private readonly scopedPrisma: ScopedPrismaService,
    private readonly auditService: OrgAuditService,
  ) {}

  async findAll(query: QueryLegalTemplateDto, ctx: ActiveOrgContext) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.LegalDraftTemplateWhereInput = {
      OR: [
        { organizationId: ctx.organizationId },
        { isSystemTemplate: true, organizationId: null },
      ],
      ...(query.includeArchived ? {} : { isActive: true }),
      ...(query.category ? { category: query.category } : {}),
      ...(query.documentType ? { documentType: query.documentType } : {}),
      ...(query.search?.trim()
        ? {
            AND: [
              {
                OR: [
                  {
                    name: {
                      contains: query.search.trim(),
                      mode: "insensitive",
                    },
                  },
                  {
                    description: {
                      contains: query.search.trim(),
                      mode: "insensitive",
                    },
                  },
                ],
              },
            ],
          }
        : {}),
    };

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const [data, total] = await Promise.all([
        tx.legalDraftTemplate.findMany({
          where,
          select: TEMPLATE_SELECT,
          orderBy: [{ isSystemTemplate: "desc" }, { updatedAt: "desc" }],
          skip,
          take: limit,
        }),
        tx.legalDraftTemplate.count({ where }),
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
    const template = await this.scopedPrisma.runInOrgContext(ctx, (tx) =>
      tx.legalDraftTemplate.findFirst({
        where: {
          id,
          OR: [
            { organizationId: ctx.organizationId },
            { isSystemTemplate: true, organizationId: null },
          ],
        },
        select: TEMPLATE_SELECT,
      }),
    );

    if (!template) {
      throw new NotFoundException("Plantilla jurídica no encontrada");
    }
    return template;
  }

  async create(dto: CreateLegalTemplateDto, ctx: ActiveOrgContext) {
    const { content } = validateAndSanitizeLegalContent(dto.content);
    const docType = dto.documentType ?? LegalDraftDocumentType.OTRO;
    const category: LegalDraftCategory =
      dto.category ?? findCatalogItem(docType).category;

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const created = await tx.legalDraftTemplate.create({
        data: {
          organization: { connect: { id: ctx.organizationId } },
          createdBy: { connect: { id: ctx.userId } },
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          category,
          documentType: docType,
          versionNumber: 1,
          baseInstructions: dto.baseInstructions?.trim() || null,
          variables: (dto.variables || []) as unknown as Prisma.InputJsonValue,
          requiredInfo: (dto.requiredInfo ||
            []) as unknown as Prisma.InputJsonValue,
          jurisdiction: dto.jurisdiction?.trim() || null,
          fuero: dto.fuero?.trim() || null,
          content: content as unknown as Prisma.InputJsonValue,
          isSystemTemplate: false,
          isActive: true,
        },
        select: TEMPLATE_SELECT,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "LEGAL_TEMPLATE_CREATED",
          result: "SUCCESS",
          entityTable: "LegalDraftTemplate",
          entityId: created.id,
          newValues: {
            name: created.name,
            documentType: created.documentType,
          },
        },
        tx,
      );

      return created;
    });
  }

  async update(id: string, dto: UpdateLegalTemplateDto, ctx: ActiveOrgContext) {
    const sanitizedContent =
      dto.content !== undefined
        ? validateAndSanitizeLegalContent(dto.content).content
        : undefined;

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const existing = await tx.legalDraftTemplate.findFirst({
        where: {
          id,
          OR: [
            { organizationId: ctx.organizationId },
            { isSystemTemplate: true, organizationId: null },
          ],
        },
        select: {
          id: true,
          isSystemTemplate: true,
          organizationId: true,
          name: true,
          isActive: true,
        },
      });

      if (!existing) {
        throw new NotFoundException("Plantilla jurídica no encontrada");
      }
      if (existing.isSystemTemplate) {
        throw new ForbiddenException(
          "Las plantillas orientativas de sistema son de solo lectura. Duplíquela para personalizar una versión del estudio.",
        );
      }

      const updated = await tx.legalDraftTemplate.update({
        where: { id: existing.id },
        data: {
          versionNumber: { increment: 1 },
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          ...(dto.category !== undefined ? { category: dto.category } : {}),
          ...(dto.documentType !== undefined
            ? { documentType: dto.documentType }
            : {}),
          ...(dto.baseInstructions !== undefined
            ? { baseInstructions: dto.baseInstructions?.trim() || null }
            : {}),
          ...(dto.variables !== undefined
            ? { variables: dto.variables as unknown as Prisma.InputJsonValue }
            : {}),
          ...(dto.requiredInfo !== undefined
            ? {
                requiredInfo:
                  dto.requiredInfo as unknown as Prisma.InputJsonValue,
              }
            : {}),
          ...(dto.jurisdiction !== undefined
            ? { jurisdiction: dto.jurisdiction?.trim() || null }
            : {}),
          ...(dto.fuero !== undefined
            ? { fuero: dto.fuero?.trim() || null }
            : {}),
          ...(sanitizedContent !== undefined
            ? { content: sanitizedContent as unknown as Prisma.InputJsonValue }
            : {}),
        },
        select: TEMPLATE_SELECT,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "LEGAL_TEMPLATE_UPDATED",
          result: "SUCCESS",
          entityTable: "LegalDraftTemplate",
          entityId: updated.id,
          oldValues: { name: existing.name },
          newValues: { name: updated.name, documentType: updated.documentType },
        },
        tx,
      );

      return updated;
    });
  }

  async duplicate(id: string, ctx: ActiveOrgContext) {
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const source = await tx.legalDraftTemplate.findFirst({
        where: {
          id,
          OR: [
            { organizationId: ctx.organizationId },
            { isSystemTemplate: true, organizationId: null },
          ],
        },
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          documentType: true,
          baseInstructions: true,
          variables: true,
          requiredInfo: true,
          jurisdiction: true,
          fuero: true,
          content: true,
        },
      });

      if (!source) {
        throw new NotFoundException("Plantilla de origen no encontrada");
      }

      const copy = await tx.legalDraftTemplate.create({
        data: {
          organization: { connect: { id: ctx.organizationId } },
          createdBy: { connect: { id: ctx.userId } },
          name: `${source.name} (Copia)`,
          description: source.description,
          category: source.category,
          documentType: source.documentType,
          versionNumber: 1,
          baseInstructions: source.baseInstructions,
          variables: source.variables as Prisma.InputJsonValue,
          requiredInfo: source.requiredInfo as Prisma.InputJsonValue,
          jurisdiction: source.jurisdiction,
          fuero: source.fuero,
          content: source.content as Prisma.InputJsonValue,
          isSystemTemplate: false,
          isActive: true,
        },
        select: TEMPLATE_SELECT,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "LEGAL_TEMPLATE_DUPLICATED",
          result: "SUCCESS",
          entityTable: "LegalDraftTemplate",
          entityId: copy.id,
          newValues: { sourceTemplateId: source.id, name: copy.name },
        },
        tx,
      );

      return copy;
    });
  }

  async archive(id: string, ctx: ActiveOrgContext) {
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const existing = await tx.legalDraftTemplate.findFirst({
        where: {
          id,
          OR: [
            { organizationId: ctx.organizationId },
            { isSystemTemplate: true, organizationId: null },
          ],
        },
        select: {
          id: true,
          isSystemTemplate: true,
          name: true,
          isActive: true,
        },
      });

      if (!existing) {
        throw new NotFoundException("Plantilla jurídica no encontrada");
      }
      if (existing.isSystemTemplate) {
        throw new ForbiddenException(
          "No se pueden archivar las plantillas orientativas de sistema",
        );
      }

      const archived = await tx.legalDraftTemplate.update({
        where: { id: existing.id },
        data: {
          isActive: false,
          archivedAt: new Date(),
          archivedBy: { connect: { id: ctx.userId } },
        },
        select: TEMPLATE_SELECT,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "LEGAL_TEMPLATE_ARCHIVED",
          result: "SUCCESS",
          entityTable: "LegalDraftTemplate",
          entityId: archived.id,
          oldValues: { isActive: existing.isActive },
          newValues: { isActive: false },
        },
        tx,
      );

      return archived;
    });
  }
}
