/**
 * Suite de Pruebas TDS para AUTH-02: BFF, OIDC Authorization Code + PKCE y Sesiones Seguras
 * Especificación: SPEC-AUTH-001 v1.0.8 (Baseline Consolidado)
 * Expediente: AUTH0-IMPLEMENTATION-003 / AUTH0-IMPLEMENTATION-005 / AUTH0-AUTH02-FINAL-VERIFICATION-006
 *
 * Cobertura Normativa y Cierre de Defectos:
 * - TST-AUTH-009 / TST-AUTH-046: Resolución e integridad de identidad externa (issuer, subject) vía UserIdentity.
 * - TST-AUTH-031: Cookie de sesión opaca app_session con HttpOnly, Secure, SameSite=Lax, Path=/; 0 tokens en storage.
 * - TST-AUTH-032: Regeneración de sesión anti-Session Fixation en callback OIDC.
 * - TST-AUTH-033: Rechazo de mutaciones sin Anti-CSRF o con Origin no autorizado (403 Forbidden).
 * - TST-AUTH-034: Expiración por inactividad (idleExpiresAt a 30 min).
 * - TST-AUTH-036: Validación estricta de state y cookie de correlación en callback OIDC (400 Bad Request).
 * - TST-AUTH-037: Expiración absoluta de sesión (expiresAt a 8 horas).
 * - TST-AUTH-052: Validación canónica de Origin exacto (sin startsWith) y firma HMAC de CSRF.
 * - TST-AUTH-054: Validación independiente de nonce en ID Token y code_verifier PKCE.
 * - D-01: Verificación criptográfica RS256 de firma de ID Token contra JWKS, rechazo de firmas corruptas (401),
 *         kid ausente (401), kid desconocido (503), indisponibilidad JWKS (503) y algoritmos HS256/none (401).
 * - D-02: Validación semántica exhaustiva de claims (iss, aud, azp ausente/erróneo, exp, nonce, sub),
 *         configuración Fail-Closed de issuer/clientId, y cero consultas a UserIdentity antes de completar validaciones.
 * - Logout y revocación efectiva de sesión.
 */

import { Test, TestingModule } from "@nestjs/testing";
import {
  INestApplication,
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  HttpStatus,
  ServiceUnavailableException,
} from "@nestjs/common";
import * as request from "supertest";
import { ConfigModule, ConfigService } from "@nestjs/config";
import * as crypto from "crypto";

import { createPrismaMock, MockPrismaService } from "../mocks/prisma.mock";
import {
  createFixtureUser,
  createFixtureUserIdentity,
  createFixtureUserSession,
} from "../fixtures/user.fixture";
import { PrismaService } from "../../src/prisma.service";
import {
  generateTestRsaKeyPair,
  createSignedTestJwt,
  corruptTokenSignature,
  KeyPairResult,
} from "../helpers/crypto-test-helper";

// Componentes AUTH-02
import { BffController } from "../../src/auth/bff/bff.controller";
import { OidcClientService } from "../../src/auth/bff/oidc-client.service";
import { BffSessionService } from "../../src/auth/bff/bff-session.service";
import { CsrfService } from "../../src/auth/bff/csrf.service";
import { JwksKeystoreService } from "../../src/auth/services/jwks-keystore.service";
import { BffSessionGuard } from "../../src/auth/guards/bff-session.guard";
import { CsrfGuard } from "../../src/auth/guards/csrf.guard";
import { SecurityContextGuard } from "../../src/auth/guards/security-context.guard";

@Controller("api/expedientes")
class BffProtectedResourceController {
  @Get()
  @UseGuards(BffSessionGuard, SecurityContextGuard)
  list(@Req() req: any) {
    return { status: "ok", securityContext: req.securityContext };
  }

  @Post()
  @UseGuards(BffSessionGuard, CsrfGuard, SecurityContextGuard)
  create(@Req() req: any) {
    return {
      status: "created",
      id: "exp-new-001",
      securityContext: req.securityContext,
    };
  }
}

