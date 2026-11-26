/**
 * Servicio de Protección Anti-CSRF para BFF.
 * Especificación: SPEC-AUTH-001 (AUTH-007, TST-AUTH-033, TST-AUTH-052)
 *
 * Características:
 * - Doble submit cookie con firma HMAC-SHA256 vinculada a la sesión del usuario.
 * - Validación en tiempo constante (crypto.timingSafeEqual).
 * - Validación canónica exacta del encabezado Origin contra allowlist estricta (sin startsWith ni sufijos).
 */

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";

@Injectable()
export class CsrfService {
  private readonly secret: string;
  private readonly allowedOrigins: Set<string>;

  constructor(private configService: ConfigService) {
    this.secret =
      this.configService.get<string>("CSRF_SECRET") ||
      "default-csrf-secret-minimum-32-characters-test!";

    const configuredAppOrigin =
      this.configService.get<string>("APP_ORIGIN") || "http://localhost:3000";

    this.allowedOrigins = new Set<string>();
    this.addCanonicalOrigin(configuredAppOrigin);

    // Permitir orígenes configurados adicionales en lista separada por comas
    const extraOrigins = this.configService.get<string>("CORS_ALLOWED_ORIGINS");
    if (extraOrigins) {
      extraOrigins.split(",").forEach((o) => this.addCanonicalOrigin(o.trim()));
    }
  }

  private addCanonicalOrigin(urlStr: string): void {
    try {
      const parsed = new URL(urlStr);
      this.allowedOrigins.add(parsed.origin.toLowerCase());
    } catch {
      // Ignorar URLs malformadas en configuración
    }
  }

  /**
   * Genera un token CSRF firmado con HMAC vinculado al secreto de sesión.
   * Formato: <nonce_hex>.<signature_hex>
   */
  generateToken(rawSessionSecret: string): string {
    const nonce = crypto.randomBytes(16).toString("hex");
    const signature = this.computeSignature(nonce, rawSessionSecret);
    return `${nonce}.${signature}`;
  }

  /**
   * Valida la firma del token CSRF recibido contra el secreto de sesión en tiempo constante.
   */
  verifyToken(token: string, rawSessionSecret: string): boolean {
    if (!token || typeof token !== "string") return false;

    const parts = token.split(".");
    if (parts.length !== 2) return false;

    const [nonce, providedSignature] = parts;

    // Validación estricta de formato hexadecimal para evitar decodificación laxa de Buffer.from
    if (
      !/^[0-9a-f]{32}$/i.test(nonce) ||
      !/^[0-9a-f]{64}$/i.test(providedSignature)
    ) {
      return false;
    }

    const expectedSignature = this.computeSignature(nonce, rawSessionSecret);

    const providedBuf = Buffer.from(providedSignature, "hex");
    const expectedBuf = Buffer.from(expectedSignature, "hex");

    if (providedBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  }

  /**
   * Valida el encabezado Origin mediante comparación canónica exacta.
   * Prohibido terminantemente el uso de startsWith o expresiones regulares laxas.
   */
  validateOrigin(originHeader: string | undefined): boolean {
    if (!originHeader || typeof originHeader !== "string") {
      return false;
    }

    try {
      const parsed = new URL(originHeader);
      const canonicalOrigin = parsed.origin.toLowerCase();
      return this.allowedOrigins.has(canonicalOrigin);
    } catch {
      return false;
    }
  }

  private computeSignature(nonce: string, rawSessionSecret: string): string {
    const payload = `${nonce}:${rawSessionSecret}`;
    return crypto
      .createHmac("sha256", this.secret)
      .update(payload)
      .digest("hex");
  }
}
