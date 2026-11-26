import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import {
  ClientPersonType,
  ExpedienteEstado,
  MembershipStatus,
  Prisma,
} from "@prisma/client";
import { ScopedPrismaService } from "../authz/scoped-prisma.service";
import { OrgAuditService } from "../organizations/org-audit.service";
import { ActiveOrgContext } from "../authz/guards/active-org-context.guard";
import { EXPEDIENTE_SELECT_BY_ROLE } from "../authz/permissions";
import { CreateExpedienteDto } from "./dto/create-expediente.dto";
import { UpdateExpedienteDto } from "./dto/update-expediente.dto";
import { QueryExpedienteDto } from "./dto/query-expediente.dto";
import { CreateParteDto, UpdateParteDto } from "./dto/parte.dto";

export interface PaginatedExpedientesResult {
  data: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const PARTE_SELECT: Prisma.ExpedienteParteSelect = {
  id: true,
  expedienteId: true,
  clientId: true,
  nombre: true,
  tipoParte: true,
  cuitDni: true,
  rol: true,
  caracter: true,
  esCliente: true,
  observaciones: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dniCuit: true,
      email: true,
      phone: true,
    },
  },
};

@Injectable()
export class ExpedientesService {
  constructor(
    private readonly scopedPrisma: ScopedPrismaService,
    private readonly auditService: OrgAuditService,
  ) {}

