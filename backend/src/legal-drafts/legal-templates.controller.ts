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
import { LegalTemplatesService } from "./legal-templates.service";
import {
  CreateLegalTemplateDto,
  QueryLegalTemplateDto,
  UpdateLegalTemplateDto,
} from "./dto/legal-template.dto";

@UseGuards(
  BffSessionGuard,
  ActiveOrgContextGuard,
  CsrfGuard,
  OrgPermissionGuard,
)
@Controller("legal-templates")
export class LegalTemplatesController {
  constructor(private readonly templatesService: LegalTemplatesService) {}

  @Get()
  @RequireOrgPermissions("legal_drafts:read")
  async findAll(@Query() query: QueryLegalTemplateDto, @Req() req: any) {
    return this.templatesService.findAll(query, req.orgContext);
  }

  @Post()
  @RequireOrgPermissions("legal_templates:manage")
  async create(@Body() dto: CreateLegalTemplateDto, @Req() req: any) {
    return this.templatesService.create(dto, req.orgContext);
  }

  @Get(":id")
  @RequireOrgPermissions("legal_drafts:read")
  async findById(@Param("id", ParseUUIDPipe) id: string, @Req() req: any) {
    return this.templatesService.findById(id, req.orgContext);
  }

  @Patch(":id")
  @RequireOrgPermissions("legal_templates:manage")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateLegalTemplateDto,
    @Req() req: any,
  ) {
    return this.templatesService.update(id, dto, req.orgContext);
  }

  @Post(":id/duplicate")
  @RequireOrgPermissions("legal_templates:manage")
  async duplicate(@Param("id", ParseUUIDPipe) id: string, @Req() req: any) {
    return this.templatesService.duplicate(id, req.orgContext);
  }

  @Delete(":id")
  @RequireOrgPermissions("legal_templates:manage")
  async archive(@Param("id", ParseUUIDPipe) id: string, @Req() req: any) {
    return this.templatesService.archive(id, req.orgContext);
  }
}
