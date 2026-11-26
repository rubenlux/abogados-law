import { Module } from "@nestjs/common";
import { ExpedientesModule } from "./expedientes/expedientes.module";
import { IAModule } from "./ia/ia.module";
import { AuthModule } from "./auth/auth.module";
import { AuthzModule } from "./authz/authz.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { AgendaModule } from "./agenda/agenda.module";
import { MovimientosModule } from "./movimientos/movimientos.module";
import { VencimientosModule } from "./vencimientos/vencimientos.module";
import { DocumentsManagementModule } from "./documents/documents-management.module";
import { LegalDraftsModule } from "./legal-drafts/legal-drafts.module";
import { LegalAiAssistantModule } from "./legal-ai/legal-ai-assistant.module";
import { TemplatesModule } from "./templates/templates.module";
import { ClientPortalModule } from "./client-portal/client-portal.module";
import { JudicialEngineModule } from "./judicial-engine/judicial-engine.module";
import { AdminModule } from "./admin/admin.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { SecurityCoreModule } from "./core/security/security-core.module";
import { ClientsModule } from "./clients/clients.module";
import { PrismaService } from "./prisma.service";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    AuthzModule,
    ExpedientesModule,
    IAModule,
    AuthModule,
    OrganizationsModule,
    AgendaModule,
    MovimientosModule,
    VencimientosModule,
    DocumentsManagementModule,
    LegalDraftsModule,
    LegalAiAssistantModule,
    TemplatesModule,
    ClientPortalModule,
    JudicialEngineModule,
    AdminModule,
    AnalyticsModule,
    SecurityCoreModule,
    ClientsModule,
  ],
  controllers: [],
  providers: [PrismaService],
  exports: [PrismaService], // Global
})
export class AppModule {}