  /**
   * Valida que un usuario tenga membresía ACTIVE en la organización activa.
   */
  private async assertActiveOrgMember(
    tx: Prisma.TransactionClient,
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const membership = await tx.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      select: { status: true },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException(
        "Target user does not have an ACTIVE membership in the active organization",
      );
    }
  }

  /**
   * Valida que un cliente pertenezca a la organización activa.
   */
  private async assertClientInOrg(
    tx: Prisma.TransactionClient,
    clientId: string,
    organizationId: string,
  ): Promise<void> {
    const client = await tx.client.findFirst({
      where: { id: clientId, organizationId },
      select: { id: true },
    });
    if (!client) {
      throw new BadRequestException(
        "El cliente especificado no existe o no pertenece a la organización activa",
      );
    }
  }

  /**
   * Lista expedientes de la organización activa con filtros y búsqueda.
   * Si se pasa page o limit, retorna respuesta paginada { data, total, page, limit, totalPages }.
   * Si no se pasa page ni limit, retorna Expediente[] para retrocompatibilidad con AUTH-04.
   */
  async findAll(
    query: QueryExpedienteDto,
    ctx: ActiveOrgContext,
  ): Promise<PaginatedExpedientesResult | any[]> {
    const select = EXPEDIENTE_SELECT_BY_ROLE[ctx.orgRole];
    const isPaginated = query?.page !== undefined || query?.limit !== undefined;
    const page = Math.max(1, query?.page || 1);
    const limit = Math.min(100, Math.max(1, query?.limit || 10));
    const skip = (page - 1) * limit;

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const where: Prisma.ExpedienteWhereInput = {
        organizationId: ctx.organizationId,
      };

      if (query?.estado) {
        where.estado = query.estado;
      } else {
        where.estado = { not: ExpedienteEstado.ARCHIVADO };
      }

      if (query?.fuero?.trim()) {
        where.fuero = { equals: query.fuero.trim(), mode: "insensitive" };
      }

      if (query?.jurisdiccion?.trim()) {
        where.jurisdiccion = {
          equals: query.jurisdiccion.trim(),
          mode: "insensitive",
        };
      }

      if (query?.provincia?.trim()) {
        where.provincia = {
          equals: query.provincia.trim(),
          mode: "insensitive",
        };
      }

      if (query?.responsableId) {
        where.responsableId = query.responsableId;
      }

      if (query?.clientId) {
        where.partes = {
          some: {
            clientId: query.clientId,
            organizationId: ctx.organizationId,
          },
        };
      }

      if (query?.search?.trim()) {
        const s = query.search.trim();
        where.OR = [
          { caratula: { contains: s, mode: "insensitive" } },
          { numeroExpediente: { contains: s, mode: "insensitive" } },
          { juzgado: { contains: s, mode: "insensitive" } },
          { materia: { contains: s, mode: "insensitive" } },
          {
            partes: {
              some: {
                organizationId: ctx.organizationId,
                OR: [
                  { nombre: { contains: s, mode: "insensitive" } },
                  {
                    client: {
                      OR: [
                        { firstName: { contains: s, mode: "insensitive" } },
                        { lastName: { contains: s, mode: "insensitive" } },
                      ],
                    },
                  },
                ],
              },
            },
          },
        ];
      }

      if (!isPaginated) {
        return tx.expediente.findMany({
          where,
          select,
          orderBy: { updatedAt: "desc" },
        });
      }

      const [total, data] = await Promise.all([
        tx.expediente.count({ where }),
        tx.expediente.findMany({
          where,
          select,
          orderBy: { updatedAt: "desc" },
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

  /**
   * Obtiene el detalle de un expediente con proyección por rol y anti-enumeración (404).
   */
  async findById(id: string, ctx: ActiveOrgContext) {
    const select = EXPEDIENTE_SELECT_BY_ROLE[ctx.orgRole];
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const expediente = await tx.expediente.findFirst({
        where: { id, organizationId: ctx.organizationId },
        select,
      });

      if (!expediente) {
        throw new NotFoundException("Expediente no encontrado");
      }

      return expediente;
    });
  }

  /**
   * Crea un expediente con sus datos judiciales, responsable, equipo y partes iniciales.
   */
  async create(dto: CreateExpedienteDto, ctx: ActiveOrgContext) {
    const numeroExpediente = (dto.numeroExpediente ?? dto.numero)?.trim();
    if (!numeroExpediente) {
      throw new BadRequestException(
        "El número de expediente (numeroExpediente o numero) es obligatorio",
      );
    }

    const select = EXPEDIENTE_SELECT_BY_ROLE[ctx.orgRole];

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      if (dto.responsableId) {
        await this.assertActiveOrgMember(
          tx,
          dto.responsableId,
          ctx.organizationId,
        );
      }

      if (dto.userIds?.length) {
        for (const uid of dto.userIds) {
          await this.assertActiveOrgMember(tx, uid, ctx.organizationId);
        }
      }

      if (dto.partes?.length) {
        for (const parte of dto.partes) {
          if (parte.clientId) {
            await this.assertClientInOrg(
              tx,
              parte.clientId,
              ctx.organizationId,
            );
          }
        }
      }

      const data: Prisma.ExpedienteCreateInput = {
        organization: { connect: { id: ctx.organizationId } },
        caratula: dto.caratula.trim(),
        numeroExpediente,
        juzgado: dto.juzgado.trim(),
        jurisdiccion: dto.jurisdiccion?.trim() || "NACION",
        provincia: dto.provincia?.trim() || null,
        fuero: dto.fuero?.trim() || null,
        secretaria: dto.secretaria?.trim() || null,
        tipoProceso: dto.tipoProceso?.trim() || null,
        materia: dto.materia?.trim() || null,
        fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : null,
        descripcion: dto.descripcion?.trim() || null,
        estado: dto.estado ?? ExpedienteEstado.INICIO,
        tags: dto.tags ?? [],
        ...(dto.responsableId
          ? { responsable: { connect: { id: dto.responsableId } } }
          : {}),
        ...(dto.userIds?.length
          ? { users: { connect: dto.userIds.map((id) => ({ id })) } }
          : {}),
        ...(dto.partes?.length
          ? {
              partes: {
                create: dto.partes.map((p) => ({
                  organization: { connect: { id: ctx.organizationId } },
                  ...(p.clientId
                    ? { client: { connect: { id: p.clientId } } }
                    : {}),
                  nombre: p.nombre.trim(),
                  tipoParte: p.tipoParte ?? ClientPersonType.HUMANA,
                  cuitDni: p.cuitDni?.trim() || null,
                  rol: p.rol,
                  caracter: p.caracter?.trim() || null,
                  esCliente: p.esCliente ?? Boolean(p.clientId),
                  observaciones: p.observaciones?.trim() || null,
                })),
              },
            }
          : {}),
      };

      const expediente = await tx.expediente.create({
        data,
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "EXPEDIENTE_CREATED",
          result: "SUCCESS",
          entityTable: "Expediente",
          entityId: (expediente as any).id,
          newValues: {
            caratula: (expediente as any).caratula,
            numeroExpediente: (expediente as any).numeroExpediente,
            estado: (expediente as any).estado,
            jurisdiccion: (expediente as any).jurisdiccion,
          },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return expediente;
    });
  }

  /**
   * Actualiza los datos generales de un expediente dentro de la organización activa.
   */
  async update(id: string, dto: UpdateExpedienteDto, ctx: ActiveOrgContext) {
    const select = EXPEDIENTE_SELECT_BY_ROLE[ctx.orgRole];

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const existing = await tx.expediente.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new NotFoundException("Expediente no encontrado");
      }

      if (dto.responsableId) {
        await this.assertActiveOrgMember(
          tx,
          dto.responsableId,
          ctx.organizationId,
        );
      }

      const data: Prisma.ExpedienteUpdateInput = {};

      if (dto.caratula !== undefined) data.caratula = dto.caratula.trim();
      const nextNum = dto.numeroExpediente ?? dto.numero;
      if (nextNum !== undefined) data.numeroExpediente = nextNum.trim();
      if (dto.juzgado !== undefined) data.juzgado = dto.juzgado.trim();
      if (dto.jurisdiccion !== undefined)
        data.jurisdiccion = dto.jurisdiccion.trim();
      if (dto.provincia !== undefined)
        data.provincia = dto.provincia ? dto.provincia.trim() : null;
      if (dto.fuero !== undefined)
        data.fuero = dto.fuero ? dto.fuero.trim() : null;
      if (dto.secretaria !== undefined)
        data.secretaria = dto.secretaria ? dto.secretaria.trim() : null;
      if (dto.tipoProceso !== undefined)
        data.tipoProceso = dto.tipoProceso ? dto.tipoProceso.trim() : null;
      if (dto.materia !== undefined)
        data.materia = dto.materia ? dto.materia.trim() : null;
      if (dto.fechaInicio !== undefined)
        data.fechaInicio = dto.fechaInicio ? new Date(dto.fechaInicio) : null;
      if (dto.descripcion !== undefined)
        data.descripcion = dto.descripcion ? dto.descripcion.trim() : null;
      if (dto.estado !== undefined) data.estado = dto.estado;
      if (dto.tags !== undefined) data.tags = dto.tags;
      if (dto.responsableId !== undefined) {
        data.responsable = dto.responsableId
          ? { connect: { id: dto.responsableId } }
          : { disconnect: true };
      }

      const updated = await tx.expediente.update({
        where: { id: existing.id },
        data,
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "EXPEDIENTE_UPDATED",
          result: "SUCCESS",
          entityTable: "Expediente",
          entityId: existing.id,
          oldValues: {
            caratula: existing.caratula,
            numeroExpediente: existing.numeroExpediente,
            estado: existing.estado,
            juzgado: existing.juzgado,
          },
          newValues: {
            caratula: (updated as any).caratula,
            numeroExpediente: (updated as any).numeroExpediente,
            estado: (updated as any).estado,
            juzgado: (updated as any).juzgado,
          },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Archiva un expediente (soft delete a estado ARCHIVADO).
   */
  async archive(id: string, ctx: ActiveOrgContext) {
    const select = EXPEDIENTE_SELECT_BY_ROLE[ctx.orgRole];

    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const existing = await tx.expediente.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new NotFoundException("Expediente no encontrado");
      }

      const archived = await tx.expediente.update({
        where: { id: existing.id },
        data: { estado: ExpedienteEstado.ARCHIVADO },
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "EXPEDIENTE_ARCHIVED",
          result: "SUCCESS",
          entityTable: "Expediente",
          entityId: existing.id,
          oldValues: { estado: existing.estado },
          newValues: { estado: ExpedienteEstado.ARCHIVADO },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return archived;
    });
  }

  /**
   * Agrega una parte procesal a un expediente existente validando pertenencia a la org.
   */
  async addParte(
    expedienteId: string,
    dto: CreateParteDto,
    ctx: ActiveOrgContext,
  ) {
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const expediente = await tx.expediente.findFirst({
        where: { id: expedienteId, organizationId: ctx.organizationId },
        select: { id: true },
      });

      if (!expediente) {
        throw new NotFoundException("Expediente no encontrado");
      }

      if (dto.clientId) {
        await this.assertClientInOrg(tx, dto.clientId, ctx.organizationId);
      }

      const parte = await tx.expedienteParte.create({
        data: {
          expediente: { connect: { id: expediente.id } },
          organization: { connect: { id: ctx.organizationId } },
          ...(dto.clientId
            ? { client: { connect: { id: dto.clientId } } }
            : {}),
          nombre: dto.nombre.trim(),
          tipoParte: dto.tipoParte ?? ClientPersonType.HUMANA,
          cuitDni: dto.cuitDni?.trim() || null,
          rol: dto.rol,
          caracter: dto.caracter?.trim() || null,
          esCliente: dto.esCliente ?? Boolean(dto.clientId),
          observaciones: dto.observaciones?.trim() || null,
        },
        select: PARTE_SELECT,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "EXPEDIENTE_PARTE_ADDED",
          result: "SUCCESS",
          entityTable: "ExpedienteParte",
          entityId: parte.id,
          newValues: {
            expedienteId: expediente.id,
            nombre: parte.nombre,
            rol: parte.rol,
            clientId: parte.clientId,
          },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return parte;
    });
  }

  /**
   * Modifica una parte procesal dentro de un expediente de la organización activa.
   */
  async updateParte(
    expedienteId: string,
    parteId: string,
    dto: UpdateParteDto,
    ctx: ActiveOrgContext,
  ) {
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const existing = await tx.expedienteParte.findFirst({
        where: {
          id: parteId,
          expedienteId,
          organizationId: ctx.organizationId,
        },
      });

      if (!existing) {
        throw new NotFoundException("Parte procesal no encontrada");
      }

      if (dto.clientId) {
        await this.assertClientInOrg(tx, dto.clientId, ctx.organizationId);
      }

      const data: Prisma.ExpedienteParteUpdateInput = {};
      if (dto.nombre !== undefined) data.nombre = dto.nombre.trim();
      if (dto.tipoParte !== undefined) data.tipoParte = dto.tipoParte;
      if (dto.cuitDni !== undefined)
        data.cuitDni = dto.cuitDni ? dto.cuitDni.trim() : null;
      if (dto.rol !== undefined) data.rol = dto.rol;
      if (dto.caracter !== undefined)
        data.caracter = dto.caracter ? dto.caracter.trim() : null;
      if (dto.esCliente !== undefined) data.esCliente = dto.esCliente;
      if (dto.observaciones !== undefined)
        data.observaciones = dto.observaciones
          ? dto.observaciones.trim()
          : null;
      if (dto.clientId !== undefined) {
        data.client = dto.clientId
          ? { connect: { id: dto.clientId } }
          : { disconnect: true };
      }

      const updated = await tx.expedienteParte.update({
        where: { id: existing.id },
        data,
        select: PARTE_SELECT,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "EXPEDIENTE_PARTE_UPDATED",
          result: "SUCCESS",
          entityTable: "ExpedienteParte",
          entityId: existing.id,
          newValues: {
            expedienteId,
            nombre: updated.nombre,
            rol: updated.rol,
          },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Elimina una parte procesal de un expediente de la organización activa.
   */
  async removeParte(
    expedienteId: string,
    parteId: string,
    ctx: ActiveOrgContext,
  ) {
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const existing = await tx.expedienteParte.findFirst({
        where: {
          id: parteId,
          expedienteId,
          organizationId: ctx.organizationId,
        },
      });

      if (!existing) {
        throw new NotFoundException("Parte procesal no encontrada");
      }

      await tx.expedienteParte.delete({
        where: { id: existing.id },
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          action: "EXPEDIENTE_PARTE_REMOVED",
          result: "SUCCESS",
          entityTable: "ExpedienteParte",
          entityId: existing.id,
          oldValues: {
            expedienteId,
            nombre: existing.nombre,
            rol: existing.rol,
          },
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return { deleted: true, id: existing.id };
    });
  }

  /**
   * Asigna un usuario a un expediente validando en aplicación (y RLS _ExpedienteToUser)
   * que el expediente pertenece a ctx.organizationId y el usuario tiene membresía ACTIVE en esa org.
   */
  async assignUser(
    expedienteId: string,
    targetUserId: string,
    ctx: ActiveOrgContext,
  ) {
    const select = EXPEDIENTE_SELECT_BY_ROLE[ctx.orgRole];
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const expediente = await tx.expediente.findFirst({
        where: { id: expedienteId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!expediente) {
        throw new NotFoundException("Expediente not found");
      }

      await this.assertActiveOrgMember(tx, targetUserId, ctx.organizationId);

      const updated = await tx.expediente.update({
        where: { id: expediente.id },
        data: { users: { connect: { id: targetUserId } } },
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          targetUserId,
          action: "EXPEDIENTE_USER_ASSIGNED",
          result: "SUCCESS",
          entityTable: "Expediente",
          entityId: expediente.id,
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Desasigna un usuario de un expediente dentro de la organización activa.
   */
  async unassignUser(
    expedienteId: string,
    targetUserId: string,
    ctx: ActiveOrgContext,
  ) {
    const select = EXPEDIENTE_SELECT_BY_ROLE[ctx.orgRole];
    return this.scopedPrisma.runInOrgContext(ctx, async (tx) => {
      const expediente = await tx.expediente.findFirst({
        where: { id: expedienteId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!expediente) {
        throw new NotFoundException("Expediente no encontrado");
      }

      const updated = await tx.expediente.update({
        where: { id: expediente.id },
        data: { users: { disconnect: { id: targetUserId } } },
        select,
      });

      await this.auditService.record(
        {
          actorId: ctx.userId,
          organizationId: ctx.organizationId,
          targetUserId,
          action: "EXPEDIENTE_USER_UNASSIGNED",
          result: "SUCCESS",
          entityTable: "Expediente",
          entityId: expediente.id,
          correlationId: ctx.correlationId,
        },
        tx,
      );

      return updated;
    });
  }
}
