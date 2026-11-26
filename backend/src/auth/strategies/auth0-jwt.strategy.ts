/**
 * Estrategia Passport JWT RS256 Conectada al Keystore JWKS de Auth0.
 * Especificación: SPEC-AUTH-001 (AUTH-002, TST-AUTH-001 a TST-AUTH-008)
 *
 * Características:
 * - Algoritmo RS256 estricto.
 * - Validación obligatoria de iss, aud, sub y exp.
 * - Obtención dinámica de clave pública mediante secretOrKeyProvider.
 */

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { JwksKeystoreService } from "../services/jwks-keystore.service";

@Injectable()
export class Auth0JwtStrategy extends PassportStrategy(Strategy, "auth0-jwt") {
  constructor(
    private configService: ConfigService,
    private jwksService: JwksKeystoreService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ["RS256"],
      issuer: configService.get<string>("AUTH0_ISSUER_URL"),
      audience: configService.get<string>("AUTH0_AUDIENCE"),
      secretOrKeyProvider: (req: any, rawJwtToken: any, done: any) => {
        jwksService.getPublicKey(req, rawJwtToken, done);
      },
    });
  }

  async validate(payload: any): Promise<any> {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException("Token missing mandatory sub claim");
    }
    return payload;
  }
}
