import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { BffSessionGuard } from "../auth/guards/bff-session.guard";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { ActiveOrgContextGuard } from "../authz/guards/active-org-context.guard";
import { OrgPermissionGuard } from "../authz/guards/org-permission.guard";
import { RequireOrgPermissions } from "../authz/decorators/require-org-permissions.decorator";
import { VencimientosService } from "./vencimientos.service";
import {
  ActionVencimientoDto,
  CreateVencimientoDto,
  QueryVencimientoDto,
  UpdateVencimientoDto,
} from "./dto/vencimiento.dto";

@ApiTags("vencimientos")
@UseGuards(
  BffSessionGuard,
  ActiveOrgContextGuard,
  CsrfGuard,
  OrgPermissionGuard,
)
@Controller("vencimientos")
export class VencimientosController {
  constructor(private readonly vencimientosService: VencimientosService) {}

  @Get()
  @RequireOrgPermissions("agenda:read")
  @ApiOperation({
    summary:
      "Listar vencimientos (todos, pendientes, próximos, vencidos, cumplidos)",
  })
  findAll(@Query() query: QueryVencimientoDto, @Req() req: any) {
    return this.vencimientosService.findAll(query, req.orgContext);
  }

  @Post()
  @RequireOrgPermissions("agenda:write")
  @ApiOperation({
    summary:
      "Registrar vencimiento con fecha límite ingresada manualmente por el usuario",
  })
  create(@Body() dto: CreateVencimientoDto, @Req() req: any) {
    return this.vencimientosService.create(dto, req.orgContext);
  }

  @Get(":id")
  @RequireOrgPermissions("agenda:read")
  @ApiOperation({ summary: "Obtener detalle de vencimiento" })
  findById(@Param("id") id: string, @Req() req: any) {
    return this.vencimientosService.findById(id, req.orgContext);
  }

  @Patch(":id")
  @RequireOrgPermissions("agenda:write")
  @ApiOperation({ summary: "Editar vencimiento" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateVencimientoDto,
    @Req() req: any,
  ) {
    return this.vencimientosService.update(id, dto, req.orgContext);
  }

  @Post(":id/cumplir")
  @HttpCode(HttpStatus.OK)
  @RequireOrgPermissions("agenda:write")
  @ApiOperation({ summary: "Marcar vencimiento como cumplido" })
  complete(
    @Param("id") id: string,
    @Body() dto: ActionVencimientoDto,
    @Req() req: any,
  ) {
    return this.vencimientosService.complete(id, dto || {}, req.orgContext);
  }

  @Post(":id/cancelar")
  @HttpCode(HttpStatus.OK)
  @RequireOrgPermissions("agenda:write")
  @ApiOperation({ summary: "Cancelar vencimiento" })
  cancel(
    @Param("id") id: string,
    @Body() dto: ActionVencimientoDto,
    @Req() req: any,
  ) {
    return this.vencimientosService.cancel(id, dto || {}, req.orgContext);
  }
}

