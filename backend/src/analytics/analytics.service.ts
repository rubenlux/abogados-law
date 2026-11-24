
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ActorType } from '@prisma/client';
import { ForensicService } from '../core/security/forensic.service';

export interface TrackEventDto {
    actorType: ActorType;
    actorId?: string;
    eventType: string; // "LOGIN", "VIEW_DOC", "AI_PROMPT"
    entityType?: string; // "EXPEDIENTE"
    entityId?: string;
    payload?: any;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    organizationId?: string;
}

@Injectable()
export class AnalyticsService {
    private readonly logger = new Logger(AnalyticsService.name);

    constructor(
        private prisma: PrismaService,
        private forensicService: ForensicService
    ) { }

    async trackEvent(data: TrackEventDto) {
        try {
            // Basic Risk Scoring Logic (Mock)
            let riskScore = 0;
            if (data.eventType === 'LOGIN_FAILED') riskScore = 20;
            if (data.eventType === 'MASS_EXPORT') riskScore = 80;

            // 1. Get Previous Hash (Chain) - expensive but necessary for full forensic
            // Optimization: Cache last hash in Redis per Org
            const lastLog = await this.prisma.eventLog.findFirst({
                where: { organizationId: data.organizationId },
                orderBy: { timestamp: 'desc' },
                select: { currentHash: true }
            });
            const prevHash = lastLog?.currentHash || null;

            // 2. Calculate New Hash
            const timestamp = new Date();
            const currentHash = this.forensicService.calculateEventHash(
                prevHash,
                timestamp,
                data.actorId || 'system',
                data.payload || {}
            );

            // 3. Sign it
            const signature = this.forensicService.signEvent(currentHash);

            await this.prisma.eventLog.create({
                data: {
                    actorType: data.actorType,
                    actorId: data.actorId,
                    eventType: data.eventType,
                    entityType: data.entityType,
                    entityId: data.entityId,
                    payload: data.payload || {},

                    ipAddress: data.ipAddress,
                    userAgent: data.userAgent,
                    sessionId: data.sessionId,
                    organizationId: data.organizationId,

                    riskScore: riskScore,
                    timestamp: timestamp,

                    // -- Forensic Fields --
                    prevHash,
                    currentHash,
                    signature,
                    category: 'SYSTEM', // Default, should be passed in DTO
                    severity: 'INFO'
                }
            });
        } catch (error) {
            this.logger.error('Failed to track event', error);
        }
    }

    /**
     * Aggregation for Employee Productivity
     * This would typically run as a Cron Job at EOD
     */
    async updateEmployeeMetrics(userId: string, metricType: 'TIME' | 'TICKET' | 'AI' | 'DOC', value: number = 1) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const updateData: any = {};
        if (metricType === 'TIME') updateData.activeTimeMinutes = { increment: value };
        if (metricType === 'TICKET') updateData.ticketsResolved = { increment: value };
        if (metricType === 'AI') updateData.aiPromptsUsed = { increment: value };
        if (metricType === 'DOC') updateData.documentsRead = { increment: value };

        await this.prisma.employeeMetric.upsert({
            where: {
                userId_date: { userId, date: today }
            },
            create: {
                userId,
                date: today,
                activeTimeMinutes: metricType === 'TIME' ? value : 0,
                ticketsResolved: metricType === 'TICKET' ? value : 0,
                aiPromptsUsed: metricType === 'AI' ? value : 0,
                documentsRead: metricType === 'DOC' ? value : 0,
                productivityScore: 50 // Base score
            },
            update: updateData
        });
    }

    /**
     * For Admin Dashboard: Get recent global events
     */
    async getRecentEvents(limit: number = 50) {
        return this.prisma.eventLog.findMany({
            take: limit,
            orderBy: { timestamp: 'desc' }
        });
    }
}
