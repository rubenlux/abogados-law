
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsageControlService {
    constructor(private prisma: PrismaService) { }

    /**
     * Checks if an organization has enough AI tokens quota.
     * Should be called before any LLM inference.
     */
    async checkAiQuota(organizationId: string, estimatedCostTokens: number = 1000): Promise<boolean> {
        // 1. Get current usage and plan limits
        // This query joins Organization -> SubscriptionPlan (not yet fully modeled in schema relation but logically present)
        // For MVP we assume limits hardcoded or from a Plan table

        const usage = await this.prisma.tenantUsage.findUnique({
            where: { organizationId }
        });

        if (!usage) return true; // Fail open or closed depending on policy. Open for now.

        // Mock Limit: 50,000 for STARTER
        const LIMIT = 50000;

        if (usage.aiTokensUsed + estimatedCostTokens > LIMIT) {
            return false;
        }

        return true;
    }

    /**
     * Records actual usage after an operation
     */
    async trackUsage(organizationId: string, tokens: number, endpoint: string, userId: string) {
        // Update aggregated usage
        await this.prisma.tenantUsage.upsert({
            where: { organizationId },
            create: {
                organizationId,
                periodEnd: new Date(), // Should be next month
                aiTokensUsed: tokens
            },
            update: {
                aiTokensUsed: { increment: tokens }
            }
        });

        // Log granular interaction
        await this.prisma.aIInteraction.create({
            data: {
                organizationId,
                userId,
                endpoint,
                promptTokens: Math.floor(tokens / 2), // Approx split
                completionTokens: Math.ceil(tokens / 2),
                costUsd: 0, // Calculate based on model price
                response: "Logged"
            }
        });
    }
}
