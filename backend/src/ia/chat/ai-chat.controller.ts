import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  Delete,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { AIChatService } from "./ai-chat.service";
import { BffSessionGuard } from "../../auth/guards/bff-session.guard";
import { CsrfGuard } from "../../auth/guards/csrf.guard";
import { ActiveOrgContextGuard } from "../../authz/guards/active-org-context.guard";
import { OrgPermissionGuard } from "../../authz/guards/org-permission.guard";
import { RequireOrgPermissions } from "../../authz/decorators/require-org-permissions.decorator";

@ApiTags("IA Chat")
@Controller("ai/chat")
@UseGuards(
  BffSessionGuard,
  ActiveOrgContextGuard,
  CsrfGuard,
  OrgPermissionGuard,
)
export class AIChatController {
  constructor(private chatService: AIChatService) {}

  @Post(":expedienteId")
  @RequireOrgPermissions("ai:use")
  @ApiOperation({
    summary: "Enviar mensaje al asistente legal sobre un expediente específico",
  })
  async chat(
    @Param("expedienteId") expedienteId: string,
    @Body() body: { message: string },
    @Req() req: any,
  ) {
    return this.chatService.chat(expedienteId, body.message, req.orgContext);
  }

  @Get(":expedienteId/history")
  @RequireOrgPermissions("ai:use")
  @ApiOperation({ summary: "Obtener historial de chat del expediente" })
  async getHistory(
    @Param("expedienteId") expedienteId: string,
    @Req() req: any,
  ) {
    return this.chatService.getSessionHistory(expedienteId, req.orgContext);
  }

  @Delete(":expedienteId/history")
  @RequireOrgPermissions("ai:use")
  @ApiOperation({ summary: "Borrar memoria del chat" })
  async clearHistory(
    @Param("expedienteId") expedienteId: string,
    @Req() req: any,
  ) {
    return this.chatService.clearHistory(expedienteId, req.orgContext);
  }
}
