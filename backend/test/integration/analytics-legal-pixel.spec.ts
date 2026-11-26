/**
 * FRONTEND-LEGALPIXEL-CONNECTION-REMEDIATION-001
 * Prueba de integración TDS-LP-008 sobre PostgreSQL 18 real (abogados_test / abogados_app_user)
 *
 * Verifica el contrato completo de POST /events/collect con el payload exacto emitido por LegalPixel:
 * - Con backend activo, sesión BFF válida, X-CSRF-Token, firma HMAC-SHA256 (sin X-Org-Id y sin organizationId en body) -> 201 y EventLog persistido con organizationId derivado de sesión.
 * - Sin sesión BFF -> 401 Unauthorized.
 * - Sin X-CSRF-Token -> 403 Forbidden.
 * - Con organizationId manipulado en body -> 403 ORGANIZATION_CONTEXT_MISMATCH.
 */

import {
  PrismaClient,
  OrganizationRole,
  MembershipStatus,
  OrganizationStatus,
  UserRole,
} from "@prisma/client";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import * as crypto from "crypto";

import { assertSafeTestDatabaseUrl } from "../helpers/db-guard";
import { PrismaService } from "../../src/prisma.service";
import { AuthModule } from "../../src/auth/auth.module";
import { AuthzModule } from "../../src/authz/authz.module";
import { OrganizationsModule } from "../../src/organizations/organizations.module";
import { AnalyticsModule } from "../../src/analytics/analytics.module";
import { SecurityCoreModule } from "../../src/core/security/security-core.module";
import { BffSessionService } from "../../src/auth/bff/bff-session.service";
import { CsrfService } from "../../src/auth/bff/csrf.service";

