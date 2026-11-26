import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { BffController } from "./bff/bff.controller";
import { OidcClientService } from "./bff/oidc-client.service";
import { BffSessionService } from "./bff/bff-session.service";
import { CsrfService } from "./bff/csrf.service";
import { BffSessionGuard } from "./guards/bff-session.guard";
import { CsrfGuard } from "./guards/csrf.guard";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { Auth0JwtStrategy } from "./strategies/auth0-jwt.strategy";
import { Auth0JwtGuard } from "./guards/auth0-jwt.guard";
import { SecurityContextGuard } from "./guards/security-context.guard";
import { JwksKeystoreService } from "./services/jwks-keystore.service";
import { PrismaService } from "../prisma.service";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "auth0-jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET") || "secret",
        signOptions: { expiresIn: "60m" },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, BffController],
  providers: [
    AuthService,
    JwksKeystoreService,
    Auth0JwtStrategy,
    Auth0JwtGuard,
    SecurityContextGuard,
    OidcClientService,
    BffSessionService,
    CsrfService,
    BffSessionGuard,
    CsrfGuard,
    JwtStrategy,
    PrismaService,
  ],
  exports: [
    AuthService,
    JwksKeystoreService,
    Auth0JwtStrategy,
    Auth0JwtGuard,
    SecurityContextGuard,
    OidcClientService,
    BffSessionService,
    CsrfService,
    BffSessionGuard,
    CsrfGuard,
  ],
})
export class AuthModule {}
