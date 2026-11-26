/**
 * Servicio de Sesiones Backend for Frontend (BFF).
 * Especificación: SPEC-AUTH-001 (AUTH-007, TST-AUTH-031, TST-AUTH-032, TST-AUTH-034, TST-AUTH-037)
 *
 * Características:
 * - Identificadores generados por CSPRNG (32 bytes).
 * - En base de datos se almacena ÚNICAMENTE el hash SHA-256 (64 hex) del identificador de sesión.
 * - Vencimiento por inactividad: 30 minutos (idleExpiresAt).
 * - Vencimiento absoluto: 8 horas (expiresAt).
 * - Revocación individual inmediata en logout.
 */

import { Injectable, UnauthorizedException } from "@nestjs/common";
import * as crypto from "crypto";
import { PrismaService } from "../../prisma.service";
import { User, UserSession } from "@prisma/client";

export interface ValidatedSessionResult {
  session: UserSession;
  user: User;
}

@Injectable()
export class BffSessionService {
  private readonly IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos
  private readonly ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 horas

  constructor(private prisma: PrismaService) {}

  /**
   * Crea una nueva sesión persistente en base de datos.
   * Retorna el secreto en texto plano para la cookie y el registro persistido con su hash.
   */
  async createSession(
    userId: string,
    options?: {
      auth0Sid?: string;
      deviceInfo?: string;
      ipAddress?: string;
      activeOrganizationId?: string | null;
    },
  ): Promise<{ rawSessionSecret: string; session: UserSession }> {
    // 1. Generar secreto aleatorio de alta entropía (32 bytes = 256 bits CSPRNG)
    const rawSessionSecret = crypto.randomBytes(32).toString("hex");

    // 2. Calcular hash SHA-256 para persistencia segura
    const sessionTokenHash = this.hashSessionSecret(rawSessionSecret);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ABSOLUTE_TIMEOUT_MS);
    const idleExpiresAt = new Date(now.getTime() + this.IDLE_TIMEOUT_MS);

    // 3. Persistir en la base de datos
    const session = await this.prisma.userSession.create({
      data: {
        userId,
        sessionToken: sessionTokenHash,
        sessionVersion: 1,
        auth0Sid: options?.auth0Sid || null,
        deviceInfo: options?.deviceInfo || null,
        ipAddress: options?.ipAddress || null,
        ...(options?.activeOrganizationId
          ? { activeOrganizationId: options.activeOrganizationId }
          : {}),
        expiresAt,
        idleExpiresAt,
        lastActiveAt: now,
      },
    });

    return { rawSessionSecret, session };
  }

  /**
   * Valida la cookie de sesión contra la base de datos.
   */
  async validateSession(
    rawSessionSecret: string,
  ): Promise<ValidatedSessionResult> {
    if (!rawSessionSecret || typeof rawSessionSecret !== "string") {
      throw new UnauthorizedException("Missing or malformed session cookie");
    }

    const sessionTokenHash = this.hashSessionSecret(rawSessionSecret);

    const session = await this.prisma.userSession.findUnique({
      where: { sessionToken: sessionTokenHash },
    });

    if (!session) {
      throw new UnauthorizedException("Session not found or invalid");
    }

    // 1. Comprobar si fue revocada
    if (session.revokedAt) {
      throw new UnauthorizedException("Session has been revoked");
    }

    const now = Date.now();

    // 2. Comprobar expiración absoluta (8 horas)
    if (session.expiresAt.getTime() <= now) {
      throw new UnauthorizedException("Session expired by absolute timeout");
    }

    // 3. Comprobar expiración por inactividad (30 minutos)
    if (session.idleExpiresAt.getTime() <= now) {
      throw new UnauthorizedException("Session expired due to inactivity");
    }

    // 4. Buscar usuario vinculado
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      throw new UnauthorizedException("User associated with session not found");
    }

    // 5. Renovar ventana de inactividad
    const newIdleTime = Math.min(
      now + this.IDLE_TIMEOUT_MS,
      session.expiresAt.getTime(),
    );
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        lastActiveAt: new Date(now),
        idleExpiresAt: new Date(newIdleTime),
      },
    });

    return { session, user };
  }

  /**
   * Revoca una sesión por su secreto.
   */
  async revokeSession(rawSessionSecret: string): Promise<void> {
    if (!rawSessionSecret) return;

    const sessionTokenHash = this.hashSessionSecret(rawSessionSecret);

    const session = await this.prisma.userSession.findUnique({
      where: { sessionToken: sessionTokenHash },
    });

    if (session && !session.revokedAt) {
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  hashSessionSecret(rawSecret: string): string {
    return crypto.createHash("sha256").update(rawSecret).digest("hex");
  }
}