describe("TDS-LP-008 — Contrato real de POST /events/collect (LegalPixel ↔ Backend)", () => {
  let app: INestApplication;
  let adminPrisma: PrismaClient;
  let appPrisma: PrismaClient;
  let sessionService: BffSessionService;
  let csrfService: CsrfService;

  const APP_ORIGIN = "http://localhost:3000";
  const PIXEL_SECRET =
    process.env.PIXEL_HMAC_SECRET ||
    "test-pixel-hmac-secret-minimum-32-chars-long!!";
  const FORENSIC_KEY =
    process.env.FORENSIC_KEY ||
    "test-forensic-key-minimum-32-chars-for-testing!";
  const TEST_ENCRYPTION_KEY =
    process.env.OIDC_TRANSACTION_ENCRYPTION_KEY ||
    "9059d7b7e25d3c8c6de1cb0dc62232e3692c26404b1c2cdaecc19e559ef16a0c";

  const adminDbUrl =
    process.env.MIGRATION_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/abogados_test?schema=public";
  const appRuntimeDbUrl = process.env.APP_RUNTIME_DATABASE_URL || "";

  const runTag = `lp01-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

  let orgAId: string;
  let orgBId: string;
  let userId: string;
  let rawSessionSecret: string;
  let csrfToken: string;

  beforeAll(async () => {
    assertSafeTestDatabaseUrl(adminDbUrl);
    assertSafeTestDatabaseUrl(appRuntimeDbUrl);

    adminPrisma = new PrismaClient({
      datasources: { db: { url: adminDbUrl } },
    });
    await adminPrisma.$connect();

    appPrisma = new PrismaClient({
      datasources: { db: { url: appRuntimeDbUrl } },
    });
    await appPrisma.$connect();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [
            () => ({
              NODE_ENV: "test",
              DATABASE_URL: appRuntimeDbUrl,
              AUTH0_DOMAIN: "abogados-test.us.auth0.com",
              AUTH0_ISSUER_URL: "https://abogados-test.us.auth0.com/",
              AUTH0_AUDIENCE: "https://api.abogadoslaw.com",
              AUTH0_CLIENT_ID: "test-auth0-client-id-for-automated-testing",
              AUTH0_CLIENT_SECRET: "test-client-secret-minimum-32-chars!",
              APP_ORIGIN,
              CSRF_SECRET: "test-csrf-hmac-secret-minimum-32-chars-long!",
              PIXEL_HMAC_SECRET: PIXEL_SECRET,
              FORENSIC_KEY,
              OIDC_TRANSACTION_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
            }),
          ],
        }),
        SecurityCoreModule,
        AuthzModule,
        AuthModule,
        OrganizationsModule,
        AnalyticsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(appPrisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    sessionService = moduleRef.get<BffSessionService>(BffSessionService);
    csrfService = moduleRef.get<CsrfService>(CsrfService);

    const orgA = await adminPrisma.organization.create({
      data: { name: `Org LP A ${runTag}`, status: OrganizationStatus.ACTIVE },
    });
    const orgB = await adminPrisma.organization.create({
      data: { name: `Org LP B ${runTag}`, status: OrganizationStatus.ACTIVE },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const email = `lp-user-${runTag}@abogados-test.com`;
    const user = await adminPrisma.user.create({
      data: {
        email,
        fullName: "LegalPixel Test User",
        passwordHash: "$2b$04$testMockHashNeverExposed",
        role: UserRole.ASSOCIATE,
        organizationId: orgAId,
      },
    });
    userId = user.id;

    await adminPrisma.userIdentity.create({
      data: {
        userId,
        issuer: "https://abogados-test.us.auth0.com/",
        subject: `auth0|lp-${runTag}`,
        authEmail: email,
      },
    });

    await adminPrisma.organizationMembership.create({
      data: {
        userId,
        organizationId: orgAId,
        role: OrganizationRole.LAWYER,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date(),
      },
    });

    const created = await sessionService.createSession(userId);
    rawSessionSecret = created.rawSessionSecret;
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawSessionSecret)
      .digest("hex");
    await adminPrisma.userSession.update({
      where: { sessionToken: tokenHash },
      data: { activeOrganizationId: orgAId },
    });
    csrfToken = csrfService.generateToken(rawSessionSecret);
  });

  afterAll(async () => {
    if (app) await app.close();
    if (adminPrisma) {
      await adminPrisma.eventLog.deleteMany({
        where: { organizationId: { in: [orgAId, orgBId] } },
      });
      await adminPrisma.organizationMembership.deleteMany({
        where: { userId },
      });
      await adminPrisma.userIdentity.deleteMany({ where: { userId } });
      await adminPrisma.userSession.deleteMany({ where: { userId } });
      await adminPrisma.user.deleteMany({ where: { id: userId } });
      await adminPrisma.organization.deleteMany({
        where: { id: { in: [orgAId, orgBId] } },
      });
      await adminPrisma.$disconnect();
    }
    if (appPrisma) await appPrisma.$disconnect();
  });

  const signBody = (body: Record<string, unknown>) => {
    const timestamp = String(Date.now());
    const nonce = crypto.randomBytes(8).toString("hex");
    const bodyString = JSON.stringify(body);
    const signature = crypto
      .createHmac("sha256", PIXEL_SECRET)
      .update("" + timestamp + nonce + bodyString)
      .digest("hex");
    return { timestamp, nonce, signature };
  };

  it("TDS-LP-008a: Con backend activo y sesión BFF válida, evento sin organizationId se persiste bajo la organización activa", async () => {
    const body = {
      actorType: "USER",
      eventType: "VIEW_PAGE",
      payload: { path: `/expedientes-${runTag}` },
      timestamp: new Date().toISOString(),
    };
    const { timestamp, nonce, signature } = signBody(body);

    const res = await request(app.getHttpServer())
      .post("/events/collect")
      .set("Cookie", [
        `app_session=${rawSessionSecret}`,
        `csrf_token=${csrfToken}`,
      ])
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", csrfToken)
      .set("X-Timestamp", timestamp)
      .set("X-Nonce", nonce)
      .set("X-Signature", signature)
      .send(body);

    expect({ status: res.status, body: res.body }).toEqual({
      status: 201,
      body: { status: "ok" },
    });

    const persisted = await adminPrisma.eventLog.findFirst({
      where: {
        organizationId: orgAId,
        actorId: userId,
        eventType: "VIEW_PAGE",
      },
      orderBy: { timestamp: "desc" },
    });
    expect(persisted).not.toBeNull();
    expect(persisted?.organizationId).toBe(orgAId);
    expect(persisted?.actorId).toBe(userId);
  });

  it("TDS-LP-008b: Sin sesión BFF retorna 401 Unauthorized", async () => {
    const body = { actorType: "USER", eventType: "VIEW_PAGE" };
    const { timestamp, nonce, signature } = signBody(body);

    await request(app.getHttpServer())
      .post("/events/collect")
      .set("Origin", APP_ORIGIN)
      .set("X-Timestamp", timestamp)
      .set("X-Nonce", nonce)
      .set("X-Signature", signature)
      .send(body)
      .expect(401);
  });

  it("TDS-LP-008c: Sin X-CSRF-Token retorna 403 Forbidden (CSRF intacto)", async () => {
    const body = { actorType: "USER", eventType: "VIEW_PAGE" };
    const { timestamp, nonce, signature } = signBody(body);

    await request(app.getHttpServer())
      .post("/events/collect")
      .set("Cookie", [
        `app_session=${rawSessionSecret}`,
        `csrf_token=${csrfToken}`,
      ])
      .set("Origin", APP_ORIGIN)
      .set("X-Timestamp", timestamp)
      .set("X-Nonce", nonce)
      .set("X-Signature", signature)
      .send(body)
      .expect(403);
  });

  it("TDS-LP-008d: Manipulación de organizationId en body retorna 403 ORGANIZATION_CONTEXT_MISMATCH", async () => {
    const body = {
      actorType: "USER",
      eventType: "VIEW_PAGE",
      organizationId: orgBId,
    };
    const { timestamp, nonce, signature } = signBody(body);

    const res = await request(app.getHttpServer())
      .post("/events/collect")
      .set("Cookie", [
        `app_session=${rawSessionSecret}`,
        `csrf_token=${csrfToken}`,
      ])
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", csrfToken)
      .set("X-Timestamp", timestamp)
      .set("X-Nonce", nonce)
      .set("X-Signature", signature)
      .send(body)
      .expect(403);

    expect(JSON.stringify(res.body)).toContain("ORGANIZATION_CONTEXT_MISMATCH");
  });
});
