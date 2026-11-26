import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { ActorType } from "@prisma/client";
import { ForensicService } from "../core/security/forensic.service";
import { ScopedPrismaService } from "../authz/scoped-prisma.service";

export interface TrackEventDto {
  actorType: ActorType;
  actorId?: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  payload?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  organizationId: string;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scopedPrisma: ScopedPrismaService,
    private readonly forensicService: ForensicService,
  ) {}

  async trackEvent(data: TrackEventDto) {
    if (!data.organizationId) {
      throw new BadRequestException(
        "organizationId is required to track tenant event",
      );
    }

    try {
      let riskScore = 0;
      if (data.eventType === "LOGIN_FAILED") riskScore = 20;
      if (data.eventType === "MASS_EXPORT") riskScore = 80;

      await this.scopedPrisma.runInOrgContext(
        { organizationId: data.organizationId },
        async (tx) => {
          const lastLog = await tx.eventLog.findFirst({
            where: { organizationId: data.organizationId },
            orderBy: { timestamp: "desc" },
            select: { currentHash: true },
          });
          const prevHash = lastLog?.currentHash || null;

          const timestamp = new Date();
          const currentHash = this.forensicService.calculateEventHash(
            prevHash,
            timestamp,
            data.actorId || "system",
            data.payload || {},
          );
          const signature = this.forensicService.signEvent(currentHash);

          await tx.eventLog.create({
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
              riskScore,
              timestamp,
              prevHash,
              currentHash,
              signature,
              category: "SYSTEM",
              severity: "INFO",
            },
          });
        },
      );
    } catch (error) {
      this.logger.error("Failed to track event", error);
    }
  }

  /**
   * Actualización de productividad por usuario estrictamente scoped a la organización activa.
   */
  async updateEmployeeMetrics(
    organizationId: string,
    userId: string,
    metricType: "TIME" | "TICKET" | "AI" | "DOC",
    value: number = 1,
  ) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const updateData: any = {};
    if (metricType === "TIME")
      updateData.activeTimeMinutes = { increment: value };
    if (metricType === "TICKET")
      updateData.ticketsResolved = { increment: value };
    if (metricType === "AI") updateData.aiPromptsUsed = { increment: value };
    if (metricType === "DOC") updateData.documentsRead = { increment: value };

    await this.scopedPrisma.runInOrgContext({ organizationId }, async (tx) => {
      const existing = await tx.employeeMetric.findFirst({
        where: { userId, organizationId, date: today },
        select: { id: true },
      });

      if (existing) {
        await tx.employeeMetric.updateMany({
          where: { id: existing.id, organizationId },
          data: updateData,
        });
      } else {
        await tx.employeeMetric.create({
          data: {
            userId,
            organizationId,
            date: today,
            activeTimeMinutes: metricType === "TIME" ? value : 0,
            ticketsResolved: metricType === "TICKET" ? value : 0,
            aiPromptsUsed: metricType === "AI" ? value : 0,
            documentsRead: metricType === "DOC" ? value : 0,
            productivityScore: 50,
          },
        });
      }
    });
  }

  async getRecentEvents(limit: number = 50) {
    return this.prisma.eventLog.findMany({
      take: limit,
      orderBy: { timestamp: "desc" },
    });
  }
}
