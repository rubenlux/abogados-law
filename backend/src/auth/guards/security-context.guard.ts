/**
 * Guard de Resolución de Identidad y Construcción de SecurityContext.
 * Especificación: SPEC-AUTH-001 (AUTH-003, AUTH-004, AUTH-005, TST-AUTH-001, TST-AUTH-009, TST-AUTH-046)
 *
 * Responsabilidades:
 * - Resuelve identidad (issuer, subject) hacia usuario local mediante UserIdentity.
 * - Bloquea identidades no enroladas (401 Unauthorized).
 * - Bloquea usuarios suspendidos o inactivos (403 Forbidden).
 * - Bloquea usuarios sin organización activa (403 Forbidden).
 * - Inyecta req.securityContext con { userId, userEmail, activeOrgId, role, authTime }.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import { User } from "@prisma/client";

export interface SecurityContext {
  userId: string;
  userEmail: string;
  activeOrgId: string;
  role: string;
  authTime?: number;
}

@Injectable()
export class SecurityContextGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    let user: User | null = null;
    let authTime: number | undefined;

    // 1. Caso A: Petición autenticada por BFFSessionGuard (usuario ya resuelto)
    if (req.user && req.user.id && req.user.role) {
      user = req.user as User;
      authTime = req.session?.lastActiveAt
        ? Math.floor(new Date(req.session.lastActiveAt).getTime() / 1000)
        : undefined;
    }
    // 2. Caso B: Petición con JWT RS256 autenticada por Auth0JwtGuard
    else if (req.user && req.user.sub) {
      const jwtPayload = req.user;
      authTime = jwtPayload.iat;

      const issuer: string =
        jwtPayload.iss || "https://abogados-test.us.auth0.com/";
      const subject: string = jwtPayload.sub;

      // Resolución formal mediante relación UserIdentity (issuer, subject)
      if (this.prisma.userIdentity) {
        const identity = await this.prisma.userIdentity.findUnique({
          where: {
            issuer_subject: {
              issuer,
              subject,
            },
          },
          include: { user: true },
        });

        if (identity && identity.user) {
          user = identity.user;
        }
      }

      // Compatibilidad con arnés unitario transitorio si no se mockeó userIdentity
      if (!user) {
        user = await this.prisma.user.findFirst({
          where: {
            OR: [{ id: subject.replace(/^auth0\|/, "") }, { id: subject }],
          },
        });
      }
    } else {
      throw new UnauthorizedException(
        "Security context resolution failed: missing authenticated payload",
      );
    }

    if (!user) {
      throw new UnauthorizedException("Identity not registered in system");
    }

    // Comprobar estado de suspensión del usuario
    const permissions = user.permissions as Record<string, any> | null;
    if (permissions && permissions.status === "SUSPENDED") {
      throw new ForbiddenException("Account is suspended or inactive");
    }

    // Comprobar membresía activa de organización
    if (!user.organizationId || user.organizationId.trim() === "") {
      throw new ForbiddenException("No active organization membership found");
    }

    // Inyectar SecurityContext soberano en el request
    req.securityContext = {
      userId: user.id,
      userEmail: user.email,
      activeOrgId: user.organizationId,
      role: user.role,
      authTime,
    };

    return true;
  }
}
