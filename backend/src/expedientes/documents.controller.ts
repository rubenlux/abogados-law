import {
  Controller,
  Post,
  Patch,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { DocumentsService } from "./documents.service";
import {
  DocumentsManagementService,
  UploadedDiskFile,
} from "../documents/documents-management.service";
import { DocumentUploadInterceptor } from "../documents/document-upload.interceptor";
import {
  CreateDocumentDto,
  QueryDocumentDto,
  UpdateDocumentMetadataDto,
  UploadDocumentVersionDto,
} from "../documents/dto/document.dto";
import { BffSessionGuard } from "../auth/guards/bff-session.guard";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { ActiveOrgContextGuard } from "../authz/guards/active-org-context.guard";
import { OrgPermissionGuard } from "../authz/guards/org-permission.guard";
import { RequireOrgPermissions } from "../authz/decorators/require-org-permissions.decorator";

@ApiTags("documents")
@UseGuards(
  BffSessionGuard,
  ActiveOrgContextGuard,
  CsrfGuard,
  OrgPermissionGuard,
)
@Controller("documents")
export class DocumentsController {
  constructor(
    private readonly docsService: DocumentsService,
    private readonly docsManagementService: DocumentsManagementService,
  ) {}

  // ===========================================================================
  // AUTH-08: Gestión Documental Jurídica (Document + DocumentFileVersion)
  // ===========================================================================

  @Get()
  @RequireOrgPermissions("documents:metadata_read")
  @ApiOperation({
    summary: "Listar documentos paginados de la organización activa",
  })
  findAll(@Query() query: QueryDocumentDto, @Req() req: any) {
    return this.docsManagementService.findAll(query, req.orgContext);
  }

  @Post()
  @RequireOrgPermissions("documents:write")
  @UseInterceptors(DocumentUploadInterceptor)
  @ApiOperation({
    summary: "Crear documento lógico y cargar su primera versión física",
  })
  async create(@Body() dto: CreateDocumentDto, @Req() req: any) {
    // Defensa explícita contra inyección en multipart
    if (req.body?.organizationId !== undefined) {
      throw new ForbiddenException({
        code: "ORGANIZATION_CONTEXT_MISMATCH",
        message: "organizationId cannot be supplied by client",
      });
    }
    if (
      req.body?.storageKey !== undefined ||
      req.body?.storagePath !== undefined ||
      req.body?.path !== undefined
    ) {
      throw new BadRequestException(
        "Client-supplied storage path is forbidden",
      );
    }
    const file = req.file as UploadedDiskFile | undefined;
    return this.docsManagementService.createWithFile(dto, file, req.orgContext);
  }

  // Ruta estática AUTH-04 (declarada ANTES de @Get(':id') para evitar colisión)
  @Get("compare/:v1/:v2")
  @RequireOrgPermissions("documents:read")
  async compare(
    @Param("v1") v1: string,
    @Param("v2") v2: string,
    @Req() req: any,
  ) {
    return this.docsService.compareVersions(v1, v2, req.orgContext);
  }

  @Get(":id")
  @RequireOrgPermissions("documents:metadata_read")
  @ApiOperation({ summary: "Consultar metadatos e historial de un documento" })
  findById(@Param("id") id: string, @Req() req: any) {
    return this.docsManagementService.findById(id, req.orgContext);
  }

  @Patch(":id")
  @RequireOrgPermissions("documents:write")
  @ApiOperation({
    summary: "Actualizar metadatos y asociaciones de un documento",
  })
  updateMetadata(
    @Param("id") id: string,
    @Body() dto: UpdateDocumentMetadataDto,
    @Req() req: any,
  ) {
    return this.docsManagementService.updateMetadata(id, dto, req.orgContext);
  }

  @Delete(":id")
  @RequireOrgPermissions("documents:delete")
  @ApiOperation({ summary: "Archivar documento (eliminación lógica trazable)" })
  archive(@Param("id") id: string, @Req() req: any) {
    return this.docsManagementService.archive(id, req.orgContext);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @RequireOrgPermissions("documents:delete")
  @ApiOperation({ summary: "Restaurar documento archivado" })
  restore(@Param("id") id: string, @Req() req: any) {
    return this.docsManagementService.restore(id, req.orgContext);
  }

  @Get(":id/versions")
  @RequireOrgPermissions("documents:read")
  @ApiOperation({ summary: "Listar versiones inmutables de un documento" })
  listVersions(@Param("id") id: string, @Req() req: any) {
    return this.docsManagementService.listVersions(id, req.orgContext);
  }

  @Get(":id/versions/:versionId")
  @RequireOrgPermissions("documents:read")
  @ApiOperation({
    summary: "Obtener detalle de una versión documental específica",
  })
  findVersionById(
    @Param("id") id: string,
    @Param("versionId") versionId: string,
    @Req() req: any,
  ) {
    return this.docsManagementService.findVersionById(
      id,
      versionId,
      req.orgContext,
    );
  }

  @Get(":id/download")
  @RequireOrgPermissions("documents:download")
  @ApiOperation({
    summary: "Descargar versión vigente del documento con verificación SHA-256",
  })
  async downloadCurrent(
    @Param("id") id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const dl = await this.docsManagementService.prepareDownload(
      id,
      null,
      req.orgContext,
    );
    res.setHeader("Content-Type", dl.mimeType);
    res.setHeader("Content-Length", String(dl.sizeBytes));
    res.setHeader("Content-Disposition", dl.contentDisposition);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    dl.stream.pipe(res);
  }

  @Get(":id/versions/:versionId/download")
  @RequireOrgPermissions("documents:download")
  @ApiOperation({
    summary: "Descargar versión histórica específica del documento",
  })
  async downloadVersion(
    @Param("id") id: string,
    @Param("versionId") versionId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const dl = await this.docsManagementService.prepareDownload(
      id,
      versionId,
      req.orgContext,
    );
    res.setHeader("Content-Type", dl.mimeType);
    res.setHeader("Content-Length", String(dl.sizeBytes));
    res.setHeader("Content-Disposition", dl.contentDisposition);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");
    dl.stream.pipe(res);
  }

  /**
   * Unificado:
   * - multipart/form-data -> AUTH-08 carga nueva versión física inmutable (DocumentFileVersion)
   * - application/json    -> Retrocompatibilidad AUTH-04 (Documento/DocumentVersion)
   */
  @Post(":id/versions")
  @RequireOrgPermissions("documents:write")
  @UseInterceptors(DocumentUploadInterceptor)
  async uploadVersion(
    @Param("id") id: string,
    @Body() body: Record<string, any>,
    @Req() req: any,
  ) {
    const contentType: string = req.headers?.["content-type"] || "";
    if (contentType.toLowerCase().includes("multipart/form-data")) {
      if (
        body?.path !== undefined ||
        body?.storagePath !== undefined ||
        body?.storageKey !== undefined
      ) {
        throw new BadRequestException(
          "Client-supplied storage path is forbidden",
        );
      }
      const dto: UploadDocumentVersionDto = {
        changeNote:
          typeof body?.changeNote === "string" ? body.changeNote : undefined,
      };
      const file = req.file as UploadedDiskFile | undefined;
      return this.docsManagementService.uploadNewVersion(
        id,
        dto,
        file,
        req.orgContext,
      );
    }

    // SPEC-AUTH-004 §13: prohibido aceptar storagePath / path provisto por el cliente
    if (body?.path !== undefined || body?.storagePath !== undefined) {
      throw new BadRequestException(
        "Client-supplied storage path is forbidden",
      );
    }

    const fileData = {
      originalName:
        typeof body?.filename === "string" && body.filename.trim()
          ? body.filename.trim()
          : "document.pdf",
      size: typeof body?.size === "number" && body.size > 0 ? body.size : 1024,
      mimetype:
        typeof body?.mimetype === "string" && body.mimetype.trim()
          ? body.mimetype.trim()
          : "application/pdf",
    };

    return this.docsService.uploadVersion(id, fileData, req.orgContext);
  }

  @Patch(":id/legal-hold")
  @RequireOrgPermissions("documents:sensitive")
  async setLegalHold(
    @Param("id") id: string,
    @Body() body: { status: boolean; reason?: string },
    @Req() req: any,
  ) {
    return this.docsService.setLegalHold(
      id,
      body.status,
      body.reason,
      req.orgContext,
    );
  }
}
