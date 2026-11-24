
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AdminDataService {
    constructor(private prisma: PrismaService) { }

    /**
     * Get Real-time KPI Stats for Admin Dashboard
     */
    async getGlobalStats() {
        const [users, orgs, events] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.organization.count(),
            this.prisma.eventLog.count()
        ]);

        return {
            activeSessions: users, // For MVP approximation
            eventsTotal: events,
            tenantsActive: orgs,
            systemHealth: 99.8
        };
    }

    /**
     * Get recent logs for "God Mode" console
     */
    async getLiveLogs(limit = 20) {
        return this.prisma.eventLog.findMany({
            take: limit,
            orderBy: { timestamp: 'desc' },
            select: {
                id: true,
                eventType: true,
                actorId: true,
                riskScore: true,
                timestamp: true,
                payload: true
            }
        });
    }

    /**
     * Get Traffic Volume for Charts
     */
    async getTrafficVolume() {
        // Mocking time-series for now as Prisma grouping by hour is verbose raw SQL
        // In prod: use TimescaleDB or Clickhouse
        return [
            { time: '09:00', events: 120, risk: 5 },
            { time: '10:00', events: 340, risk: 12 },
            { time: '11:00', events: 550, risk: 8 },
            { time: '12:00', events: 430, risk: 25 },
        ];
    }
}
