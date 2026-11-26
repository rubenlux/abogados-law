/**
 * ScopedPrismaService — Acceso Transaccional a PostgreSQL con Scoping Multi-Tenant + SET LOCAL RLS (AUTH-04)
 * Especificación: SPEC-AUTH-004 v0.2.0 — APPROVED (§9, §10.1, §11, §12)
 *
 * Garantías:
 * 1. Exige organizationId no vacío (Fail-Closed).
 * 2. Prohibe cambio de tenant anidado dentro de una transacción abierta (AsyncLocalStorage).
 * 3. Ejecuta `SELECT set_config('app.current_organization_id', $1, true)` (SET LOCAL) como primera sentencia
 *    de la transacción interactiva Prisma, garantizando limpieza automática en COMMIT y ROLLBACK.
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { AsyncLocalStorage } from "async_hooks";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

export interface ScopedOrgInput {
  readonly organizationId: string;
}

@Injectable()
export class ScopedPrismaService {
  private readonly activeTxOrg = new AsyncLocalStorage<string>();

  constructor(private readonly prisma: PrismaService) {}

  async runInOrgContext<T>(
    ctx: ScopedOrgInput,
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const orgId = ctx?.organizationId?.trim();
    if (!orgId) {
      throw new BadRequestException(
        "ScopedPrismaService requires a non-empty organizationId",
      );
    }

    const currentActiveOrg = this.activeTxOrg.getStore();
    if (currentActiveOrg !== undefined && currentActiveOrg !== orgId) {
      throw new ForbiddenException(
        "Nested tenant context switch inside an active transaction is forbidden",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${orgId}, true)`;
      return this.activeTxOrg.run(orgId, () => callback(tx));
    });
  }
}

