/**
 * Guard de Contexto y Autorización por Rol dentro de una Organización (AUTH-03).
 *
 * Garantías:
 * - Resuelve la membresía del usuario autenticado ÚNICAMENTE para el :organizationId de la ruta.
 * - Rechaza membresías inexistentes, INVITED, SUSPENDED o REVOKED (403 Forbidden).
 * - Rechaza organizaciones SUSPENDED o INACTIVE salvo rutas explícitamente anotadas con @AllowSuspendedOrg().
 * - Verifica los roles contextuales (@OrgRoles) de la membresía; nunca traslada roles entre organizaciones.
 * - Inyecta req.orgContext con { userId, organizationId, membershipId, orgRole, correlationId }.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import * as crypto from "crypto";
import {
  MembershipStatus,
  OrganizationRole,
  OrganizationStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma.service";
import {
  ORG_ROLES_KEY,
  ALLOW_SUSPENDED_ORG_KEY,
} from "../decorators/org-roles.decorator";

export interface OrgRequestContext {
  userId: string;
  organizationId: string;
  membershipId: string;
  orgRole: OrganizationRole;
  membershipStatus: MembershipStatus;
  organizationStatus: OrganizationStatus;
  correlationId: string;
}

@Injectable()
export class OrgRolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user || !user.id) {
      throw new UnauthorizedException("Authentication required");
    }

    const organizationId: string | undefined = req.params?.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      throw new ForbiddenException("Missing organization scope");
    }

    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId,
        },
      },
      include: { organization: true },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException(
        "Active membership in target organization is required",
      );
    }

    const allowSuspendedOrg = this.reflector.getAllAndOverride<boolean>(
      ALLOW_SUSPENDED_ORG_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      !membership.organization ||
      (!allowSuspendedOrg &&
        membership.organization.status !== OrganizationStatus.ACTIVE)
    ) {
      throw new ForbiddenException("Target organization is not active");
    }

    const requiredRoles = this.reflector.getAllAndOverride<OrganizationRole[]>(
      ORG_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      requiredRoles &&
      requiredRoles.length > 0 &&
      !requiredRoles.includes(membership.role)
    ) {
      throw new ForbiddenException(
        "Insufficient organization role for this operation",
      );
    }

    const correlationId =
      (req.headers?.["x-correlation-id"] as string) || crypto.randomUUID();

    req.orgContext = {
      userId: user.id,
      organizationId,
      membershipId: membership.id,
      orgRole: membership.role,
      membershipStatus: membership.status,
      organizationStatus: membership.organization.status,
      correlationId,
    } as OrgRequestContext;

    return true;
  }
}
