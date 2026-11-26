import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  EstadoVencimiento,
  MembershipStatus,
  OrigenFechaLimite,
  PrioridadVencimiento,
  Prisma,
  TipoVencimiento,
} from "@prisma/client";
import { ScopedPrismaService } from "../authz/scoped-prisma.service";
import { OrgAuditService } from "../organizations/org-audit.service";
import { ActiveOrgContext } from "../authz/guards/active-org-context.guard";
import { VENCIMIENTO_SELECT_BY_ROLE } from "../authz/permissions";
import {
  ActionVencimientoDto,
  CreateVencimientoDto,
  QueryVencimientoDto,
  UpdateVencimientoDto,
} from "./dto/vencimiento.dto";

@Injectable()
export class VencimientosService {
  constructor(
    private readonly scopedPrisma: ScopedPrismaService,
    private readonly auditService: OrgAuditService,
  ) {}

  /**
   * Identifica en lectura si un vencimiento abierto ya superó su fecha límite,
   * SIN alterar automáticamente su estado persistido en PostgreSQL (AUTH-07 §4.3).
   */
  private withComputedOverdue<
    T extends { estado: EstadoVencimiento; fechaLimite: Date },
  >(row: T): T & { estaVencido: boolean } {
    const isOpen =
      row.estado === EstadoVencimiento.PENDIENTE ||
      row.estado === EstadoVencimiento.EN_CURSO;
    const estaVencido =
      isOpen && new Date(row.fechaLimite).getTime() < Date.now();
    return { ...row, estaVencido };
  }

  private async assertActiveOrgMember(
    tx: Prisma.TransactionClient,
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const membership = await tx.organizationMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
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

  async create(dto: CreateVencimientoDto, ctx: ActiveOrgContext) {
    // Fecha límite ingresada manualmente por el usuario — SIN cálculo jurídico automático
    const fechaLimite = new Date(dto.fechaLimite);
    if (Number.isNaN(fechaLimite.getTime())) {
      throw new BadRequestException("fechaLimite inválida");
    }

    const select = VENCIMIENTO_SELECT_BY_ROLE[ctx.orgRole];

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

      const created = await tx.vencimiento.create({
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
          tipo: dto.tipo ?? TipoVencimiento.PROCESAL,
          fechaLimite,
          origenFechaLimite: OrigenFechaLimite.MANUAL,
          prioridad: dto.prioridad ?? PrioridadVencimiento.NORMAL,
          estado: dto.estado ?? EstadoVencimiento.PENDIENTE,
          observaciones: dto.observaciones?.trim() || null,
        },
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "VENCIMIENTO_CREATED",
          result: "SUCCESS",
          entityTable: "Vencimiento",
          entityId: (created as any).id,
          newValues: {
            titulo: dto.titulo.trim(),
            tipo: dto.tipo ?? TipoVencimiento.PROCESAL,
            fechaLimite: fechaLimite.toISOString(),
            origenFechaLimite: OrigenFechaLimite.MANUAL,
            prioridad: dto.prioridad ?? PrioridadVencimiento.NORMAL,
          },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return this.withComputedOverdue(created as any);
    });
  }

  async findAll(query: QueryVencimientoDto, ctx: ActiveOrgContext) {
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

    const select = VENCIMIENTO_SELECT_BY_ROLE[ctx.orgRole];
    const page = Math.max(1, query?.page || 1);
    const limit = Math.min(100, Math.max(1, query?.limit || 20));
    const skip = (page - 1) * limit;
    const now = new Date();
    const upcomingDays = Math.min(90, Math.max(1, query?.upcomingDays || 7));

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const where: Prisma.VencimientoWhereInput = {
        organizationId: ctx.organizationId,
      };

      if (query?.expedienteId) where.expedienteId = query.expedienteId;
      if (query?.responsableId) where.responsableId = query.responsableId;
      if (query?.prioridad) where.prioridad = query.prioridad;
      if (query?.tipo) where.tipo = query.tipo;

      const scope = query?.scope || "all";
      if (scope === "pendientes") {
        where.estado = {
          in: [EstadoVencimiento.PENDIENTE, EstadoVencimiento.EN_CURSO],
        };
      } else if (scope === "vencidos") {
        where.estado = {
          in: [EstadoVencimiento.PENDIENTE, EstadoVencimiento.EN_CURSO],
        };
        where.fechaLimite = { lt: now };
      } else if (scope === "proximos") {
        const limitDate = new Date(
          now.getTime() + upcomingDays * 24 * 60 * 60 * 1000,
        );
        where.estado = {
          in: [EstadoVencimiento.PENDIENTE, EstadoVencimiento.EN_CURSO],
        };
        where.fechaLimite = { gte: now, lte: limitDate };
      } else if (scope === "cumplidos") {
        where.estado = EstadoVencimiento.CUMPLIDO;
      } else if (query?.estado) {
        where.estado = query.estado;
      }

      if (fromDate || toDate) {
        const existingRange =
          (where.fechaLimite as Prisma.DateTimeFilter) || {};
        where.fechaLimite = {
          ...existingRange,
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        };
      }

      if (query?.search?.trim()) {
        const s = query.search.trim();
        where.OR = [
          { titulo: { contains: s, mode: "insensitive" } },
          { descripcion: { contains: s, mode: "insensitive" } },
          { observaciones: { contains: s, mode: "insensitive" } },
        ];
      }

      const [total, rows] = await Promise.all([
        tx.vencimiento.count({ where }),
        tx.vencimiento.findMany({
          where,
          select,
          orderBy: [{ fechaLimite: "asc" }, { id: "asc" }],
          skip,
          take: limit,
        }),
      ]);

      return {
        data: rows.map((r) => this.withComputedOverdue(r as any)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    });
  }

