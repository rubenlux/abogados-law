import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EstadoEventoAgenda, MembershipStatus, Prisma } from "@prisma/client";
import { ScopedPrismaService } from "../authz/scoped-prisma.service";
import { OrgAuditService } from "../organizations/org-audit.service";
import { ActiveOrgContext } from "../authz/guards/active-org-context.guard";
import { AGENDA_EVENT_SELECT_BY_ROLE } from "../authz/permissions";
import {
  CreateAgendaEventDto,
  QueryAgendaEventDto,
  UpdateAgendaEventDto,
} from "./dto/agenda-event.dto";

export interface OverlapWarning {
  hasOverlap: boolean;
  overlappingCount: number;
  overlappingEventIds: string[];
}

@Injectable()
export class AgendaEventsService {
  constructor(
    private readonly scopedPrisma: ScopedPrismaService,
    private readonly auditService: OrgAuditService,
  ) {}

  private async assertActiveOrgMember(
    tx: Prisma.TransactionClient,
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const membership = await tx.organizationMembership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
      select: { status: true },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException(
        "El responsable debe pertenecer a la organización activa con membresía ACTIVE",
      );
    }
  }

  private async assertExpedienteInOrg(
    tx: Prisma.TransactionClient,
    expedienteId: string,
    organizationId: string,
  ): Promise<void> {
    const exp = await tx.expediente.findFirst({
      where: { id: expedienteId, organizationId },
      select: { id: true },
    });
    if (!exp) {
      throw new NotFoundException("Expediente no encontrado");
    }
  }

  private async detectOverlap(
    tx: Prisma.TransactionClient,
    organizationId: string,
    responsableId: string | null | undefined,
    fechaInicio: Date,
    fechaFin: Date | null,
    excludeEventId?: string,
  ): Promise<OverlapWarning> {
    if (!responsableId) {
      return {
        hasOverlap: false,
        overlappingCount: 0,
        overlappingEventIds: [],
      };
    }

    const effectiveEnd = fechaFin ?? fechaInicio;
    const overlapping = await tx.agendaEvent.findMany({
      where: {
        organizationId,
        responsableId,
        estado: { not: EstadoEventoAgenda.CANCELADO },
        ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
        fechaInicio: { lte: effectiveEnd },
        OR: [
          { fechaFin: { gte: fechaInicio } },
          { fechaFin: null, fechaInicio: { gte: fechaInicio } },
        ],
      },
      select: { id: true },
    });

    return {
      hasOverlap: overlapping.length > 0,
      overlappingCount: overlapping.length,
      overlappingEventIds: overlapping.map((o) => o.id),
    };
  }

  async create(dto: CreateAgendaEventDto, ctx: ActiveOrgContext) {
    const fechaInicio = new Date(dto.fechaInicio);
    const fechaFin = dto.fechaFin ? new Date(dto.fechaFin) : null;
    if (
      Number.isNaN(fechaInicio.getTime()) ||
      (fechaFin && Number.isNaN(fechaFin.getTime()))
    ) {
      throw new BadRequestException("Fechas inválidas");
    }
    if (fechaFin && fechaFin.getTime() < fechaInicio.getTime()) {
      throw new BadRequestException(
        "La fecha de finalización no puede ser anterior a la fecha de inicio",
      );
    }

    const select = AGENDA_EVENT_SELECT_BY_ROLE[ctx.orgRole];

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      if (dto.expedienteId) {
        await this.assertExpedienteInOrg(
          tx,
          dto.expedienteId,
          ctx.organizationId,
        );
      }

      if (dto.responsableId) {
        await this.assertActiveOrgMember(
          tx,
          dto.responsableId,
          ctx.organizationId,
        );
      }

      const overlapWarning = await this.detectOverlap(
        tx,
        ctx.organizationId,
        dto.responsableId,
        fechaInicio,
        fechaFin,
      );

      const event = await tx.agendaEvent.create({
        data: {
          organization: { connect: { id: ctx.organizationId } },
          creadoPor: { connect: { id: ctx.userId } },
          ...(dto.expedienteId
            ? { expediente: { connect: { id: dto.expedienteId } } }
            : {}),
          ...(dto.responsableId
            ? { responsable: { connect: { id: dto.responsableId } } }
            : {}),
          titulo: dto.titulo.trim(),
          descripcion: dto.descripcion?.trim() || null,
          tipo: dto.tipo,
          fechaInicio,
          fechaFin,
          ubicacion: dto.ubicacion?.trim() || null,
          estado: dto.estado ?? EstadoEventoAgenda.PROGRAMADO,
        },
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "AGENDA_EVENT_CREATED",
          result: "SUCCESS",
          entityTable: "AgendaEvent",
          entityId: (event as any).id,
          newValues: {
            titulo: dto.titulo.trim(),
            tipo: dto.tipo,
            fechaInicio: fechaInicio.toISOString(),
            fechaFin: fechaFin?.toISOString() ?? null,
            expedienteId: dto.expedienteId ?? null,
            responsableId: dto.responsableId ?? null,
          },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return { event, overlapWarning };
    });
  }

  async findAll(query: QueryAgendaEventDto, ctx: ActiveOrgContext) {
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

    const select = AGENDA_EVENT_SELECT_BY_ROLE[ctx.orgRole];
    const page = Math.max(1, query?.page || 1);
    const limit = Math.min(100, Math.max(1, query?.limit || 50));
    const skip = (page - 1) * limit;

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const where: Prisma.AgendaEventWhereInput = {
        organizationId: ctx.organizationId,
      };

      if (fromDate || toDate) {
        where.fechaInicio = {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        };
      }

      if (query?.responsableId) where.responsableId = query.responsableId;
      if (query?.expedienteId) where.expedienteId = query.expedienteId;
      if (query?.tipo) where.tipo = query.tipo;
      if (query?.estado) where.estado = query.estado;

      if (query?.search?.trim()) {
        const s = query.search.trim();
        where.OR = [
          { titulo: { contains: s, mode: "insensitive" } },
          { descripcion: { contains: s, mode: "insensitive" } },
          { ubicacion: { contains: s, mode: "insensitive" } },
        ];
      }

      const [total, data] = await Promise.all([
        tx.agendaEvent.count({ where }),
        tx.agendaEvent.findMany({
          where,
          select,
          orderBy: [{ fechaInicio: "asc" }, { id: "asc" }],
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
    const select = AGENDA_EVENT_SELECT_BY_ROLE[ctx.orgRole];
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const event = await tx.agendaEvent.findFirst({
        where: { id, organizationId: ctx.organizationId },
        select,
      });

      if (!event) {
        throw new NotFoundException("Evento de agenda no encontrado");
      }

      return event;
    });
  }

  async update(id: string, dto: UpdateAgendaEventDto, ctx: ActiveOrgContext) {
    const select = AGENDA_EVENT_SELECT_BY_ROLE[ctx.orgRole];

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const existing = await tx.agendaEvent.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new NotFoundException("Evento de agenda no encontrado");
      }

      const nextFechaInicio =
        dto.fechaInicio !== undefined
          ? new Date(dto.fechaInicio)
          : existing.fechaInicio;
      const nextFechaFin =
        dto.fechaFin !== undefined
          ? dto.fechaFin
            ? new Date(dto.fechaFin)
            : null
          : existing.fechaFin;

      if (
        Number.isNaN(nextFechaInicio.getTime()) ||
        (nextFechaFin && Number.isNaN(nextFechaFin.getTime()))
      ) {
        throw new BadRequestException("Fechas inválidas");
      }
      if (nextFechaFin && nextFechaFin.getTime() < nextFechaInicio.getTime()) {
        throw new BadRequestException(
          "La fecha de finalización no puede ser anterior a la fecha de inicio",
        );
      }

      if (dto.expedienteId) {
        await this.assertExpedienteInOrg(
          tx,
          dto.expedienteId,
          ctx.organizationId,
        );
      }

      if (dto.responsableId) {
        await this.assertActiveOrgMember(
          tx,
          dto.responsableId,
          ctx.organizationId,
        );
      }

      const nextResponsableId =
        dto.responsableId !== undefined
          ? dto.responsableId
          : existing.responsableId;

      const overlapWarning = await this.detectOverlap(
        tx,
        ctx.organizationId,
        nextResponsableId,
        nextFechaInicio,
        nextFechaFin,
        existing.id,
      );

      const data: Prisma.AgendaEventUpdateInput = {};
      if (dto.titulo !== undefined) data.titulo = dto.titulo.trim();
      if (dto.descripcion !== undefined)
        data.descripcion = dto.descripcion ? dto.descripcion.trim() : null;
      if (dto.tipo !== undefined) data.tipo = dto.tipo;
      if (dto.fechaInicio !== undefined) data.fechaInicio = nextFechaInicio;
      if (dto.fechaFin !== undefined) data.fechaFin = nextFechaFin;
      if (dto.ubicacion !== undefined)
        data.ubicacion = dto.ubicacion ? dto.ubicacion.trim() : null;
      if (dto.estado !== undefined) data.estado = dto.estado;
      if (dto.expedienteId !== undefined) {
        data.expediente = dto.expedienteId
          ? { connect: { id: dto.expedienteId } }
          : { disconnect: true };
      }
      if (dto.responsableId !== undefined) {
        data.responsable = dto.responsableId
          ? { connect: { id: dto.responsableId } }
          : { disconnect: true };
      }

      const event = await tx.agendaEvent.update({
        where: { id: existing.id },
        data,
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "AGENDA_EVENT_UPDATED",
          result: "SUCCESS",
          entityTable: "AgendaEvent",
          entityId: existing.id,
          oldValues: {
            titulo: existing.titulo,
            estado: existing.estado,
            fechaInicio: existing.fechaInicio.toISOString(),
          },
          newValues: {
            titulo: (event as any).titulo,
            estado: (event as any).estado,
            fechaInicio: (event as any).fechaInicio,
          },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return { event, overlapWarning };
    });
  }

  async complete(id: string, ctx: ActiveOrgContext) {
    const select = AGENDA_EVENT_SELECT_BY_ROLE[ctx.orgRole];
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const existing = await tx.agendaEvent.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new NotFoundException("Evento de agenda no encontrado");
      }

      const updated = await tx.agendaEvent.update({
        where: { id: existing.id },
        data: { estado: EstadoEventoAgenda.COMPLETADO },
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "AGENDA_EVENT_COMPLETED",
          result: "SUCCESS",
          entityTable: "AgendaEvent",
          entityId: existing.id,
          oldValues: { estado: existing.estado },
          newValues: { estado: EstadoEventoAgenda.COMPLETADO },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return updated;
    });
  }

  async cancel(id: string, ctx: ActiveOrgContext) {
    const select = AGENDA_EVENT_SELECT_BY_ROLE[ctx.orgRole];
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const existing = await tx.agendaEvent.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new NotFoundException("Evento de agenda no encontrado");
      }

      const updated = await tx.agendaEvent.update({
        where: { id: existing.id },
        data: { estado: EstadoEventoAgenda.CANCELADO },
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "AGENDA_EVENT_CANCELLED",
          result: "SUCCESS",
          entityTable: "AgendaEvent",
          entityId: existing.id,
          oldValues: { estado: existing.estado },
          newValues: { estado: EstadoEventoAgenda.CANCELADO },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return updated;
    });
  }
}
