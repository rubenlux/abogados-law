/**
 * Servicio de Resolución y Selección de Organización Activa en Sesión BFF (AUTH-03).
 * Especificación: SPEC-AUTH-001 v1.0.8 | Expediente: AUTH0-IMPLEMENTATION-007
 *
 * Garantías:
 * - La organización activa se persiste en backend (`UserSession.activeOrganizationId`), nunca como dato confiable del cliente.
 * - Exige membresía `ACTIVE` y organización `ACTIVE` tanto al seleccionar como al resolver en vivo.
 * - Cambiar de organización actualiza el contexto de autorización sin alterar identidad global ni roles.
 */

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import * as crypto from "crypto";
import {
  MembershipStatus,
  OrganizationStatus,
  UserSession,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { OrgAuditService } from "./org-audit.service";
import { RequestMeta } from "./organizations.service";

@Injectable()
export class ActiveOrganizationService {
  constructor(
    private prisma: PrismaService,
    private auditService: OrgAuditService,
  ) {}

  async setActiveOrganization(
    session: UserSession,
    organizationId: string,
    meta?: RequestMeta,
  ) {
    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: session.userId,
          organizationId,
        },
      },
      include: { organization: true },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException(
        "Active membership in the requested organization is required",
      );
    }

    if (
      !membership.organization ||
      membership.organization.status !== OrganizationStatus.ACTIVE
    ) {
      throw new ForbiddenException(
        "Requested organization is suspended or inactive",
      );
    }

    const previousOrgId = session.activeOrganizationId || null;

    await this.prisma.$transaction(async (tx) => {
      await tx.userSession.update({
        where: { id: session.id },
        data: { activeOrganizationId: organizationId },
      });

      await this.auditService.record(
        {
          actorId: session.userId,
          organizationId,
          targetUserId: session.userId,
          action: "ACTIVE_ORGANIZATION_CHANGED",
          result: "SUCCESS",
          entityTable: "UserSession",
          entityId: session.id,
          oldValues: { activeOrganizationId: previousOrgId },
          newValues: {
            activeOrganizationId: organizationId,
            role: membership.role,
          },
          correlationId: meta?.correlationId || crypto.randomUUID(),
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
        tx,
      );
    });

    return {
      organizationId: membership.organizationId,
      name: membership.organization.name,
      tradeName: membership.organization.tradeName,
      membershipId: membership.id,
      role: membership.role,
      membershipStatus: membership.status,
      organizationStatus: membership.organization.status,
    };
  }

  async resolveActiveOrganization(session: UserSession) {
    if (!session.activeOrganizationId) {
      throw new NotFoundException("No active organization selected in session");
    }

    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: session.userId,
          organizationId: session.activeOrganizationId,
        },
      },
      include: { organization: true },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException(
        "Active organization membership is no longer valid",
      );
    }

    if (
      !membership.organization ||
      membership.organization.status !== OrganizationStatus.ACTIVE
    ) {
      throw new ForbiddenException("Active organization is no longer active");
    }

    return {
      organizationId: membership.organizationId,
      name: membership.organization.name,
      tradeName: membership.organization.tradeName,
      membershipId: membership.id,
      role: membership.role,
      membershipStatus: membership.status,
      organizationStatus: membership.organization.status,
    };
  }
}
