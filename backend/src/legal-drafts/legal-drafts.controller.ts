import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { BffSessionGuard } from "../auth/guards/bff-session.guard";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { ActiveOrgContextGuard } from "../authz/guards/active-org-context.guard";
import { OrgPermissionGuard } from "../authz/guards/org-permission.guard";
import { RequireOrgPermissions } from "../authz/decorators/require-org-permissions.decorator";
import { LegalDraftsService } from "./legal-drafts.service";
import { LegalDraftAiService } from "./legal-draft-ai.service";
import {
  AiAssistLegalDraftDto,
  AiGenerateLegalDraftDto,
  ApproveDraftDto,
  CreateLegalDraftDto,
  CreateLegalDraftVersionDto,
  ExportLegalDraftDto,
  FinalizeDraftDto,
  QueryLegalDraftDto,
  RequestChangesDto,
  SubmitReviewDto,
  UpdateLegalDraftDto,
} from "./dto/legal-draft.dto";

@UseGuards(
  BffSessionGuard,
  ActiveOrgContextGuard,
  CsrfGuard,
  OrgPermissionGuard,
)
@Controller("legal-drafts")
export class LegalDraftsController {
  constructor(
    private readonly draftsService: LegalDraftsService,
    private readonly aiDraftService: LegalDraftAiService,
  ) {}

  @Get("catalog")
  @RequireOrgPermissions("legal_drafts:read")
  getCatalog() {
    return this.aiDraftService.getCatalog();
  }

  @Get("ai/status")
  @RequireOrgPermissions("legal_drafts:read")
  getAiStatus() {
    return this.aiDraftService.getAiStatus();
  }

  @Get("recent-cases")
  @RequireOrgPermissions("legal_drafts:read")
  async getRecentCases(
    @Query("search") search: string | undefined,
    @Req() req: any,
  ) {
    return this.aiDraftService.getRecentCases(req.orgContext, search);
  }

  @Post("ai/generate")
  @RequireOrgPermissions("legal_drafts:write", "ai:use")
  async generateWithAi(@Body() dto: AiGenerateLegalDraftDto, @Req() req: any) {
    return this.aiDraftService.generateDraftWithAi(dto, req.orgContext);
  }

  @Get()
  @RequireOrgPermissions("legal_drafts:read")
  async findAll(@Query() query: QueryLegalDraftDto, @Req() req: any) {
    return this.draftsService.findAll(query, req.orgContext);
  }

  @Post()
  @RequireOrgPermissions("legal_drafts:write")
  async create(@Body() dto: CreateLegalDraftDto, @Req() req: any) {
    return this.draftsService.create(dto, req.orgContext);
  }

  @Get(":id")
  @RequireOrgPermissions("legal_drafts:read")
  async findById(@Param("id", ParseUUIDPipe) id: string, @Req() req: any) {
    return this.draftsService.findById(id, req.orgContext);
  }

  @Patch(":id")
  @RequireOrgPermissions("legal_drafts:write")
  async updateMetadata(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateLegalDraftDto,
    @Req() req: any,
  ) {
    return this.draftsService.updateMetadata(id, dto, req.orgContext);
  }

  @Delete(":id")
  @RequireOrgPermissions("legal_drafts:write")
  async archive(@Param("id", ParseUUIDPipe) id: string, @Req() req: any) {
    return this.draftsService.archive(id, req.orgContext);
  }

  @Get(":id/versions")
  @RequireOrgPermissions("legal_drafts:read")
  async listVersions(@Param("id", ParseUUIDPipe) id: string, @Req() req: any) {
    return this.draftsService.listVersions(id, req.orgContext);
  }

  @Get(":id/versions/:versionId")
  @RequireOrgPermissions("legal_drafts:read")
  async findVersionById(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @Req() req: any,
  ) {
    return this.draftsService.findVersionById(id, versionId, req.orgContext);
  }

  @Post(":id/versions")
  @RequireOrgPermissions("legal_drafts:write")
  async createVersion(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateLegalDraftVersionDto,
    @Req() req: any,
  ) {
    return this.draftsService.createVersion(id, dto, req.orgContext);
  }

  @Post(":id/ai/assist")
  @HttpCode(HttpStatus.OK)
  @RequireOrgPermissions("legal_drafts:write", "ai:use")
  async assistWithAi(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AiAssistLegalDraftDto,
    @Req() req: any,
  ) {
    return this.aiDraftService.assistExistingDraft(id, dto, req.orgContext);
  }

  @Post(":id/submit-review")
  @HttpCode(HttpStatus.OK)
  @RequireOrgPermissions("legal_drafts:write")
  async submitReview(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SubmitReviewDto,
    @Req() req: any,
  ) {
    return this.draftsService.submitForReview(id, dto, req.orgContext);
  }

  @Post(":id/request-changes")
  @HttpCode(HttpStatus.OK)
  @RequireOrgPermissions("legal_drafts:review")
  async requestChanges(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RequestChangesDto,
    @Req() req: any,
  ) {
    return this.draftsService.requestChanges(id, dto, req.orgContext);
  }

  @Post(":id/approve")
  @HttpCode(HttpStatus.OK)
  @RequireOrgPermissions("legal_drafts:approve")
  async approve(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ApproveDraftDto,
    @Req() req: any,
  ) {
    return this.draftsService.approve(id, dto, req.orgContext);
  }

  @Post(":id/finalize")
  @HttpCode(HttpStatus.OK)
  @RequireOrgPermissions("legal_drafts:approve")
  async finalize(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: FinalizeDraftDto,
    @Req() req: any,
  ) {
    return this.draftsService.finalize(id, dto, req.orgContext);
  }

  @Post(":id/export")
  @RequireOrgPermissions("legal_drafts:export")
  async exportDraft(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ExportLegalDraftDto,
    @Req() req: any,
  ) {
    return this.draftsService.exportDraft(id, dto, req.orgContext);
  }

  @Get(":id/exports")
  @RequireOrgPermissions("legal_drafts:read")
  async listExports(@Param("id", ParseUUIDPipe) id: string, @Req() req: any) {
    return this.draftsService.listExports(id, req.orgContext);
  }

  @Get(":id/exports/:exportId/download")
  @RequireOrgPermissions("legal_drafts:export")
  async downloadExport(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("exportId", ParseUUIDPipe) exportId: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, mimeType, sizeBytes, contentDisposition } =
      await this.draftsService.prepareExportDownload(
        id,
        exportId,
        req.orgContext,
      );

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", String(sizeBytes));
    res.setHeader("Content-Disposition", contentDisposition);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");

    return new StreamableFile(stream);
  }
}
