/**
 * Decoradores de Autorización por Organización (AUTH-03).
 * Especificación: SPEC-AUTH-001 v1.0.8 | Expediente: AUTH0-IMPLEMENTATION-007
 */

import { SetMetadata } from "@nestjs/common";
import { OrganizationRole } from "@prisma/client";

export const ORG_ROLES_KEY = "auth03_org_roles";
export const ALLOW_SUSPENDED_ORG_KEY = "auth03_allow_suspended_org";

export const OrgRoles = (...roles: OrganizationRole[]) =>
  SetMetadata(ORG_ROLES_KEY, roles);

export const AllowSuspendedOrg = () =>
  SetMetadata(ALLOW_SUSPENDED_ORG_KEY, true);
