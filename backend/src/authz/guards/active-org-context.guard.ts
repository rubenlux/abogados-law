/**
 * ActiveOrgContextGuard — Fuente Única de Verdad del Contexto Organizacional (AUTH-04)
 * Especificación: SPEC-AUTH-004 v0.2.0 — APPROVED (§6.1, §6.2, §9)
 *
 * Garantías:
 * 1. Resuelve la organización activa EXCLUSIVAMENTE desde req.session.activeOrganizationId (PostgreSQL).
 * 2. Nunca lee ni confía en User.organizationId, User.role, headers arbitrarios, body ni query.
 * 3. Si activeOrganizationId es NULL -> 403 Forbidden (NO_ACTIVE_ORGANIZATION).
 * 4. Revalida en vivo OrganizationMembership (ACTIVE) y Organization (ACTIVE) en cada solicitud.
 * 5. Si la solicitud intenta pasar otro organizationId en body/query/params/x-org-id -> 403 Forbidden.
 * 6. Inyecta req.orgContext congelado (Object.freeze).
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import * as crypto from "crypto";
import {
  MembershipStatus,
  OrganizationRole,
  OrganizationStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma.service";

export interface ActiveOrgContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly membershipId: string;
  readonly orgRole: OrganizationRole;
  readonly correlationId: string;
}

@Injectable()
export class ActiveOrgContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    if (!req?.user?.id || !req?.session) {
      throw new UnauthorizedException("Authenticated BFF session is required");
    }

    const activeOrgId: string | null | undefined =
      req.session.activeOrganizationId;

    if (
      !activeOrgId ||
      typeof activeOrgId !== "string" ||
      !activeOrgId.trim()
    ) {
      throw new ForbiddenException({
        code: "NO_ACTIVE_ORGANIZATION",
        message: "Active organization context is required",
      });
    }

    // Bloquear cualquier intento del cliente de suplantar o cambiar organizationId vía body/query/params/headers
    const clientOrgCandidates: Array<unknown> = [
      req.body?.organizationId,
      req.query?.organizationId,
      req.params?.organizationId,
      req.headers?.["x-org-id"],
      req.headers?.["x-organization-id"],
    ];

    for (const candidate of clientOrgCandidates) {
      if (
        candidate !== undefined &&
        candidate !== null &&
        String(candidate).trim() !== "" &&
        String(candidate).trim() !== activeOrgId
      ) {
        throw new ForbiddenException({
          code: "ORGANIZATION_CONTEXT_MISMATCH",
          message:
            "Client-supplied organizationId does not match active session organization",
        });
      }
    }

    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: req.user.id,
          organizationId: activeOrgId,
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException({
        code: "MEMBERSHIP_INACTIVE",
        message: "Active membership in active organization is required",
      });
    }

    if (
      !membership.organization ||
      membership.organization.status !== OrganizationStatus.ACTIVE
    ) {
      throw new ForbiddenException({
        code: "ORGANIZATION_INACTIVE",
        message: "Active organization is not in ACTIVE status",
      });
    }

    const correlationId =
      (req.headers?.["x-correlation-id"] as string) || crypto.randomUUID();

    req.orgContext = Object.freeze<ActiveOrgContext>({
      userId: req.user.id,
      organizationId: activeOrgId,
      membershipId: membership.id,
      orgRole: membership.role,
      correlationId,
    });

    return true;
  }
}
