
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminDataService } from './admin-data.service';
// import { SuperAdminGuard } from ... (TODO)

@Controller('admin-api')
export class AdminApiController {
    constructor(private dataService: AdminDataService) { }

    @Get('stats')
    async getStats() {
        return this.dataService.getGlobalStats();
    }

    @Get('logs')
    async getLogs() {
        return this.dataService.getLiveLogs();
    }

    @Get('traffic')
    async getTraffic() {
        return this.dataService.getTrafficVolume();
    }
}
