import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { ScopedPrismaService } from "../authz/scoped-prisma.service";
import { ActiveOrgContext } from "../authz/guards/active-org-context.guard";
import { LEGAL_TEMPLATE_SELECT_BY_ROLE } from "../authz/permissions";

@Injectable()
export class TemplatesService {
  constructor(private readonly scopedPrisma: ScopedPrismaService) {}

  async create(
    data: {
      name: string;
      description?: string;
      content: string;
      variables: string[];
      category?: string;
    },
    ctx: ActiveOrgContext,
  ) {
    const select = LEGAL_TEMPLATE_SELECT_BY_ROLE[ctx.orgRole];
    if (!select) {
      throw new ForbiddenException("Role cannot access templates");
    }

    return this.scopedPrisma.runInOrgContext(ctx, (tx) =>
      tx.legalTemplate.create({
        data: {
          name: data.name,
          description: data.description,
          content: data.content,
          variables: data.variables,
          category: data.category,
          organizationId: ctx.organizationId,
        },
        select,
      }),
    );
  }

  async findAll(ctx: ActiveOrgContext) {
    const select = LEGAL_TEMPLATE_SELECT_BY_ROLE[ctx.orgRole];
    if (!select) {
      throw new ForbiddenException("Role cannot access templates");
    }

    return this.scopedPrisma.runInOrgContext(ctx, (tx) =>
      tx.legalTemplate.findMany({
        where: { organizationId: ctx.organizationId, isActive: true },
        select,
      }),
    );
  }

  /**
   * Renderiza una plantilla verificando pertenencia estricta a la organización activa.
   */
  async generateDocument(
    id: string,
    values: Record<string, string>,
    ctx: ActiveOrgContext,
  ) {
    const template = await this.scopedPrisma.runInOrgContext(ctx, (tx) =>
      tx.legalTemplate.findFirst({
        where: { id, organizationId: ctx.organizationId },
        select: {
          id: true,
          name: true,
          content: true,
          variables: true,
        },
      }),
    );

    if (!template) {
      throw new NotFoundException("Template not found");
    }

    let content = template.content;

    Object.keys(values).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      content = content.replace(regex, values[key]);
    });

    const variablesList = Array.isArray(template.variables)
      ? (template.variables as string[])
      : [];

    const missingVars = variablesList.filter(
      (v: string) => !values[v] && content.includes(`{{${v}}}`),
    );

    return {
      content,
      missingVariables: missingVars,
      templateName: template.name,
    };
  }
}