  async findById(id: string, ctx: ActiveOrgContext) {
    const select = VENCIMIENTO_SELECT_BY_ROLE[ctx.orgRole];
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const row = await tx.vencimiento.findFirst({
        where: { id, organizationId: ctx.organizationId },
        select,
      });

      if (!row) {
        throw new NotFoundException("Vencimiento no encontrado");
      }

      return this.withComputedOverdue(row as any);
    });
  }

  async update(id: string, dto: UpdateVencimientoDto, ctx: ActiveOrgContext) {
    const select = VENCIMIENTO_SELECT_BY_ROLE[ctx.orgRole];

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const existing = await tx.vencimiento.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new NotFoundException("Vencimiento no encontrado");
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

      const data: Prisma.VencimientoUpdateInput = {};
      if (dto.titulo !== undefined) data.titulo = dto.titulo.trim();
      if (dto.descripcion !== undefined)
        data.descripcion = dto.descripcion ? dto.descripcion.trim() : null;
      if (dto.tipo !== undefined) data.tipo = dto.tipo;
      if (dto.fechaLimite !== undefined) {
        const dt = new Date(dto.fechaLimite);
        if (Number.isNaN(dt.getTime())) {
          throw new BadRequestException("fechaLimite inválida");
        }
        data.fechaLimite = dt;
      }
      if (dto.prioridad !== undefined) data.prioridad = dto.prioridad;
      if (dto.estado !== undefined) data.estado = dto.estado;
      if (dto.observaciones !== undefined)
        data.observaciones = dto.observaciones
          ? dto.observaciones.trim()
          : null;
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

      const updated = await tx.vencimiento.update({
        where: { id: existing.id },
        data,
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "VENCIMIENTO_UPDATED",
          result: "SUCCESS",
          entityTable: "Vencimiento",
          entityId: existing.id,
          oldValues: {
            titulo: existing.titulo,
            fechaLimite: existing.fechaLimite.toISOString(),
            prioridad: existing.prioridad,
            estado: existing.estado,
          },
          newValues: {
            titulo: (updated as any).titulo,
            fechaLimite: (updated as any).fechaLimite,
            prioridad: (updated as any).prioridad,
            estado: (updated as any).estado,
          },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return this.withComputedOverdue(updated as any);
    });
  }

  async complete(id: string, dto: ActionVencimientoDto, ctx: ActiveOrgContext) {
    const select = VENCIMIENTO_SELECT_BY_ROLE[ctx.orgRole];
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const existing = await tx.vencimiento.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new NotFoundException("Vencimiento no encontrado");
      }

      const cumplidoAt = new Date();
      const updated = await tx.vencimiento.update({
        where: { id: existing.id },
        data: {
          estado: EstadoVencimiento.CUMPLIDO,
          cumplidoAt,
          cumplidoPor: { connect: { id: ctx.userId } },
          ...(dto?.observaciones !== undefined
            ? { observaciones: dto.observaciones.trim() || null }
            : {}),
        },
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "VENCIMIENTO_COMPLETED",
          result: "SUCCESS",
          entityTable: "Vencimiento",
          entityId: existing.id,
          oldValues: { estado: existing.estado },
          newValues: {
            estado: EstadoVencimiento.CUMPLIDO,
            cumplidoAt: cumplidoAt.toISOString(),
            cumplidoPorId: ctx.userId,
          },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return this.withComputedOverdue(updated as any);
    });
  }

  async cancel(id: string, dto: ActionVencimientoDto, ctx: ActiveOrgContext) {
    const select = VENCIMIENTO_SELECT_BY_ROLE[ctx.orgRole];
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const existing = await tx.vencimiento.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new NotFoundException("Vencimiento no encontrado");
      }

      const updated = await tx.vencimiento.update({
        where: { id: existing.id },
        data: {
          estado: EstadoVencimiento.CANCELADO,
          ...(dto?.observaciones !== undefined
            ? { observaciones: dto.observaciones.trim() || null }
            : {}),
        },
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "VENCIMIENTO_CANCELLED",
          result: "SUCCESS",
          entityTable: "Vencimiento",
          entityId: existing.id,
          oldValues: { estado: existing.estado },
          newValues: { estado: EstadoVencimiento.CANCELADO },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return this.withComputedOverdue(updated as any);
    });
  }
}
