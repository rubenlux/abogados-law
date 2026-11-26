import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  UseGuards,
  Ip,
} from "@nestjs/common";
import { AnalyticsService, TrackEventDto } from "./analytics.service";
import { PixelGuard } from "../core/security/pixel.guard";
import { BffSessionGuard } from "../auth/guards/bff-session.guard";
import { CsrfGuard } from "../auth/guards/csrf.guard";
import { ActiveOrgContextGuard } from "../authz/guards/active-org-context.guard";
import { PlatformBlockedGuard } from "../authz/guards/platform-blocked.guard";

@Controller("events")
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Post("collect")
  @UseGuards(BffSessionGuard, ActiveOrgContextGuard, CsrfGuard, PixelGuard)
  async collectEvent(@Body() body: any, @Req() req: any, @Ip() ip: string) {
    // SPEC-AUTH-004: nunca confiar en body.organizationId; usar exclusivamente req.orgContext
    const eventData: TrackEventDto = {
      actorType: body.actorType || "USER",
      actorId: req.orgContext.userId,
      eventType: body.eventType,
      entityType: body.entityType,
      entityId: body.entityId,
      payload: body.payload,
      ipAddress: ip,
      userAgent: req.headers["user-agent"],
      sessionId: req.session?.id,
      organizationId: req.orgContext.organizationId,
    };

    await this.analyticsService.trackEvent(eventData);
    return { status: "ok" };
  }

  // DEC-04-04 (SPEC-AUTH-004): Lectura global de logs bloqueada Fail-Closed.
  @Get("logs")
  @UseGuards(PlatformBlockedGuard)
  async getLogs() {
    return this.analyticsService.getRecentEvents();
  }
}
