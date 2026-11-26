import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { Prisma, ClientStatus, ClientPersonType } from "@prisma/client";
import { ScopedPrismaService } from "../authz/scoped-prisma.service";
import { OrgAuditService } from "../organizations/org-audit.service";
import { ActiveOrgContext } from "../authz/guards/active-org-context.guard";
import { CLIENT_SELECT_BY_ROLE } from "../authz/permissions";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";
import { QueryClientDto } from "./dto/query-client.dto";

export interface PaginatedClientsResult {
  data: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly scopedPrisma: ScopedPrismaService,
    private readonly auditService: OrgAuditService,
  ) {}

  /**
   * Crea un cliente dentro de la organización activa con aislamiento RLS.
   */
  async create(dto: CreateClientDto, ctx: ActiveOrgContext) {
    const dniCuitTrimmed = dto.dniCuit?.trim() || null;

    return this.scopedPrisma.runInOrgContext(
      { organizationId: ctx.organizationId },
      async (tx) => {
        // Validación de unicidad de DNI/CUIT aislada por organización
        if (dniCuitTrimmed) {
          const existing = await tx.client.findFirst({
            where: {
              organizationId: ctx.organizationId,
              dniCuit: dniCuitTrimmed,
            },
          });
          if (existing) {
            throw new ConflictException(
              `Ya existe un cliente con el DNI/CUIT ${dniCuitTrimmed} en esta organización`,
            );
          }
        }

        const data: Prisma.ClientCreateInput = {
          organization: { connect: { id: ctx.organizationId } },
          personType: dto.personType ?? ClientPersonType.HUMANA,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName?.trim() || null,
          dniCuit: dniCuitTrimmed,
          email: dto.email?.trim() || null,
          phone: dto.phone?.trim() || null,
          address: dto.address?.trim() || null,
          city: dto.city?.trim() || null,
          province: dto.province?.trim() || null,
          notes: dto.notes?.trim() || null,
          status: dto.status ?? ClientStatus.ACTIVO,
        };

        const client = await tx.client.create({
          data,
          select: CLIENT_SELECT_BY_ROLE[ctx.orgRole],
        });

        await this.auditService.record(
          {
            actorId: ctx.userId,
            organizationId: ctx.organizationId,
            action: "CLIENT_CREATED",
            result: "SUCCESS",
            entityTable: "Client",
            entityId: (client as any).id,
            newValues: {
              personType: (client as any).personType,
              firstName: (client as any).firstName,
              lastName: (client as any).lastName,
              dniCuit: (client as any).dniCuit,
              status: (client as any).status,
            },
            correlationId: ctx.correlationId,
          },
          tx,
        );

        return client;
      },
    );
  }

  /**
   * Consulta listado paginado con búsqueda y filtros por estado y tipo.
   */
  async findAll(
    query: QueryClientDto,
    ctx: ActiveOrgContext,
  ): Promise<PaginatedClientsResult> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    return this.scopedPrisma.runInOrgContext(
      { organizationId: ctx.organizationId },
      async (tx) => {
        const where: Prisma.ClientWhereInput = {
          organizationId: ctx.organizationId,
        };

        // Filtro de status: si no se especifica, se omiten archivados por omisión
        if (query.status) {
          where.status = query.status;
        } else {
          where.status = { not: ClientStatus.ARCHIVADO };
        }

        // Filtro por tipo de persona
        if (query.personType) {
          where.personType = query.personType;
        }

        // Búsqueda por nombre, apellido, DNI/CUIT, email o teléfono
        if (query.search?.trim()) {
          const s = query.search.trim();
          where.OR = [
            { firstName: { contains: s, mode: "insensitive" } },
            { lastName: { contains: s, mode: "insensitive" } },
            { dniCuit: { contains: s, mode: "insensitive" } },
            { email: { contains: s, mode: "insensitive" } },
            { phone: { contains: s, mode: "insensitive" } },
          ];
        }

        const [total, data] = await Promise.all([
          tx.client.count({ where }),
          tx.client.findMany({
            where,
            select: CLIENT_SELECT_BY_ROLE[ctx.orgRole],
            orderBy: { createdAt: "desc" },
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
      },
    );
  }

  /**
   * Consulta el detalle de un cliente asegurando aislamiento y proyección de rol.
   */
  async findById(id: string, ctx: ActiveOrgContext) {
    return this.scopedPrisma.runInOrgContext(
      { organizationId: ctx.organizationId },
      async (tx) => {
        const client = await tx.client.findFirst({
          where: {
            id,
            organizationId: ctx.organizationId,
          },
          select: CLIENT_SELECT_BY_ROLE[ctx.orgRole],
        });

        if (!client) {
          throw new NotFoundException("Cliente no encontrado");
        }

        return client;
      },
    );
  }

  /**
   * Actualiza datos de un cliente existente dentro de la organización activa.
   */
  async update(id: string, dto: UpdateClientDto, ctx: ActiveOrgContext) {
    return this.scopedPrisma.runInOrgContext(
      { organizationId: ctx.organizationId },
      async (tx) => {
        const existing = await tx.client.findFirst({
          where: {
            id,
            organizationId: ctx.organizationId,
          },
        });

        if (!existing) {
          throw new NotFoundException("Cliente no encontrado");
        }

        const dniCuitTrimmed =
          dto.dniCuit !== undefined ? dto.dniCuit?.trim() || null : undefined;

        if (dniCuitTrimmed && dniCuitTrimmed !== existing.dniCuit) {
          const duplicate = await tx.client.findFirst({
            where: {
              organizationId: ctx.organizationId,
              dniCuit: dniCuitTrimmed,
              id: { not: id },
            },
          });
          if (duplicate) {
            throw new ConflictException(
              `Ya existe otro cliente con el DNI/CUIT ${dniCuitTrimmed} en esta organización`,
            );
          }
        }

        const data: Prisma.ClientUpdateInput = {};
        if (dto.personType !== undefined) data.personType = dto.personType;
        if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
        if (dto.lastName !== undefined)
          data.lastName = dto.lastName?.trim() || null;
        if (dniCuitTrimmed !== undefined) data.dniCuit = dniCuitTrimmed;
        if (dto.email !== undefined) data.email = dto.email?.trim() || null;
        if (dto.phone !== undefined) data.phone = dto.phone?.trim() || null;
        if (dto.address !== undefined)
          data.address = dto.address?.trim() || null;
        if (dto.city !== undefined) data.city = dto.city?.trim() || null;
        if (dto.province !== undefined)
          data.province = dto.province?.trim() || null;
        if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
        if (dto.status !== undefined) data.status = dto.status;

        const updated = await tx.client.update({
          where: { id },
          data,
          select: CLIENT_SELECT_BY_ROLE[ctx.orgRole],
        });

        await this.auditService.record(
          {
            actorId: ctx.userId,
            organizationId: ctx.organizationId,
            action: "CLIENT_UPDATED",
            result: "SUCCESS",
            entityTable: "Client",
            entityId: id,
            oldValues: {
              firstName: existing.firstName,
              lastName: existing.lastName,
              dniCuit: existing.dniCuit,
              status: existing.status,
            },
            newValues: {
              firstName: (updated as any).firstName,
              lastName: (updated as any).lastName,
              dniCuit: (updated as any).dniCuit,
              status: (updated as any).status,
            },
            correlationId: ctx.correlationId,
          },
          tx,
        );

        return updated;
      },
    );
  }

  /**
   * Archiva (soft delete) un cliente preservando la evidencia histórica.
   */
  async archive(id: string, ctx: ActiveOrgContext) {
    return this.scopedPrisma.runInOrgContext(
      { organizationId: ctx.organizationId },
      async (tx) => {
        const existing = await tx.client.findFirst({
          where: {
            id,
            organizationId: ctx.organizationId,
          },
        });

        if (!existing) {
          throw new NotFoundException("Cliente no encontrado");
        }

        const archived = await tx.client.update({
          where: { id },
          data: { status: ClientStatus.ARCHIVADO },
          select: CLIENT_SELECT_BY_ROLE[ctx.orgRole],
        });

        await this.auditService.record(
          {
            actorId: ctx.userId,
            organizationId: ctx.organizationId,
            action: "CLIENT_ARCHIVED",
            result: "SUCCESS",
            entityTable: "Client",
            entityId: id,
            oldValues: { status: existing.status },
            newValues: { status: ClientStatus.ARCHIVADO },
            correlationId: ctx.correlationId,
          },
          tx,
        );

        return archived;
      },
    );
  }
}
