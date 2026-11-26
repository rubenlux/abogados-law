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
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { ExpedientesService } from "./expedientes.service";
import { CreateExpedienteDto } from "./dto/create-expediente.dto";
import { UpdateExpedienteDto } from "./dto/update-expediente.dto";
import { QueryExpedienteDto } from "./dto/query-expediente.dto";
import { CreateParteDto, UpdateParteDto } from "./dto/parte.dto";
import { AssignUserDto } from "./dto/assign-user.dto";
import { BffSessionGuard } from "../auth/guards/bff-session.guard";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { ActiveOrgContextGuard } from "../authz/guards/active-org-context.guard";
import { OrgPermissionGuard } from "../authz/guards/org-permission.guard";
import { RequireOrgPermissions } from "../authz/decorators/require-org-permissions.decorator";

@ApiTags("expedientes")
@UseGuards(
  BffSessionGuard,
  ActiveOrgContextGuard,
  CsrfGuard,
  OrgPermissionGuard,
)
@Controller("expedientes")
export class ExpedientesController {
  constructor(private readonly expedientesService: ExpedientesService) {}

  @Get()
  @RequireOrgPermissions("cases:read")
  @ApiOperation({ summary: "Listar expedientes de la organización activa" })
  findAll(@Query() query: QueryExpedienteDto, @Req() req: any) {
    return this.expedientesService.findAll(query, req.orgContext);
  }

  @Post()
  @RequireOrgPermissions("cases:write")
  @ApiOperation({ summary: "Crear nuevo expediente en la organización activa" })
  create(@Body() createExpedienteDto: CreateExpedienteDto, @Req() req: any) {
    return this.expedientesService.create(createExpedienteDto, req.orgContext);
  }

  @Get(":id")
  @RequireOrgPermissions("cases:read")
  @ApiOperation({ summary: "Obtener detalle de un expediente por ID" })
  findById(@Param("id") id: string, @Req() req: any) {
    return this.expedientesService.findById(id, req.orgContext);
  }

  @Patch(":id")
  @RequireOrgPermissions("cases:write")
  @ApiOperation({ summary: "Actualizar datos generales de un expediente" })
  update(
    @Param("id") id: string,
    @Body() updateExpedienteDto: UpdateExpedienteDto,
    @Req() req: any,
  ) {
    return this.expedientesService.update(
      id,
      updateExpedienteDto,
      req.orgContext,
    );
  }

  @Delete(":id")
  @RequireOrgPermissions("cases:delete")
  @ApiOperation({
    summary: "Archivar expediente (soft delete) en la organización activa",
  })
  archive(@Param("id") id: string, @Req() req: any) {
    return this.expedientesService.archive(id, req.orgContext);
  }

  @Post(":id/partes")
  @RequireOrgPermissions("cases:write")
  @ApiOperation({ summary: "Agregar una parte procesal a un expediente" })
  addParte(
    @Param("id") id: string,
    @Body() dto: CreateParteDto,
    @Req() req: any,
  ) {
    return this.expedientesService.addParte(id, dto, req.orgContext);
  }

  @Patch(":id/partes/:parteId")
  @RequireOrgPermissions("cases:write")
  @ApiOperation({ summary: "Modificar una parte procesal de un expediente" })
  updateParte(
    @Param("id") id: string,
    @Param("parteId") parteId: string,
    @Body() dto: UpdateParteDto,
    @Req() req: any,
  ) {
    return this.expedientesService.updateParte(
      id,
      parteId,
      dto,
      req.orgContext,
    );
  }

  @Delete(":id/partes/:parteId")
  @RequireOrgPermissions("cases:write")
  @ApiOperation({ summary: "Eliminar una parte procesal de un expediente" })
  removeParte(
    @Param("id") id: string,
    @Param("parteId") parteId: string,
    @Req() req: any,
  ) {
    return this.expedientesService.removeParte(id, parteId, req.orgContext);
  }

  @Post(":id/users")
  @HttpCode(HttpStatus.OK)
  @RequireOrgPermissions("cases:write")
  @ApiOperation({ summary: "Asignar profesional al equipo del expediente" })
  assignUser(
    @Param("id") id: string,
    @Body() dto: AssignUserDto,
    @Req() req: any,
  ) {
    return this.expedientesService.assignUser(id, dto.userId, req.orgContext);
  }

  @Delete(":id/users/:userId")
  @RequireOrgPermissions("cases:write")
  @ApiOperation({ summary: "Desasignar profesional del equipo del expediente" })
  unassignUser(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @Req() req: any,
  ) {
    return this.expedientesService.unassignUser(id, userId, req.orgContext);
  }
}
