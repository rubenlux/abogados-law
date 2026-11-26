import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminDataService } from "./admin-data.service";
import { PlatformBlockedGuard } from "../authz/guards/platform-blocked.guard";

// DEC-04-04 (SPEC-AUTH-004): Contención Fail-Closed de endpoints prototipales de plataforma.
@UseGuards(PlatformBlockedGuard)
@Controller("admin-api")
export class AdminApiController {
  constructor(private dataService: AdminDataService) {}

  @Get("stats")
  async getStats() {
    return this.dataService.getGlobalStats();
  }

  @Get("logs")
  async getLogs() {
    return this.dataService.getLiveLogs();
  }

  @Get("traffic")
  async getTraffic() {
    return this.dataService.getTrafficVolume();
  }
}
