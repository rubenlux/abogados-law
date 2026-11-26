import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuthzModule } from "../authz/authz.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { DocumentsManagementModule } from "../documents/documents-management.module";
import { LegalDraftsModule } from "../legal-drafts/legal-drafts.module";
import { PrismaService } from "../prisma.service";
import { DocumentTextExtractorService } from "./document-text-extractor.service";
import { LegalAiContextService } from "./legal-ai-context.service";
import { LegalAiAssistantService } from "./legal-ai-assistant.service";
import { LegalAiAssistantController } from "./legal-ai-assistant.controller";
import { LegalAiAnalysisService } from "./legal-ai-analysis.service";
import { LegalAiAnalysisController } from "./legal-ai-analysis.controller";

@Module({
  imports: [
    AuthModule,
    AuthzModule,
    OrganizationsModule,
    DocumentsManagementModule,
    LegalDraftsModule,
  ],
  controllers: [LegalAiAssistantController, LegalAiAnalysisController],
  providers: [
    PrismaService,
    DocumentTextExtractorService,
    LegalAiContextService,
    LegalAiAssistantService,
    LegalAiAnalysisService,
  ],
  exports: [LegalAiAssistantService, LegalAiAnalysisService],
})
export class LegalAiAssistantModule {}
