import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { BffSessionGuard } from "../auth/guards/bff-session.guard";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { ActiveOrgContextGuard } from "../authz/guards/active-org-context.guard";
import { OrgPermissionGuard } from "../authz/guards/org-permission.guard";
import { RequireOrgPermissions } from "../authz/decorators/require-org-permissions.decorator";
import { LegalAiAssistantService } from "./legal-ai-assistant.service";
import {
  CreateConversationDto,
  QueryConversationsDto,
  SendAssistantMessageDto,
  UpdateConversationDto,
} from "./dto/legal-ai-assistant.dto";

@UseGuards(
  BffSessionGuard,
  ActiveOrgContextGuard,
  CsrfGuard,
  OrgPermissionGuard,
)
@Controller("legal-ai")
export class LegalAiAssistantController {
  constructor(private readonly assistantService: LegalAiAssistantService) {}

  @Get("assistant/status")
  @RequireOrgPermissions("legal_ai:read", "ai:use")
  getStatus() {
    return this.assistantService.getStatus();
  }

  @Post("conversations")
  @RequireOrgPermissions("legal_ai:write", "ai:use")
  async createConversation(
    @Body() dto: CreateConversationDto,
    @Req() req: any,
  ) {
    return this.assistantService.createConversation(dto, req.orgContext);
  }

  @Get("conversations")
  @RequireOrgPermissions("legal_ai:read", "ai:use")
  async listConversations(
    @Query() query: QueryConversationsDto,
    @Req() req: any,
  ) {
    return this.assistantService.listConversations(query, req.orgContext);
  }

  @Get("conversations/:id")
  @RequireOrgPermissions("legal_ai:read", "ai:use")
  async getConversation(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.assistantService.getConversation(id, req.orgContext);
  }

  @Patch("conversations/:id")
  @RequireOrgPermissions("legal_ai:write", "ai:use")
  async updateConversation(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
    @Req() req: any,
  ) {
    return this.assistantService.updateConversation(id, dto, req.orgContext);
  }

  @Delete("conversations/:id")
  @RequireOrgPermissions("legal_ai:write", "ai:use")
  async archiveConversation(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.assistantService.archiveConversation(id, req.orgContext);
  }

  @Get("conversations/:id/messages")
  @RequireOrgPermissions("legal_ai:read", "ai:use")
  async listMessages(@Param("id", ParseUUIDPipe) id: string, @Req() req: any) {
    return this.assistantService.listMessages(id, req.orgContext);
  }

  @Post("conversations/:id/messages")
  @RequireOrgPermissions("legal_ai:write", "ai:use")
  async sendMessage(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SendAssistantMessageDto,
    @Req() req: any,
  ) {
    return this.assistantService.sendMessage(id, dto, req.orgContext);
  }
}
