import { Controller, Post, Get, Param, UseGuards, Req } from "@nestjs/common";
import { LegalRiskService } from "./legal-risk.service";
import { BffSessionGuard } from "../../auth/guards/bff-session.guard";
import { CsrfGuard } from "../../auth/guards/csrf.guard";
import { ActiveOrgContextGuard } from "../../authz/guards/active-org-context.guard";
import { OrgPermissionGuard } from "../../authz/guards/org-permission.guard";
import { RequireOrgPermissions } from "../../authz/decorators/require-org-permissions.decorator";

@UseGuards(
  BffSessionGuard,
  ActiveOrgContextGuard,
  CsrfGuard,
  OrgPermissionGuard,
)
@Controller("ai/risk-score")
export class LegalRiskController {
  constructor(private readonly riskService: LegalRiskService) {}

  @Post(":expedienteId")
  @RequireOrgPermissions("ai:use")
  async analyzeRisk(
    @Param("expedienteId") expedienteId: string,
    @Req() req: any,
  ) {
    return this.riskService.analyzeRisk(expedienteId, req.orgContext);
  }

  @Get(":expedienteId")
  @RequireOrgPermissions("ai:use")
  async getRiskHistory(
    @Param("expedienteId") expedienteId: string,
    @Req() req: any,
  ) {
    return this.riskService.getHistory(expedienteId, req.orgContext);
  }
}
