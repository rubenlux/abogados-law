import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuthzModule } from "../authz/authz.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaService } from "../prisma.service";
import { VencimientosController } from "./vencimientos.controller";
import { VencimientosService } from "./vencimientos.service";

@Module({
  imports: [AuthzModule, OrganizationsModule, AuthModule],
  controllers: [VencimientosController],
  providers: [VencimientosService, PrismaService],
  exports: [VencimientosService],
})
export class VencimientosModule {}

