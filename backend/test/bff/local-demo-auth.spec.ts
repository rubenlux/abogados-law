/**
 * Suite TDS — AUTH-LOCAL-DEMO-SESSION-FIX-001
 * Login Demo Local de Desarrollo integrado al BFF (AUTH-01..AUTH-10 intactos).
 *
 * IMPORTANTE: Utiliza Prisma en memoria (mock stateful), nunca modifica ni toca `abogados_test`.
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
} from "@nestjs/common";
import * as request from "supertest";
import { ConfigService } from "@nestjs/config";
import {
  MembershipStatus,
  OrganizationRole,
  OrganizationStatus,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../src/prisma.service";
import { BffController } from "../../src/auth/bff/bff.controller";
import { OidcClientService } from "../../src/auth/bff/oidc-client.service";
import { BffSessionService } from "../../src/auth/bff/bff-session.service";
import { CsrfService } from "../../src/auth/bff/csrf.service";
import { JwksKeystoreService } from "../../src/auth/services/jwks-keystore.service";
import { BffSessionGuard } from "../../src/auth/guards/bff-session.guard";
import { CsrfGuard } from "../../src/auth/guards/csrf.guard";
import { ActiveOrgContextGuard } from "../../src/authz/guards/active-org-context.guard";
import { OrgPermissionGuard } from "../../src/authz/guards/org-permission.guard";
import { RequireOrgPermissions } from "../../src/authz/decorators/require-org-permissions.decorator";
import { ScopedPrismaService } from "../../src/authz/scoped-prisma.service";

const DEMO_ISSUER = "https://local-demo.abogados.internal/";
const DEMO_SUBJECT = "local-demo|socio-principal";
const DEMO_ORG_A_ID = "org-demo-a-0000-0000-0000-000000000001";
const OTHER_ORG_B_ID = "org-other-b-0000-0000-0000-000000000002";
const DEMO_USER_ID = "usr-demo-0000-0000-0000-000000000001";
const DEMO_MEMBERSHIP_ID = "mem-demo-0000-0000-0000-000000000001";

@Controller("api/test-demo-protected")
@UseGuards(BffSessionGuard, ActiveOrgContextGuard, OrgPermissionGuard)
class TestProtectedModulesController {
  constructor(private readonly scopedPrisma: ScopedPrismaService) {}

  @Get("clients")
  @RequireOrgPermissions("clients:read")
  getClients(@Req() req: any) {
    return this.scopedPrisma.runInOrgContext(
      req.orgContext,
      async (tx: any) => {
        const items = await tx.client.findMany();
        return {
          organizationId: req.orgContext.organizationId,
          orgRole: req.orgContext.orgRole,
          items,
        };
      },
    );
  }

  @Get("ia-legal")
  @RequireOrgPermissions("legal_ai:read", "ai:use", "legal_drafts:read")
  getIaLegal(@Req() req: any) {
    return {
      status: "ok",
      organizationId: req.orgContext.organizationId,
      orgRole: req.orgContext.orgRole,
    };
  }

  @Post("ia-legal/mutate")
  @UseGuards(CsrfGuard)
  @RequireOrgPermissions("legal_ai:write", "legal_drafts:write")
  mutateIaLegal(@Req() req: any) {
    return {
      status: "mutated",
      organizationId: req.orgContext.organizationId,
    };
  }

  @Post("owner-only-status")
  @UseGuards(CsrfGuard)
  @RequireOrgPermissions("org:manage_status", "org:transfer_ownership")
  ownerOnly(@Req() req: any) {
    return {
      status: "owner_action_executed",
      organizationId: req.orgContext.organizationId,
    };
  }
}

interface StatefulDemoDb {
  users: Map<string, any>;
  identities: Map<string, any>;
  organizations: Map<string, any>;
  memberships: Map<string, any>;
  sessionsByHash: Map<string, any>;
  sessionsById: Map<string, any>;
  clients: Array<{ id: string; organizationId: string; name: string }>;
  activeRlsOrgId: string | null;
}

function createStatefulDemoPrismaMock() {
  const db: StatefulDemoDb = {
    users: new Map(),
    identities: new Map(),
    organizations: new Map(),
    memberships: new Map(),
    sessionsByHash: new Map(),
    sessionsById: new Map(),
    clients: [
      { id: "cli-a-1", organizationId: DEMO_ORG_A_ID, name: "Cliente Org A" },
      { id: "cli-b-1", organizationId: OTHER_ORG_B_ID, name: "Cliente Org B" },
    ],
    activeRlsOrgId: null,
  };

  const orgA = {
    id: DEMO_ORG_A_ID,
    name: "Estudio Jurídico Demo",
    tradeName: "Estudio Demo",
    cuit: "30-71000000-9",
    status: OrganizationStatus.ACTIVE,
    plan: "PRO",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const orgB = {
    id: OTHER_ORG_B_ID,
    name: "Otro Estudio Aislado",
    tradeName: "Estudio B",
    cuit: "30-72000000-8",
    status: OrganizationStatus.ACTIVE,
    plan: "PRO",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  db.organizations.set(orgA.id, orgA);
  db.organizations.set(orgB.id, orgB);

  const demoUser = {
    id: DEMO_USER_ID,
    email: "socio.demo@estudio.local",
    passwordHash:
      "$2b$10$LOCALDEMONONUSABLEPASSWORDHASH0000000000000000000000000",
    fullName: "Dr. Socio Demo",
    role: UserRole.ASSOCIATE, // Legacy field deliberately NOT matching orgRole
    permissions: null,
    refreshTokenHash: null,
    organizationId: OTHER_ORG_B_ID, // Legacy field deliberately pointing to wrong org (must be ignored!)
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  db.users.set(demoUser.id, demoUser);

  const demoIdentity = {
    id: "id-demo-0001",
    userId: demoUser.id,
    issuer: DEMO_ISSUER,
    subject: DEMO_SUBJECT,
    provider: "local-demo",
    authEmail: demoUser.email,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    lastUsedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  db.identities.set(`${DEMO_ISSUER}|${DEMO_SUBJECT}`, demoIdentity);

  const demoMembership = {
    id: DEMO_MEMBERSHIP_ID,
    userId: demoUser.id,
    organizationId: DEMO_ORG_A_ID,
    role: OrganizationRole.ORG_ADMIN,
    status: MembershipStatus.ACTIVE,
    joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    revokedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  db.memberships.set(`${demoUser.id}|${DEMO_ORG_A_ID}`, demoMembership);

  let sessionSeq = 1;

  const prismaMock: any = {
    __db: db,
    user: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where?.id) return db.users.get(where.id) || null;
        if (where?.email) {
          for (const u of db.users.values()) {
            if (u.email === where.email) return u;
          }
        }
        return null;
      }),
    },
    userIdentity: {
      findUnique: jest.fn(async ({ where, include }: any) => {
        const key = `${where?.issuer_subject?.issuer}|${where?.issuer_subject?.subject}`;
        const identity = db.identities.get(key);
        if (!identity) return null;
        return include?.user
          ? { ...identity, user: db.users.get(identity.userId) || null }
          : identity;
      }),
    },
    organizationMembership: {
      findUnique: jest.fn(async ({ where, include }: any) => {
        const key = `${where?.userId_organizationId?.userId}|${where?.userId_organizationId?.organizationId}`;
        const mem = db.memberships.get(key);
        if (!mem) return null;
        return include?.organization
          ? {
              ...mem,
              organization: db.organizations.get(mem.organizationId) || null,
            }
          : mem;
      }),
      findFirst: jest.fn(async ({ where, include }: any) => {
        for (const mem of db.memberships.values()) {
          if (where?.userId && mem.userId !== where.userId) continue;
          if (where?.status && mem.status !== where.status) continue;
          const org = db.organizations.get(mem.organizationId);
          if (
            where?.organization?.status &&
            org?.status !== where.organization.status
          ) {
            continue;
          }
          return include?.organization
            ? { ...mem, organization: org || null }
            : mem;
        }
        return null;
      }),
    },
    userSession: {
      create: jest.fn(async ({ data }: any) => {
        const created = {
          id: `ses-demo-${sessionSeq++}`,
          userId: data.userId,
          activeOrganizationId: data.activeOrganizationId ?? null,
          sessionToken: data.sessionToken,
          sessionVersion: data.sessionVersion ?? 1,
          auth0Sid: data.auth0Sid ?? null,
          deviceInfo: data.deviceInfo ?? null,
          ipAddress: data.ipAddress ?? null,
          expiresAt: data.expiresAt,
          idleExpiresAt: data.idleExpiresAt,
          revokedAt: null,
          createdAt: new Date(),
          lastActiveAt: data.lastActiveAt ?? new Date(),
        };
        db.sessionsByHash.set(created.sessionToken, created);
        db.sessionsById.set(created.id, created);
        return created;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where?.sessionToken) {
          return db.sessionsByHash.get(where.sessionToken) || null;
        }
        if (where?.id) {
          return db.sessionsById.get(where.id) || null;
        }
        return null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const existing = db.sessionsById.get(where.id);
        if (!existing) throw new Error("Session not found");
        const updated = { ...existing, ...data };
        db.sessionsById.set(updated.id, updated);
        db.sessionsByHash.set(updated.sessionToken, updated);
        return updated;
      }),
    },
    client: {
      findMany: jest.fn(async () => {
        if (!db.activeRlsOrgId) return [];
        return db.clients.filter((c) => c.organizationId === db.activeRlsOrgId);
      }),
    },
    $executeRaw: jest.fn(
      async (strings: TemplateStringsArray, ...values: any[]) => {
        const sql = Array.isArray(strings)
          ? strings.join(" ")
          : String(strings);
        if (sql.includes("app.current_organization_id") && values[0]) {
          db.activeRlsOrgId = String(values[0]);
        }
        return 1;
      },
    ),
    $transaction: jest.fn(async (cb: any) => {
      const prevOrg = db.activeRlsOrgId;
      try {
        return await cb(prismaMock);
      } finally {
        db.activeRlsOrgId = prevOrg;
      }
    }),
  };

  return prismaMock;
}

function parseCookieHeader(
  setCookies: string[] | string | undefined,
  name: string,
): string | null {
  const arr = Array.isArray(setCookies)
    ? setCookies
    : setCookies
      ? [setCookies]
      : [];
  return arr.find((c) => c.startsWith(`${name}=`)) ?? null;
}

function extractCookieValue(cookieLine: string | null): string {
  if (!cookieLine) return "";
  return decodeURIComponent(
    cookieLine.split(";")[0].split("=").slice(1).join("="),
  );
}

async function buildTestApp(envOverrides: Record<string, string | undefined>) {
  const prismaMock = createStatefulDemoPrismaMock();
  const configValues: Record<string, string | undefined> = {
    NODE_ENV: "development",
    LOCAL_DEMO_AUTH_ENABLED: "false",
    APP_ORIGIN: "http://localhost:5173",
    CORS_ALLOWED_ORIGINS: "http://localhost:5173",
    CSRF_SECRET: "test-csrf-hmac-secret-minimum-32-chars-long!",
    OIDC_TRANSACTION_ENCRYPTION_KEY:
      "9059d7b7e25d3c8c6de1cb0dc62232e3692c26404b1c2cdaecc19e559ef16a0c",
    AUTH0_DOMAIN: "abogados-test.us.auth0.com",
    AUTH0_ISSUER_URL: "https://abogados-test.us.auth0.com/",
    AUTH0_CLIENT_ID: "test-client-id-123",
    AUTH0_CLIENT_SECRET: "test-client-secret-minimum-32-chars!",
    ...envOverrides,
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const val = configValues[key];
      return val !== undefined ? val : defaultValue;
    }),
  };

  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [BffController, TestProtectedModulesController],
    providers: [
      OidcClientService,
      BffSessionService,
      CsrfService,
      JwksKeystoreService,
      BffSessionGuard,
      CsrfGuard,
      ActiveOrgContextGuard,
      OrgPermissionGuard,
      ScopedPrismaService,
      { provide: ConfigService, useValue: mockConfigService },
      { provide: PrismaService, useValue: prismaMock },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return { app, prismaMock, moduleRef };
}

describe("TDS — AUTH-LOCAL-DEMO-SESSION-FIX-001 (Backend BFF Local Demo Auth)", () => {
  const appsToClose: INestApplication[] = [];

  afterEach(async () => {
    while (appsToClose.length > 0) {
      const app = appsToClose.pop();
      if (app) await app.close();
    }
    jest.restoreAllMocks();
  });

  it("TDS-DEMO-001: Login Demo habilitado en development crea sesión BFF persistida (hash SHA-256) y no duplica usuario/organización", async () => {
    const { app, prismaMock } = await buildTestApp({
      NODE_ENV: "development",
      LOCAL_DEMO_AUTH_ENABLED: "true",
    });
    appsToClose.push(app);

    const res1 = await request(app.getHttpServer())
      .post("/api/auth/local-demo-login")
      .set("Origin", "http://localhost:5173")
      .expect(HttpStatus.OK);

    expect(res1.body.status).toBe("authenticated");
    expect(res1.body.activeOrganizationId).toBe(DEMO_ORG_A_ID);
    expect(res1.body.user.id).toBe(DEMO_USER_ID);
    expect(res1.body.user.orgRole).toBe(OrganizationRole.ORG_ADMIN);

    const rawSessionCookie1 = extractCookieValue(
      parseCookieHeader(res1.header["set-cookie"], "app_session"),
    );
    expect(rawSessionCookie1).toHaveLength(64);

    // Sesión persistida SOLO como hash (nunca secreto en claro)
    expect(prismaMock.__db.sessionsByHash.size).toBe(1);
    const storedSession = Array.from(
      prismaMock.__db.sessionsByHash.values(),
    )[0] as any;
    expect(storedSession.sessionToken).toHaveLength(64);
    expect(storedSession.sessionToken).not.toBe(rawSessionCookie1);
    expect(storedSession.activeOrganizationId).toBe(DEMO_ORG_A_ID);

    // Segundo login no duplica usuario ni organización
    await request(app.getHttpServer())
      .post("/api/auth/local-demo-login")
      .set("Origin", "http://localhost:5173")
      .expect(HttpStatus.OK);

    expect(prismaMock.__db.users.size).toBe(1);
    expect(prismaMock.__db.organizations.size).toBe(2);
    expect(prismaMock.__db.sessionsByHash.size).toBe(2);
  });

  it("TDS-DEMO-002: Login Demo deshabilitado (LOCAL_DEMO_AUTH_ENABLED=false o ausente) es rechazado sin crear sesión", async () => {
    const { app, prismaMock } = await buildTestApp({
      NODE_ENV: "development",
      LOCAL_DEMO_AUTH_ENABLED: "false",
    });
    appsToClose.push(app);

    const res = await request(app.getHttpServer())
      .post("/api/auth/local-demo-login")
      .set("Origin", "http://localhost:5173");

    expect([HttpStatus.NOT_FOUND, HttpStatus.FORBIDDEN]).toContain(res.status);
    expect(
      parseCookieHeader(res.header["set-cookie"], "app_session"),
    ).toBeNull();
    expect(prismaMock.__db.sessionsByHash.size).toBe(0);
  });

  it("TDS-DEMO-003: Login Demo en production es rechazado incluso si LOCAL_DEMO_AUTH_ENABLED=true", async () => {
    const { app, prismaMock } = await buildTestApp({
      NODE_ENV: "production",
      LOCAL_DEMO_AUTH_ENABLED: "true",
    });
    appsToClose.push(app);

    const res = await request(app.getHttpServer())
      .post("/api/auth/local-demo-login")
      .set("Origin", "http://localhost:5173");

    expect([HttpStatus.NOT_FOUND, HttpStatus.FORBIDDEN]).toContain(res.status);
    expect(
      parseCookieHeader(res.header["set-cookie"], "app_session"),
    ).toBeNull();
    expect(prismaMock.__db.sessionsByHash.size).toBe(0);
  });

  it("TDS-DEMO-004: Emite cookies app_session (HttpOnly) y csrf_token con atributos SameSite=Lax y Path=/", async () => {
    const { app } = await buildTestApp({
      NODE_ENV: "development",
      LOCAL_DEMO_AUTH_ENABLED: "true",
    });
    appsToClose.push(app);

    const res = await request(app.getHttpServer())
      .post("/api/auth/local-demo-login")
      .set("Origin", "http://localhost:5173")
      .expect(HttpStatus.OK);

    const appSessionLine = parseCookieHeader(
      res.header["set-cookie"],
      "app_session",
    );
    const csrfLine = parseCookieHeader(res.header["set-cookie"], "csrf_token");

    expect(appSessionLine).toBeDefined();
    expect(appSessionLine).toMatch(/HttpOnly/i);
    expect(appSessionLine).toMatch(/SameSite=Lax/i);
    expect(appSessionLine).toMatch(/Path=\//i);

    expect(csrfLine).toBeDefined();
    expect(csrfLine).not.toMatch(/HttpOnly/i);
    expect(csrfLine).toMatch(/SameSite=Lax/i);
    expect(csrfLine).toMatch(/Path=\//i);

    const csrfVal = extractCookieValue(csrfLine);
    expect(csrfVal).toMatch(/^[0-9a-f]{32}\.[0-9a-f]{64}$/i);
  });

  it("TDS-DEMO-005: Sesión emitida es aceptada por BffSessionGuard, ActiveOrgContextGuard, OrgPermissionGuard y CsrfGuard", async () => {
    const { app } = await buildTestApp({
      NODE_ENV: "development",
      LOCAL_DEMO_AUTH_ENABLED: "true",
    });
    appsToClose.push(app);

    const loginRes = await request(app.getHttpServer())
      .post("/api/auth/local-demo-login")
      .set("Origin", "http://localhost:5173")
      .expect(HttpStatus.OK);

    const appSession = extractCookieValue(
      parseCookieHeader(loginRes.header["set-cookie"], "app_session"),
    );
    const csrfToken = extractCookieValue(
      parseCookieHeader(loginRes.header["set-cookie"], "csrf_token"),
    );

    // GET protegido (IA Legal)
    const iaRes = await request(app.getHttpServer())
      .get("/api/test-demo-protected/ia-legal")
      .set("Cookie", [`app_session=${appSession}`])
      .expect(HttpStatus.OK);

    expect(iaRes.body.organizationId).toBe(DEMO_ORG_A_ID);
    expect(iaRes.body.orgRole).toBe(OrganizationRole.ORG_ADMIN);

    // POST protegido con CSRF válido
    await request(app.getHttpServer())
      .post("/api/test-demo-protected/ia-legal/mutate")
      .set("Origin", "http://localhost:5173")
      .set("Cookie", [`app_session=${appSession}`])
      .set("X-CSRF-Token", csrfToken)
      .expect(HttpStatus.CREATED);

    // POST protegido sin CSRF -> 403 (CsrfGuard intacto)
    await request(app.getHttpServer())
      .post("/api/test-demo-protected/ia-legal/mutate")
      .set("Origin", "http://localhost:5173")
      .set("Cookie", [`app_session=${appSession}`])
      .expect(HttpStatus.FORBIDDEN);

    // demo-token nunca es aceptado por BffSessionGuard
    await request(app.getHttpServer())
      .get("/api/test-demo-protected/ia-legal")
      .set("Authorization", "Bearer demo-token")
      .set("Cookie", ["app_session=demo-token"])
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it("TDS-DEMO-006: Sesión revocada (logout) o vencida es rechazada con 401 Unauthorized", async () => {
    const { app, prismaMock } = await buildTestApp({
      NODE_ENV: "development",
      LOCAL_DEMO_AUTH_ENABLED: "true",
    });
    appsToClose.push(app);

    const loginRes = await request(app.getHttpServer())
      .post("/api/auth/local-demo-login")
      .set("Origin", "http://localhost:5173")
      .expect(HttpStatus.OK);

    const appSession = extractCookieValue(
      parseCookieHeader(loginRes.header["set-cookie"], "app_session"),
    );

    // Logout revoca la sesión en PostgreSQL
    await request(app.getHttpServer())
      .post("/api/auth/logout")
      .set("Cookie", [`app_session=${appSession}`])
      .expect(HttpStatus.OK);

    await request(app.getHttpServer())
      .get("/api/test-demo-protected/ia-legal")
      .set("Cookie", [`app_session=${appSession}`])
      .expect(HttpStatus.UNAUTHORIZED);

    // Nuevo login y expiración por inactividad -> 401
    const loginRes2 = await request(app.getHttpServer())
      .post("/api/auth/local-demo-login")
      .set("Origin", "http://localhost:5173")
      .expect(HttpStatus.OK);

    const appSession2 = extractCookieValue(
      parseCookieHeader(loginRes2.header["set-cookie"], "app_session"),
    );

    for (const s of prismaMock.__db.sessionsById.values()) {
      s.idleExpiresAt = new Date(Date.now() - 60_000);
    }

    await request(app.getHttpServer())
      .get("/api/test-demo-protected/ia-legal")
      .set("Cookie", [`app_session=${appSession2}`])
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it("TDS-DEMO-007: Usuario sin membresía activa es rechazado (403 Forbidden)", async () => {
    const { app, prismaMock } = await buildTestApp({
      NODE_ENV: "development",
      LOCAL_DEMO_AUTH_ENABLED: "true",
    });
    appsToClose.push(app);

    // Suspender membresía
    const mem = prismaMock.__db.memberships.get(
      `${DEMO_USER_ID}|${DEMO_ORG_A_ID}`,
    );
    mem.status = MembershipStatus.SUSPENDED;

    const res = await request(app.getHttpServer())
      .post("/api/auth/local-demo-login")
      .set("Origin", "http://localhost:5173")
      .expect(HttpStatus.FORBIDDEN);

    expect(
      parseCookieHeader(res.header["set-cookie"], "app_session"),
    ).toBeNull();
    expect(prismaMock.__db.sessionsByHash.size).toBe(0);
  });

  it("TDS-DEMO-008: Contexto de organización y RLS aíslan Org A de Org B", async () => {
    const { app } = await buildTestApp({
      NODE_ENV: "development",
      LOCAL_DEMO_AUTH_ENABLED: "true",
    });
    appsToClose.push(app);

    const loginRes = await request(app.getHttpServer())
      .post("/api/auth/local-demo-login")
      .set("Origin", "http://localhost:5173")
      .expect(HttpStatus.OK);

    const appSession = extractCookieValue(
      parseCookieHeader(loginRes.header["set-cookie"], "app_session"),
    );

    // Consulta clientes: solo ve Org A (nunca Org B)
    const clientsRes = await request(app.getHttpServer())
      .get("/api/test-demo-protected/clients")
      .set("Cookie", [`app_session=${appSession}`])
      .expect(HttpStatus.OK);

    expect(clientsRes.body.organizationId).toBe(DEMO_ORG_A_ID);
    expect(clientsRes.body.items).toHaveLength(1);
    expect(clientsRes.body.items[0].id).toBe("cli-a-1");

    // Intento de suplantación cross-tenant vía header x-org-id -> 403
    await request(app.getHttpServer())
      .get("/api/test-demo-protected/clients")
      .set("Cookie", [`app_session=${appSession}`])
      .set("x-org-id", OTHER_ORG_B_ID)
      .expect(HttpStatus.FORBIDDEN);
  });

  it("TDS-DEMO-009: No permite elevar privilegios ni suplantar organización vía parámetros del frontend", async () => {
    const { app } = await buildTestApp({
      NODE_ENV: "development",
      LOCAL_DEMO_AUTH_ENABLED: "true",
    });
    appsToClose.push(app);

    // Enviar role/organizationId/userId en body -> rechazado 400
    await request(app.getHttpServer())
      .post("/api/auth/local-demo-login")
      .set("Origin", "http://localhost:5173")
      .send({ role: "ORG_OWNER", organizationId: OTHER_ORG_B_ID })
      .expect(HttpStatus.BAD_REQUEST);

    // Login limpio: usuario Demo tiene ORG_ADMIN, NO ORG_OWNER (no puede ejecutar acciones owner-only)
    const loginRes = await request(app.getHttpServer())
      .post("/api/auth/local-demo-login")
      .set("Origin", "http://localhost:5173")
      .expect(HttpStatus.OK);

    const appSession = extractCookieValue(
      parseCookieHeader(loginRes.header["set-cookie"], "app_session"),
    );
    const csrfToken = extractCookieValue(
      parseCookieHeader(loginRes.header["set-cookie"], "csrf_token"),
    );

    await request(app.getHttpServer())
      .post("/api/test-demo-protected/owner-only-status")
      .set("Origin", "http://localhost:5173")
      .set("Cookie", [`app_session=${appSession}`])
      .set("X-CSRF-Token", csrfToken)
      .expect(HttpStatus.FORBIDDEN);
  });

  it("TDS-DEMO-010: No filtra secretos de sesión, passwordHash ni cookies en respuestas JSON ni en logs", async () => {
    const { app } = await buildTestApp({
      NODE_ENV: "development",
      LOCAL_DEMO_AUTH_ENABLED: "true",
    });
    appsToClose.push(app);

    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const loginRes = await request(app.getHttpServer())
      .post("/api/auth/local-demo-login")
      .set("Origin", "http://localhost:5173")
      .expect(HttpStatus.OK);

    const appSession = extractCookieValue(
      parseCookieHeader(loginRes.header["set-cookie"], "app_session"),
    );
    const csrfToken = extractCookieValue(
      parseCookieHeader(loginRes.header["set-cookie"], "csrf_token"),
    );

    const bodyStr = JSON.stringify(loginRes.body);
    expect(bodyStr).not.toContain(appSession);
    expect(bodyStr).not.toContain(csrfToken);
    expect(bodyStr).not.toContain("passwordHash");
    expect(bodyStr).not.toContain("sessionToken");
    expect(bodyStr).not.toContain("refreshTokenHash");
    expect(bodyStr).not.toContain("access_token");

    const allLogs = [
      ...logSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errSpy.mock.calls,
    ]
      .flat()
      .map(String)
      .join("\n");

    expect(allLogs).not.toContain(appSession);
    expect(allLogs).not.toContain(csrfToken);
    expect(allLogs).not.toContain("LOCALDEMONONUSABLEPASSWORDHASH");
  });
});
