import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrigenMovimiento, Prisma } from "@prisma/client";
import { ScopedPrismaService } from "../authz/scoped-prisma.service";
import { OrgAuditService } from "../organizations/org-audit.service";
import { ActiveOrgContext } from "../authz/guards/active-org-context.guard";
import { MOVIMIENTO_SELECT_BY_ROLE } from "../authz/permissions";
import {
  AnnulMovimientoDto,
  CreateMovimientoDto,
  QueryMovimientoDto,
  UpdateMovimientoDto,
} from "./dto/movimiento.dto";

@Injectable()
export class MovimientosService {
  constructor(
    private readonly scopedPrisma: ScopedPrismaService,
    private readonly auditService: OrgAuditService,
  ) {}

  async create(dto: CreateMovimientoDto, ctx: ActiveOrgContext) {
    const select = MOVIMIENTO_SELECT_BY_ROLE[ctx.orgRole];
    const fechaActuacion = new Date(dto.fechaActuacion);
    if (Number.isNaN(fechaActuacion.getTime())) {
      throw new BadRequestException("fechaActuacion inválida");
    }

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const expediente = await tx.expediente.findFirst({
        where: { id: dto.expedienteId, organizationId: ctx.organizationId },
        select: { id: true },
      });

      if (!expediente) {
        throw new NotFoundException("Expediente no encontrado");
      }

      const movimiento = await tx.movimientoProcesal.create({
        data: {
          organization: { connect: { id: ctx.organizationId } },
          expediente: { connect: { id: expediente.id } },
          registradoPor: { connect: { id: ctx.userId } },
          tipo: dto.tipo,
          titulo: dto.titulo.trim(),
          descripcion: dto.descripcion?.trim() || null,
          fechaActuacion,
          fechaRegistro: new Date(),
          origen: dto.origen ?? OrigenMovimiento.MANUAL,
          referencia: dto.referencia?.trim() || null,
          metadatos:
            (dto.metadatos as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "MOVIMIENTO_CREATED",
          result: "SUCCESS",
          entityTable: "MovimientoProcesal",
          entityId: (movimiento as any).id,
          newValues: {
            expedienteId: expediente.id,
            tipo: dto.tipo,
            titulo: dto.titulo.trim(),
            fechaActuacion: fechaActuacion.toISOString(),
          },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return movimiento;
    });
  }

  async findAll(query: QueryMovimientoDto, ctx: ActiveOrgContext) {
    const select = MOVIMIENTO_SELECT_BY_ROLE[ctx.orgRole];
    const page = Math.max(1, query?.page || 1);
    const limit = Math.min(100, Math.max(1, query?.limit || 20));
    const skip = (page - 1) * limit;
    const dir: Prisma.SortOrder = query?.order === "asc" ? "asc" : "desc";

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const where: Prisma.MovimientoProcesalWhereInput = {
        organizationId: ctx.organizationId,
      };

      if (query?.expedienteId) {
        where.expedienteId = query.expedienteId;
      }

      if (query?.tipo) {
        where.tipo = query.tipo;
      }

      if (!query?.includeAnulados) {
        where.anuladoAt = null;
      }

      if (query?.search?.trim()) {
        const s = query.search.trim();
        where.OR = [
          { titulo: { contains: s, mode: "insensitive" } },
          { descripcion: { contains: s, mode: "insensitive" } },
          { referencia: { contains: s, mode: "insensitive" } },
        ];
      }

      const [total, data] = await Promise.all([
        tx.movimientoProcesal.count({ where }),
        tx.movimientoProcesal.findMany({
          where,
          select,
          orderBy: [
            { fechaActuacion: dir },
            { fechaRegistro: dir },
            { id: dir },
          ],
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
    const select = MOVIMIENTO_SELECT_BY_ROLE[ctx.orgRole];
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const movimiento = await tx.movimientoProcesal.findFirst({
        where: { id, organizationId: ctx.organizationId },
        select,
      });

      if (!movimiento) {
        throw new NotFoundException("Movimiento procesal no encontrado");
      }

      return movimiento;
    });
  }

  async update(id: string, dto: UpdateMovimientoDto, ctx: ActiveOrgContext) {
    const select = MOVIMIENTO_SELECT_BY_ROLE[ctx.orgRole];
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const existing = await tx.movimientoProcesal.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new NotFoundException("Movimiento procesal no encontrado");
      }

      if (existing.anuladoAt) {
        throw new BadRequestException(
          "No se puede editar un movimiento procesal anulado",
        );
      }

      const data: Prisma.MovimientoProcesalUpdateInput = {};
      if (dto.tipo !== undefined) data.tipo = dto.tipo;
      if (dto.titulo !== undefined) data.titulo = dto.titulo.trim();
      if (dto.descripcion !== undefined)
        data.descripcion = dto.descripcion ? dto.descripcion.trim() : null;
      if (dto.fechaActuacion !== undefined) {
        const dt = new Date(dto.fechaActuacion);
        if (Number.isNaN(dt.getTime())) {
          throw new BadRequestException("fechaActuacion inválida");
        }
        data.fechaActuacion = dt;
      }
      if (dto.referencia !== undefined)
        data.referencia = dto.referencia ? dto.referencia.trim() : null;
      if (dto.metadatos !== undefined) {
        data.metadatos =
          dto.metadatos === null
            ? Prisma.JsonNull
            : (dto.metadatos as Prisma.InputJsonValue);
      }

      const updated = await tx.movimientoProcesal.update({
        where: { id: existing.id },
        data,
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "MOVIMIENTO_UPDATED",
          result: "SUCCESS",
          entityTable: "MovimientoProcesal",
          entityId: existing.id,
          oldValues: {
            tipo: existing.tipo,
            titulo: existing.titulo,
            fechaActuacion: existing.fechaActuacion.toISOString(),
            referencia: existing.referencia,
          },
          newValues: {
            tipo: (updated as any).tipo,
            titulo: (updated as any).titulo,
            fechaActuacion: (updated as any).fechaActuacion,
            referencia: (updated as any).referencia,
          },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return updated;
    });
  }

  async annul(id: string, dto: AnnulMovimientoDto, ctx: ActiveOrgContext) {
    const select = MOVIMIENTO_SELECT_BY_ROLE[ctx.orgRole];
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const existing = await tx.movimientoProcesal.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new NotFoundException("Movimiento procesal no encontrado");
      }

      const annulled = await tx.movimientoProcesal.update({
        where: { id: existing.id },
        data: {
          anuladoAt: new Date(),
          anuladoPor: { connect: { id: ctx.userId } },
          anuladoMotivo: dto?.motivo?.trim() || null,
        },
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "MOVIMIENTO_ANNULLED",
          result: "SUCCESS",
          entityTable: "MovimientoProcesal",
          entityId: existing.id,
          oldValues: { anuladoAt: existing.anuladoAt },
          newValues: {
            anuladoAt: (annulled as any).anuladoAt,
            motivo: dto?.motivo?.trim() || null,
          },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return annulled;
    });
  }
}
