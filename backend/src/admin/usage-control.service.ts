import { Injectable } from "@nestjs/common";
import { ScopedPrismaService } from "../authz/scoped-prisma.service";

@Injectable()
export class UsageControlService {
  constructor(private readonly scopedPrisma: ScopedPrismaService) {}

  /**
   * Verifica cuota de tokens IA estrictamente dentro del contexto organizacional (RLS + filtro).
   */
  async checkAiQuota(
    organizationId: string,
    estimatedCostTokens: number = 1000,
  ): Promise<boolean> {
    return this.scopedPrisma.runInOrgContext({ organizationId }, async (tx) => {
      const usage = await tx.tenantUsage.findFirst({
        where: { organizationId },
      });

      if (!usage) return true;

      const LIMIT = 50000;
      if (usage.aiTokensUsed + estimatedCostTokens > LIMIT) {
        return false;
      }

      return true;
    });
  }

  /**
   * Registra uso agregado (TenantUsage) y detalle granular (AIInteraction) bajo ScopedPrismaService.
   */
  async trackUsage(
    organizationId: string,
    tokens: number,
    endpoint: string,
    userId: string,
  ) {
    await this.scopedPrisma.runInOrgContext({ organizationId }, async (tx) => {
      const existing = await tx.tenantUsage.findFirst({
        where: { organizationId },
        select: { id: true },
      });

      if (existing) {
        await tx.tenantUsage.updateMany({
          where: { id: existing.id, organizationId },
          data: { aiTokensUsed: { increment: tokens } },
        });
      } else {
        await tx.tenantUsage.create({
          data: {
            organizationId,
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            aiTokensUsed: tokens,
          },
        });
      }

      await tx.aIInteraction.create({
        data: {
          organizationId,
          userId,
          endpoint,
          promptTokens: Math.floor(tokens / 2),
          completionTokens: Math.ceil(tokens / 2),
          costUsd: 0,
          response: "Logged",
        },
      });
    });
  }
}
