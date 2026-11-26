import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuthzModule } from "../authz/authz.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaService } from "../prisma.service";
import {
  DocumentStorageService,
  NoOpDocumentMalwareScanner,
} from "./document-storage.service";
import { DocumentUploadInterceptor } from "./document-upload.interceptor";
import { DocumentsManagementService } from "./documents-management.service";

@Module({
  imports: [AuthzModule, OrganizationsModule, AuthModule],
  providers: [
    DocumentStorageService,
    NoOpDocumentMalwareScanner,
    DocumentUploadInterceptor,
    DocumentsManagementService,
    PrismaService,
  ],
  exports: [
    DocumentStorageService,
    NoOpDocumentMalwareScanner,
    DocumentUploadInterceptor,
    DocumentsManagementService,
  ],
})
export class DocumentsManagementModule {}