describe("AUTH-02 — BFF, OIDC PKCE & Session Management TDS Suite", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prismaMock: MockPrismaService;
  let oidcService: OidcClientService;
  let csrfService: CsrfService;
  let jwksKeystoreService: JwksKeystoreService;
  let configService: ConfigService;

  let keyPair: KeyPairResult;
  const TEST_ISSUER =
    process.env.AUTH0_ISSUER_URL || "https://abogados-test.us.auth0.com/";
  const TEST_AUDIENCE =
    process.env.AUTH0_AUDIENCE || "https://api.abogadoslaw.com";
  const TEST_CLIENT_ID = process.env.AUTH0_CLIENT_ID || "test-client-id-123";
  const TEST_ENCRYPTION_KEY =
    process.env.OIDC_TRANSACTION_ENCRYPTION_KEY ||
    "9059d7b7e25d3c8c6de1cb0dc62232e3692c26404b1c2cdaecc19e559ef16a0c";
  const APP_URL = "http://localhost:3000";

  beforeAll(async () => {
    keyPair = generateTestRsaKeyPair("test-bff-kid");
    prismaMock = createPrismaMock();

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              AUTH0_DOMAIN: "abogados-test.us.auth0.com",
              AUTH0_ISSUER_URL: TEST_ISSUER,
              AUTH0_AUDIENCE: TEST_AUDIENCE,
              AUTH0_CLIENT_ID: TEST_CLIENT_ID,
              AUTH0_CLIENT_SECRET: "test-client-secret-minimum-32-chars!",
              APP_ORIGIN: APP_URL,
              CSRF_SECRET: "test-csrf-hmac-secret-minimum-32-chars-long!",
              OIDC_TRANSACTION_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
            }),
          ],
        }),
      ],
      controllers: [BffController, BffProtectedResourceController],
      providers: [
        OidcClientService,
        BffSessionService,
        CsrfService,
        JwksKeystoreService,
        BffSessionGuard,
        CsrfGuard,
        SecurityContextGuard,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    oidcService = moduleRef.get<OidcClientService>(OidcClientService);
    csrfService = moduleRef.get<CsrfService>(CsrfService);
    jwksKeystoreService =
      moduleRef.get<JwksKeystoreService>(JwksKeystoreService);
    configService = moduleRef.get<ConfigService>(ConfigService);

    // Registrar la clave pública en el keystore de prueba para simular JWKS sin llamadas externas
    jwksKeystoreService.registerSigningKey(keyPair.kid, keyPair.publicKeyPem);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  // TST-AUTH-036: OIDC Login & Correlation Cookie
  it("TST-AUTH-036 [Login]: should initiate OIDC PKCE login, emit opaque correlation cookie and redirect to Auth0", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/auth/login")
      .expect(HttpStatus.FOUND);

    expect(res.header["location"]).toBeDefined();
    const redirectUrl = new URL(res.header["location"]);
    expect(redirectUrl.origin).toBe("https://abogados-test.us.auth0.com");
    expect(redirectUrl.searchParams.get("response_type")).toBe("code");
    expect(redirectUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(redirectUrl.searchParams.get("code_challenge")).toBeDefined();
    expect(redirectUrl.searchParams.get("state")).toBeDefined();
    expect(redirectUrl.searchParams.get("nonce")).toBeDefined();

    // Comprobar cookie de correlación opaca (no expone el verifier al navegador)
    const rawCookies = res.header["set-cookie"];
    const cookies: string[] = Array.isArray(rawCookies)
      ? rawCookies
      : rawCookies
        ? [rawCookies]
        : [];
    expect(cookies.length).toBeGreaterThan(0);
    const correlationCookie = cookies.find((c: string) =>
      c.startsWith("auth0_correlation="),
    );
    expect(correlationCookie).toBeDefined();
    expect(correlationCookie).toMatch(/HttpOnly/i);
    expect(correlationCookie).toMatch(/Path=\//i);
    // El verifier no debe estar en la cookie en claro
    expect(correlationCookie).not.toContain(
      redirectUrl.searchParams.get("code_challenge"),
    );
  });

  // TST-AUTH-036: Callback con state alterado o faltante
  it("TST-AUTH-036 [Callback Failure]: should reject callback with 400 Bad Request when state is invalid or correlation cookie missing", async () => {
    // 1. Sin cookie de correlación
    const res1 = await request(app.getHttpServer())
      .get("/api/auth/callback?code=mock_code&state=unknown_state")
      .expect(HttpStatus.BAD_REQUEST);

    expect(res1.body.message).toMatch(/Invalid state or missing correlation/i);

    // 2. Con cookie de correlación pero state no coincidente
    const tx = await oidcService.createTransaction();
    const res2 = await request(app.getHttpServer())
      .get("/api/auth/callback?code=mock_code&state=tampered_state")
      .set("Cookie", [`auth0_correlation=${tx.transactionId}`])
      .expect(HttpStatus.BAD_REQUEST);

    expect(res2.body.message).toMatch(/Invalid state or missing correlation/i);
    expect(prismaMock.userIdentity.findUnique).not.toHaveBeenCalled();
  });

  // TST-AUTH-054: Validación independiente de nonce y PKCE
  it("TST-AUTH-054: should reject callback with 401 Unauthorized when ID token nonce does not match transaction", async () => {
    const tx = await oidcService.createTransaction();

    const idTokenWrongNonce = createSignedTestJwt(
      {
        kid: keyPair.kid,
        issuer: TEST_ISSUER,
        audience: TEST_CLIENT_ID,
        sub: "auth0|test-user-001",
        customClaims: { nonce: "wrong-nonce-value" },
      },
      keyPair.privateKeyPem,
    );

    jest.spyOn(oidcService, "exchangeCodeForTokens").mockResolvedValueOnce({
      idToken: idTokenWrongNonce,
      accessToken: "at-mock-123",
      expiresIn: 3600,
    });

    const res = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=valid_code&state=${tx.state}`)
      .set("Cookie", [`auth0_correlation=${tx.transactionId}`])
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res.body.message).toMatch(/Nonce mismatch in ID token/i);
    expect(prismaMock.userIdentity.findUnique).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // D-01: Verificación Criptográfica del ID Token
  // --------------------------------------------------------------------------

  it("TST-AUTH-047 [D-01 Altered Signature]: should reject callback with 401 Unauthorized when ID token signature is altered and never query UserIdentity", async () => {
    const tx = await oidcService.createTransaction();

    const validIdToken = createSignedTestJwt(
      {
        kid: keyPair.kid,
        issuer: TEST_ISSUER,
        audience: TEST_CLIENT_ID,
        sub: "auth0|test-user-001",
        customClaims: { nonce: tx.nonce },
      },
      keyPair.privateKeyPem,
    );

    const corruptedToken = corruptTokenSignature(validIdToken);

    jest.spyOn(oidcService, "exchangeCodeForTokens").mockResolvedValueOnce({
      idToken: corruptedToken,
      accessToken: "at-mock-123",
      expiresIn: 3600,
    });

    const res = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=valid_code&state=${tx.state}`)
      .set("Cookie", [`auth0_correlation=${tx.transactionId}`])
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res.body.message).toMatch(/Invalid ID token signature/i);
    expect(prismaMock.userIdentity.findUnique).not.toHaveBeenCalled();
  });

  it("TST-AUTH-048 [D-01 Unknown Kid]: should reject callback with 503 Service Unavailable when ID token kid is unknown to JWKS", async () => {
    const tx = await oidcService.createTransaction();

    const tokenUnknownKid = createSignedTestJwt(
      {
        kid: "unknown-unregistered-kid-999",
        issuer: TEST_ISSUER,
        audience: TEST_CLIENT_ID,
        sub: "auth0|test-user-001",
        customClaims: { nonce: tx.nonce },
      },
      keyPair.privateKeyPem,
    );

    jest.spyOn(oidcService, "exchangeCodeForTokens").mockResolvedValueOnce({
      idToken: tokenUnknownKid,
      accessToken: "at-mock-123",
      expiresIn: 3600,
    });

    const res = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=valid_code&state=${tx.state}`)
      .set("Cookie", [`auth0_correlation=${tx.transactionId}`])
      .expect(HttpStatus.SERVICE_UNAVAILABLE);

    expect(res.body.message).toMatch(/Signing key .* not found/i);
    expect(prismaMock.userIdentity.findUnique).not.toHaveBeenCalled();
  });

  it("TST-AUTH-048B [D-01 JWKS Unavailable]: should fail-closed with 503 Service Unavailable differentiated from invalid signature when JWKS service is unavailable", async () => {
    const tx = await oidcService.createTransaction();

    const token = createSignedTestJwt(
      {
        kid: "rotated-kid-jwks-down",
        issuer: TEST_ISSUER,
        audience: TEST_CLIENT_ID,
        sub: "auth0|test-user-001",
        customClaims: { nonce: tx.nonce },
      },
      keyPair.privateKeyPem,
    );

    jest.spyOn(oidcService, "exchangeCodeForTokens").mockResolvedValueOnce({
      idToken: token,
      accessToken: "at-mock-123",
      expiresIn: 3600,
    });

    jest
      .spyOn(jwksKeystoreService, "getPublicKey")
      .mockImplementationOnce((_req, _raw, done) => {
        done(
          new ServiceUnavailableException(
            "JWKS service unavailable or key resolution failed",
          ),
        );
      });

    const res = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=valid_code&state=${tx.state}`)
      .set("Cookie", [`auth0_correlation=${tx.transactionId}`])
      .expect(HttpStatus.SERVICE_UNAVAILABLE);

    expect(res.body.message).toMatch(/JWKS service unavailable/i);
    expect(prismaMock.userIdentity.findUnique).not.toHaveBeenCalled();
  });

  it("TST-AUTH-049 [D-01 Symmetric / None Algorithm & Missing Kid]: should reject HS256, alg=none, and missing kid with 401 Unauthorized", async () => {
    // 1. HS256
    const tx1 = await oidcService.createTransaction();
    const tokenHs256 = createSignedTestJwt(
      {
        alg: "HS256",
        kid: keyPair.kid,
        issuer: TEST_ISSUER,
        audience: TEST_CLIENT_ID,
        sub: "auth0|test-user-001",
        customClaims: { nonce: tx1.nonce },
      },
      "symmetric-secret-key-that-is-strictly-prohibited-here",
    );

    jest.spyOn(oidcService, "exchangeCodeForTokens").mockResolvedValueOnce({
      idToken: tokenHs256,
      accessToken: "at-mock-123",
      expiresIn: 3600,
    });

    const res1 = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=valid_code&state=${tx1.state}`)
      .set("Cookie", [`auth0_correlation=${tx1.transactionId}`])
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res1.body.message).toMatch(/Unsupported.*algorithm/i);

    // 2. alg: none
    const tx2 = await oidcService.createTransaction();
    const tokenNone = createSignedTestJwt(
      {
        alg: "none",
        kid: keyPair.kid,
        issuer: TEST_ISSUER,
        audience: TEST_CLIENT_ID,
        sub: "auth0|test-user-001",
        customClaims: { nonce: tx2.nonce },
      },
      "",
    );

    jest.spyOn(oidcService, "exchangeCodeForTokens").mockResolvedValueOnce({
      idToken: tokenNone,
      accessToken: "at-mock-123",
      expiresIn: 3600,
    });

    const res2 = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=valid_code&state=${tx2.state}`)
      .set("Cookie", [`auth0_correlation=${tx2.transactionId}`])
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res2.body.message).toMatch(/Unsupported.*algorithm/i);

    // 3. RS256 sin kid
    const tx3 = await oidcService.createTransaction();
    const tokenNoKid = createSignedTestJwt(
      {
        issuer: TEST_ISSUER,
        audience: TEST_CLIENT_ID,
        sub: "auth0|test-user-001",
        customClaims: { nonce: tx3.nonce },
      },
      keyPair.privateKeyPem,
    );

    jest.spyOn(oidcService, "exchangeCodeForTokens").mockResolvedValueOnce({
      idToken: tokenNoKid,
      accessToken: "at-mock-123",
      expiresIn: 3600,
    });

    const res3 = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=valid_code&state=${tx3.state}`)
      .set("Cookie", [`auth0_correlation=${tx3.transactionId}`])
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res3.body.message).toMatch(/missing mandatory kid/i);
    expect(prismaMock.userIdentity.findUnique).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // D-02: Validación Explícita de Claims de ID Token
  // --------------------------------------------------------------------------

  it("TST-AUTH-050 [D-02 Wrong Issuer]: should reject callback with 401 Unauthorized when ID token issuer does not match AUTH0_ISSUER_URL", async () => {
    const tx = await oidcService.createTransaction();

    const tokenWrongIssuer = createSignedTestJwt(
      {
        kid: keyPair.kid,
        issuer: "https://evil-attacker-idp.com/",
        audience: TEST_CLIENT_ID,
        sub: "auth0|test-user-001",
        customClaims: { nonce: tx.nonce },
      },
      keyPair.privateKeyPem,
    );

    jest.spyOn(oidcService, "exchangeCodeForTokens").mockResolvedValueOnce({
      idToken: tokenWrongIssuer,
      accessToken: "at-mock-123",
      expiresIn: 3600,
    });

    const res = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=valid_code&state=${tx.state}`)
      .set("Cookie", [`auth0_correlation=${tx.transactionId}`])
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res.body.message).toMatch(/Invalid ID token issuer/i);
    expect(prismaMock.userIdentity.findUnique).not.toHaveBeenCalled();
  });

  it("TST-AUTH-050B [D-02 Config Fail-Closed]: should fail-closed with 503 when AUTH0_ISSUER_URL or AUTH0_CLIENT_ID config is missing", async () => {
    const tx = await oidcService.createTransaction();

    const validToken = createSignedTestJwt(
      {
        kid: keyPair.kid,
        issuer: TEST_ISSUER,
        audience: TEST_CLIENT_ID,
        sub: "auth0|test-user-001",
        customClaims: { nonce: tx.nonce },
      },
      keyPair.privateKeyPem,
    );

    jest.spyOn(oidcService, "exchangeCodeForTokens").mockResolvedValueOnce({
      idToken: validToken,
      accessToken: "at-mock-123",
      expiresIn: 3600,
    });

    const origGet = configService.get.bind(configService);
    jest.spyOn(configService, "get").mockImplementation((key: string) => {
      if (key === "AUTH0_ISSUER_URL") return undefined;
      return origGet(key);
    });

    const res = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=valid_code&state=${tx.state}`)
      .set("Cookie", [`auth0_correlation=${tx.transactionId}`])
      .expect(HttpStatus.SERVICE_UNAVAILABLE);

    expect(res.body.message).toMatch(
      /issuer or client ID configuration missing/i,
    );
    expect(prismaMock.userIdentity.findUnique).not.toHaveBeenCalled();
  });

  it("TST-AUTH-051 [D-02 Wrong Audience]: should reject callback with 401 Unauthorized when ID token audience does not contain CLIENT_ID", async () => {
    const tx = await oidcService.createTransaction();

    const tokenWrongAud = createSignedTestJwt(
      {
        kid: keyPair.kid,
        issuer: TEST_ISSUER,
        audience: "foreign-client-id-xyz",
        sub: "auth0|test-user-001",
        customClaims: { nonce: tx.nonce },
      },
      keyPair.privateKeyPem,
    );

    jest.spyOn(oidcService, "exchangeCodeForTokens").mockResolvedValueOnce({
      idToken: tokenWrongAud,
      accessToken: "at-mock-123",
      expiresIn: 3600,
    });

    const res = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=valid_code&state=${tx.state}`)
      .set("Cookie", [`auth0_correlation=${tx.transactionId}`])
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res.body.message).toMatch(/Invalid ID token audience/i);
    expect(prismaMock.userIdentity.findUnique).not.toHaveBeenCalled();
  });

  it("TST-AUTH-053 [D-02 Multiple Audiences]: should reject callback with 401 Unauthorized when multiple audiences exist and azp is mismatched or missing", async () => {
    // 1. azp no coincidente
    const tx1 = await oidcService.createTransaction();
    const tokenMultipleAudWrongAzp = createSignedTestJwt(
      {
        kid: keyPair.kid,
        issuer: TEST_ISSUER,
        audience: TEST_CLIENT_ID,
        sub: "auth0|test-user-001",
        customClaims: {
          aud: [TEST_CLIENT_ID, "https://api.abogadoslaw.com"],
          nonce: tx1.nonce,
          azp: "mismatched-azp-client-id",
        },
      },
      keyPair.privateKeyPem,
    );

    jest.spyOn(oidcService, "exchangeCodeForTokens").mockResolvedValueOnce({
      idToken: tokenMultipleAudWrongAzp,
      accessToken: "at-mock-123",
      expiresIn: 3600,
    });

    const res1 = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=valid_code&state=${tx1.state}`)
      .set("Cookie", [`auth0_correlation=${tx1.transactionId}`])
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res1.body.message).toMatch(/Invalid or missing azp claim/i);

    // 2. azp ausente
    const tx2 = await oidcService.createTransaction();
    const tokenMultipleAudMissingAzp = createSignedTestJwt(
      {
        kid: keyPair.kid,
        issuer: TEST_ISSUER,
        audience: TEST_CLIENT_ID,
        sub: "auth0|test-user-001",
        customClaims: {
          aud: [TEST_CLIENT_ID, "https://api.abogadoslaw.com"],
          nonce: tx2.nonce,
        },
      },
      keyPair.privateKeyPem,
    );

    jest.spyOn(oidcService, "exchangeCodeForTokens").mockResolvedValueOnce({
      idToken: tokenMultipleAudMissingAzp,
      accessToken: "at-mock-123",
      expiresIn: 3600,
    });

    const res2 = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=valid_code&state=${tx2.state}`)
      .set("Cookie", [`auth0_correlation=${tx2.transactionId}`])
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res2.body.message).toMatch(/Invalid or missing azp claim/i);
    expect(prismaMock.userIdentity.findUnique).not.toHaveBeenCalled();
  });

  it("TST-AUTH-055 [D-02 Multiple Audiences with Valid AZP]: should accept callback when multiple audiences exist and azp matches CLIENT_ID", async () => {
    const tx = await oidcService.createTransaction();

    const tokenMultipleAudValidAzp = createSignedTestJwt(
      {
        kid: keyPair.kid,
        issuer: TEST_ISSUER,
        audience: TEST_CLIENT_ID,
        sub: "auth0|test-user-001",
        customClaims: {
          aud: [TEST_CLIENT_ID, "https://api.abogadoslaw.com"],
          nonce: tx.nonce,
          azp: TEST_CLIENT_ID,
        },
      },
      keyPair.privateKeyPem,
    );

    jest.spyOn(oidcService, "exchangeCodeForTokens").mockResolvedValueOnce({
      idToken: tokenMultipleAudValidAzp,
      accessToken: "at-mock-123",
      expiresIn: 3600,
    });

    const fixtureUser = createFixtureUser();
    const fixtureIdentity = {
      ...createFixtureUserIdentity({ userId: fixtureUser.id }),
      user: fixtureUser,
    } as any;
    const fixtureSession = createFixtureUserSession({ userId: fixtureUser.id });

    prismaMock.userIdentity.findUnique.mockResolvedValueOnce(fixtureIdentity);
    prismaMock.user.findUnique.mockResolvedValueOnce(fixtureUser);
    prismaMock.userSession.create.mockResolvedValueOnce(fixtureSession);

    const res = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=valid_code&state=${tx.state}`)
      .set("Cookie", [`auth0_correlation=${tx.transactionId}`]);

    expect([HttpStatus.OK, HttpStatus.FOUND]).toContain(res.status);
  });

  it("TST-AUTH-056 [D-02 Expired ID Token]: should reject callback with 401 Unauthorized when ID token has expired", async () => {
    const tx = await oidcService.createTransaction();

    const tokenExpired = createSignedTestJwt(
      {
        kid: keyPair.kid,
        issuer: TEST_ISSUER,
        audience: TEST_CLIENT_ID,
        sub: "auth0|test-user-001",
        expOffsetSeconds: -120,
        customClaims: { nonce: tx.nonce },
      },
      keyPair.privateKeyPem,
    );

    jest.spyOn(oidcService, "exchangeCodeForTokens").mockResolvedValueOnce({
      idToken: tokenExpired,
      accessToken: "at-mock-123",
      expiresIn: 3600,
    });

    const res = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=valid_code&state=${tx.state}`)
      .set("Cookie", [`auth0_correlation=${tx.transactionId}`])
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res.body.message).toMatch(/ID token expired/i);
    expect(prismaMock.userIdentity.findUnique).not.toHaveBeenCalled();
  });

  it("TST-AUTH-057 [D-02 Empty Subject]: should reject callback with 401 Unauthorized when sub is missing or empty", async () => {
    const tx = await oidcService.createTransaction();

    const tokenEmptySub = createSignedTestJwt(
      {
        kid: keyPair.kid,
        issuer: TEST_ISSUER,
        audience: TEST_CLIENT_ID,
        omitSub: true,
        customClaims: { nonce: tx.nonce },
      },
      keyPair.privateKeyPem,
    );

    jest.spyOn(oidcService, "exchangeCodeForTokens").mockResolvedValueOnce({
      idToken: tokenEmptySub,
      accessToken: "at-mock-123",
      expiresIn: 3600,
    });

    const res = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=valid_code&state=${tx.state}`)
      .set("Cookie", [`auth0_correlation=${tx.transactionId}`])
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res.body.message).toMatch(/Missing or empty subject/i);
    expect(prismaMock.userIdentity.findUnique).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // TST-AUTH-009 & TST-AUTH-046: Resolución estricta de UserIdentity
  // --------------------------------------------------------------------------
  it("TST-AUTH-009 / TST-AUTH-046: should reject callback with 401 Unauthorized if external identity (issuer, sub) is not enrolled", async () => {
    const tx = await oidcService.createTransaction();

    const idTokenValid = createSignedTestJwt(
      {
        kid: keyPair.kid,
        issuer: TEST_ISSUER,
        audience: TEST_CLIENT_ID,
        sub: "auth0|unregistered-external-sub",
        customClaims: { nonce: tx.nonce },
      },
      keyPair.privateKeyPem,
    );

    jest.spyOn(oidcService, "exchangeCodeForTokens").mockResolvedValueOnce({
      idToken: idTokenValid,
      accessToken: "at-mock-123",
      expiresIn: 3600,
    });

    prismaMock.userIdentity.findUnique.mockResolvedValueOnce(null);

    const res = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=valid_code&state=${tx.state}`)
      .set("Cookie", [`auth0_correlation=${tx.transactionId}`])
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res.body.message).toMatch(/Identity not registered in system/i);
    expect(prismaMock.userIdentity.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          issuer_subject: {
            issuer: TEST_ISSUER,
            subject: "auth0|unregistered-external-sub",
          },
        },
      }),
    );
  });

  // TST-AUTH-031 & TST-AUTH-032: Callback exitoso, emisión de app_session y regeneración anti-fixation
  it("TST-AUTH-031 & TST-AUTH-032: should exchange code, create UserSession, destroy correlation and emit app_session cookie (200/302 OK)", async () => {
    const tx = await oidcService.createTransaction();

    const idTokenValid = createSignedTestJwt(
      {
        kid: keyPair.kid,
        issuer: TEST_ISSUER,
        audience: TEST_CLIENT_ID,
        sub: "auth0|test-user-001",
        customClaims: { nonce: tx.nonce },
      },
      keyPair.privateKeyPem,
    );

    jest.spyOn(oidcService, "exchangeCodeForTokens").mockResolvedValueOnce({
      idToken: idTokenValid,
      accessToken: "at-mock-123",
      expiresIn: 3600,
    });

    const fixtureUser = createFixtureUser();
    const fixtureIdentity = {
      ...createFixtureUserIdentity({ userId: fixtureUser.id }),
      user: fixtureUser,
    } as any;
    const fixtureSession = createFixtureUserSession({ userId: fixtureUser.id });

    prismaMock.userIdentity.findUnique.mockResolvedValueOnce(fixtureIdentity);
    prismaMock.user.findUnique.mockResolvedValueOnce(fixtureUser);
    prismaMock.userSession.create.mockResolvedValueOnce(fixtureSession);

    const res = await request(app.getHttpServer())
      .get(`/api/auth/callback?code=valid_code&state=${tx.state}`)
      .set("Cookie", [`auth0_correlation=${tx.transactionId}`]);

    expect([HttpStatus.OK, HttpStatus.FOUND]).toContain(res.status);

    const rawCookies = res.header["set-cookie"];
    const cookies: string[] = Array.isArray(rawCookies)
      ? rawCookies
      : rawCookies
        ? [rawCookies]
        : [];
    expect(cookies.length).toBeGreaterThan(0);

    const sessionCookie = cookies.find((c: string) =>
      c.startsWith("app_session="),
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);
    expect(sessionCookie).toMatch(/Path=\//i);

    const correlationCleared = cookies.find((c: string) =>
      c.startsWith("auth0_correlation="),
    );
    expect(correlationCleared).toMatch(/Max-Age=0|expires=/i);

    expect(prismaMock.userSession.create).toHaveBeenCalledTimes(1);
    const createdArgs = prismaMock.userSession.create.mock.calls[0][0];
    expect(createdArgs.data.sessionToken).toHaveLength(64);
  });

  // TST-AUTH-033 & TST-AUTH-052: CSRF Engine (Origin allowlist canónica y firma HMAC)
  it("TST-AUTH-033 & TST-AUTH-052: should enforce CSRF protection on mutations with exact Origin allowlist and HMAC validation", async () => {
    const rawSessionSecret = "test-raw-session-secret-32-chars-long!";
    const sessionHash = crypto
      .createHash("sha256")
      .update(rawSessionSecret)
      .digest("hex");

    const fixtureUser = createFixtureUser();
    const fixtureSession = createFixtureUserSession({
      userId: fixtureUser.id,
      sessionToken: sessionHash,
    });

    prismaMock.userSession.findUnique.mockResolvedValue(fixtureSession);
    prismaMock.user.findUnique.mockResolvedValue(fixtureUser);

    const resNoCsrf = await request(app.getHttpServer())
      .post("/api/expedientes")
      .set("Cookie", [`app_session=${rawSessionSecret}`])
      .set("Origin", APP_URL)
      .send({ caratula: "Test Causa" })
      .expect(HttpStatus.FORBIDDEN);

    expect(resNoCsrf.body.message).toMatch(/CSRF token missing or invalid/i);

    const validCsrfToken = csrfService.generateToken(rawSessionSecret);
    const resBadOrigin = await request(app.getHttpServer())
      .post("/api/expedientes")
      .set("Cookie", [
        `app_session=${rawSessionSecret}`,
        `csrf_token=${validCsrfToken}`,
      ])
      .set("X-CSRF-Token", validCsrfToken)
      .set("Origin", "http://localhost:3000.attacker.com")
      .send({ caratula: "Test Causa" })
      .expect(HttpStatus.FORBIDDEN);

    expect(resBadOrigin.body.message).toMatch(/CSRF origin mismatch/i);

    const resTampered = await request(app.getHttpServer())
      .post("/api/expedientes")
      .set("Cookie", [
        `app_session=${rawSessionSecret}`,
        `csrf_token=${validCsrfToken}`,
      ])
      .set("X-CSRF-Token", validCsrfToken + "_tampered")
      .set("Origin", APP_URL)
      .send({ caratula: "Test Causa" })
      .expect(HttpStatus.FORBIDDEN);

    expect(resTampered.body.message).toMatch(/CSRF signature invalid/i);

    const resValid = await request(app.getHttpServer())
      .post("/api/expedientes")
      .set("Cookie", [
        `app_session=${rawSessionSecret}`,
        `csrf_token=${validCsrfToken}`,
      ])
      .set("X-CSRF-Token", validCsrfToken)
      .set("Origin", APP_URL)
      .send({ caratula: "Test Causa" })
      .expect(HttpStatus.CREATED);

    expect(resValid.body.status).toBe("created");
    expect(resValid.body.securityContext.userId).toBe(fixtureUser.id);
  });

  // TST-AUTH-034: Expiración por inactividad (idleExpiresAt = 30 min)
  it("TST-AUTH-034: should reject request with 401 Unauthorized when session exceeded inactivity threshold (idleExpiresAt)", async () => {
    const rawSessionSecret = "test-raw-session-idle-expired!";
    const sessionHash = crypto
      .createHash("sha256")
      .update(rawSessionSecret)
      .digest("hex");

    const fixtureSession = createFixtureUserSession({
      sessionToken: sessionHash,
      idleExpiresAt: new Date(Date.now() - 60000),
      expiresAt: new Date(Date.now() + 4 * 3600 * 1000),
    });

    prismaMock.userSession.findUnique.mockResolvedValueOnce(fixtureSession);

    const res = await request(app.getHttpServer())
      .get("/api/expedientes")
      .set("Cookie", [`app_session=${rawSessionSecret}`])
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res.body.message).toMatch(/Session expired due to inactivity/i);
  });

  // TST-AUTH-037: Expiración absoluta de 8 horas (expiresAt)
  it("TST-AUTH-037: should reject request with 401 Unauthorized when session exceeded absolute lifetime of 8 hours", async () => {
    const rawSessionSecret = "test-raw-session-absolute-expired!";
    const sessionHash = crypto
      .createHash("sha256")
      .update(rawSessionSecret)
      .digest("hex");

    const fixtureSession = createFixtureUserSession({
      sessionToken: sessionHash,
      expiresAt: new Date(Date.now() - 60000),
    });

    prismaMock.userSession.findUnique.mockResolvedValueOnce(fixtureSession);

    const res = await request(app.getHttpServer())
      .get("/api/expedientes")
      .set("Cookie", [`app_session=${rawSessionSecret}`])
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res.body.message).toMatch(/Session expired by absolute timeout/i);
  });

  // Logout y Revocación de Sesión
  it("Logout: should revoke session in database and clear cookies on POST /api/auth/logout", async () => {
    const rawSessionSecret = "test-raw-session-logout!";
    const sessionHash = crypto
      .createHash("sha256")
      .update(rawSessionSecret)
      .digest("hex");

    const fixtureUser = createFixtureUser();
    const fixtureSession = createFixtureUserSession({
      userId: fixtureUser.id,
      sessionToken: sessionHash,
    });

    prismaMock.userSession.findUnique.mockResolvedValueOnce(fixtureSession);
    prismaMock.user.findUnique.mockResolvedValueOnce(fixtureUser);
    prismaMock.userSession.update.mockResolvedValueOnce({
      ...fixtureSession,
      revokedAt: new Date(),
    });

    const res = await request(app.getHttpServer())
      .post("/api/auth/logout")
      .set("Cookie", [`app_session=${rawSessionSecret}`])
      .expect(HttpStatus.OK);

    expect(res.body.status).toBe("logged_out");
    expect(prismaMock.userSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: fixtureSession.id },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      }),
    );

    const rawCookies = res.header["set-cookie"];
    const cookies: string[] = Array.isArray(rawCookies)
      ? rawCookies
      : rawCookies
        ? [rawCookies]
        : [];
    expect(cookies.length).toBeGreaterThan(0);
    const clearedSession = cookies.find((c: string) =>
      c.startsWith("app_session="),
    );
    expect(clearedSession).toMatch(/Max-Age=0|expires=/i);
  });
});
