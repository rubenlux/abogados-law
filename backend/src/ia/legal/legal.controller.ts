import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Req,
  Param,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery } from "@nestjs/swagger";
import {
  LegalIngestionService,
  LegalNormIngestionDto,
} from "./legal-ingestion.service";
import { LegalSearchService, LegalSearchQuery } from "./legal-search.service";
import { BffSessionGuard } from "../../auth/guards/bff-session.guard";
import { ActiveOrgContextGuard } from "../../authz/guards/active-org-context.guard";
import { OrgPermissionGuard } from "../../authz/guards/org-permission.guard";
import { PlatformBlockedGuard } from "../../authz/guards/platform-blocked.guard";
import { RequireOrgPermissions } from "../../authz/decorators/require-org-permissions.decorator";

@ApiTags("legal")
@Controller("legal")
export class LegalController {
  constructor(
    private ingestionService: LegalIngestionService,
    private searchService: LegalSearchService,
  ) {}

  @Post("ingest")
  @UseGuards(PlatformBlockedGuard)
  @ApiOperation({ summary: "Ingestar norma legal (bloqueado Fail-Closed)" })
  async ingest(@Body() dto: LegalNormIngestionDto, @Req() req: any) {
    dto.ingestedBy = req.orgContext?.userId;
    return this.ingestionService.ingestNorm(dto);
  }

  @Post("ingest/batch")
  @UseGuards(PlatformBlockedGuard)
  @ApiOperation({
    summary: "Ingesta masiva de normas (bloqueado Fail-Closed)",
  })
  async ingestBatch(
    @Body() body: { norms: LegalNormIngestionDto[] },
    @Req() req: any,
  ) {
    const normsWithUser = (body.norms || []).map((n) => ({
      ...n,
      ingestedBy: req.orgContext?.userId,
    }));
    return this.ingestionService.ingestBatch(normsWithUser);
  }

  @Get("search")
  @UseGuards(BffSessionGuard, ActiveOrgContextGuard, OrgPermissionGuard)
  @RequireOrgPermissions("knowledge:read")
  @ApiOperation({ summary: "Búsqueda semántica de normas legales" })
  @ApiQuery({ name: "query", required: true })
  @ApiQuery({ name: "jurisdiccion", required: false })
  @ApiQuery({ name: "fuero", required: false })
  @ApiQuery({ name: "estado", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "threshold", required: false })
  async search(@Query() query: LegalSearchQuery) {
    return this.searchService.search(query);
  }

  @Get("article/:numeroNorma/:articulo")
  @UseGuards(BffSessionGuard, ActiveOrgContextGuard, OrgPermissionGuard)
  @RequireOrgPermissions("knowledge:read")
  @ApiOperation({ summary: "Buscar artículo específico" })
  async findArticle(
    @Param("numeroNorma") numeroNorma: string,
    @Param("articulo") articulo: string,
    @Query("jurisdiccion") jurisdiccion?: string,
  ) {
    return this.searchService.findByArticle(
      numeroNorma,
      articulo,
      jurisdiccion,
    );
  }

  @Get("versions/:numeroNorma/:articulo")
  @UseGuards(BffSessionGuard, ActiveOrgContextGuard, OrgPermissionGuard)
  @RequireOrgPermissions("knowledge:read")
  @ApiOperation({ summary: "Historial de versiones de un artículo" })
  async getVersions(
    @Param("numeroNorma") numeroNorma: string,
    @Param("articulo") articulo: string,
  ) {
    return this.searchService.getVersionHistory(numeroNorma, articulo);
  }

  @Get("conflicts/:normId")
  @UseGuards(BffSessionGuard, ActiveOrgContextGuard, OrgPermissionGuard)
  @RequireOrgPermissions("knowledge:read")
  @ApiOperation({ summary: "Detectar conflictos normativos" })
  async detectConflicts(@Param("normId") normId: string) {
    return this.searchService.detectConflicts(normId);
  }

  @Get("stats")
  @UseGuards(BffSessionGuard, ActiveOrgContextGuard, OrgPermissionGuard)
  @RequireOrgPermissions("knowledge:read")
  @ApiOperation({ summary: "Estadísticas de la base legal" })
  async getStats() {
    return this.searchService.getStats();
  }

  @Post("version/:normId")
  @UseGuards(PlatformBlockedGuard)
  @ApiOperation({
    summary: "Crear nueva versión de norma (bloqueado Fail-Closed)",
  })
  async createVersion(
    @Param("normId") normId: string,
    @Body() updates: Partial<LegalNormIngestionDto>,
    @Req() req: any,
  ) {
    return this.ingestionService.createNewVersion(
      normId,
      updates,
      req.orgContext?.userId,
    );
  }
}
