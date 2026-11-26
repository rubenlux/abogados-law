import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { OrganizationStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ScopedPrismaService } from "../authz/scoped-prisma.service";
import { ActiveOrgContext } from "../authz/guards/active-org-context.guard";
import { EVENTO_AGENDA_SELECT_BY_ROLE } from "../authz/permissions";

@Injectable()
export class AgendaService {
  private readonly logger = new Logger(AgendaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scopedPrisma: ScopedPrismaService,
  ) {}

  // --- CALENDARIO JUDICIAL (Global Read-Only Cat E) ---

  async areDatesHolidays(dates: Date[], jurisdiccion: string) {
    return this.prisma.calendarioJudicial.findMany({
      where: {
        jurisdiccion,
        fecha: { in: dates },
      },
    });
  }

  async getHolidays(jurisdiccion: string, year: number) {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    return this.prisma.calendarioJudicial.findMany({
      where: {
        jurisdiccion,
        fecha: { gte: start, lte: end },
      },
    });
  }

  // --- EVENTOS AGENDA (Tenant-Scoped Cat A) ---

  async createEvent(data: any, ctx: ActiveOrgContext) {
    const select = EVENTO_AGENDA_SELECT_BY_ROLE[ctx.orgRole];
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const expediente = await tx.expediente.findFirst({
        where: {
          id: data.expedienteId,
          organizationId: ctx.organizationId,
        },
        select: { id: true },
      });

      if (!expediente) {
        throw new NotFoundException("Expediente not found");
      }

      return tx.eventoAgenda.create({
        data: {
          titulo: data.titulo,
          fechaVencimiento: new Date(data.fechaVencimiento),
          tipoPlazo: data.tipoPlazo || "ORDINARIO",
          expedienteId: expediente.id,
          organizationId: ctx.organizationId,
          descripcion: data.descripcion,
          isCritical: data.isCritical || false,
          estado: "PENDIENTE",
        },
        select,
      });
    });
  }

  async findAll(ctx: ActiveOrgContext, query: any) {
    const select = EVENTO_AGENDA_SELECT_BY_ROLE[ctx.orgRole];
    return this.scopedPrisma.runInOrgContext(ctx, (tx) => {
      const where: any = {
        organizationId: ctx.organizationId,
      };
      if (query?.expedienteId) {
        where.expedienteId = String(query.expedienteId);
      }

      return tx.eventoAgenda.findMany({
        where,
        select,
        orderBy: { fechaVencimiento: "asc" },
      });
    });
  }

  /**
   * Cron de vencimientos: itera explícitamente sobre organizaciones ACTIVE,
   * aislando cada consulta dentro de ScopedPrismaService.runInOrgContext.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleCron(): Promise<{
    perOrganization: Array<{ organizationId: string; urgentCount: number }>;
  }> {
    this.logger.debug("Running per-organization deadline checks");
    const today = new Date();
    const next3Days = new Date(today);
    next3Days.setDate(today.getDate() + 3);

    const activeOrgs = await this.prisma.organization.findMany({
      where: { status: OrganizationStatus.ACTIVE },
      select: { id: true },
    });

    const perOrganization: Array<{
      organizationId: string;
      urgentCount: number;
    }> = [];

    for (const org of activeOrgs) {
      const urgentEvents = await this.scopedPrisma.runInOrgContext(
        { organizationId: org.id },
        (tx) =>
          tx.eventoAgenda.findMany({
            where: {
              organizationId: org.id,
              estado: "PENDIENTE",
              fechaVencimiento: {
                lte: next3Days,
                gte: today,
              },
            },
            select: {
              id: true,
              expedienteId: true,
              titulo: true,
              fechaVencimiento: true,
            },
          }),
      );

      if (urgentEvents.length > 0) {
        this.logger.warn(
          `Org ${org.id}: found ${urgentEvents.length} urgent deadlines due soon.`,
        );
      }

      perOrganization.push({
        organizationId: org.id,
        urgentCount: urgentEvents.length,
      });
    }

    return { perOrganization };
  }
}
