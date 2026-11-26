import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuthzModule } from "../authz/authz.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { DocumentsManagementModule } from "../documents/documents-management.module";
import { PrismaService } from "../prisma.service";
import { LegalDraftExportGeneratorService } from "./export-generator.service";
import { LegalTemplatesService } from "./legal-templates.service";
import { LegalTemplatesController } from "./legal-templates.controller";
import { LegalDraftsService } from "./legal-drafts.service";
import { LegalDraftsController } from "./legal-drafts.controller";
import {
  LEGAL_AI_PROVIDER,
  OpenAiLegalDraftingProvider,
} from "./legal-ai.provider";
import { LegalDraftAiService } from "./legal-draft-ai.service";

@Module({
  imports: [
    AuthModule,
    AuthzModule,
    OrganizationsModule,
    DocumentsManagementModule,
  ],
  controllers: [LegalDraftsController, LegalTemplatesController],
  providers: [
    PrismaService,
    LegalDraftExportGeneratorService,
    LegalTemplatesService,
    LegalDraftsService,
    LegalDraftAiService,
    {
      provide: LEGAL_AI_PROVIDER,
      useClass: OpenAiLegalDraftingProvider,
    },
  ],
  exports: [
    LegalDraftsService,
    LegalTemplatesService,
    LegalDraftAiService,
    LEGAL_AI_PROVIDER,
  ],
})
export class LegalDraftsModule {}
