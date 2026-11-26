import { Controller, Post, Param, UseGuards, Req } from "@nestjs/common";
import { JudicialSyncService } from "./judicial-sync.service";
import { BffSessionGuard } from "../auth/guards/bff-session.guard";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { ActiveOrgContextGuard } from "../authz/guards/active-org-context.guard";
import { OrgPermissionGuard } from "../authz/guards/org-permission.guard";
import { PlatformBlockedGuard } from "../authz/guards/platform-blocked.guard";
import { RequireOrgPermissions } from "../authz/decorators/require-org-permissions.decorator";

@Controller("judicial")
export class JudicialController {
  constructor(private syncService: JudicialSyncService) {}

  @Post("sync/:expedienteId")
  @UseGuards(
    BffSessionGuard,
    ActiveOrgContextGuard,
    CsrfGuard,
    OrgPermissionGuard,
  )
  @RequireOrgPermissions("judicial:sync")
  async syncCase(@Param("expedienteId") id: string, @Req() req: any) {
    return this.syncService.syncCase(id, req.orgContext);
  }

  @Post("sync-system")
  @UseGuards(PlatformBlockedGuard)
  async syncSystem() {
    return this.syncService.syncSystem();
  }
}
