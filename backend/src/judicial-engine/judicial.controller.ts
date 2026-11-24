
import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { JudicialSyncService } from './judicial-sync.service';

@Controller('judicial')
export class JudicialController {
    constructor(private syncService: JudicialSyncService) { }

    @Post('sync/:expedienteId')
    async syncCase(@Param('expedienteId') id: string) {
        return this.syncService.syncCase(id);
    }

    @Post('sync-system')
    async syncSystem() {
        return this.syncService.syncSystem();
    }
}
