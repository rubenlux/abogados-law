import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { IAService } from "./ia.service";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { BffSessionGuard } from "../auth/guards/bff-session.guard";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { ActiveOrgContextGuard } from "../authz/guards/active-org-context.guard";
import { OrgPermissionGuard } from "../authz/guards/org-permission.guard";
import { PlatformBlockedGuard } from "../authz/guards/platform-blocked.guard";
import { RequireOrgPermissions } from "../authz/decorators/require-org-permissions.decorator";

@ApiTags("ia")
@Controller("ia")
export class IAController {
  constructor(private readonly iaService: IAService) {}

  @Post("ask")
  @UseGuards(
    BffSessionGuard,
    ActiveOrgContextGuard,
    CsrfGuard,
    OrgPermissionGuard,
  )
  @RequireOrgPermissions("ai:use")
  @ApiOperation({ summary: "Consultar asistente legal (RAG)" })
  async ask(@Body() body: { query: string; context?: string }) {
    return this.iaService.askLegalAssistant(body.query, body.context);
  }

  @Post("analyze")
  @UseGuards(
    BffSessionGuard,
    ActiveOrgContextGuard,
    CsrfGuard,
    OrgPermissionGuard,
  )
  @RequireOrgPermissions("ai:use")
  @ApiOperation({ summary: "Analizar documento jurídico" })
  async analyze(@Body() body: { text: string }) {
    return this.iaService.analyzeDocument(body.text);
  }

  @Post("ingest")
  @UseGuards(PlatformBlockedGuard)
  @ApiOperation({
    summary: "Ingestar norma legal (contenido Fail-Closed en AUTH-04)",
  })
  async ingest(
    @Body()
    body: {
      titulo: string;
      texto: string;
      jurisdiccion: string;
      fuero: string;
      tipo: string;
      articulo: string;
    },
  ) {
    return this.iaService.ingestLegalNorm(body);
  }
}
