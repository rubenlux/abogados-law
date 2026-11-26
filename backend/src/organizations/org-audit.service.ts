/**
 * Servicio de Auditoría para Eventos de Organizaciones, Membresías, Roles e Invitaciones (AUTH-03).
 * Reutiliza la tabla `AuditLog` existente en PostgreSQL y sanitiza payloads para impedir fugas de secretos.
 *
 * Especificación: SPEC-AUTH-001 v1.0.8 | Expediente: AUTH0-IMPLEMENTATION-007
 */

import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

export interface OrgAuditEventInput {
  actorId: string | null;
  organizationId: string | null;
  targetUserId?: string | null;
  action: string;
  result: "SUCCESS" | "DENIED" | "FAILED";
  entityTable?: string;
  entityId?: string | null;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  correlationId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const SENSITIVE_KEY_PATTERN =
  /token|secret|password|hash|verifier|authorization|cookie/i;

@Injectable()
export class OrgAuditService {
  constructor(private prisma: PrismaService) {}

  async record(
    input: OrgAuditEventInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const correlationId = input.correlationId || crypto.randomUUID();
    const data = {
      userId: input.actorId,
      organizationId: input.organizationId,
      targetUserId: input.targetUserId ?? null,
      action: input.action,
      result: input.result,
      correlationId,
      entityTable: input.entityTable ?? null,
      entityId: input.entityId ?? null,
      oldValues: input.oldValues
        ? (this.sanitize(input.oldValues) as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      newValues: input.newValues
        ? (this.sanitize(input.newValues) as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    };

    if (tx) {
      if (input.organizationId && typeof tx.$executeRaw === "function") {
        await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${input.organizationId}, true)`;
      }
      await tx.auditLog.create({ data });
      return;
    }

    if (
      input.organizationId &&
      typeof this.prisma.$transaction === "function" &&
      typeof this.prisma.$executeRaw === "function"
    ) {
      await this.prisma.$transaction(async (scopedTx) => {
        if (typeof scopedTx.$executeRaw === "function") {
          await scopedTx.$executeRaw`SELECT set_config('app.current_organization_id', ${input.organizationId}, true)`;
        }
        await scopedTx.auditLog.create({ data });
      });
      return;
    }

    await this.prisma.auditLog.create({ data });
  }

  async listByOrganization(organizationId: string, limit = 100) {
    const boundedLimit = Math.min(Math.max(limit, 1), 200);
    if (
      typeof this.prisma.$transaction === "function" &&
      typeof this.prisma.$executeRaw === "function"
    ) {
      return this.prisma.$transaction(async (scopedTx) => {
        if (typeof scopedTx.$executeRaw === "function") {
          await scopedTx.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`;
        }
        return scopedTx.auditLog.findMany({
          where: { organizationId },
          orderBy: { timestamp: "desc" },
          take: boundedLimit,
        });
      });
    }
    return this.prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { timestamp: "desc" },
      take: boundedLimit,
    });
  }

  private sanitize(value: any): any {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }
    if (typeof value === "object") {
      const cleaned: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
          continue;
        }
        cleaned[key] = this.sanitize(val);
      }
      return cleaned;
    }
    return value;
  }
}
