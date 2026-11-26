import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TemplatesController } from "./templates.controller";
import { TemplatesService } from "./templates.service";
import { PrismaService } from "../prisma.service";

@Module({
  imports: [AuthModule],
  controllers: [TemplatesController],
  providers: [TemplatesService, PrismaService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
