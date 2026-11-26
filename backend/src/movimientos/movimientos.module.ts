import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuthzModule } from "../authz/authz.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaService } from "../prisma.service";
import { MovimientosController } from "./movimientos.controller";
import { MovimientosService } from "./movimientos.service";

@Module({
  imports: [AuthzModule, OrganizationsModule, AuthModule],
  controllers: [MovimientosController],
  providers: [MovimientosService, PrismaService],
  exports: [MovimientosService],
})
export class MovimientosModule {}

