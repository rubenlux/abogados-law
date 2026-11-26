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
import { AgendaEventsService } from "./agenda-events.service";
import {
  CreateAgendaEventDto,
  QueryAgendaEventDto,
  UpdateAgendaEventDto,
} from "./dto/agenda-event.dto";

@ApiTags("agenda-actividades")
@UseGuards(
  BffSessionGuard,
  ActiveOrgContextGuard,
  CsrfGuard,
  OrgPermissionGuard,
)
@Controller("agenda/actividades")
export class AgendaEventsController {
  constructor(private readonly agendaEventsService: AgendaEventsService) {}

  @Get()
  @RequireOrgPermissions("agenda:read")
  @ApiOperation({
    summary: "Listar eventos programados de agenda por rango y filtros",
  })
  findAll(@Query() query: QueryAgendaEventDto, @Req() req: any) {
    return this.agendaEventsService.findAll(query, req.orgContext);
  }

  @Post()
  @RequireOrgPermissions("agenda:write")
  @ApiOperation({ summary: "Programar nuevo evento en agenda judicial" })
  create(@Body() dto: CreateAgendaEventDto, @Req() req: any) {
    return this.agendaEventsService.create(dto, req.orgContext);
  }

  @Get(":id")
  @RequireOrgPermissions("agenda:read")
  @ApiOperation({ summary: "Obtener detalle de evento de agenda" })
  findById(@Param("id") id: string, @Req() req: any) {
    return this.agendaEventsService.findById(id, req.orgContext);
  }

  @Patch(":id")
  @RequireOrgPermissions("agenda:write")
  @ApiOperation({ summary: "Editar evento de agenda" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateAgendaEventDto,
    @Req() req: any,
  ) {
    return this.agendaEventsService.update(id, dto, req.orgContext);
  }

  @Post(":id/completar")
  @HttpCode(HttpStatus.OK)
  @RequireOrgPermissions("agenda:write")
  @ApiOperation({ summary: "Marcar evento de agenda como completado" })
  complete(@Param("id") id: string, @Req() req: any) {
    return this.agendaEventsService.complete(id, req.orgContext);
  }

  @Post(":id/cancelar")
  @HttpCode(HttpStatus.OK)
  @RequireOrgPermissions("agenda:write")
  @ApiOperation({ summary: "Cancelar evento de agenda" })
  cancel(@Param("id") id: string, @Req() req: any) {
    return this.agendaEventsService.cancel(id, req.orgContext);
  }
}

