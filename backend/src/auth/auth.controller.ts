import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RefreshDto } from "./dto/refresh.dto";
import { ApiTags } from "@nestjs/swagger";
import { Auth0JwtGuard } from "./guards/auth0-jwt.guard";
import { SecurityContextGuard } from "./guards/security-context.guard";
import { PlatformBlockedGuard } from "../authz/guards/platform-blocked.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  // NOTA NORMATIVA (SPEC-AUTH-001 / TST-AUTH-020):
  // El endpoint legacy 'POST /auth/login' con contraseñas locales en texto plano
  // o bcrypt ha sido ERRADICADO DEFINITIVAMENTE. La autenticación se delega
  // exclusivamente a Auth0 Universal Login / Passwordless a través del BFF.
  // Toda petición a /auth/login retorna 404 Not Found de forma intencional.

  // DEC-04-05 (SPEC-AUTH-004): POST /auth/refresh legacy HS256 deprecado y contenido Fail-Closed.
  @UseGuards(PlatformBlockedGuard)
  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  refresh(@Body() refreshDto: RefreshDto) {
    return this.authService.refresh(refreshDto.refresh_token);
  }

  @UseGuards(Auth0JwtGuard, SecurityContextGuard)
  @HttpCode(HttpStatus.OK)
  @Post("logout")
  logout(@Request() req) {
    return this.authService.logout(req.securityContext.userId);
  }
}
