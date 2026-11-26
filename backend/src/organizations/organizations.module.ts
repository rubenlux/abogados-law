/**
 * Módulo de Organizaciones, Membresías, Roles Multi-Organización e Invitaciones (AUTH-03).
 * Especificación: SPEC-AUTH-001 v1.0.8 | Expediente: AUTH0-IMPLEMENTATION-007
 */

import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../prisma.service";
import { OrganizationsController } from "./organizations.controller";
import { InvitationsController } from "./invitations.controller";
import { OrganizationsService } from "./organizations.service";
import { MembershipsService } from "./memberships.service";
import { InvitationsService } from "./invitations.service";
import { ActiveOrganizationService } from "./active-organization.service";
import { OrgAuditService } from "./org-audit.service";
import { OrgRolesGuard } from "./guards/org-roles.guard";

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController, InvitationsController],
  providers: [
    PrismaService,
    OrganizationsService,
    MembershipsService,
    InvitationsService,
    ActiveOrganizationService,
    OrgAuditService,
    OrgRolesGuard,
  ],
  exports: [
    OrganizationsService,
    MembershipsService,
    InvitationsService,
    ActiveOrganizationService,
    OrgAuditService,
    OrgRolesGuard,
  ],
})
export class OrganizationsModule {}
