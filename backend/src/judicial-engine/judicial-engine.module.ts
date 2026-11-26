import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { JudicialController } from "./judicial.controller";
import { JudicialSyncService } from "./judicial-sync.service";
import { JudicialScraperService } from "./judicial-scraper.service";
import { PrismaService } from "../prisma.service";

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [JudicialController],
  providers: [JudicialSyncService, JudicialScraperService, PrismaService],
  exports: [JudicialSyncService],
})
export class JudicialEngineModule {}
