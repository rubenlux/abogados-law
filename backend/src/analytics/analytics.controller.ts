
import { Controller, Post, Body, Get, Req, UseGuards, Ip } from '@nestjs/common';
import { AnalyticsService, TrackEventDto } from './analytics.service';
import { Request } from 'express';
// import { JwtAuthGuard } from ... // Public endpoint often needed for pixels, but better secured

import { PixelGuard } from '../core/security/pixel.guard';

@Controller('events')
export class AnalyticsController {
    constructor(private analyticsService: AnalyticsService) { }

    @Post('collect')
    @UseGuards(PixelGuard)
    async collectEvent(@Body() body: any, @Req() req: Request, @Ip() ip: string) {
        // Enriched DTO
        const eventData: TrackEventDto = {
            actorType: body.actorType || 'SYSTEM', // Default, should be reinforced by Auth
            actorId: body.actorId,
            eventType: body.eventType,
            entityType: body.entityType,
            entityId: body.entityId,
            payload: body.payload,
            ipAddress: ip,
            userAgent: req.headers['user-agent'],
            sessionId: body.sessionId,
            organizationId: body.organizationId
        };

        // Async fire and forget
        this.analyticsService.trackEvent(eventData);
        return { status: 'ok' };
    }

    @Get('logs')
    async getLogs() {
        // Secure this endpoint with AdminGuard later!
        return this.analyticsService.getRecentEvents();
    }
}
