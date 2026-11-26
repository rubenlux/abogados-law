/**
 * Servicio Keystore y Cliente JWKS para Verificación de Tokens Auth0 RS256.
 * Especificación: SPEC-AUTH-001 (AUTH-002, TST-AUTH-001 a TST-AUTH-008, TST-AUTH-018, TST-AUTH-043)
 *
 * Funcionalidades:
 * - Caché local de claves de firma con TTL de 24 horas.
 * - Rechazo estricto de cualquier algoritmo distinto de RS256.
 * - Rotación dinámica de claves (nuevos kid).
 * - Fail-Closed (503 Service Unavailable) ante IdP caído o clave no encontrada.
 * - Modo test: permite inyección de claves locales en memoria sin llamadas a red.
 */

import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import nodeFetch from "node-fetch";

interface CachedKey {
  pem: string;
  cachedAt: number;
}

@Injectable()
export class JwksKeystoreService {
  private readonly logger = new Logger(JwksKeystoreService.name);
  private readonly keyCache = new Map<string, CachedKey>();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

  constructor(private configService: ConfigService) {}

  /**
   * Registra manualmente una clave pública PEM para un kid (usado en tests e inicialización).
   */
  registerSigningKey(kid: string, publicKeyPem: string): void {
    this.keyCache.set(kid, {
      pem: publicKeyPem,
      cachedAt: Date.now(),
    });
  }

  /**
   * Proveedor de clave asimétrica para passport-jwt secretOrKeyProvider.
   */
  getPublicKey(
    req: any,
    rawJwtToken: any,
    done: (err: any, key?: string) => void,
  ): void {
    try {
      if (!rawJwtToken || typeof rawJwtToken !== "string") {
        return done(new UnauthorizedException("Token format invalid"));
      }

      const parts = rawJwtToken.split(".");
      if (parts.length < 2) {
        return done(new UnauthorizedException("Token malformed"));
      }

      // Decodificar cabecera JWT sin verificar firma aún
      const headerJson = Buffer.from(parts[0], "base64url").toString("utf8");
      const header = JSON.parse(headerJson);

      // Regla de oro: Rechazo inmediato de algoritmos no RS256
      if (!header.alg || header.alg !== "RS256") {
        return done(
          new UnauthorizedException(
            `Unsupported JWT algorithm '${header.alg}'. Only RS256 is accepted.`,
          ),
        );
      }

      const kid = header.kid;
      if (!kid) {
        return done(
          new UnauthorizedException("JWT header missing mandatory kid claim"),
        );
      }

      // 1. Verificar caché en memoria
      const cached = this.keyCache.get(kid);
      if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
        return done(null, cached.pem);
      }

      // 2. Si no está en caché o expiró, intentar refresco (en tests si no está registrado, fail-closed)
      this.refreshKeyFromIdp(kid)
        .then((pem) => {
          if (pem) {
            this.keyCache.set(kid, { pem, cachedAt: Date.now() });
            done(null, pem);
          } else {
            done(
              new ServiceUnavailableException(
                `Signing key '${kid}' not found in IdP JWKS endpoint`,
              ),
            );
          }
        })
        .catch((err) => {
          this.logger.error(
            `Failed to retrieve signing key for kid ${kid}: ${err.message}`,
          );
          done(
            new ServiceUnavailableException(
              "JWKS service unavailable or key resolution failed",
            ),
          );
        });
    } catch (err: any) {
      return done(new UnauthorizedException("Invalid JWT header format"));
    }
  }

  private async refreshKeyFromIdp(kid: string): Promise<string | null> {
    const issuerUrl = this.configService.get<string>("AUTH0_ISSUER_URL");
    if (!issuerUrl) {
      return null;
    }

    try {
      const jwksUrl = new URL(".well-known/jwks.json", issuerUrl).toString();
      // En entorno de prueba sin servidor HTTP activo o con mock de fallo
      const response = await (nodeFetch as any)(jwksUrl, { timeout: 3000 });
      if (!response.ok) {
        throw new Error(`IdP returned HTTP ${response.status}`);
      }

      const body = await response.json();
      if (!body.keys || !Array.isArray(body.keys)) {
        throw new Error("JWKS response missing keys array");
      }

      for (const key of body.keys) {
        if (key.kid && key.kty === "RSA") {
          const pem = crypto
            .createPublicKey({ key, format: "jwk" })
            .export({ type: "spki", format: "pem" }) as string;
          this.keyCache.set(key.kid, { pem, cachedAt: Date.now() });
        }
      }

      const matched = this.keyCache.get(kid);
      return matched ? matched.pem : null;
    } catch (err) {
      return null;
    }
  }
}
