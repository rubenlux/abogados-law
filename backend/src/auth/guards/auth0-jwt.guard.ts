/**
 * Guard de Autenticación Asimétrica Auth0 JWT (RS256).
 * Especificación: SPEC-AUTH-001 (AUTH-002, TST-AUTH-001 a TST-AUTH-008, TST-AUTH-018, TST-AUTH-043)
 *
 * Maneja respuestas HTTP estandarizadas:
 * - 401 Unauthorized ante firma inválida, token vencido o audiencia incorrecta.
 * - 503 Service Unavailable ante indisponibilidad de JWKS (Fail-Closed).
 */

import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  HttpException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class Auth0JwtGuard extends AuthGuard("auth0-jwt") {
  handleRequest(
    err: any,
    user: any,
    info: any,
    _context: ExecutionContext,
    _status?: any,
  ): any {
    // 1. Manejo de excepciones propagadas en err
    if (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      if (err.status === 503 || (err.message && err.message.includes("JWKS"))) {
        throw new ServiceUnavailableException(
          err.message || "JWKS service unavailable",
        );
      }
      throw new UnauthorizedException(err.message || "Unauthorized");
    }

    // 2. Manejo de fallas de Passport propagadas en info
    if (!user) {
      if (info) {
        if (info instanceof HttpException) {
          throw info;
        }
        if (
          info.status === 503 ||
          (info.message && info.message.includes("JWKS"))
        ) {
          throw new ServiceUnavailableException(
            info.message || "JWKS service unavailable or key resolution failed",
          );
        }
        if (
          info.name === "TokenExpiredError" ||
          info.message === "jwt expired"
        ) {
          throw new UnauthorizedException({
            error: "Unauthorized",
            message: "jwt expired",
          });
        }
        if (info.name === "JsonWebTokenError") {
          throw new UnauthorizedException(info.message);
        }
        if (info.message) {
          throw new UnauthorizedException(info.message);
        }
      }
      throw new UnauthorizedException("Unauthorized");
    }

    return user;
  }
}
