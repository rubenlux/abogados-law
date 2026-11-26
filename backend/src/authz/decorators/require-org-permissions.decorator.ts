import { SetMetadata } from "@nestjs/common";
import { OrgPermission } from "../permissions";

export const ORG_PERMISSIONS_KEY = "auth04_org_permissions";

export const RequireOrgPermissions = (...permissions: OrgPermission[]) =>
  SetMetadata(ORG_PERMISSIONS_KEY, permissions);

