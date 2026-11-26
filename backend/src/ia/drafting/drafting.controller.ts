import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { DraftingService, DraftInputDto } from "./drafting.service";
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
@Controller("ai/draft")
export class DraftingController {
  constructor(private readonly draftingService: DraftingService) {}

  @Post()
  @RequireOrgPermissions("ai:use")
  async generate(@Body() body: any, @Req() req: any) {
    // SPEC-AUTH-004: ignorar body.userId; fijar userId y organizationId exclusivamente desde req.orgContext
    const input: DraftInputDto = {
      expedienteId: body.expedienteId,
      draftType: body.type,
      jurisdiction: body.jurisdiction,
      fuero: body.fuero,
      facts: body.facts,
      dataContext: body.dataContext,
    };
    return this.draftingService.generateDraft(input, req.orgContext);
  }

  @Get("user/:userId")
  @RequireOrgPermissions("ai:use")
  async getDrafts(
    @Req() req: any,
    @Query("expedienteId") expedienteId?: string,
  ) {
    return this.draftingService.getDrafts(req.orgContext, expedienteId);
  }

  @Get(":id")
  @RequireOrgPermissions("ai:use")
  async getDraft(@Param("id") id: string, @Req() req: any) {
    return this.draftingService.getDraft(id, req.orgContext);
  }
}
