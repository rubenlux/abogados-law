import { Module } from "@nestjs/common";
import { ClientsService } from "./clients.service";
import { ClientsController } from "./clients.controller";
import { AuthzModule } from "../authz/authz.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../prisma.service";

@Module({
  imports: [AuthzModule, OrganizationsModule, AuthModule],
  controllers: [ClientsController],
  providers: [ClientsService, PrismaService],
  exports: [ClientsService],
})
export class ClientsModule {}
