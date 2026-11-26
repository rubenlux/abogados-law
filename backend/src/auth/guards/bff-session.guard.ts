/**
 * Guard de Autenticación de Sesión BFF basado en Cookies HttpOnly.
 * Especificación: SPEC-AUTH-001 (AUTH-007, TST-AUTH-031, TST-AUTH-034, TST-AUTH-037)
 *
 * Características:
 * - Extrae la cookie opaca app_session.
 * - Valida existencia, expiración absoluta (8h), inactividad (30m) y no-revocación en BD.
 * - Inyecta req.user y req.session en la petición.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { BffSessionService } from "../bff/bff-session.service";

@Injectable()
export class BffSessionGuard implements CanActivate {
  constructor(private sessionService: BffSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const rawSessionSecret = this.extractCookie(req, "app_session");
    if (!rawSessionSecret) {
      throw new UnauthorizedException("Missing session cookie");
    }

    const { session, user } =
      await this.sessionService.validateSession(rawSessionSecret);

    req.user = user;
    req.session = session;
    req.rawSessionSecret = rawSessionSecret;

    return true;
  }

  private extractCookie(req: any, cookieName: string): string | null {
    if (req.cookies && req.cookies[cookieName]) {
      return req.cookies[cookieName];
    }
    const cookieHeader = req.headers["cookie"];
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(";");
    for (const c of cookies) {
      const [name, val] = c.trim().split("=");
      if (name === cookieName) {
        return decodeURIComponent(val);
      }
    }
    return null;
  }
}
