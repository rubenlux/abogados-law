/**
 * Servicio de Invitaciones a Organizaciones (AUTH-03).
 * Especificación: SPEC-AUTH-001 v1.0.8 | Expediente: AUTH0-IMPLEMENTATION-007
 *
 * Garantías de Seguridad:
 * - Token CSPRNG de 32 bytes; en PostgreSQL se persiste ÚNICAMENTE su hash SHA-256.
 * - Uso único y consumo atómico en PostgreSQL mediante `UPDATE ... WHERE status = 'PENDING' AND expiresAt > NOW() RETURNING id`.
 * - Aceptación estrictamente transaccional: invitación ACCEPTED + membresía ACTIVE + auditoría en una sola transacción.
 * - Requiere identidad Auth0 autenticada persistida (`UserIdentity`); nunca vincula identidades únicamente por email.
 * - Cero almacenamiento de tokens o hashes en registros de auditoría o logs.
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import * as crypto from "crypto";
import {
  InvitationStatus,
  MembershipStatus,
  OrganizationRole,
  OrganizationStatus,
  User,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { OrgAuditService } from "./org-audit.service";
import { CreateInvitationDto } from "./dto/organizations.dto";
import { OrgRequestContext } from "./guards/org-roles.guard";
import { RequestMeta } from "./organizations.service";

const DEFAULT_INVITATION_TTL_HOURS = 72;

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private auditService: OrgAuditService,
  ) {}

  async issueInvitation(
    organizationId: string,
    actorContext: OrgRequestContext,
    dto: CreateInvitationDto,
    meta?: RequestMeta,
  ) {
    // ORG_OWNER no puede otorgarse vía invitación (requiere creación o transferencia explícita)
    if (dto.role === OrganizationRole.ORG_OWNER) {
      throw new ForbiddenException(
        "ORG_OWNER role cannot be assigned via invitation; use explicit ownership transfer",
      );
    }

    const normalizedEmail = dto.invitedEmail.trim().toLowerCase();
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = this.hashToken(rawToken);
    const ttlHours = dto.expiresInHours || DEFAULT_INVITATION_TTL_HOURS;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const invitation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organizationInvitation.create({
        data: {
          organizationId,
          role: dto.role,
          tokenHash,
          invitedEmail: normalizedEmail,
          targetUserId: dto.targetUserId || null,
          invitedById: actorContext.userId,
          status: InvitationStatus.PENDING,
          expiresAt,
        },
      });

      await this.auditService.record(
        {
          actorId: actorContext.userId,
          organizationId,
          targetUserId: dto.targetUserId || null,
          action: "INVITATION_ISSUED",
          result: "SUCCESS",
          entityTable: "OrganizationInvitation",
          entityId: created.id,
          newValues: {
            invitedEmail: normalizedEmail,
            role: created.role,
            expiresAt: created.expiresAt.toISOString(),
          },
          correlationId: meta?.correlationId || actorContext.correlationId,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
        tx,
      );

      return created;
    });

    return {
      invitation: {
        id: invitation.id,
        organizationId: invitation.organizationId,
        role: invitation.role,
        invitedEmail: invitation.invitedEmail,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        invitedById: invitation.invitedById,
        createdAt: invitation.createdAt,
      },
      // El token en texto plano se entrega UNA sola vez para futura integración de entrega/correo
      invitationToken: rawToken,
    };
  }

  async revokeInvitation(
    organizationId: string,
    invitationId: string,
    actorContext: OrgRequestContext,
    meta?: RequestMeta,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.organizationInvitation.findUnique({
        where: { id: invitationId },
      });

      if (!invitation || invitation.organizationId !== organizationId) {
        throw new NotFoundException("Invitation not found in organization");
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new BadRequestException(
          `Cannot revoke invitation in status ${invitation.status}`,
        );
      }

      const updated = await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.REVOKED,
          revokedAt: new Date(),
          revokedById: actorContext.userId,
        },
      });

      await this.auditService.record(
        {
          actorId: actorContext.userId,
          organizationId,
          targetUserId: invitation.targetUserId,
          action: "INVITATION_REVOKED",
          result: "SUCCESS",
          entityTable: "OrganizationInvitation",
          entityId: invitation.id,
          oldValues: { status: invitation.status },
          newValues: { status: updated.status },
          correlationId: meta?.correlationId || actorContext.correlationId,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
        tx,
      );

      return {
        id: updated.id,
        organizationId: updated.organizationId,
        status: updated.status,
        revokedAt: updated.revokedAt,
      };
    });
  }

  async acceptInvitation(actor: User, rawToken: string, meta?: RequestMeta) {
    if (!rawToken || !rawToken.trim()) {
      throw new BadRequestException("Invitation token is required");
    }

    const tokenHash = this.hashToken(rawToken.trim());
    const correlationId = meta?.correlationId || crypto.randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.organizationInvitation.findUnique({
        where: { tokenHash },
        include: { organization: true },
      });

      if (!invitation) {
        throw new BadRequestException("Invalid invitation token");
      }

      if (invitation.status === InvitationStatus.ACCEPTED) {
        throw new ConflictException("Invitation has already been accepted");
      }

      if (invitation.status === InvitationStatus.REVOKED) {
        throw new BadRequestException("Invitation has been revoked");
      }

      if (
        invitation.status === InvitationStatus.EXPIRED ||
        new Date(invitation.expiresAt).getTime() <= Date.now()
      ) {
        if (invitation.status === InvitationStatus.PENDING) {
          await tx.organizationInvitation.update({
            where: { id: invitation.id },
            data: { status: InvitationStatus.EXPIRED },
          });
        }
        throw new BadRequestException("Invitation has expired");
      }

      if (
        !invitation.organization ||
        invitation.organization.status !== OrganizationStatus.ACTIVE
      ) {
        throw new ForbiddenException("Target organization is not active");
      }

      // 1. Verificar identidad Auth0 autenticada (NUNCA vincular automáticamente solo por email)
      const identities = await tx.userIdentity.findMany({
        where: { userId: actor.id },
      });

      if (!identities || identities.length === 0) {
        throw new ForbiddenException(
          "Authenticated Auth0 identity is required to accept an invitation",
        );
      }

      // 2. Comprobar elegibilidad del destinatario autenticado
      if (invitation.targetUserId) {
        if (invitation.targetUserId !== actor.id) {
          throw new ForbiddenException(
            "Authenticated user is not the intended recipient of this invitation",
          );
        }
      } else {
        const expectedEmail = invitation.invitedEmail.toLowerCase();
        const identitiesWithAuthEmail = identities.filter(
          (id) =>
            typeof id.authEmail === "string" && id.authEmail.trim() !== "",
        );

        const isEligible =
          identitiesWithAuthEmail.length > 0
            ? identitiesWithAuthEmail.some(
                (id) => id.authEmail!.trim().toLowerCase() === expectedEmail,
              )
            : actor.email.trim().toLowerCase() === expectedEmail;

        if (!isEligible) {
          throw new ForbiddenException(
            "Authenticated identity is not eligible to accept this invitation",
          );
        }
      }

      // 3. Comprobar membresía previa en la organización destino
      const existingMembership = await tx.organizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: actor.id,
            organizationId: invitation.organizationId,
          },
        },
      });

      if (
        existingMembership &&
        existingMembership.status === MembershipStatus.ACTIVE
      ) {
        throw new ConflictException(
          "User is already an active member of this organization",
        );
      }

      if (
        existingMembership &&
        existingMembership.status === MembershipStatus.SUSPENDED
      ) {
        throw new ForbiddenException(
          "Existing membership in target organization is suspended",
        );
      }

      // 4. Consumo atómico condicional en PostgreSQL (un solo ganador bajo concurrencia)
      const claimed = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE "OrganizationInvitation"
        SET "status" = 'ACCEPTED'::"InvitationStatus",
            "acceptedAt" = NOW(),
            "acceptedByUserId" = ${actor.id},
            "updatedAt" = NOW()
        WHERE "id" = ${invitation.id}
          AND "status" = 'PENDING'::"InvitationStatus"
          AND "expiresAt" > NOW()
        RETURNING "id"
      `;

      if (!claimed || claimed.length === 0) {
        throw new ConflictException(
          "Invitation has already been accepted or expired",
        );
      }

      // 5. Crear o reactivar (si estaba REVOKED) la membresía en la misma transacción
      const now = new Date();
      const membership = existingMembership
        ? await tx.organizationMembership.update({
            where: { id: existingMembership.id },
            data: {
              role: invitation.role,
              status: MembershipStatus.ACTIVE,
              invitedById: invitation.invitedById,
              joinedAt: now,
              revokedAt: null,
              suspendedAt: null,
            },
          })
        : await tx.organizationMembership.create({
            data: {
              userId: actor.id,
              organizationId: invitation.organizationId,
              role: invitation.role,
              status: MembershipStatus.ACTIVE,
              invitedById: invitation.invitedById,
              joinedAt: now,
            },
          });

      await this.auditService.record(
        {
          actorId: actor.id,
          organizationId: invitation.organizationId,
          targetUserId: actor.id,
          action: "INVITATION_ACCEPTED",
          result: "SUCCESS",
          entityTable: "OrganizationInvitation",
          entityId: invitation.id,
          oldValues: { status: InvitationStatus.PENDING },
          newValues: { status: InvitationStatus.ACCEPTED },
          correlationId,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
        tx,
      );

      await this.auditService.record(
        {
          actorId: actor.id,
          organizationId: invitation.organizationId,
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

      return {
        invitation: {
          id: invitation.id,
          organizationId: invitation.organizationId,
          status: InvitationStatus.ACCEPTED,
        },
        membership,
      };
    });
  }

  private hashToken(rawToken: string): string {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
  }
}
