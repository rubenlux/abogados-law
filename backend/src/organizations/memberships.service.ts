/**
 * Servicio de Gestión de Membresías, Roles Contextuales y Transferencia de Propiedad (AUTH-03).
 * Especificación: SPEC-AUTH-001 v1.0.8 | Expediente: AUTH0-IMPLEMENTATION-007
 *
 * Transiciones válidas de MembershipStatus:
 * - INVITED   -> ACTIVE (vía aceptación de invitación) | REVOKED
 * - ACTIVE    -> SUSPENDED | REVOKED
 * - SUSPENDED -> ACTIVE | REVOKED
 * - REVOKED   -> (terminal: requiere nueva invitación; preserva historial e identidad global)
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { MembershipStatus, OrganizationRole, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { OrgAuditService } from "./org-audit.service";
import { OrgRequestContext } from "./guards/org-roles.guard";
import { RequestMeta } from "./organizations.service";

@Injectable()
export class MembershipsService {
  constructor(
    private prisma: PrismaService,
    private auditService: OrgAuditService,
  ) {}

  /**
   * Adquiere bloqueo transaccional exclusivo sobre la fila Organization (PostgreSQL FOR UPDATE)
   * para serializar mutaciones críticas de membresías/propiedad y erradicar write-skew concurrente.
   */
  private async lockOrganizationForUpdate(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<void> {
    await tx.$queryRaw`
      SELECT "id" FROM "Organization"
      WHERE "id" = ${organizationId}
      FOR UPDATE
    `;
  }

  private async verifyActorStillActiveInTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    actorContext: OrgRequestContext,
    requireOwner = false,
  ): Promise<void> {
    const actorMembership = await tx.organizationMembership.findUnique({
      where: { id: actorContext.membershipId },
    });
    if (
      !actorMembership ||
      actorMembership.organizationId !== organizationId ||
      actorMembership.status !== MembershipStatus.ACTIVE
    ) {
      throw new ForbiddenException(
        "Actor membership is no longer active in this organization",
      );
    }
    if (requireOwner && actorMembership.role !== OrganizationRole.ORG_OWNER) {
      throw new ForbiddenException(
        "Active ORG_OWNER membership is required for this operation",
      );
    }
  }

  async listMembers(organizationId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { organizationId },
      include: { user: true },
    });

    return memberships.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      organizationId: m.organizationId,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
      suspendedAt: m.suspendedAt,
      revokedAt: m.revokedAt,
      user: m.user
        ? {
            id: m.user.id,
            email: m.user.email,
            fullName: m.user.fullName,
          }
        : null,
    }));
  }

  async suspendMember(
    organizationId: string,
    membershipId: string,
    actorContext: OrgRequestContext,
    meta?: RequestMeta,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrganizationForUpdate(tx, organizationId);
      await this.verifyActorStillActiveInTx(tx, organizationId, actorContext);

      const target = await tx.organizationMembership.findUnique({
        where: { id: membershipId },
      });

      if (!target || target.organizationId !== organizationId) {
        throw new NotFoundException("Membership not found in organization");
      }

      // ORG_ADMIN no puede suspender a un ORG_OWNER
      if (
        actorContext.orgRole !== OrganizationRole.ORG_OWNER &&
        target.role === OrganizationRole.ORG_OWNER
      ) {
        throw new ForbiddenException(
          "Only an organization owner can manage an owner membership",
        );
      }

      if (target.status !== MembershipStatus.ACTIVE) {
        throw new BadRequestException(
          `Cannot suspend membership in status ${target.status}`,
        );
      }

      // Proteger última membresía propietaria activa
      if (target.role === OrganizationRole.ORG_OWNER) {
        const activeOwners = await tx.organizationMembership.count({
          where: {
            organizationId,
            role: OrganizationRole.ORG_OWNER,
            status: MembershipStatus.ACTIVE,
          },
        });
        if (activeOwners <= 1) {
          throw new ConflictException(
            "Cannot suspend the last active organization owner",
          );
        }
      }

      const updated = await tx.organizationMembership.update({
        where: { id: target.id },
        data: {
          status: MembershipStatus.SUSPENDED,
          suspendedAt: new Date(),
        },
      });

      // Desvincular organización activa de sesiones vigentes del usuario en esta org
      await tx.userSession.updateMany({
        where: {
          userId: target.userId,
          activeOrganizationId: organizationId,
        },
        data: { activeOrganizationId: null },
      });

      await this.auditService.record(
        {
          actorId: actorContext.userId,
          organizationId,
          targetUserId: target.userId,
          action: "MEMBERSHIP_SUSPENDED",
          result: "SUCCESS",
          entityTable: "OrganizationMembership",
          entityId: target.id,
          oldValues: { status: target.status, role: target.role },
          newValues: { status: updated.status, role: updated.role },
          correlationId: meta?.correlationId || actorContext.correlationId,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
        tx,
      );

      return updated;
    });
  }

  async reactivateMember(
    organizationId: string,
    membershipId: string,
    actorContext: OrgRequestContext,
    meta?: RequestMeta,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrganizationForUpdate(tx, organizationId);
      await this.verifyActorStillActiveInTx(tx, organizationId, actorContext);

      const target = await tx.organizationMembership.findUnique({
        where: { id: membershipId },
      });

      if (!target || target.organizationId !== organizationId) {
        throw new NotFoundException("Membership not found in organization");
      }

      if (
        actorContext.orgRole !== OrganizationRole.ORG_OWNER &&
        target.role === OrganizationRole.ORG_OWNER
      ) {
        throw new ForbiddenException(
          "Only an organization owner can manage an owner membership",
        );
      }

      if (target.status !== MembershipStatus.SUSPENDED) {
        throw new BadRequestException(
          `Only SUSPENDED memberships can be reactivated directly (current: ${target.status})`,
        );
      }

      const updated = await tx.organizationMembership.update({
        where: { id: target.id },
        data: {
          status: MembershipStatus.ACTIVE,
          suspendedAt: null,
        },
      });

      await this.auditService.record(
        {
          actorId: actorContext.userId,
          organizationId,
          targetUserId: target.userId,
          action: "MEMBERSHIP_ACTIVATED",
          result: "SUCCESS",
          entityTable: "OrganizationMembership",
          entityId: target.id,
          oldValues: { status: target.status },
          newValues: { status: updated.status },
          correlationId: meta?.correlationId || actorContext.correlationId,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
        tx,
      );

      return updated;
    });
  }

  async revokeMember(
    organizationId: string,
    membershipId: string,
    actorContext: OrgRequestContext,
    meta?: RequestMeta,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrganizationForUpdate(tx, organizationId);
      await this.verifyActorStillActiveInTx(tx, organizationId, actorContext);

      const target = await tx.organizationMembership.findUnique({
        where: { id: membershipId },
      });

      if (!target || target.organizationId !== organizationId) {
        throw new NotFoundException("Membership not found in organization");
      }

      if (
        actorContext.orgRole !== OrganizationRole.ORG_OWNER &&
        target.role === OrganizationRole.ORG_OWNER
      ) {
        throw new ForbiddenException(
          "Only an organization owner can revoke an owner membership",
        );
      }

      if (target.status === MembershipStatus.REVOKED) {
        throw new BadRequestException("Membership is already revoked");
      }

      // Proteger última membresía propietaria activa
      if (
        target.role === OrganizationRole.ORG_OWNER &&
        target.status === MembershipStatus.ACTIVE
      ) {
        const activeOwners = await tx.organizationMembership.count({
          where: {
            organizationId,
            role: OrganizationRole.ORG_OWNER,
            status: MembershipStatus.ACTIVE,
          },
        });
        if (activeOwners <= 1) {
          throw new ConflictException(
            "Cannot revoke the last active organization owner without transferring ownership",
          );
        }
      }

      const updated = await tx.organizationMembership.update({
        where: { id: target.id },
        data: {
          status: MembershipStatus.REVOKED,
          revokedAt: new Date(),
        },
      });

      await tx.userSession.updateMany({
        where: {
          userId: target.userId,
          activeOrganizationId: organizationId,
        },
        data: { activeOrganizationId: null },
      });

      await this.auditService.record(
        {
          actorId: actorContext.userId,
          organizationId,
          targetUserId: target.userId,
          action: "MEMBERSHIP_REVOKED",
          result: "SUCCESS",
          entityTable: "OrganizationMembership",
          entityId: target.id,
          oldValues: { status: target.status, role: target.role },
          newValues: { status: updated.status, role: updated.role },
          correlationId: meta?.correlationId || actorContext.correlationId,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
        tx,
      );

      return updated;
    });
  }

  async changeMemberRole(
    organizationId: string,
    membershipId: string,
    actorContext: OrgRequestContext,
    newRole: OrganizationRole,
    meta?: RequestMeta,
  ) {
    if (actorContext.orgRole !== OrganizationRole.ORG_OWNER) {
      throw new ForbiddenException("Only ORG_OWNER can change member roles");
    }

    // No asignar ORG_OWNER por cambio ordinario de rol (requiere transferencia explícita)
    if (newRole === OrganizationRole.ORG_OWNER) {
      throw new ForbiddenException(
        "ORG_OWNER role can only be granted via explicit ownership transfer",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockOrganizationForUpdate(tx, organizationId);
      await this.verifyActorStillActiveInTx(
        tx,
        organizationId,
        actorContext,
        true,
      );

      const target = await tx.organizationMembership.findUnique({
        where: { id: membershipId },
      });

      if (!target || target.organizationId !== organizationId) {
        throw new NotFoundException("Membership not found in organization");
      }

      // Prohibición de automodificación / autoelevación de privilegios
      if (target.userId === actorContext.userId) {
        throw new ForbiddenException(
          "Users cannot modify or elevate their own role",
        );
      }

      if (target.status !== MembershipStatus.ACTIVE) {
        throw new BadRequestException(
          "Only ACTIVE memberships can have their role modified",
        );
      }

      if (target.role === OrganizationRole.ORG_OWNER) {
        const activeOwners = await tx.organizationMembership.count({
          where: {
            organizationId,
            role: OrganizationRole.ORG_OWNER,
            status: MembershipStatus.ACTIVE,
          },
        });
        if (activeOwners <= 1) {
          throw new ConflictException(
            "Cannot demote the last active organization owner",
          );
        }
      }

      const updated = await tx.organizationMembership.update({
        where: { id: target.id },
        data: { role: newRole },
      });

      await this.auditService.record(
        {
          actorId: actorContext.userId,
          organizationId,
          targetUserId: target.userId,
          action: "MEMBER_ROLE_CHANGED",
          result: "SUCCESS",
          entityTable: "OrganizationMembership",
          entityId: target.id,
          oldValues: { role: target.role },
          newValues: { role: updated.role },
          correlationId: meta?.correlationId || actorContext.correlationId,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
        tx,
      );

      return updated;
    });
  }

  async transferOwnership(
    organizationId: string,
    actorContext: OrgRequestContext,
    targetMembershipId: string,
    meta?: RequestMeta,
  ) {
    if (actorContext.orgRole !== OrganizationRole.ORG_OWNER) {
      throw new ForbiddenException(
        "Only ORG_OWNER can transfer organization ownership",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockOrganizationForUpdate(tx, organizationId);

      const currentOwner = await tx.organizationMembership.findUnique({
        where: { id: actorContext.membershipId },
      });

      if (
        !currentOwner ||
        currentOwner.organizationId !== organizationId ||
        currentOwner.status !== MembershipStatus.ACTIVE ||
        currentOwner.role !== OrganizationRole.ORG_OWNER
      ) {
        throw new ForbiddenException("Active ORG_OWNER membership required");
      }

      const target = await tx.organizationMembership.findUnique({
        where: { id: targetMembershipId },
      });

      if (!target || target.organizationId !== organizationId) {
        throw new NotFoundException(
          "Target membership not found in organization",
        );
      }

      if (target.userId === actorContext.userId) {
        throw new BadRequestException("Cannot transfer ownership to yourself");
      }

      if (target.status !== MembershipStatus.ACTIVE) {
        throw new BadRequestException(
          "Target member must have an ACTIVE membership to receive ownership",
        );
      }

      const newOwner = await tx.organizationMembership.update({
        where: { id: target.id },
        data: { role: OrganizationRole.ORG_OWNER },
      });

      const previousOwner = await tx.organizationMembership.update({
        where: { id: currentOwner.id },
        data: { role: OrganizationRole.ORG_ADMIN },
      });

      await this.auditService.record(
        {
          actorId: actorContext.userId,
          organizationId,
          targetUserId: target.userId,
          action: "OWNERSHIP_TRANSFERRED",
          result: "SUCCESS",
          entityTable: "Organization",
          entityId: organizationId,
          oldValues: {
            previousOwnerUserId: currentOwner.userId,
            previousTargetRole: target.role,
          },
          newValues: {
            newOwnerUserId: target.userId,
            previousOwnerNewRole: OrganizationRole.ORG_ADMIN,
          },
          correlationId: meta?.correlationId || actorContext.correlationId,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        },
        tx,
      );

      return { newOwner, previousOwner };
    });
  }
}
