/**
 * Guard Anti-CSRF para Operaciones Mutantes de la API BFF.
 * Especificación: SPEC-AUTH-001 (AUTH-007, TST-AUTH-033, TST-AUTH-052)
 *
 * Aplica en mutaciones HTTP (POST, PUT, PATCH, DELETE):
 * 1. Validación canónica exacta del encabezado Origin contra la allowlist configurada.
 * 2. Validación criptográfica HMAC-SHA256 del token provisto en la cabecera X-CSRF-Token.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { CsrfService } from "../bff/csrf.service";

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private csrfService: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const method = req.method.toUpperCase();

    // Las peticiones no mutantes (GET, HEAD, OPTIONS) están exentas de CSRF
    if (["GET", "HEAD", "OPTIONS"].includes(method)) {
      return true;
    }

    // 1. Validación estricta de Origin
    const origin = req.headers["origin"] || req.headers["referer"];
    if (!origin || !this.csrfService.validateOrigin(origin)) {
      throw new ForbiddenException("CSRF origin mismatch");
    }

    // 2. Extraer cabecera X-CSRF-Token
    const csrfToken = req.headers["x-csrf-token"];
    if (!csrfToken || typeof csrfToken !== "string") {
      throw new ForbiddenException("CSRF token missing or invalid");
    }

    // 3. Extraer secreto de sesión desde la cookie o contexto de la petición
    const rawSessionSecret =
      req.rawSessionSecret || this.extractCookie(req, "app_session");
    if (!rawSessionSecret) {
      throw new ForbiddenException("CSRF token missing or invalid");
    }

    // 4. Validación criptográfica HMAC en tiempo constante
    const isValid = this.csrfService.verifyToken(csrfToken, rawSessionSecret);
    if (!isValid) {
      throw new ForbiddenException("CSRF signature invalid");
    }

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
