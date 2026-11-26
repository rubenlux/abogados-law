/**
 * Servicio de Cliente OIDC para Authorization Code Flow + PKCE (S256).
 * Especificación: SPEC-AUTH-001 (AUTH-001, AUTH-007, TST-AUTH-036, TST-AUTH-054)
 * Expedientes: AUTH0-IMPLEMENTATION-005 / AUTH0-AUTH02-FINAL-VERIFICATION-006
 *
 * Características:
 * - Generación de code_verifier (CSPRNG) y code_challenge (SHA-256 base64url).
 * - Generación de state y nonce criptográficos.
 * - Persistencia compartida en PostgreSQL (modelo OidcTransaction) con TTL de 10 minutos.
 * - Clave independiente AES-256-GCM (`OIDC_TRANSACTION_ENCRYPTION_KEY`: exactamente 64 hex chars = 32 bytes CSPRNG),
 *   validada Fail-Closed al iniciar el servicio, sin reutilización de JWT_SECRET/CSRF_SECRET ni valores por defecto.
 * - Protección del code_verifier en reposo mediante cifrado autenticado AES-256-GCM versionado (v1),
 *   IV aleatorio de 12 bytes y Auth Tag de 16 bytes.
 * - Consumo atómico de un solo uso mediante sentencia única `DELETE ... RETURNING` parametrizada en PostgreSQL
 *   (inmune a race conditions, replay attacks y errores P2025/500 bajo concurrencia).
 * - Cookie de correlación contiene únicamente un transactionId opaco (el verifier nunca se envía al navegador).
 * - Canje seguro de authorization code ante Auth0 (/oauth/token) exclusivamente desde backend.
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import nodeFetch from "node-fetch";
import { PrismaService } from "../../prisma.service";

export interface OidcTransaction {
  transactionId: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
  expiresAt: number;
}

export interface TokenExchangeResult {
  idToken: string;
  accessToken: string;
  expiresIn: number;
}

interface OidcTransactionRow {
  transactionId: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  expiresAt: Date;
  createdAt: Date;
}

const CIPHERTEXT_VERSION = "v1";
const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/;
const HEX_24_REGEX = /^[0-9a-fA-F]{24}$/;
const HEX_32_REGEX = /^[0-9a-fA-F]{32}$/;
const HEX_EVEN_REGEX = /^(?:[0-9a-fA-F]{2})+$/;

@Injectable()
export class OidcClientService {
  private readonly logger = new Logger(OidcClientService.name);
  private readonly TX_TTL_MS = 10 * 60 * 1000; // 10 minutos
  private readonly encryptionKey: Buffer;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.encryptionKey = this.loadAndValidateEncryptionKey();
  }

  /**
   * Valida al inicio del servicio (Fail-Closed) la clave independiente de cifrado
   * OIDC_TRANSACTION_ENCRYPTION_KEY: debe ser una cadena hexadecimal de exactamente 64 caracteres (32 bytes).
   * Nunca reutiliza JWT_SECRET ni CSRF_SECRET ni utiliza valores predeterminados.
   */
  private loadAndValidateEncryptionKey(): Buffer {
    const rawKey = this.configService.get<string>(
      "OIDC_TRANSACTION_ENCRYPTION_KEY",
    );

    if (!rawKey || typeof rawKey !== "string" || !HEX_64_REGEX.test(rawKey)) {
      throw new Error(
        "FATAL: OIDC_TRANSACTION_ENCRYPTION_KEY is missing or invalid. " +
          "Expected exactly 64 hexadecimal characters (32 bytes CSPRNG).",
      );
    }

    const keyBuffer = Buffer.from(rawKey, "hex");
    if (keyBuffer.length !== 32) {
      throw new Error(
        "FATAL: OIDC_TRANSACTION_ENCRYPTION_KEY must decode to exactly 32 bytes.",
      );
    }

    return keyBuffer;
  }

  /**
   * Cifra el code_verifier en reposo usando AES-256-GCM con IV aleatorio de 12 bytes y Auth Tag de 16 bytes.
   * Formato versionado: v1:<iv_24hex>:<tag_32hex>:<ciphertext_hex>
   */
  private encryptCodeVerifier(verifier: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      this.encryptionKey,
      iv,
      { authTagLength: 16 },
    );
    const ciphertext = Buffer.concat([
      cipher.update(verifier, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${CIPHERTEXT_VERSION}:${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
  }

  /**
   * Descifra y verifica la autenticidad del code_verifier desde su representación AES-256-GCM.
   * Ante cualquier alteración de ciphertext, auth tag, versión desconocida o clave incorrecta,
   * falla de forma segura sin exponer secretos ni provocar HTTP 500.
   */
  private decryptCodeVerifier(encrypted: string): string {
    if (!encrypted || typeof encrypted !== "string") {
      this.logger.warn("OIDC transaction payload decryption rejected");
      throw new BadRequestException("Invalid or corrupted OIDC transaction");
    }

    const parts = encrypted.split(":");
    if (
      parts.length !== 4 ||
      parts[0] !== CIPHERTEXT_VERSION ||
      !HEX_24_REGEX.test(parts[1]) ||
      !HEX_32_REGEX.test(parts[2]) ||
      !HEX_EVEN_REGEX.test(parts[3])
    ) {
      this.logger.warn(
        "OIDC transaction payload format or version rejected during decryption",
      );
      throw new BadRequestException("Invalid or corrupted OIDC transaction");
    }

    try {
      const iv = Buffer.from(parts[1], "hex");
      const tag = Buffer.from(parts[2], "hex");
      const ciphertext = Buffer.from(parts[3], "hex");

      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        this.encryptionKey,
        iv,
        { authTagLength: 16 },
      );
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return decrypted.toString("utf8");
    } catch {
      this.logger.warn(
        "OIDC transaction payload authentication failed during decryption",
      );
      throw new BadRequestException("Invalid or corrupted OIDC transaction");
    }
  }

  /**
   * Crea una nueva transacción PKCE OIDC y la persiste cifrada en PostgreSQL.
   */
  async createTransaction(): Promise<OidcTransaction> {
    // 1. Generar code_verifier (32 bytes CSPRNG -> 43 caracteres base64url)
    const verifierBuffer = crypto.randomBytes(32);
    const codeVerifier = this.base64UrlEncode(verifierBuffer);

    // 2. Calcular code_challenge S256: BASE64URL(SHA256(code_verifier))
    const hash = crypto.createHash("sha256").update(codeVerifier).digest();
    const codeChallenge = this.base64UrlEncode(hash);

    // 3. Generar state y nonce criptográficos
    const state = this.base64UrlEncode(crypto.randomBytes(24));
    const nonce = this.base64UrlEncode(crypto.randomBytes(24));

    // 4. Identificador de transacción opaco para la cookie de correlación
    const transactionId = this.base64UrlEncode(crypto.randomBytes(24));
    const expiresAt = new Date(Date.now() + this.TX_TTL_MS);

    // 5. Cifrar code_verifier con AES-256-GCM antes de persistir
    const encryptedVerifier = this.encryptCodeVerifier(codeVerifier);

    await this.prisma.oidcTransaction.create({
      data: {
        transactionId,
        state,
        nonce,
        codeVerifier: encryptedVerifier,
        expiresAt,
      },
    });

    return {
      transactionId,
      state,
      nonce,
      codeVerifier,
      codeChallenge,
      expiresAt: expiresAt.getTime(),
    };
  }

  /**
   * Construye la URL de redirección hacia Auth0 Universal Login.
   */
  buildAuthorizeUrl(transaction: OidcTransaction): string {
    const issuerUrl = this.configService.get<string>("AUTH0_ISSUER_URL");
    const clientId = this.configService.get<string>("AUTH0_CLIENT_ID");
    const audience = this.configService.get<string>("AUTH0_AUDIENCE");
    const appOrigin =
      this.configService.get<string>("APP_ORIGIN") || "http://localhost:3000";

    if (!issuerUrl || !clientId) {
      throw new Error("AUTH0_ISSUER_URL or AUTH0_CLIENT_ID not configured");
    }

    const redirectUri = new URL("/api/auth/callback", appOrigin).toString();
    const authorizeUrl = new URL("/authorize", issuerUrl);

    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("scope", "openid profile email");
    authorizeUrl.searchParams.set("state", transaction.state);
    authorizeUrl.searchParams.set("code_challenge", transaction.codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("nonce", transaction.nonce);
    if (audience) {
      authorizeUrl.searchParams.set("audience", audience);
    }

    return authorizeUrl.toString();
  }

  /**
   * Consume la transacción OIDC de forma estrictamente atómica en PostgreSQL
   * mediante `DELETE ... RETURNING` parametrizado (un solo uso, inmune a concurrencia y replay).
   */
  async consumeTransaction(
    transactionId: string,
    state: string,
  ): Promise<OidcTransaction> {
    if (!transactionId) {
      throw new BadRequestException(
        "Invalid state or missing correlation cookie",
      );
    }

    const deletedRows = await this.prisma.$queryRaw<OidcTransactionRow[]>`
      DELETE FROM "OidcTransaction"
      WHERE "transactionId" = ${transactionId}
      RETURNING "transactionId", "state", "nonce", "codeVerifier", "expiresAt", "createdAt"
    `;

    const txRecord = deletedRows?.[0];
    if (!txRecord) {
      throw new BadRequestException(
        "Invalid state or missing correlation cookie",
      );
    }

    const expiresAtMs = new Date(txRecord.expiresAt).getTime();
    if (expiresAtMs < Date.now()) {
      throw new BadRequestException("Correlation transaction has expired");
    }

    // Validación estricta de state en tiempo constante
    const txStateBuf = Buffer.from(txRecord.state);
    const inStateBuf = Buffer.from(state || "");
    if (
      txStateBuf.length !== inStateBuf.length ||
      !crypto.timingSafeEqual(txStateBuf, inStateBuf)
    ) {
      throw new BadRequestException(
        "Invalid state or missing correlation cookie",
      );
    }

    // Descifrar codeVerifier verificando autenticidad AES-256-GCM
    const codeVerifier = this.decryptCodeVerifier(txRecord.codeVerifier);
    const hash = crypto.createHash("sha256").update(codeVerifier).digest();
    const codeChallenge = this.base64UrlEncode(hash);

    return {
      transactionId: txRecord.transactionId,
      state: txRecord.state,
      nonce: txRecord.nonce,
      codeVerifier,
      codeChallenge,
      expiresAt: expiresAtMs,
    };
  }

  /**
   * Canjea el Authorization Code por tokens ante Auth0 (/oauth/token).
   */
  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
  ): Promise<TokenExchangeResult> {
    const issuerUrl = this.configService.get<string>("AUTH0_ISSUER_URL");
    const clientId = this.configService.get<string>("AUTH0_CLIENT_ID");
    const clientSecret = this.configService.get<string>("AUTH0_CLIENT_SECRET");
    const appOrigin =
      this.configService.get<string>("APP_ORIGIN") || "http://localhost:3000";
    const redirectUri = new URL("/api/auth/callback", appOrigin).toString();

    const tokenUrl = new URL("/oauth/token", issuerUrl).toString();

    const bodyParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId || "",
      client_secret: clientSecret || "",
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    });

    try {
      const response = await (nodeFetch as any)(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: bodyParams.toString(),
        timeout: 5000,
      });

      if (!response.ok) {
        this.logger.error(`Token exchange failed with HTTP ${response.status}`);
        throw new UnauthorizedException(
          "Token exchange rejected by Identity Provider",
        );
      }

      const data = await response.json();
      if (!data.id_token) {
        throw new UnauthorizedException(
          "Identity Provider response missing id_token",
        );
      }

      return {
        idToken: data.id_token,
        accessToken: data.access_token || "",
        expiresIn: data.expires_in || 3600,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.error(`OIDC Token exchange error: ${(err as Error).message}`);
      throw new UnauthorizedException("Failed to exchange authorization code");
    }
  }

  private base64UrlEncode(buffer: Buffer): string {
    return buffer
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }
}
