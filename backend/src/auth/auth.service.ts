import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { LoginDto } from "./dto/login.dto";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(_loginDto: LoginDto) {
    throw new UnauthorizedException(
      "Legacy password authentication is deprecated and disabled. Authenticate via Auth0 Universal Login / BFF.",
    );
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  async refresh(refreshToken: string) {
    try {
      const secret =
        this.configService.get<string>("JWT_REFRESH_SECRET") ||
        "refresh-secret";
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret,
      });
      const userId = payload.sub;
      return this.refreshTokens(userId, refreshToken);
    } catch (e) {
      throw new UnauthorizedException("Invalid or Expired Refresh Token");
    }
  }

  async refreshTokens(userId: string, rt: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.refreshTokenHash)
      throw new ForbiddenException("Access Denied");

    const rtMatches = await bcrypt.compare(rt, user.refreshTokenHash);
    if (!rtMatches) throw new ForbiddenException("Access Denied");

    const tokens = await this.getTokens(
      user.id,
      user.email,
      user.role,
      user.organizationId,
    );
    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

    return tokens;
  }

  async updateRefreshTokenHash(userId: string, refreshToken: string) {
    let hash = null;
    if (refreshToken) {
      hash = await bcrypt.hash(refreshToken, 10);
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash: hash,
      },
    });
  }

  async getTokens(
    userId: string,
    email: string,
    role: string,
    organizationId: string,
  ) {
    const payload = {
      sub: userId,
      email,
      role,
      organizationId,
    };

    const atSecret = this.configService.get<string>("JWT_SECRET") || "secret";
    const rtSecret =
      this.configService.get<string>("JWT_REFRESH_SECRET") || "refresh-secret";

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: atSecret,
        expiresIn: "15m",
      }),
      this.jwtService.signAsync(payload, {
        secret: rtSecret,
        expiresIn: "7d",
      }),
    ]);

    return {
      access_token: at,
      refresh_token: rt,
    };
  }
}
