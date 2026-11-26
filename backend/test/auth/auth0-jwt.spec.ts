/**
 * Suite de Pruebas de Integración y Unitarias para AUTH-01 (Auth0 RS256 & Contexto de Seguridad)
 * Especificación: SPEC-AUTH-001 v1.0.8 (Baseline Consolidado)
 * Expediente: AUTH0-IMPLEMENTATION-001
 *
 * Cobertura TDS:
 * - TST-AUTH-001: Access Token RS256 válido -> 200 OK + inyección req.securityContext
 * - TST-AUTH-002: Token expirado (exp vencido) -> 401 Unauthorized
 * - TST-AUTH-003: Issuer spoofing (iss ajeno) -> 401 Unauthorized
 * - TST-AUTH-004: Firma asimétrica corrupta -> 401 Unauthorized
 * - TST-AUTH-005: Audiencia inválida (aud mismatch) -> 401 Unauthorized
 * - TST-AUTH-006: Algoritmo simétrico no permitido (HS256 / none) -> 401 Unauthorized
 * - TST-AUTH-007: Token carente de claim obligatorio sub -> 401 Unauthorized
 * - TST-AUTH-008: Rotación dinámica de claves JWKS -> 200 OK con nuevo kid
 * - TST-AUTH-009: Identidad Auth0 no enrolada en BD -> 401 Unauthorized
 * - TST-AUTH-010: Modificación de email con mismo sub -> 200 OK
 * - TST-AUTH-011: Usuario local suspendido -> 403 Forbidden
 * - TST-AUTH-012: Usuario sin organización activa -> 403 Forbidden
 * - TST-AUTH-018 / TST-AUTH-043: JWKS inaccesible ante clave desconocida -> 503 Fail-Closed
 * - TST-AUTH-020: Erradicación total de endpoint legacy /auth/login -> 404 Not Found
 */

import { Test, TestingModule } from "@nestjs/testing";
import {
  INestApplication,
  Controller,
  Get,
  UseGuards,
  Req,
  HttpStatus,
  ServiceUnavailableException,
} from "@nestjs/common";
import * as request from "supertest";
import { ConfigModule } from "@nestjs/config";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";

import {
  generateTestRsaKeyPair,
  createSignedTestJwt,
  corruptTokenSignature,
  KeyPairResult,
} from "../helpers/crypto-test-helper";
import { createPrismaMock, MockPrismaService } from "../mocks/prisma.mock";
import { createFixtureUser } from "../fixtures/user.fixture";
import { PrismaService } from "../../src/prisma.service";

// Componentes a implementar en Fase 1
import { Auth0JwtStrategy } from "../../src/auth/strategies/auth0-jwt.strategy";
import { Auth0JwtGuard } from "../../src/auth/guards/auth0-jwt.guard";
import { SecurityContextGuard } from "../../src/auth/guards/security-context.guard";
import { JwksKeystoreService } from "../../src/auth/services/jwks-keystore.service";
import { AuthController } from "../../src/auth/auth.controller";
import { AuthService } from "../../src/auth/auth.service";

@Controller("expedientes")
class TestExpedientesController {
  @Get()
  @UseGuards(Auth0JwtGuard, SecurityContextGuard)
  list(@Req() req: any) {
    return {
      status: "ok",
      securityContext: req.securityContext,
    };
  }
}

