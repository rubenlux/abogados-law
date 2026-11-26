/**
 * Servicio de Gestión de Organizaciones Jurídicas (AUTH-03).
 * Especificación: SPEC-AUTH-001 v1.0.8 | Expediente: AUTH0-IMPLEMENTATION-007
 *
 * Transiciones válidas de OrganizationStatus:
 * - ACTIVE    -> SUSPENDED | INACTIVE
 * - SUSPENDED -> ACTIVE | INACTIVE
 * - INACTIVE  -> (terminal: no admite transiciones directas)
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import * as crypto from "crypto";
import {
  MembershipStatus,
  OrganizationRole,
  OrganizationStatus,
  User,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { OrgAuditService } from "./org-audit.service";
import { CreateOrganizationDto } from "./dto/organizations.dto";
import { OrgRequestContext } from "./guards/org-roles.guard";

export interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string;
}

const VALID_ORG_TRANSITIONS: Record<OrganizationStatus, OrganizationStatus[]> =
  {
    [OrganizationStatus.ACTIVE]: [
      OrganizationStatus.SUSPENDED,
      OrganizationStatus.INACTIVE,
    ],
    [OrganizationStatus.SUSPENDED]: [
      OrganizationStatus.ACTIVE,
      OrganizationStatus.INACTIVE,
    ],
    [OrganizationStatus.INACTIVE]: [],
  };

@Injectable()
export class OrganizationsService {
  constructor(
    private prisma: PrismaService,
    private auditService: OrgAuditService,
  ) {}

  async createOrganization(
    actor: User,
    dto: CreateOrganizationDto,
    meta?: RequestMeta,
  ) {
    const legalName = dto.name?.trim();
    if (!legalName) {
      throw new BadRequestException("Organization legal name is required");
    }

    // Verificar que el creador posea una identidad Auth0 enrolada y autenticada
    const identity = await this.prisma.userIdentity.findFirst({
      where: { userId: actor.id },
    });
    if (!identity) {
      throw new ForbiddenException(
        "Authenticated Auth0 identity is required to create an organization",
      );
    }

    const correlationId = meta?.correlationId || crypto.randomUUID();
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: legalName,
          tradeName: dto.tradeName?.trim() || null,
          cuit: dto.cuit?.trim() || null,
          status: OrganizationStatus.ACTIVE,
        },
      });

      const membership = await tx.organizationMembership.create({
        data: {
          userId: actor.id,
          organizationId: organization.id,
          role: OrganizationRole.ORG_OWNER,
          status: MembershipStatus.ACTIVE,
          joinedAt: now,
        },
      });

      await this.auditService.record(
        {
          actorId: actor.id,
          organizationId: organization.id,
          targetUserId: actor.id,
          action: "ORGANIZATION_CREATED",
          result: "SUCCESS",
          entityTable: "Organization",
          entityId: organization.id,
          newValues: {
            name: organization.name,
            tradeName: organization.tradeName,
            cuit: organization.cuit,
            status: organization.status,
          },
          correlationId,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
        tx,
      );

      await this.auditService.record(
        {
          actorId: actor.id,
          organizationId: organization.id,
          targetUserId: actor.id,
          action: "MEMBERSHIP_ACTIVATED",
          result: "SUCCESS",
          entityTable: "OrganizationMembership",
          entityId: membership.id,
          newValues: {
            role: membership.role,
            status: membership.status,
          },
          correlationId,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
        tx,
      );

      return { organization, membership };
    });
  }

  async listUserOrganizations(userId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
      },
      include: {
        organization: true,
      },
    });

    return memberships.map((m) => ({
      membershipId: m.id,
      organizationId: m.organizationId,
      name: m.organization.name,
      tradeName: m.organization.tradeName,
      cuit: m.organization.cuit,
      organizationStatus: m.organization.status,
      role: m.role,
      membershipStatus: m.status,
      joinedAt: m.joinedAt,
    }));
  }

  async updateOrganizationStatus(
    organizationId: string,
    actorContext: OrgRequestContext,
    newStatus: OrganizationStatus,
    meta?: RequestMeta,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException("Organization not found");
    }

    const allowedTargets = VALID_ORG_TRANSITIONS[org.status] || [];
    if (!allowedTargets.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid organization status transition from ${org.status} to ${newStatus}`,
      );
    }

    const action =
      newStatus === OrganizationStatus.SUSPENDED
        ? "ORGANIZATION_SUSPENDED"
        : newStatus === OrganizationStatus.ACTIVE
          ? "ORGANIZATION_REACTIVATED"
          : "ORGANIZATION_DEACTIVATED";

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: { status: newStatus },
      });

      await this.auditService.record(
        {
          actorId: actorContext.userId,
          organizationId,
          action,
          result: "SUCCESS",
          entityTable: "Organization",
          entityId: organizationId,
          oldValues: { status: org.status },
          newValues: { status: newStatus },
          correlationId: meta?.correlationId || actorContext.correlationId,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
        tx,
      );

      return updated;
    });
  }
}
