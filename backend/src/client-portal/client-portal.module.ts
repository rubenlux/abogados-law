import { Module } from "@nestjs/common";
import { ClientPortalController } from "./client-portal.controller";
import { ClientPortalService } from "./client-portal.service";
import { PrismaService } from "../prisma.service";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: { expiresIn: "1d" }, // Clients sessions can be longer
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ClientPortalController],
  providers: [ClientPortalService, PrismaService],
})
export class ClientPortalModule {}
