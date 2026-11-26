import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Param,
} from "@nestjs/common";
import { ClientPortalService } from "./client-portal.service";
import { PlatformBlockedGuard } from "../authz/guards/platform-blocked.guard";

// DEC-04-04 (SPEC-AUTH-004): Contención Fail-Closed del portal de clientes legacy.
// No se elimina el módulo ni los datos; su rediseño definitivo queda fuera del alcance de AUTH-04.
@UseGuards(PlatformBlockedGuard)
@Controller("client-portal")
export class ClientPortalController {
  constructor(private clientService: ClientPortalService) {}

  @Post("login")
  async login(@Body() body: { email: string; cuit: string }) {
    return this.clientService.login(body.email, body.cuit);
  }

  @Get("cases")
  async getMyCases(@Request() req: any) {
    return this.clientService.getMyCases(req.user?.userId);
  }

  @Get("cases/:id")
  async getCaseDetail(@Request() req: any, @Param("id") id: string) {
    return this.clientService.getCaseDetail(req.user?.userId, id);
  }
}
