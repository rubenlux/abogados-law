/**
 * Suite de Pruebas de Integración PostgreSQL REAL para AUTH-02 (Sin Mocks de BD)
 * Especificación: SPEC-AUTH-001 v1.0.8 / SPEC-TST-001 (OBS-003)
 * Expediente: AUTH0-IMPLEMENTATION-005 / AUTH0-AUTH02-FINAL-VERIFICATION-006
 *
 * Verificaciones sobre PostgreSQL Real (abogados_test):
 * 1. Guardián Fail-Closed mediante assertSafeTestDatabaseUrl.
 * 2. Creación, unicidad compuesta (issuer, subject) [P2002], integridad referencial y ON DELETE CASCADE en UserIdentity.
 * 3. Creación, unicidad de sessionToken [P2002], recuperación y revocación (revokedAt) en UserSession.
 * 4. Persistencia real de OidcTransaction y cifrado/descifrado AES-256-GCM en reposo con OIDC_TRANSACTION_ENCRYPTION_KEY.
 * 5. Consumo atómico concurrente real en PostgreSQL (2 y 5 llamadas concurrentes -> exactamente 1 éxito, 0 errores 500/P2025).
 * 6. Concurrencia HTTP real en GET /api/auth/callback contra PostgreSQL (exactamente 1 éxito, 1 rechazo 400 Bad Request).
 * 7. Prevención de replay y rechazo de transacciones expiradas o con state inválido.
 * 8. Recuperación de transacciones pendientes tras reinicio de proceso (nueva instancia de servicio y PrismaClient).
 *
 * REGLA ESTRICTA: Si PostgreSQL no está disponible, falla de manera explícita (BLOCKED); NUNCA reporta PASS falso.
 */

import { PrismaClient, Prisma, UserRole } from "@prisma/client";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule, ConfigService } from "@nestjs/config";
import {
  BadRequestException,
  HttpStatus,
  INestApplication,
} from "@nestjs/common";
import * as request from "supertest";
import * as crypto from "crypto";

import { assertSafeTestDatabaseUrl } from "../helpers/db-guard";
import { PrismaService } from "../../src/prisma.service";
import { OidcClientService } from "../../src/auth/bff/oidc-client.service";
import { BffController } from "../../src/auth/bff/bff.controller";
import { BffSessionService } from "../../src/auth/bff/bff-session.service";
import { CsrfService } from "../../src/auth/bff/csrf.service";
import { JwksKeystoreService } from "../../src/auth/services/jwks-keystore.service";
import { BffSessionGuard } from "../../src/auth/guards/bff-session.guard";
import {
  generateTestRsaKeyPair,
  createSignedTestJwt,
} from "../helpers/crypto-test-helper";

