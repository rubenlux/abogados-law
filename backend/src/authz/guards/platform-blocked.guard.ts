/**
 * PlatformBlockedGuard — Contención Fail-Closed de Endpoints Prototipales / Plataforma / Legacy (AUTH-04)
 * Especificación: SPEC-AUTH-004 v0.2.0 — APPROVED (DEC-04-04, DEC-04-05, §7.6)
 */

import { Injectable, CanActivate, ForbiddenException } from "@nestjs/common";

@Injectable()
export class PlatformBlockedGuard implements CanActivate {
  canActivate(): never {
    throw new ForbiddenException({
      code: "PLATFORM_ENDPOINT_CONTAINED",
      message:
        "This endpoint is disabled under AUTH-04 fail-closed containment policy",
    });
  }
}
