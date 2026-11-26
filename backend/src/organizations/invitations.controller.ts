/**
 * Controlador de Aceptación de Invitaciones (AUTH-03).
 * Endpoint: POST /api/invitations/accept
 * Protegido por BffSessionGuard y CsrfGuard; exige identidad Auth0 verificada y elegible.
 */

import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { BffSessionGuard } from "../auth/guards/bff-session.guard";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { InvitationsService } from "./invitations.service";
import { AcceptInvitationDto } from "./dto/organizations.dto";

@Controller("api/invitations")
@UseGuards(BffSessionGuard, CsrfGuard)
export class InvitationsController {
  constructor(private invitationsService: InvitationsService) {}

  @Post("accept")
  @HttpCode(HttpStatus.OK)
  async accept(@Req() req: any, @Body() dto: AcceptInvitationDto) {
    return this.invitationsService.acceptInvitation(req.user, dto.token, {
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      userAgent: req.headers?.["user-agent"] || null,
      correlationId: req.headers?.["x-correlation-id"] as string | undefined,
    });
  }
}
