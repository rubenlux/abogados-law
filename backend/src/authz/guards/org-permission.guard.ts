/**
 * OrgPermissionGuard — Autorización Declarativa Fail-Closed por Permiso Organizacional (AUTH-04)
 * Especificación: SPEC-AUTH-004 v0.2.0 — APPROVED (§7, §8.1, §9)
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ORG_PERMISSIONS_KEY } from "../decorators/require-org-permissions.decorator";
import { OrgPermission, hasOrgPermissions } from "../permissions";
import { ActiveOrgContext } from "./active-org-context.guard";

@Injectable()
export class OrgPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const orgContext: ActiveOrgContext | undefined = req?.orgContext;

    if (!orgContext || !orgContext.organizationId || !orgContext.orgRole) {
      throw new ForbiddenException({
        code: "MISSING_ORG_CONTEXT",
        message:
          "Organization context is required before permission evaluation",
      });
    }

    const requiredPermissions = this.reflector.getAllAndOverride<
      OrgPermission[]
    >(ORG_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    // Fail-Closed: todo handler protegido por OrgPermissionGuard debe declarar permisos explícitos
    if (!requiredPermissions || requiredPermissions.length === 0) {
      throw new ForbiddenException({
        code: "NO_PERMISSIONS_DECLARED",
        message:
          "Endpoint lacks explicit organizational permission declaration",
      });
    }

    if (!hasOrgPermissions(orgContext.orgRole, requiredPermissions)) {
      throw new ForbiddenException({
        code: "INSUFFICIENT_ORG_PERMISSIONS",
        message: "Active organization role lacks required permissions",
      });
    }

    return true;
  }
}
