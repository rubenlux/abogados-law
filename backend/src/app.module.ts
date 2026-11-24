import { Module } from '@nestjs/common';
import { ExpedientesModule } from './expedientes/expedientes.module';
import { IAModule } from './ia/ia.module';
import { AuthModule } from './auth/auth.module';
import { AgendaModule } from './agenda/agenda.module';
import { TemplatesModule } from './templates/templates.module';
import { ClientPortalModule } from './client-portal/client-portal.module';
import { JudicialEngineModule } from './judicial-engine/judicial-engine.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SecurityCoreModule } from './core/security/security-core.module';
import { BackupModule } from './core/backup/backup.module';
import { PrismaService } from './prisma.service';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ScheduleModule.forRoot(),
        ThrottlerModule.forRoot([{
            ttl: 60000,
            limit: 10,
        }]),
        ExpedientesModule,
        IAModule,
        AuthModule,
        AgendaModule,
        TemplatesModule,
        ClientPortalModule,
        JudicialEngineModule,
        AdminModule,
        AnalyticsModule,
        SecurityCoreModule,
        BackupModule
    ],
    controllers: [],
    providers: [PrismaService],
    exports: [PrismaService], // Global
})
export class AppModule { }
