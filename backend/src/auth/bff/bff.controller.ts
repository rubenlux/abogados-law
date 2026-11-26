/**
 * Controlador BFF (Backend for Frontend) para Autenticación OIDC y Sesiones.
 * Especificación: SPEC-AUTH-001 (AUTH-001, AUTH-007, TST-AUTH-031, TST-AUTH-032, TST-AUTH-036)
 * Expediente: AUTH0-IMPLEMENTATION-005 (Cierre de Hallazgos D-01, D-02 y D-03)
 *
 * Endpoints:
 * - GET  /api/auth/login    -> Inicia flujo PKCE, emite cookie auth0_correlation y redirige a Auth0.
 * - GET  /api/auth/callback -> Valida criptográficamente el ID Token (RS256 contra JWKS),
 *                              valida claims explícitos (iss, aud, azp, exp, nonce, sub),
 *                              resuelve UserIdentity, crea UserSession y emite app_session.
 * - POST /api/auth/logout   -> Revoca sesión en BD y destruye cookies.
 * - GET  /api/auth/session  -> Retorna información del usuario y sesión actual.
 */

import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import {
  MembershipStatus,
  OrganizationRole,
  OrganizationStatus,
} from "@prisma/client";
import { OidcClientService } from "./oidc-client.service";
import { BffSessionService } from "./bff-session.service";
import { CsrfService } from "./csrf.service";
import { JwksKeystoreService } from "../services/jwks-keystore.service";
import { PrismaService } from "../../prisma.service";
import { BffSessionGuard } from "../guards/bff-session.guard";

const DEFAULT_LOCAL_DEMO_ISSUER = "https://local-demo.abogados.internal/";
const DEFAULT_LOCAL_DEMO_SUBJECT = "local-demo|socio-principal";

@Controller("api/auth")
export class BffController {
  constructor(
    private oidcClientService: OidcClientService,
    private bffSessionService: BffSessionService,
    private csrfService: CsrfService,
    private jwksKeystoreService: JwksKeystoreService,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Inicia el flujo OIDC Authorization Code con PKCE (S256).
   */
  @Get("login")
  async login(@Res() res: Response) {
    const tx = await this.oidcClientService.createTransaction();
    const authorizeUrl = this.oidcClientService.buildAuthorizeUrl(tx);

    const isProduction =
      this.configService.get<string>("NODE_ENV") === "production";

    // Cookie de correlación temporal y opaca (el verifier nunca se envía al cliente)
    res.cookie("auth0_correlation", tx.transactionId, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60 * 1000, // 10 minutos
    });

    return res.redirect(HttpStatus.FOUND, authorizeUrl);
  }

