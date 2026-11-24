
import { Controller, Get, Param, UseGuards, SetMetadata } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
// import { AdminGuard } from ...

@Controller('admin')
export class AdminMasterController {
    constructor(private prisma: PrismaService) { }

    // @UseGuards(AdminGuard)
    @Get('tenants')
    async getAllTenants() {
        return this.prisma.organization.findMany({
            include: {
                usage: true,
                _count: {
                    select: { users: true, expedientes: true }
                }
            }
        });
    }

    @Get('stats')
    async getGlobalStats() {
        const totalOrgs = await this.prisma.organization.count();
        const totalUsers = await this.prisma.user.count();
        const totalFiles = await this.prisma.documento.count();

        return {
            totalOrgs,
            totalUsers,
            totalFiles,
            systemHealth: "OPTIMAL"
        };
    }
}
