import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Req,
} from "@nestjs/common";
import { AgendaService } from "./agenda.service";
import { DeadlineCalculatorService } from "./deadline-calculator.service";
import { ApiTags } from "@nestjs/swagger";
import { BffSessionGuard } from "../auth/guards/bff-session.guard";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { ActiveOrgContextGuard } from "../authz/guards/active-org-context.guard";
import { OrgPermissionGuard } from "../authz/guards/org-permission.guard";
import { RequireOrgPermissions } from "../authz/decorators/require-org-permissions.decorator";

@ApiTags("agenda")
@UseGuards(
  BffSessionGuard,
  ActiveOrgContextGuard,
  CsrfGuard,
  OrgPermissionGuard,
)
@Controller("agenda")
export class AgendaController {
  constructor(
    private readonly agendaService: AgendaService,
    private readonly deadlineService: DeadlineCalculatorService,
  ) {}

  @Get()
  @RequireOrgPermissions("agenda:read")
  findAll(@Req() req: any, @Query() query: any) {
    return this.agendaService.findAll(req.orgContext, query);
  }

  @Get("feriados/:jurisdiccion/:year")
  @RequireOrgPermissions("knowledge:read")
  getHolidays(
    @Param("jurisdiccion") jurisdiccion: string,
    @Param("year") year: string,
  ) {
    return this.agendaService.getHolidays(jurisdiccion, parseInt(year, 10));
  }

  @Post("eventos")
  @RequireOrgPermissions("agenda:write")
  createEvent(@Body() body: any, @Req() req: any) {
    return this.agendaService.createEvent(body, req.orgContext);
  }

  @Post("simular-vencimiento")
  @RequireOrgPermissions("agenda:read")
  async simulateDeadline(
    @Body()
    body: {
      start: string;
      days: number;
      jurisdiccion: string;
      type?: "HABIL" | "CORRIDO";
    },
  ) {
    return this.deadlineService.calculateDeadline(
      body.start,
      body.days,
      body.jurisdiccion,
      body.type,
    );
  }
}
