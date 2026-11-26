import { Controller, Get, UseGuards } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { PlatformBlockedGuard } from "../authz/guards/platform-blocked.guard";

// DEC-04-04 (SPEC-AUTH-004): Contención Fail-Closed de endpoints prototipales de plataforma.
@UseGuards(PlatformBlockedGuard)
@Controller("admin")
export class AdminMasterController {
  constructor(private prisma: PrismaService) {}

  @Get("tenants")
  async getAllTenants() {
    return this.prisma.organization.findMany({
      include: {
        usage: true,
        _count: {
          select: { users: true, expedientes: true },
        },
      },
    });
  }

  @Get("stats")
  async getGlobalStats() {
    const totalOrgs = await this.prisma.organization.count();
    const totalUsers = await this.prisma.user.count();
    const totalFiles = await this.prisma.documento.count();

    return {
      totalOrgs,
      totalUsers,
      totalFiles,
      systemHealth: "OPTIMAL",
    };
  }
}
