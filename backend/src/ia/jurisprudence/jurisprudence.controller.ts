import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Req,
  Param,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { JurisprudenceIngestionService } from "./jurisprudence-ingestion.service";
import {
  JurisprudenceSearchService,
  JurisprudenceSearchQuery,
} from "./jurisprudence-search.service";
import { JurisprudenceCrawlerService } from "./jurisprudence-crawler.service";
import { BffSessionGuard } from "../../auth/guards/bff-session.guard";
import { ActiveOrgContextGuard } from "../../authz/guards/active-org-context.guard";
import { OrgPermissionGuard } from "../../authz/guards/org-permission.guard";
import { PlatformBlockedGuard } from "../../authz/guards/platform-blocked.guard";
import { RequireOrgPermissions } from "../../authz/decorators/require-org-permissions.decorator";

@ApiTags("jurisprudence")
@Controller("jurisprudence")
export class JurisprudenceController {
  private readonly logger = new Logger(JurisprudenceController.name);

  constructor(
    private readonly ingestionService: JurisprudenceIngestionService,
    private readonly searchService: JurisprudenceSearchService,
    private readonly crawlerService: JurisprudenceCrawlerService,
  ) {}

  @Get("stats")
  @UseGuards(BffSessionGuard, ActiveOrgContextGuard, OrgPermissionGuard)
  @RequireOrgPermissions("knowledge:read")
  @ApiOperation({ summary: "Estadísticas de la base de jurisprudencia" })
  async getStats() {
    this.logger.log("GET /jurisprudence/stats");
    return this.searchService.getStats();
  }

  @Get("list")
  @UseGuards(BffSessionGuard, ActiveOrgContextGuard, OrgPermissionGuard)
  @RequireOrgPermissions("knowledge:read")
  @ApiOperation({ summary: "Listar todos los casos" })
  async listAll(@Query("limit") limit?: string) {
    this.logger.log("GET /jurisprudence/list");
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.searchService.listAll(limitNum);
  }

  @Get("search")
  @UseGuards(BffSessionGuard, ActiveOrgContextGuard, OrgPermissionGuard)
  @RequireOrgPermissions("knowledge:read")
  @ApiOperation({ summary: "Búsqueda semántica" })
  async search(@Query() query: JurisprudenceSearchQuery) {
    this.logger.log(`GET /jurisprudence/search?query=${query.query}`);
    try {
      return await this.searchService.search(query);
    } catch (error) {
      this.logger.error(`Error in search: ${error.message}`);
      return this.searchService.listAll(10);
    }
  }

  @Post("import")
  @UseGuards(PlatformBlockedGuard)
  @ApiOperation({
    summary: "Importar fallos en tiempo real (bloqueado Fail-Closed)",
  })
  async import(
    @Body("query") query: string,
    @Body("source") source?: "CSJN" | "FORMOSA",
  ) {
    return this.crawlerService.importFromSource(query, source || "CSJN");
  }

  @Get(":id")
  @UseGuards(BffSessionGuard, ActiveOrgContextGuard, OrgPermissionGuard)
  @RequireOrgPermissions("knowledge:read")
  @ApiOperation({ summary: "Obtener detalle por ID" })
  async findById(@Param("id") id: string) {
    this.logger.log(`GET /jurisprudence/${id}`);
    if (
      !id ||
      id === "undefined" ||
      id === "stats" ||
      id === "list" ||
      id === "search"
    ) {
      return { error: "Invalid ID" };
    }
    return this.searchService.findById(id);
  }

  @Post("ingest")
  @UseGuards(PlatformBlockedGuard)
  async ingest(@Body() dto: any, @Req() req: any) {
    dto.ingestedBy = req.orgContext?.userId;
    return this.ingestionService.ingestJurisprudence(dto);
  }
}