describe("AUTH-01 — Auth0 RS256 JWT & Security Context Verification", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prismaMock: MockPrismaService;
  let jwksService: JwksKeystoreService;

  let keyPair1: KeyPairResult;
  let keyPair2: KeyPairResult;

  const TEST_ISSUER = "https://abogados-test.us.auth0.com/";
  const TEST_AUDIENCE = "https://api.abogadoslaw.com";

  beforeAll(async () => {
    keyPair1 = generateTestRsaKeyPair("test-kid-1");
    keyPair2 = generateTestRsaKeyPair("test-kid-2");

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
            }),
          ],
        }),
        PassportModule.register({ defaultStrategy: "auth0-jwt" }),
        JwtModule.register({ secret: "test-secret" }),
      ],
      controllers: [TestExpedientesController, AuthController],
      providers: [
        AuthService,
        JwksKeystoreService,
        Auth0JwtStrategy,
        Auth0JwtGuard,
        SecurityContextGuard,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    jwksService = moduleRef.get<JwksKeystoreService>(JwksKeystoreService);
    // Registrar clave inicial en el keystore en memoria (simulando JWKS local)
    jwksService.registerSigningKey(keyPair1.kid, keyPair1.publicKeyPem);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TST-AUTH-001
  it("TST-AUTH-001: should accept valid RS256 token and inject req.securityContext (200 OK)", async () => {
    const fixtureUser = createFixtureUser({
      id: "usr-valid-001",
      email: "abogado@estudio.com",
      role: UserRole.ASSOCIATE,
      organizationId: "org-test-alpha",
    });

    prismaMock.user.findFirst.mockResolvedValue(fixtureUser);

    const token = createSignedTestJwt(
      {
        kid: keyPair1.kid,
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        sub: "auth0|usr-valid-001",
        email: "abogado@estudio.com",
      },
      keyPair1.privateKeyPem,
    );

    const res = await request(app.getHttpServer())
      .get("/expedientes")
      .set("Authorization", `Bearer ${token}`)
      .expect(HttpStatus.OK);

    expect(res.body.status).toBe("ok");
    expect(res.body.securityContext).toBeDefined();
    expect(res.body.securityContext.userId).toBe("usr-valid-001");
    expect(res.body.securityContext.activeOrgId).toBe("org-test-alpha");
    expect(res.body.securityContext.role).toBe(UserRole.ASSOCIATE);
  });

  // TST-AUTH-002
  it("TST-AUTH-002: should reject expired token with 401 Unauthorized (jwt expired)", async () => {
    const token = createSignedTestJwt(
      {
        kid: keyPair1.kid,
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        sub: "auth0|usr-valid-001",
        expOffsetSeconds: -120, // Expirado hace 2 minutos
      },
      keyPair1.privateKeyPem,
    );

    const res = await request(app.getHttpServer())
      .get("/expedientes")
      .set("Authorization", `Bearer ${token}`)
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res.body.message).toMatch(/jwt expired|expired/i);
  });

  // TST-AUTH-003
  it("TST-AUTH-003: should reject token with untrusted/spoofed issuer with 401 Unauthorized", async () => {
    const token = createSignedTestJwt(
      {
        kid: keyPair1.kid,
        issuer: "https://attacker.auth0.com/",
        audience: TEST_AUDIENCE,
        sub: "auth0|usr-valid-001",
      },
      keyPair1.privateKeyPem,
    );

    await request(app.getHttpServer())
      .get("/expedientes")
      .set("Authorization", `Bearer ${token}`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  // TST-AUTH-004
  it("TST-AUTH-004: should reject token with corrupted signature with 401 Unauthorized", async () => {
    const validToken = createSignedTestJwt(
      {
        kid: keyPair1.kid,
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        sub: "auth0|usr-valid-001",
      },
      keyPair1.privateKeyPem,
    );

    const corruptedToken = corruptTokenSignature(validToken);

    await request(app.getHttpServer())
      .get("/expedientes")
      .set("Authorization", `Bearer ${corruptedToken}`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  // TST-AUTH-005
  it("TST-AUTH-005: should reject token with wrong audience (ID Token sent to API) with 401 Unauthorized", async () => {
    const token = createSignedTestJwt(
      {
        kid: keyPair1.kid,
        issuer: TEST_ISSUER,
        audience: "client_id_frontend_not_api",
        sub: "auth0|usr-valid-001",
      },
      keyPair1.privateKeyPem,
    );

    await request(app.getHttpServer())
      .get("/expedientes")
      .set("Authorization", `Bearer ${token}`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  // TST-AUTH-006
  it("TST-AUTH-006: should strictly reject symmetric algorithms HS256 and none with 401 Unauthorized", async () => {
    const hs256Token = createSignedTestJwt(
      {
        alg: "HS256",
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        sub: "auth0|usr-valid-001",
      },
      "attacker-symmetric-secret",
    );

    await request(app.getHttpServer())
      .get("/expedientes")
      .set("Authorization", `Bearer ${hs256Token}`)
      .expect(HttpStatus.UNAUTHORIZED);

    const noneToken = createSignedTestJwt(
      {
        alg: "none",
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        sub: "auth0|usr-valid-001",
      },
      "",
    );

    await request(app.getHttpServer())
      .get("/expedientes")
      .set("Authorization", `Bearer ${noneToken}`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  // TST-AUTH-007
  it("TST-AUTH-007: should reject token missing mandatory sub claim with 401 Unauthorized", async () => {
    const tokenWithoutSub = createSignedTestJwt(
      {
        kid: keyPair1.kid,
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        omitSub: true,
      },
      keyPair1.privateKeyPem,
    );

    await request(app.getHttpServer())
      .get("/expedientes")
      .set("Authorization", `Bearer ${tokenWithoutSub}`)
      .expect(HttpStatus.UNAUTHORIZED);
  });

  // TST-AUTH-008
  it("TST-AUTH-008: should dynamically accept token signed with newly rotated key (kid2) without server restart (200 OK)", async () => {
    const fixtureUser = createFixtureUser({
      id: "usr-rotated-001",
      email: "abogado.rotated@estudio.com",
      role: UserRole.PARTNER,
      organizationId: "org-test-alpha",
    });

    prismaMock.user.findFirst.mockResolvedValue(fixtureUser);

    // Registrar nueva clave rotada en JWKS dinámico
    jwksService.registerSigningKey(keyPair2.kid, keyPair2.publicKeyPem);

    const tokenKid2 = createSignedTestJwt(
      {
        kid: keyPair2.kid,
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        sub: "auth0|usr-rotated-001",
      },
      keyPair2.privateKeyPem,
    );

    const res = await request(app.getHttpServer())
      .get("/expedientes")
      .set("Authorization", `Bearer ${tokenKid2}`)
      .expect(HttpStatus.OK);

    expect(res.body.status).toBe("ok");
    expect(res.body.securityContext.userId).toBe("usr-rotated-001");
  });

  // TST-AUTH-009
  it("TST-AUTH-009: should reject valid token whose sub has no matching local user with 401 Unauthorized", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    const token = createSignedTestJwt(
      {
        kid: keyPair1.kid,
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        sub: "auth0|unregistered_user_999",
      },
      keyPair1.privateKeyPem,
    );

    const res = await request(app.getHttpServer())
      .get("/expedientes")
      .set("Authorization", `Bearer ${token}`)
      .expect(HttpStatus.UNAUTHORIZED);

    expect(res.body.message).toMatch(/Identity not registered in system/i);
  });

  // TST-AUTH-010
  it("TST-AUTH-010: should resolve user by sub even if email in token differs from local record (200 OK)", async () => {
    const fixtureUser = createFixtureUser({
      id: "usr-email-change-001",
      email: "original@estudio.com",
      role: UserRole.ASSOCIATE,
      organizationId: "org-test-alpha",
    });

    prismaMock.user.findFirst.mockResolvedValue(fixtureUser);

    const token = createSignedTestJwt(
      {
        kid: keyPair1.kid,
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        sub: "auth0|usr-email-change-001",
        email: "nuevo.email.cambiado@estudio.com",
      },
      keyPair1.privateKeyPem,
    );

    const res = await request(app.getHttpServer())
      .get("/expedientes")
      .set("Authorization", `Bearer ${token}`)
      .expect(HttpStatus.OK);

    expect(res.body.status).toBe("ok");
    expect(res.body.securityContext.userId).toBe("usr-email-change-001");
  });

  // TST-AUTH-011
  it("TST-AUTH-011: should reject suspended user with 403 Forbidden", async () => {
    // Simulamos usuario suspendido (permissions contiene status: SUSPENDED o flag inactivo)
    const suspendedUser = createFixtureUser({
      id: "usr-suspended-001",
      email: "suspendido@estudio.com",
      permissions: { status: "SUSPENDED" },
      organizationId: "org-test-alpha",
    });

    prismaMock.user.findFirst.mockResolvedValue(suspendedUser);

    const token = createSignedTestJwt(
      {
        kid: keyPair1.kid,
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        sub: "auth0|usr-suspended-001",
      },
      keyPair1.privateKeyPem,
    );

    const res = await request(app.getHttpServer())
      .get("/expedientes")
      .set("Authorization", `Bearer ${token}`)
      .expect(HttpStatus.FORBIDDEN);

    expect(res.body.message).toMatch(/Account is suspended or inactive/i);
  });

  // TST-AUTH-012
  it("TST-AUTH-012: should reject user without active organization membership with 403 Forbidden", async () => {
    const orphanUser = createFixtureUser({
      id: "usr-orphan-001",
      email: "huerfano@estudio.com",
      organizationId: "", // Sin organización activa
    });

    prismaMock.user.findFirst.mockResolvedValue(orphanUser);

    const token = createSignedTestJwt(
      {
        kid: keyPair1.kid,
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        sub: "auth0|usr-orphan-001",
      },
      keyPair1.privateKeyPem,
    );

    const res = await request(app.getHttpServer())
      .get("/expedientes")
      .set("Authorization", `Bearer ${token}`)
      .expect(HttpStatus.FORBIDDEN);

    expect(res.body.message).toMatch(
      /No active organization membership found/i,
    );
  });

  // TST-AUTH-018 / TST-AUTH-043
  it("TST-AUTH-018 / TST-AUTH-043: should fail-closed with 503 Service Unavailable when JWKS cannot resolve unknown kid", async () => {
    // Configurar simulación de falla JWKS para clave desconocida
    jest
      .spyOn(jwksService, "getPublicKey")
      .mockImplementation((req: any, token: any, done: any) => {
        done(
          new ServiceUnavailableException(
            "JWKS service unavailable or key not found in IdP",
          ),
        );
      });

    const unknownKidToken = createSignedTestJwt(
      {
        kid: "kid-desconocido-no-disponible",
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
        sub: "auth0|usr-valid-001",
      },
      keyPair1.privateKeyPem,
    );

    await request(app.getHttpServer())
      .get("/expedientes")
      .set("Authorization", `Bearer ${unknownKidToken}`)
      .expect(HttpStatus.SERVICE_UNAVAILABLE);
  });

  // TST-AUTH-020
  it("TST-AUTH-020: should eradicate legacy local login route and return 404 Not Found on POST /auth/login", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "admin@estudio.com", password: "hash123" })
      .expect(HttpStatus.NOT_FOUND);
  });
});