describe("AUTH-02 — PostgreSQL Real Database Integration Suite (abogados_test)", () => {
  let prisma: PrismaClient;
  let oidcService: OidcClientService;
  let configService: ConfigService;

  const testDbUrl =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/abogados_test?schema=public";
  const TEST_ENCRYPTION_KEY =
    process.env.OIDC_TRANSACTION_ENCRYPTION_KEY ||
    "9059d7b7e25d3c8c6de1cb0dc62232e3692c26404b1c2cdaecc19e559ef16a0c";

  const createdOrgIds: string[] = [];
  const createdTxIds: string[] = [];

  beforeAll(async () => {
    // 1. Guardián estricto Fail-Closed: sólo permite localhost/abogados_test
    assertSafeTestDatabaseUrl(testDbUrl);

    prisma = new PrismaClient({
      datasources: {
        db: { url: testDbUrl },
      },
    });

    // Conexión obligatoria real: si falla, el test FALLA como BLOCKED (nunca PASS falso)
    await prisma.$connect();

    // Verificar conectividad SQL efectiva
    const ping = await prisma.$queryRaw<Array<{ current_database: string }>>`
      SELECT current_database()
    `;
    expect(ping[0]?.current_database).toBe("abogados_test");

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [
            () => ({
              AUTH0_ISSUER_URL: "https://abogados-test.us.auth0.com/",
              AUTH0_CLIENT_ID: "test-auth0-client-id-for-automated-testing",
              AUTH0_CLIENT_SECRET: "test-client-secret-minimum-32-chars!",
              AUTH0_AUDIENCE: "https://api.abogadoslaw.com",
              APP_ORIGIN: "http://localhost:3000",
              CSRF_SECRET: "test-csrf-hmac-secret-minimum-32-chars-long!",
              OIDC_TRANSACTION_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
            }),
          ],
        }),
      ],
      providers: [
        OidcClientService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    oidcService = moduleRef.get<OidcClientService>(OidcClientService);
    configService = moduleRef.get<ConfigService>(ConfigService);
  });

  afterAll(async () => {
    if (prisma) {
      if (createdTxIds.length > 0) {
        await prisma.oidcTransaction.deleteMany({
          where: { transactionId: { in: createdTxIds } },
        });
      }
      if (createdOrgIds.length > 0) {
        await prisma.user.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await prisma.organization.deleteMany({
          where: { id: { in: createdOrgIds } },
        });
      }
      await prisma.$disconnect();
    }
  });

  it("DB-GUARD: should strictly enforce fail-closed validation on DATABASE_URL", () => {
    expect(() => assertSafeTestDatabaseUrl(testDbUrl)).not.toThrow();
    expect(() =>
      assertSafeTestDatabaseUrl("postgresql://prod-db.aws.com/abogados_prod"),
    ).toThrow(/Host 'prod-db.aws.com' no autorizado/i);
    expect(() =>
      assertSafeTestDatabaseUrl("postgresql://localhost:5432/abogados_dev"),
    ).toThrow(/Base de datos 'abogados_dev' no autorizada/i);
  });

  it("UserIdentity: should enforce composite uniqueness (issuer, subject) [P2002], FK integrity and ON DELETE CASCADE in real PostgreSQL", async () => {
    const testOrg = await prisma.organization.create({
      data: { name: `Test Org Identity ${Date.now()}` },
    });
    createdOrgIds.push(testOrg.id);

    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const testUser1 = await prisma.user.create({
      data: {
        email: `test.user1.${uniqueSuffix}@abogados.com`,
        fullName: "Test User 1",
        passwordHash: "$2b$04$testMockHash",
        role: UserRole.ASSOCIATE,
        organizationId: testOrg.id,
      },
    });

    const testUser2 = await prisma.user.create({
      data: {
        email: `test.user2.${uniqueSuffix}@abogados.com`,
        fullName: "Test User 2",
        passwordHash: "$2b$04$testMockHash",
        role: UserRole.ASSOCIATE,
        organizationId: testOrg.id,
      },
    });

    const issuer = "https://abogados-test.us.auth0.com/";
    const subject = `auth0|test-sub-${uniqueSuffix}`;

    // 1. Creación válida
    const createdIdentity = await prisma.userIdentity.create({
      data: {
        userId: testUser1.id,
        issuer,
        subject,
        authEmail: testUser1.email,
      },
    });
    expect(createdIdentity.id).toBeDefined();

    // 2. Colisión de unicidad compuesta (issuer, subject) debe arrojar P2002
    let caughtError: any;
    try {
      await prisma.userIdentity.create({
        data: {
          userId: testUser2.id,
          issuer,
          subject,
        },
      });
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(caughtError.code).toBe("P2002");

    // 3. Integridad referencial: FK inválida debe arrojar P2003
    let fkError: any;
    try {
      await prisma.userIdentity.create({
        data: {
          userId: "non-existent-user-id-000000",
          issuer,
          subject: `auth0|orphan-${uniqueSuffix}`,
        },
      });
    } catch (err) {
      fkError = err;
    }
    expect(fkError).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(fkError.code).toBe("P2003");

    // 4. Crear sesión asociada al User 1 para verificar cascada conjunta
    const sessionToken = crypto
      .createHash("sha256")
      .update(crypto.randomBytes(32))
      .digest("hex");
    await prisma.userSession.create({
      data: {
        userId: testUser1.id,
        sessionToken,
        expiresAt: new Date(Date.now() + 8 * 3600 * 1000),
        idleExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    // 5. Eliminar User 1 -> debe eliminar en cascada UserIdentity y UserSession
    await prisma.user.delete({ where: { id: testUser1.id } });

    const remainingIdentity = await prisma.userIdentity.findUnique({
      where: { issuer_subject: { issuer, subject } },
    });
    const remainingSession = await prisma.userSession.findUnique({
      where: { sessionToken },
    });
    expect(remainingIdentity).toBeNull();
    expect(remainingSession).toBeNull();
  });

  it("UserSession: should persist, enforce sessionToken uniqueness [P2002], query and revoke in real PostgreSQL", async () => {
    const testOrg = await prisma.organization.create({
      data: { name: `Test Org Sessions ${Date.now()}` },
    });
    createdOrgIds.push(testOrg.id);

    const testUser = await prisma.user.create({
      data: {
        email: `test.session.${Date.now()}-${crypto.randomBytes(4).toString("hex")}@abogados.com`,
        fullName: "Test User Session",
        passwordHash: "$2b$04$testMockHash",
        role: UserRole.ASSOCIATE,
        organizationId: testOrg.id,
      },
    });

    const sessionSecret = crypto.randomBytes(32).toString("hex");
    const sessionToken = crypto
      .createHash("sha256")
      .update(sessionSecret)
      .digest("hex");

    const session = await prisma.userSession.create({
      data: {
        userId: testUser.id,
        sessionToken,
        expiresAt: new Date(Date.now() + 8 * 3600 * 1000),
        idleExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    expect(session.id).toBeDefined();

    // Recuperación por sessionToken
    const fetched = await prisma.userSession.findUnique({
      where: { sessionToken },
      include: { user: true },
    });
    expect(fetched).not.toBeNull();
    expect(fetched?.user.id).toBe(testUser.id);
    expect(fetched?.revokedAt).toBeNull();

    // Unicidad de sessionToken -> P2002
    let dupError: any;
    try {
      await prisma.userSession.create({
        data: {
          userId: testUser.id,
          sessionToken,
          expiresAt: new Date(Date.now() + 8 * 3600 * 1000),
          idleExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
    } catch (err) {
      dupError = err;
    }
    expect(dupError).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(dupError.code).toBe("P2002");

    // Revocación
    const revokedAt = new Date();
    const updated = await prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt },
    });
    expect(updated.revokedAt).not.toBeNull();
  });

  it("OidcTransaction: should persist AES-256-GCM encrypted codeVerifier in real PostgreSQL, decrypt accurately on consume and reject replay", async () => {
    const tx = await oidcService.createTransaction();
    createdTxIds.push(tx.transactionId);

    // Inspeccionar directamente la fila cruda en PostgreSQL
    const rawRow = await prisma.oidcTransaction.findUnique({
      where: { transactionId: tx.transactionId },
    });
    expect(rawRow).not.toBeNull();
    expect(rawRow!.codeVerifier).not.toBe(tx.codeVerifier);
    expect(rawRow!.codeVerifier).toMatch(
      /^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i,
    );

    // Consumir exitosamente
    const consumed = await oidcService.consumeTransaction(
      tx.transactionId,
      tx.state,
    );
    expect(consumed.transactionId).toBe(tx.transactionId);
    expect(consumed.codeVerifier).toBe(tx.codeVerifier);
    expect(consumed.codeChallenge).toBe(tx.codeChallenge);
    expect(consumed.nonce).toBe(tx.nonce);
    expect(consumed.state).toBe(tx.state);

    // Verificar eliminación física en PostgreSQL
    const afterConsume = await prisma.oidcTransaction.findUnique({
      where: { transactionId: tx.transactionId },
    });
    expect(afterConsume).toBeNull();

    // Replay: segundo intento debe rechazarse con BadRequestException (400)
    await expect(
      oidcService.consumeTransaction(tx.transactionId, tx.state),
    ).rejects.toThrow(BadRequestException);
  });

  it("OidcTransaction [Real Concurrency]: two and five simultaneous consumeTransaction calls on real PostgreSQL must yield exactly 1 success and all others BadRequestException (zero 500/P2025)", async () => {
    // 1. Dos callbacks concurrentes simultáneos
    const tx2 = await oidcService.createTransaction();
    createdTxIds.push(tx2.transactionId);

    const results2 = await Promise.allSettled([
      oidcService.consumeTransaction(tx2.transactionId, tx2.state),
      oidcService.consumeTransaction(tx2.transactionId, tx2.state),
    ]);

    const fulfilled2 = results2.filter((r) => r.status === "fulfilled");
    const rejected2 = results2.filter(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult[];

    expect(fulfilled2).toHaveLength(1);
    expect(rejected2).toHaveLength(1);
    expect(rejected2[0].reason).toBeInstanceOf(BadRequestException);
    expect(rejected2[0].reason.getStatus()).toBe(HttpStatus.BAD_REQUEST);

    // 2. Cinco callbacks concurrentes simultáneos
    const tx5 = await oidcService.createTransaction();
    createdTxIds.push(tx5.transactionId);

    const results5 = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        oidcService.consumeTransaction(tx5.transactionId, tx5.state),
      ),
    );

    const fulfilled5 = results5.filter((r) => r.status === "fulfilled");
    const rejected5 = results5.filter(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult[];

    expect(fulfilled5).toHaveLength(1);
    expect(rejected5).toHaveLength(4);
    for (const r of rejected5) {
      expect(r.reason).toBeInstanceOf(BadRequestException);
      expect(r.reason.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });

  it("OidcTransaction [Real HTTP Callback Concurrency]: two concurrent GET /api/auth/callback requests against real PostgreSQL must yield exactly one 200/302 and one 400 Bad Request (never 500)", async () => {
    const keyPair = generateTestRsaKeyPair("pg-int-kid-1");
    const issuer = "https://abogados-test.us.auth0.com/";
    const clientId = "test-auth0-client-id-for-automated-testing";

    const testOrg = await prisma.organization.create({
      data: { name: `Test Org HTTP Race ${Date.now()}` },
    });
    createdOrgIds.push(testOrg.id);

    const uniqueSub = `auth0|pg-race-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const testUser = await prisma.user.create({
      data: {
        email: `race.${Date.now()}-${crypto.randomBytes(4).toString("hex")}@abogados.com`,
        fullName: "Dr. Race Test",
        passwordHash: "$2b$04$testMockHash",
        role: UserRole.PARTNER,
        organizationId: testOrg.id,
      },
    });
    await prisma.userIdentity.create({
      data: {
        userId: testUser.id,
        issuer,
        subject: uniqueSub,
      },
    });

    const appModule: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [
            () => ({
              AUTH0_DOMAIN: "abogados-test.us.auth0.com",
              AUTH0_ISSUER_URL: issuer,
              AUTH0_AUDIENCE: "https://api.abogadoslaw.com",
              AUTH0_CLIENT_ID: clientId,
              AUTH0_CLIENT_SECRET: "test-client-secret-minimum-32-chars!",
              APP_ORIGIN: "http://localhost:3000",
              CSRF_SECRET: "test-csrf-hmac-secret-minimum-32-chars-long!",
              OIDC_TRANSACTION_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
            }),
          ],
        }),
      ],
      controllers: [BffController],
      providers: [
        OidcClientService,
        BffSessionService,
        CsrfService,
        JwksKeystoreService,
        BffSessionGuard,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    const app: INestApplication = appModule.createNestApplication();
    await app.init();

    try {
      const appOidc = appModule.get<OidcClientService>(OidcClientService);
      const appJwks = appModule.get<JwksKeystoreService>(JwksKeystoreService);
      appJwks.registerSigningKey(keyPair.kid, keyPair.publicKeyPem);

      const tx = await appOidc.createTransaction();
      createdTxIds.push(tx.transactionId);

      const validIdToken = createSignedTestJwt(
        {
          kid: keyPair.kid,
          issuer,
          audience: clientId,
          sub: uniqueSub,
          customClaims: { nonce: tx.nonce },
        },
        keyPair.privateKeyPem,
      );

      jest.spyOn(appOidc, "exchangeCodeForTokens").mockResolvedValue({
        idToken: validIdToken,
        accessToken: "at-pg-race",
        expiresIn: 3600,
      });

      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .get(`/api/auth/callback?code=code_ok&state=${tx.state}`)
          .set("Accept", "application/json")
          .set("Cookie", [`auth0_correlation=${tx.transactionId}`]),
        request(app.getHttpServer())
          .get(`/api/auth/callback?code=code_ok&state=${tx.state}`)
          .set("Accept", "application/json")
          .set("Cookie", [`auth0_correlation=${tx.transactionId}`]),
      ]);

      const statuses = [resA.status, resB.status].sort((a, b) => a - b);
      expect(statuses).toEqual([HttpStatus.OK, HttpStatus.BAD_REQUEST]);

      // Confirmar que se creó exactamente 1 UserSession en PostgreSQL real
      const sessions = await prisma.userSession.findMany({
        where: { userId: testUser.id },
      });
      expect(sessions).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("OidcTransaction [Expired & Invalid State]: should reject expired transactions and state mismatches on real PostgreSQL", async () => {
    // 1. Expirada en PostgreSQL
    const txExpired = await oidcService.createTransaction();
    createdTxIds.push(txExpired.transactionId);
    await prisma.oidcTransaction.update({
      where: { transactionId: txExpired.transactionId },
      data: { expiresAt: new Date(Date.now() - 5000) },
    });

    await expect(
      oidcService.consumeTransaction(txExpired.transactionId, txExpired.state),
    ).rejects.toThrow(/expired/i);

    // 2. State inválido en PostgreSQL
    const txBadState = await oidcService.createTransaction();
    createdTxIds.push(txBadState.transactionId);

    await expect(
      oidcService.consumeTransaction(
        txBadState.transactionId,
        "wrong-state-value",
      ),
    ).rejects.toThrow(/Invalid state/i);
  });

  it("OidcTransaction [Process Restart / Multi-Instance Recovery]: a fresh OidcClientService + PrismaClient instance must recover and consume pending transactions persisted before restart", async () => {
    // Instancia 1 (antes del reinicio)
    const prismaInstance1 = new PrismaClient({
      datasources: { db: { url: testDbUrl } },
    });
    await prismaInstance1.$connect();

    const serviceInstance1 = new OidcClientService(
      configService,
      prismaInstance1 as unknown as PrismaService,
    );
    const txBeforeRestart = await serviceInstance1.createTransaction();
    createdTxIds.push(txBeforeRestart.transactionId);

    // Simular apagado completo de Instancia 1
    await prismaInstance1.$disconnect();

    // Instancia 2 (nuevo proceso / instancia distinta)
    const prismaInstance2 = new PrismaClient({
      datasources: { db: { url: testDbUrl } },
    });
    await prismaInstance2.$connect();

    try {
      const serviceInstance2 = new OidcClientService(
        configService,
        prismaInstance2 as unknown as PrismaService,
      );

      const recovered = await serviceInstance2.consumeTransaction(
        txBeforeRestart.transactionId,
        txBeforeRestart.state,
      );

      expect(recovered.transactionId).toBe(txBeforeRestart.transactionId);
      expect(recovered.codeVerifier).toBe(txBeforeRestart.codeVerifier);
      expect(recovered.nonce).toBe(txBeforeRestart.nonce);
      expect(recovered.state).toBe(txBeforeRestart.state);
    } finally {
      await prismaInstance2.$disconnect();
    }
  });
});
