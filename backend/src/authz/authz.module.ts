import { Global, Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { ActiveOrgContextGuard } from "./guards/active-org-context.guard";
import { OrgPermissionGuard } from "./guards/org-permission.guard";
import { PlatformBlockedGuard } from "./guards/platform-blocked.guard";
import { ScopedPrismaService } from "./scoped-prisma.service";

@Global()
@Module({
  providers: [
    PrismaService,
    ActiveOrgContextGuard,
    OrgPermissionGuard,
    PlatformBlockedGuard,
    ScopedPrismaService,
  ],
  exports: [
    ActiveOrgContextGuard,
    OrgPermissionGuard,
    PlatformBlockedGuard,
    ScopedPrismaService,
  ],
})
export class AuthzModule {}

