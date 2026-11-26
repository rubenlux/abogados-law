import {
  Body,
  Controller,
  Delete,
  Get,
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
import { MovimientosService } from "./movimientos.service";
import {
  AnnulMovimientoDto,
  CreateMovimientoDto,
  QueryMovimientoDto,
  UpdateMovimientoDto,
} from "./dto/movimiento.dto";

@ApiTags("movimientos")
@UseGuards(
  BffSessionGuard,
  ActiveOrgContextGuard,
  CsrfGuard,
  OrgPermissionGuard,
)
@Controller("movimientos")
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}

  @Get()
  @RequireOrgPermissions("cases:read")
  @ApiOperation({
    summary: "Listar movimientos procesales de la organización / expediente",
  })
  findAll(@Query() query: QueryMovimientoDto, @Req() req: any) {
    return this.movimientosService.findAll(query, req.orgContext);
  }

  @Post()
  @RequireOrgPermissions("cases:write")
  @ApiOperation({ summary: "Registrar nuevo movimiento procesal" })
  create(@Body() dto: CreateMovimientoDto, @Req() req: any) {
    return this.movimientosService.create(dto, req.orgContext);
  }

  @Get(":id")
  @RequireOrgPermissions("cases:read")
  @ApiOperation({ summary: "Obtener detalle de un movimiento procesal" })
  findById(@Param("id") id: string, @Req() req: any) {
    return this.movimientosService.findById(id, req.orgContext);
  }

  @Patch(":id")
  @RequireOrgPermissions("cases:write")
  @ApiOperation({ summary: "Editar movimiento procesal" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateMovimientoDto,
    @Req() req: any,
  ) {
    return this.movimientosService.update(id, dto, req.orgContext);
  }

  @Delete(":id")
  @RequireOrgPermissions("cases:delete")
  @ApiOperation({
    summary: "Anular movimiento procesal (baja lógica trazable)",
  })
  annul(
    @Param("id") id: string,
    @Body() dto: AnnulMovimientoDto,
    @Req() req: any,
  ) {
    return this.movimientosService.annul(id, dto || {}, req.orgContext);
  }
}