  /**
   * Callback OIDC invocado por Auth0 tras autenticación exitosa.
   */
  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      throw new BadRequestException(
        "Invalid callback parameters: code and state required",
      );
    }

    const correlationId = this.extractCookie(req, "auth0_correlation");
    if (!correlationId) {
      throw new BadRequestException(
        "Invalid state or missing correlation cookie",
      );
    }

    // 1. Validar y consumir la transacción en PostgreSQL (un solo uso, anti-replay, valida state)
    const tx = await this.oidcClientService.consumeTransaction(
      correlationId,
      state,
    );

    // 2. Canjear authorization code ante Auth0 por backend
    const tokens = await this.oidcClientService.exchangeCodeForTokens(
      code,
      tx.codeVerifier,
    );

    // 3. Verificación criptográfica (RS256 contra JWKS) y validación semántica de claims
    const payload = await this.decodeAndValidateIdToken(
      tokens.idToken,
      tx.nonce,
    );

    const issuer = payload.iss;
    const subject = payload.sub;

    // 4. Resolver identidad unívoca mediante UserIdentity
    // Esto se ejecuta ÚNICAMENTE después de que todas las validaciones criptográficas y de claims tuvieron éxito
    const identity = await this.prisma.userIdentity.findUnique({
      where: {
        issuer_subject: {
          issuer,
          subject,
        },
      },
      include: { user: true },
    });

    if (!identity || !identity.user) {
      throw new UnauthorizedException("Identity not registered in system");
    }

    // 5. Crear sesión BFF persistente (almacena únicamente el hash SHA-256)
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const deviceInfo = req.headers["user-agent"] || null;

    const { rawSessionSecret } = await this.bffSessionService.createSession(
      identity.userId,
      {
        deviceInfo,
        ipAddress,
      },
    );

    const isProduction =
      this.configService.get<string>("NODE_ENV") === "production";

    // 6. Destruir cookie de correlación
    res.cookie("auth0_correlation", "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    // 7 y 8. Emitir cookie de sesión opaca (app_session) y token Anti-CSRF firmado (csrf_token)
    this.issueBffCookies(res, rawSessionSecret);

    // Si la petición espera JSON (ej: testing con Supertest) responde 200, sino redirige a la app
    const acceptHeader = req.headers["accept"] || "";
    if (acceptHeader.includes("application/json")) {
      return res.status(HttpStatus.OK).json({
        status: "ok",
        user: {
          id: identity.user.id,
          email: identity.user.email,
          fullName: identity.user.fullName,
          role: identity.user.role,
        },
      });
    }

    const appOrigin =
      this.configService.get<string>("APP_ORIGIN") || "http://localhost:3000";
    return res.redirect(HttpStatus.FOUND, appOrigin);
  }

  /**
   * Cierre de sesión y revocación inmediata.
   */
  @Post("logout")
  async logout(@Req() req: any, @Res() res: Response) {
    const rawSessionSecret = this.extractCookie(req, "app_session");
    if (rawSessionSecret) {
      await this.bffSessionService.revokeSession(rawSessionSecret);
    }

    const isProduction =
      this.configService.get<string>("NODE_ENV") === "production";

    res.cookie("app_session", "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    res.cookie("csrf_token", "", {
      httpOnly: false,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    return res.status(HttpStatus.OK).json({ status: "logged_out" });
  }

  /**
   * Login Demo Local de Desarrollo integrado al BFF (AUTH-LOCAL-DEMO-SESSION-FIX-001).
   *
   * REGLAS DE SEGURIDAD:
   * - Exclusivamente habilitado cuando NODE_ENV === "development" Y LOCAL_DEMO_AUTH_ENABLED === "true".
   * - Rechaza con 404 en producción, test o cuando la bandera no está habilitada explícitamente.
   * - No acepta parámetros ni headers del cliente (impide elevación de privilegios o cambio de tenant).
   * - Reutiliza BffSessionService y CsrfService existentes para emitir app_session (HttpOnly) y csrf_token.
   * - No usa User.role ni User.organizationId legacy como autoridad.
   */
  @Post("local-demo-login")
  async localDemoLogin(@Req() req: any, @Res() res: Response) {
    const nodeEnv = this.configService.get<string>("NODE_ENV")?.trim();
    const demoEnabled = this.configService
      .get<string>("LOCAL_DEMO_AUTH_ENABLED")
      ?.trim();

    if (nodeEnv !== "development" || demoEnabled !== "true") {
      throw new NotFoundException("Cannot POST /api/auth/local-demo-login");
    }

    // Validar Origin si está presente (evitar activación cross-site)
    const originHeader = req.headers?.["origin"];
    if (originHeader && !this.csrfService.validateOrigin(originHeader)) {
      throw new ForbiddenException("CSRF origin mismatch");
    }

    // Bloquear cualquier intento del cliente de pasar parámetros o headers de privilegio/tenant
    if (
      req.body &&
      typeof req.body === "object" &&
      Object.keys(req.body).length > 0
    ) {
      throw new BadRequestException(
        "Local demo login does not accept client-supplied parameters",
      );
    }

    const forbiddenHeaders = [
      "x-org-id",
      "x-organization-id",
      "x-role",
      "x-org-role",
      "x-user-id",
    ];
    for (const h of forbiddenHeaders) {
      if (
        req.headers?.[h] !== undefined &&
        String(req.headers[h]).trim() !== ""
      ) {
        throw new BadRequestException(
          "Local demo login does not accept override headers",
        );
      }
    }

    const issuer =
      this.configService.get<string>("LOCAL_DEMO_IDENTITY_ISSUER")?.trim() ||
      DEFAULT_LOCAL_DEMO_ISSUER;
    const subject =
      this.configService.get<string>("LOCAL_DEMO_IDENTITY_SUBJECT")?.trim() ||
      DEFAULT_LOCAL_DEMO_SUBJECT;

    const identity = await this.prisma.userIdentity.findUnique({
      where: {
        issuer_subject: {
          issuer,
          subject,
        },
      },
      include: { user: true },
    });

    if (!identity || !identity.user) {
      throw new ForbiddenException({
        code: "LOCAL_DEMO_NOT_PROVISIONED",
        message: "Local demo user is not provisioned in development database",
      });
    }

    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId: identity.userId,
        status: MembershipStatus.ACTIVE,
        organization: {
          status: OrganizationStatus.ACTIVE,
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (!membership || !membership.organization) {
      throw new ForbiddenException({
        code: "MEMBERSHIP_INACTIVE",
        message: "Demo user has no active organization membership",
      });
    }

    if (membership.role === OrganizationRole.ORG_OWNER) {
      throw new ForbiddenException({
        code: "DEMO_ROLE_EXCESSIVE",
        message: "Local demo account cannot hold ORG_OWNER privileges",
      });
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const deviceInfo = req.headers?.["user-agent"] || null;

    const { rawSessionSecret, session } =
      await this.bffSessionService.createSession(identity.userId, {
        deviceInfo,
        ipAddress,
        activeOrganizationId: membership.organizationId,
      });

    this.issueBffCookies(res, rawSessionSecret);

    return res.status(HttpStatus.OK).json({
      status: "authenticated",
      user: {
        id: identity.user.id,
        email: identity.user.email,
        fullName: identity.user.fullName,
        orgRole: membership.role,
      },
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        status: membership.organization.status,
      },
      activeOrganizationId: session.activeOrganizationId,
      expiresAt: session.expiresAt,
    });
  }

  /**
   * Consulta del estado de sesión actual.
   */
  @Get("session")
  @UseGuards(BffSessionGuard)
  async getSession(@Req() req: any) {
    let orgRole: OrganizationRole | null = null;
    let organization: {
      id: string;
      name: string;
      status: OrganizationStatus;
    } | null = null;

    const activeOrgId = req.session?.activeOrganizationId ?? null;
    if (activeOrgId && this.prisma.organizationMembership?.findUnique) {
      const membership = await this.prisma.organizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: req.user.id,
            organizationId: activeOrgId,
          },
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });
      if (
        membership &&
        membership.status === MembershipStatus.ACTIVE &&
        membership.organization &&
        membership.organization.status === OrganizationStatus.ACTIVE
      ) {
        orgRole = membership.role;
        organization = membership.organization;
      }
    }

    return {
      status: "authenticated",
      user: {
        id: req.user.id,
        email: req.user.email,
        fullName: req.user.fullName,
        role: req.user.role,
        orgRole,
        organizationId: req.user.organizationId,
      },
      organization,
      activeOrganizationId: activeOrgId,
      expiresAt: req.session.expiresAt,
    };
  }

  private issueBffCookies(res: Response, rawSessionSecret: string): void {
    const isProduction =
      this.configService.get<string>("NODE_ENV") === "production";

    res.cookie("app_session", rawSessionSecret, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60 * 1000, // 8 horas
    });

    const csrfToken = this.csrfService.generateToken(rawSessionSecret);
    res.cookie("csrf_token", csrfToken, {
      httpOnly: false, // Accesible por JS para enviar en cabecera X-CSRF-Token
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60 * 1000,
    });
  }

  /**
   * D-01 & D-02: Verificación criptográfica del ID Token (RS256 contra JWKS)
   * y validación semántica exhaustiva de claims.
   */
  private async decodeAndValidateIdToken(
    idToken: string,
    expectedNonce: string,
  ): Promise<any> {
    if (!idToken || typeof idToken !== "string") {
      throw new UnauthorizedException("Malformed ID token");
    }

    const parts = idToken.split(".");
    if (parts.length !== 3) {
      throw new UnauthorizedException("Malformed ID token");
    }

    let header: any;
    try {
      header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    } catch {
      throw new UnauthorizedException("Malformed ID token header");
    }

    // 1. Algoritmo estricto RS256
    if (!header.alg || header.alg !== "RS256") {
      throw new UnauthorizedException(
        `Unsupported ID token algorithm '${header.alg}'. Only RS256 is accepted.`,
      );
    }

    // 2. Identificador de clave kid obligatorio
    const kid = header.kid;
    if (!kid || typeof kid !== "string" || kid.trim().length === 0) {
      throw new UnauthorizedException("JWT header missing mandatory kid claim");
    }

    // 3. Obtener clave pública desde JwksKeystoreService (Fail-Closed)
    const publicKeyPem = await new Promise<string>((resolve, reject) => {
      this.jwksKeystoreService.getPublicKey(null, idToken, (err, key) => {
        if (err) return reject(err);
        if (!key) {
          return reject(
            new ServiceUnavailableException(
              `Signing key '${kid}' not found in IdP JWKS endpoint`,
            ),
          );
        }
        resolve(key);
      });
    });

    // 4. Verificación Criptográfica de la Firma RS256 (D-01)
    try {
      const verifier = crypto.createVerify("RSA-SHA256");
      verifier.update(`${parts[0]}.${parts[1]}`);
      const signatureBuf = Buffer.from(parts[2], "base64url");
      const isValid = verifier.verify(publicKeyPem, signatureBuf);
      if (!isValid) {
        throw new UnauthorizedException("Invalid ID token signature");
      }
    } catch (err) {
      if (
        err instanceof UnauthorizedException ||
        err instanceof ServiceUnavailableException
      ) {
        throw err;
      }
      throw new UnauthorizedException("Invalid ID token signature");
    }

    // 5. Decodificar Payload
    let payload: any;
    try {
      payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    } catch {
      throw new UnauthorizedException("Malformed ID token payload");
    }

    // ------------------------------------------------------------------------
    // D-02: Validación semántica explícita de Claims (Fail-Closed ante config faltante)
    // ------------------------------------------------------------------------

    const expectedIssuer = this.configService
      .get<string>("AUTH0_ISSUER_URL")
      ?.trim();
    const clientId = this.configService.get<string>("AUTH0_CLIENT_ID")?.trim();
    if (!expectedIssuer || !clientId) {
      throw new ServiceUnavailableException(
        "OIDC issuer or client ID configuration missing (fail-closed)",
      );
    }

    // A. Emisor (iss)
    if (!payload.iss || payload.iss !== expectedIssuer) {
      throw new UnauthorizedException("Invalid ID token issuer");
    }

    // B. Audiencia (aud)
    if (!payload.aud) {
      throw new UnauthorizedException("Invalid ID token audience");
    }
    let audMatches = false;
    if (typeof payload.aud === "string") {
      audMatches = payload.aud === clientId;
    } else if (Array.isArray(payload.aud)) {
      audMatches = payload.aud.includes(clientId);
    }
    if (!audMatches) {
      throw new UnauthorizedException("Invalid ID token audience");
    }

    // C. Múltiples audiencias y azp (Authorized Party)
    if (Array.isArray(payload.aud) && payload.aud.length > 1) {
      if (!payload.azp || payload.azp !== clientId) {
        throw new UnauthorizedException(
          "Invalid or missing azp claim in ID token with multiple audiences",
        );
      }
    }

    // D. Expiración (exp)
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || typeof payload.exp !== "number" || payload.exp <= now) {
      throw new UnauthorizedException("ID token expired");
    }

    // E. Nonce
    if (!payload.nonce || payload.nonce !== expectedNonce) {
      throw new UnauthorizedException("Nonce mismatch in ID token");
    }

    // F. Subject (sub)
    if (
      !payload.sub ||
      typeof payload.sub !== "string" ||
      payload.sub.trim().length === 0
    ) {
      throw new UnauthorizedException("Missing or empty subject in ID token");
    }

    return payload;
  }

  private extractCookie(req: any, cookieName: string): string | null {
    if (req.cookies && req.cookies[cookieName]) {
      return req.cookies[cookieName];
    }
    const cookieHeader = req.headers["cookie"];
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(";");
    for (const c of cookies) {
      const [name, val] = c.trim().split("=");
      if (name === cookieName) {
        return decodeURIComponent(val);
      }
    }
    return null;
  }
}
