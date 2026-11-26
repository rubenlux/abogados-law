import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from "@nestjs/common";
import { TemplatesService } from "./templates.service";
import { BffSessionGuard } from "../auth/guards/bff-session.guard";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { ActiveOrgContextGuard } from "../authz/guards/active-org-context.guard";
import { OrgPermissionGuard } from "../authz/guards/org-permission.guard";
import { RequireOrgPermissions } from "../authz/decorators/require-org-permissions.decorator";

@UseGuards(
  BffSessionGuard,
  ActiveOrgContextGuard,
  CsrfGuard,
  OrgPermissionGuard,
)
@Controller("templates")
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @RequireOrgPermissions("templates:write")
  async create(@Body() body: Record<string, any>, @Req() req: any) {
    if (body?.organizationId !== undefined) {
      throw new BadRequestException(
        "Client-supplied organizationId is forbidden",
      );
    }
    return this.templatesService.create(
      {
        name: body.name,
        description: body.description,
        content: body.content,
        variables: Array.isArray(body.variables) ? body.variables : [],
        category: body.category,
      },
      req.orgContext,
    );
  }

  @Get()
  @RequireOrgPermissions("templates:read")
  async findAll(@Req() req: any) {
    return this.templatesService.findAll(req.orgContext);
  }

  @Post(":id/generate")
  @RequireOrgPermissions("templates:read")
  async generate(
    @Param("id") id: string,
    @Body() values: Record<string, string>,
    @Req() req: any,
  ) {
    return this.templatesService.generateDocument(
      id,
      values || {},
      req.orgContext,
    );
  }
}
