
import { Module } from '@nestjs/common';
import { JudicialController } from './judicial.controller';
import { JudicialSyncService } from './judicial-sync.service';
import { JudicialScraperService } from './judicial-scraper.service';
import { PrismaService } from '../prisma.service';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ConfigModule],
    controllers: [JudicialController],
    providers: [JudicialSyncService, JudicialScraperService, PrismaService],
    exports: [JudicialSyncService]
})
export class JudicialEngineModule { }
