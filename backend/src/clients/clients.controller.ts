import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { BffSessionGuard } from "../auth/guards/bff-session.guard";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { ActiveOrgContextGuard } from "../authz/guards/active-org-context.guard";
import { OrgPermissionGuard } from "../authz/guards/org-permission.guard";
import { RequireOrgPermissions } from "../authz/decorators/require-org-permissions.decorator";
import { ClientsService } from "./clients.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";
import { QueryClientDto } from "./dto/query-client.dto";

@ApiTags("clients")
@UseGuards(
  BffSessionGuard,
  ActiveOrgContextGuard,
  CsrfGuard,
  OrgPermissionGuard,
)
@Controller("clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @RequireOrgPermissions("clients:read")
  @ApiOperation({
    summary: "Listar clientes paginados de la organización activa",
  })
  findAll(@Query() query: QueryClientDto, @Req() req: any) {
    return this.clientsService.findAll(query, req.orgContext);
  }

  @Post()
  @RequireOrgPermissions("clients:write")
  @ApiOperation({ summary: "Crear nuevo cliente en la organización activa" })
  create(@Body() dto: CreateClientDto, @Req() req: any) {
    return this.clientsService.create(dto, req.orgContext);
  }

  @Get(":id")
  @RequireOrgPermissions("clients:read")
  @ApiOperation({ summary: "Obtener detalle de cliente por ID" })
  findById(@Param("id") id: string, @Req() req: any) {
    return this.clientsService.findById(id, req.orgContext);
  }

  @Patch(":id")
  @RequireOrgPermissions("clients:write")
  @ApiOperation({ summary: "Editar cliente existente" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateClientDto,
    @Req() req: any,
  ) {
    return this.clientsService.update(id, dto, req.orgContext);
  }

  @Delete(":id")
  @RequireOrgPermissions("clients:delete")
  @ApiOperation({
    summary: "Archivar cliente (soft delete) en la organización activa",
  })
  archive(@Param("id") id: string, @Req() req: any) {
    return this.clientsService.archive(id, req.orgContext);
  }
}
