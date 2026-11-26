import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { BffSessionGuard } from "../auth/guards/bff-session.guard";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { ActiveOrgContextGuard } from "../authz/guards/active-org-context.guard";
import { OrgPermissionGuard } from "../authz/guards/org-permission.guard";
import { RequireOrgPermissions } from "../authz/decorators/require-org-permissions.decorator";
import { LegalAiAnalysisService } from "./legal-ai-analysis.service";
import {
  CreateLegalAiAnalysisDto,
  PreviewAnalysisSourcesDto,
  QueryLegalAiAnalysesDto,
  UpdateLegalAiAnalysisDto,
} from "./dto/legal-ai-analysis.dto";

@UseGuards(
  BffSessionGuard,
  ActiveOrgContextGuard,
  CsrfGuard,
  OrgPermissionGuard,
)
@Controller("legal-ai/analyses")
export class LegalAiAnalysisController {
  constructor(private readonly analysisService: LegalAiAnalysisService) {}

  @Get("status")
  @RequireOrgPermissions("legal_ai_analysis:read", "ai:use")
  getStatus() {
    return this.analysisService.getStatus();
  }

  @Post("preview-sources")
  @RequireOrgPermissions("legal_ai_analysis:read", "ai:use")
  async previewSources(
    @Body() dto: PreviewAnalysisSourcesDto,
    @Req() req: any,
  ) {
    return this.analysisService.previewSources(dto, req.orgContext);
  }

  @Post()
  @RequireOrgPermissions("legal_ai_analysis:write", "ai:use")
  async createAnalysis(@Body() dto: CreateLegalAiAnalysisDto, @Req() req: any) {
    return this.analysisService.createAnalysis(dto, req.orgContext);
  }

  @Get()
  @RequireOrgPermissions("legal_ai_analysis:read", "ai:use")
  async listAnalyses(@Query() query: QueryLegalAiAnalysesDto, @Req() req: any) {
    return this.analysisService.listAnalyses(query, req.orgContext);
  }

  @Get(":id")
  @RequireOrgPermissions("legal_ai_analysis:read", "ai:use")
  async getAnalysis(@Param("id", ParseUUIDPipe) id: string, @Req() req: any) {
    return this.analysisService.getAnalysis(id, req.orgContext);
  }

  @Patch(":id")
  @RequireOrgPermissions("legal_ai_analysis:write", "ai:use")
  async updateAnalysis(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateLegalAiAnalysisDto,
    @Req() req: any,
  ) {
    return this.analysisService.updateAnalysis(id, dto, req.orgContext);
  }

  @Delete(":id")
  @RequireOrgPermissions("legal_ai_analysis:write", "ai:use")
  async archiveAnalysis(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.analysisService.archiveAnalysis(id, req.orgContext);
  }

  @Post(":id/retry")
  @RequireOrgPermissions("legal_ai_analysis:write", "ai:use")
  async retryAnalysis(@Param("id", ParseUUIDPipe) id: string, @Req() req: any) {
    return this.analysisService.retryAnalysis(id, req.orgContext);
  }
}
