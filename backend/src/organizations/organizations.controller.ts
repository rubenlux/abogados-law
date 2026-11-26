/**
 * Controlador REST de Organizaciones, Membresías, Roles, Invitaciones y Organización Activa (AUTH-03).
 * Especificación: SPEC-AUTH-001 v1.0.8 | Expediente: AUTH0-IMPLEMENTATION-007
 *
 * Todas las rutas requieren sesión BFF válida (`BffSessionGuard`).
 * Todas las mutaciones requieren protección Anti-CSRF (`CsrfGuard`).
 * Las operaciones administrativas exigen membresía ACTIVE y rol contextual mediante `OrgRolesGuard`.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { OrganizationRole } from "@prisma/client";
import { BffSessionGuard } from "../auth/guards/bff-session.guard";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { OrgRolesGuard } from "./guards/org-roles.guard";
import { OrgRoles, AllowSuspendedOrg } from "./decorators/org-roles.decorator";
import { OrganizationsService } from "./organizations.service";
import { MembershipsService } from "./memberships.service";
import { InvitationsService } from "./invitations.service";
import { ActiveOrganizationService } from "./active-organization.service";
import { OrgAuditService } from "./org-audit.service";
import {
  CreateOrganizationDto,
  UpdateOrganizationStatusDto,
  CreateInvitationDto,
  ChangeMemberRoleDto,
  TransferOwnershipDto,
  SetActiveOrganizationDto,
} from "./dto/organizations.dto";

@Controller("api/organizations")
@UseGuards(BffSessionGuard, CsrfGuard)
export class OrganizationsController {
  constructor(
    private organizationsService: OrganizationsService,
    private membershipsService: MembershipsService,
    private invitationsService: InvitationsService,
    private activeOrgService: ActiveOrganizationService,
    private auditService: OrgAuditService,
  ) {}

  private extractMeta(req: any) {
    return {
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      userAgent: req.headers?.["user-agent"] || null,
      correlationId: req.headers?.["x-correlation-id"] as string | undefined,
    };
  }

  /** Crear organización (el creador queda como ORG_OWNER ACTIVE) */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: any, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.createOrganization(
      req.user,
      dto,
      this.extractMeta(req),
    );
  }

  /** Consultar organizaciones propias con membresía ACTIVE */
  @Get()
  async listOwn(@Req() req: any) {
    const organizations = await this.organizationsService.listUserOrganizations(
      req.user.id,
    );
    return { organizations };
  }

  /** Seleccionar organización activa (validada en backend y persistida en UserSession) */
  @Post("active")
  @HttpCode(HttpStatus.OK)
  async setActive(@Req() req: any, @Body() dto: SetActiveOrganizationDto) {
    const activeOrganization =
      await this.activeOrgService.setActiveOrganization(
        req.session,
        dto.organizationId,
        this.extractMeta(req),
      );
    return { activeOrganization };
  }

  /** Resolver organización activa desde sesión BFF con revalidación en vivo */
  @Get("active")
  async getActive(@Req() req: any) {
    const activeOrganization =
      await this.activeOrgService.resolveActiveOrganization(req.session);
    return { activeOrganization };
  }

  /** Cambiar estado de organización (SUSPEND / REACTIVATE / DEACTIVATE) — Solo ORG_OWNER */
  @Patch(":organizationId/status")
  @UseGuards(OrgRolesGuard)
  @AllowSuspendedOrg()
  @OrgRoles(OrganizationRole.ORG_OWNER)
  async updateStatus(
    @Param("organizationId") organizationId: string,
    @Req() req: any,
    @Body() dto: UpdateOrganizationStatusDto,
  ) {
    return this.organizationsService.updateOrganizationStatus(
      organizationId,
      req.orgContext,
      dto.status,
      this.extractMeta(req),
    );
  }

  /** Consultar miembros de la organización — ORG_OWNER / ORG_ADMIN */
  @Get(":organizationId/members")
  @UseGuards(OrgRolesGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN)
  async listMembers(@Param("organizationId") organizationId: string) {
    const members = await this.membershipsService.listMembers(organizationId);
    return { members };
  }

  /** Suspender miembro — ORG_OWNER / ORG_ADMIN (con restricciones) */
  @Post(":organizationId/members/:membershipId/suspend")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgRolesGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN)
  async suspendMember(
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string,
    @Req() req: any,
  ) {
    return this.membershipsService.suspendMember(
      organizationId,
      membershipId,
      req.orgContext,
      this.extractMeta(req),
    );
  }

  /** Reactivar miembro suspendido — ORG_OWNER / ORG_ADMIN */
  @Post(":organizationId/members/:membershipId/reactivate")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgRolesGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN)
  async reactivateMember(
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string,
    @Req() req: any,
  ) {
    return this.membershipsService.reactivateMember(
      organizationId,
      membershipId,
      req.orgContext,
      this.extractMeta(req),
    );
  }

  /** Revocar membresía — ORG_OWNER / ORG_ADMIN (protege último owner y preserva historial) */
  @Post(":organizationId/members/:membershipId/revoke")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgRolesGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN)
  async revokeMember(
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string,
    @Req() req: any,
  ) {
    return this.membershipsService.revokeMember(
      organizationId,
      membershipId,
      req.orgContext,
      this.extractMeta(req),
    );
  }

  /** Cambiar rol de miembro — Solo ORG_OWNER (sin autoelevación ni asignación directa de ORG_OWNER) */
  @Patch(":organizationId/members/:membershipId/role")
  @UseGuards(OrgRolesGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER)
  async changeRole(
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string,
    @Req() req: any,
    @Body() dto: ChangeMemberRoleDto,
  ) {
    return this.membershipsService.changeMemberRole(
      organizationId,
      membershipId,
      req.orgContext,
      dto.role,
      this.extractMeta(req),
    );
  }

  /** Transferencia explícita y auditada de propiedad — Solo ORG_OWNER */
  @Post(":organizationId/transfer-ownership")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgRolesGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER)
  async transferOwnership(
    @Param("organizationId") organizationId: string,
    @Req() req: any,
    @Body() dto: TransferOwnershipDto,
  ) {
    return this.membershipsService.transferOwnership(
      organizationId,
      req.orgContext,
      dto.targetMembershipId,
      this.extractMeta(req),
    );
  }

  /** Emitir invitación a organización — ORG_OWNER / ORG_ADMIN */
  @Post(":organizationId/invitations")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OrgRolesGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN)
  async createInvitation(
    @Param("organizationId") organizationId: string,
    @Req() req: any,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationsService.issueInvitation(
      organizationId,
      req.orgContext,
      dto,
      this.extractMeta(req),
    );
  }

  /** Revocar invitación pendiente — ORG_OWNER / ORG_ADMIN */
  @Post(":organizationId/invitations/:invitationId/revoke")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgRolesGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN)
  async revokeInvitation(
    @Param("organizationId") organizationId: string,
    @Param("invitationId") invitationId: string,
    @Req() req: any,
  ) {
    return this.invitationsService.revokeInvitation(
      organizationId,
      invitationId,
      req.orgContext,
      this.extractMeta(req),
    );
  }

  /** Consultar historial de auditoría de la organización — ORG_OWNER / ORG_ADMIN */
  @Get(":organizationId/audit")
  @UseGuards(OrgRolesGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN)
  async listAudit(@Param("organizationId") organizationId: string) {
    const events = await this.auditService.listByOrganization(organizationId);
    return { events };
  }
}
