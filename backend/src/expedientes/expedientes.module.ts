import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuthzModule } from "../authz/authz.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { DocumentsManagementModule } from "../documents/documents-management.module";
import { ExpedientesController } from "./expedientes.controller";
import { DocumentsController } from "./documents.controller";
import { ExpedientesService } from "./expedientes.service";
import { DocumentsService } from "./documents.service";
import { PrismaService } from "../prisma.service";

@Module({
  imports: [
    AuthzModule,
    OrganizationsModule,
    AuthModule,
    DocumentsManagementModule,
  ],
  controllers: [ExpedientesController, DocumentsController],
  providers: [ExpedientesService, DocumentsService, PrismaService],
  exports: [ExpedientesService],
})
export class ExpedientesModule {}
