/**
 * Suite de Pruebas TDS (Unitaria + HTTP Contract) para AUTH-03:
 * Organizaciones, Membresías, Roles Multi-Organización, Invitaciones, Organización Activa y Auditoría.
 *
 * Especificación: SPEC-AUTH-001 v1.0.8 | Expediente: AUTH0-IMPLEMENTATION-007
 * Cobertura completa del Catálogo Fase 1 (TST-ORG, TST-MEM, TST-ROL, TST-INV, TST-ACT, TST-SEC).
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, HttpStatus, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { ConfigModule } from "@nestjs/config";
import * as crypto from "crypto";
import {
  OrganizationStatus,
  OrganizationRole,
  MembershipStatus,
  InvitationStatus,
} from "@prisma/client";

import { PrismaService } from "../../src/prisma.service";
import { AuthModule } from "../../src/auth/auth.module";
import { CsrfService } from "../../src/auth/bff/csrf.service";
import { OrganizationsModule } from "../../src/organizations/organizations.module";
import {
  createFixtureUser,
  createFixtureUserIdentity,
  createFixtureUserSession,
} from "../fixtures/user.fixture";

/**
 * In-memory deterministic Prisma double for HTTP contract & business rule testing of AUTH-03.
 * Real PostgreSQL constraints, transactions & concurrency are additionally verified in
 * test/integration/auth03-db.spec.ts against real PostgreSQL 18 (abogados_test).
 */
function createAuth03PrismaDouble() {
  const users = new Map<string, any>();
  const identities = new Map<string, any>();
  const sessions = new Map<string, any>();
  const organizations = new Map<string, any>();
  const memberships = new Map<string, any>();
  const invitations = new Map<string, any>();
  const auditLogs: any[] = [];

  const getMembershipByPair = (userId: string, organizationId: string) => {
    for (const m of memberships.values()) {
      if (m.userId === userId && m.organizationId === organizationId) {
        return m;
      }
    }
    return null;
  };

  const enrichMembership = (m: any, include?: any) => {
    if (!m) return null;
    const out = { ...m };
    if (include?.organization) {
      out.organization = organizations.get(m.organizationId) || null;
    }
    if (include?.user) {
      out.user = users.get(m.userId) || null;
    }
    return out;
  };

  const db: any = {
    _stores: {
      users,
      identities,
      sessions,
      organizations,
      memberships,
      invitations,
      auditLogs,
    },
    user: {
      findUnique: jest.fn(async ({ where, include }: any) => {
        let u: any = null;
        if (where.id) u = users.get(where.id) || null;
        else if (where.email) {
          for (const item of users.values()) {
            if (item.email === where.email) {
              u = item;
              break;
            }
          }
        }
        if (!u) return null;
        const out = { ...u };
        if (include?.identities) {
          out.identities = Array.from(identities.values()).filter(
            (i) => i.userId === u.id,
          );
        }
        return out;
      }),
    },
    userIdentity: {
      findFirst: jest.fn(async ({ where }: any) => {
        for (const i of identities.values()) {
          if (where.userId && i.userId !== where.userId) continue;
          return { ...i };
        }
        return null;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return Array.from(identities.values())
          .filter((i) => !where?.userId || i.userId === where.userId)
          .map((i) => ({ ...i }));
      }),
    },
    userSession: {
      findUnique: jest.fn(async ({ where }: any) => {
        for (const s of sessions.values()) {
          if (where.sessionToken && s.sessionToken === where.sessionToken) {
            return { ...s };
          }
          if (where.id && s.id === where.id) {
            return { ...s };
          }
        }
        return null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const s = sessions.get(where.id);
        if (!s) throw new Error("Session not found");
        const updated = { ...s, ...data };
        sessions.set(where.id, updated);
        return { ...updated };
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const [id, s] of sessions.entries()) {
          if (where.userId && s.userId !== where.userId) continue;
          if (
            where.activeOrganizationId &&
            s.activeOrganizationId !== where.activeOrganizationId
          )
            continue;
          sessions.set(id, { ...s, ...data });
          count++;
        }
        return { count };
      }),
    },
    organization: {
      create: jest.fn(async ({ data }: any) => {
        const org = {
          id: data.id || crypto.randomUUID(),
          name: data.name,
          tradeName: data.tradeName ?? null,
          cuit: data.cuit ?? null,
          status: data.status || OrganizationStatus.ACTIVE,
          plan: data.plan || "STARTER",
          settings: data.settings ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        organizations.set(org.id, org);
        return { ...org };
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const o = organizations.get(where.id);
        return o ? { ...o } : null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const o = organizations.get(where.id);
        if (!o) throw new Error("Org not found");
        const updated = { ...o, ...data, updatedAt: new Date() };
        organizations.set(where.id, updated);
        return { ...updated };
      }),
    },
    organizationMembership: {
      create: jest.fn(async ({ data, include }: any) => {
        if (getMembershipByPair(data.userId, data.organizationId)) {
          const err: any = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        }
        const m = {
          id: data.id || crypto.randomUUID(),
          userId: data.userId,
          organizationId: data.organizationId,
          role: data.role,
          status: data.status || MembershipStatus.ACTIVE,
          invitedById: data.invitedById ?? null,
          joinedAt: data.joinedAt ?? null,
          suspendedAt: data.suspendedAt ?? null,
          revokedAt: data.revokedAt ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        memberships.set(m.id, m);
        return enrichMembership(m, include);
      }),
      findUnique: jest.fn(async ({ where, include }: any) => {
        let m: any = null;
        if (where.id) m = memberships.get(where.id) || null;
        else if (where.userId_organizationId) {
          m = getMembershipByPair(
            where.userId_organizationId.userId,
            where.userId_organizationId.organizationId,
          );
        }
        return enrichMembership(m, include);
      }),
      findFirst: jest.fn(async ({ where, include }: any) => {
        for (const m of memberships.values()) {
          if (where.id && m.id !== where.id) continue;
          if (where.userId && m.userId !== where.userId) continue;
          if (where.organizationId && m.organizationId !== where.organizationId)
            continue;
          if (where.status && m.status !== where.status) continue;
          if (where.role && m.role !== where.role) continue;
          return enrichMembership(m, include);
        }
        return null;
      }),
      findMany: jest.fn(async ({ where, include }: any) => {
        const list: any[] = [];
        for (const m of memberships.values()) {
          if (where?.userId && m.userId !== where.userId) continue;
          if (
            where?.organizationId &&
            m.organizationId !== where.organizationId
          )
            continue;
          if (where?.status) {
            if (typeof where.status === "string" && m.status !== where.status)
              continue;
            if (where.status.in && !where.status.in.includes(m.status))
              continue;
          }
          if (where?.role && m.role !== where.role) continue;
          list.push(enrichMembership(m, include));
        }
        return list;
      }),
      count: jest.fn(async ({ where }: any) => {
        let count = 0;
        for (const m of memberships.values()) {
          if (
            where?.organizationId &&
            m.organizationId !== where.organizationId
          )
            continue;
          if (where?.role && m.role !== where.role) continue;
          if (where?.status && m.status !== where.status) continue;
          count++;
        }
        return count;
      }),
      update: jest.fn(async ({ where, data, include }: any) => {
        const m = memberships.get(where.id);
        if (!m) throw new Error("Membership not found");
        const updated = { ...m, ...data, updatedAt: new Date() };
        memberships.set(where.id, updated);
        return enrichMembership(updated, include);
      }),
    },
    organizationInvitation: {
      create: jest.fn(async ({ data }: any) => {
        const inv = {
          id: data.id || crypto.randomUUID(),
          organizationId: data.organizationId,
          role: data.role,
          tokenHash: data.tokenHash,
          invitedEmail: data.invitedEmail,
          targetUserId: data.targetUserId ?? null,
          invitedById: data.invitedById,
          status: data.status || InvitationStatus.PENDING,
          expiresAt: data.expiresAt,
          acceptedAt: null,
          acceptedByUserId: null,
          revokedAt: null,
          revokedById: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        invitations.set(inv.id, inv);
        return { ...inv };
      }),
      findUnique: jest.fn(async ({ where, include }: any) => {
        let inv: any = null;
        if (where.id) inv = invitations.get(where.id) || null;
        else if (where.tokenHash) {
          for (const item of invitations.values()) {
            if (item.tokenHash === where.tokenHash) {
              inv = item;
              break;
            }
          }
        }
        if (!inv) return null;
        const out = { ...inv };
        if (include?.organization) {
          out.organization = organizations.get(inv.organizationId) || null;
        }
        return out;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return Array.from(invitations.values())
          .filter(
            (i) =>
              (!where?.organizationId ||
                i.organizationId === where.organizationId) &&
              (!where?.status || i.status === where.status),
          )
          .map((i) => ({ ...i }));
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const inv = invitations.get(where.id);
        if (!inv) throw new Error("Invitation not found");
        const updated = { ...inv, ...data, updatedAt: new Date() };
        invitations.set(where.id, updated);
        return { ...updated };
      }),
    },
    auditLog: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: crypto.randomUUID(),
          ...data,
          timestamp: new Date(),
        };
        auditLogs.push(row);
        return { ...row };
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return auditLogs
          .filter(
            (a) =>
              (!where?.organizationId ||
                a.organizationId === where.organizationId) &&
              (!where?.entityId || a.entityId === where.entityId),
          )
          .map((a) => ({ ...a }));
      }),
    },
    $queryRaw: jest.fn(
      async (query: TemplateStringsArray, ...values: any[]) => {
        const sql = Array.isArray(query) ? query.join(" ") : "";
        if (sql.includes('UPDATE "OrganizationInvitation"')) {
          const [acceptedByUserId, invitationId] = values;
          const inv = invitations.get(invitationId);
          if (
            !inv ||
            inv.status !== InvitationStatus.PENDING ||
            new Date(inv.expiresAt).getTime() <= Date.now()
          ) {
            return [];
          }
          inv.status = InvitationStatus.ACCEPTED;
          inv.acceptedAt = new Date();
          inv.acceptedByUserId = acceptedByUserId;
          inv.updatedAt = new Date();
          invitations.set(invitationId, inv);
          return [{ id: inv.id }];
        }
        return [];
      },
    ),
    $transaction: jest.fn(async (cb: any) => cb(db)),
    $connect: jest.fn(async () => undefined),
    $disconnect: jest.fn(async () => undefined),
  };

  return db;
}

describe("AUTH-03 — Organizations, Memberships, Multi-Org Roles, Invitations & Active Org TDS Suite", () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createAuth03PrismaDouble>;
  let csrfService: CsrfService;

  const APP_ORIGIN = "http://localhost:3000";
  const ENCRYPTION_KEY =
    "9059d7b7e25d3c8c6de1cb0dc62232e3692c26404b1c2cdaecc19e559ef16a0c";

  const registerAuthenticatedUser = (opts: {
    id: string;
    email: string;
    fullName: string;
    withAuth0Identity?: boolean;
  }) => {
    const user = createFixtureUser({
      id: opts.id,
      email: opts.email,
      fullName: opts.fullName,
    });
    prisma._stores.users.set(user.id, user);

    if (opts.withAuth0Identity !== false) {
      const identity = createFixtureUserIdentity({
        id: `ident-${opts.id}`,
        userId: user.id,
        subject: `auth0|${opts.id}`,
        authEmail: opts.email,
      });
      prisma._stores.identities.set(identity.id, identity);
    }

    const rawSecret = `raw-session-${opts.id}-${crypto.randomBytes(8).toString("hex")}`;
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawSecret)
      .digest("hex");
    const session = createFixtureUserSession({
      id: `sess-${opts.id}`,
      userId: user.id,
      sessionToken: tokenHash,
      activeOrganizationId: null,
    });
    prisma._stores.sessions.set(session.id, session);

    const csrfToken = csrfService.generateToken(rawSecret);

    return {
      user,
      session,
      rawSecret,
      csrfToken,
      authHeaders: {
        Cookie: [`app_session=${rawSecret}`, `csrf_token=${csrfToken}`],
        Origin: APP_ORIGIN,
        "X-CSRF-Token": csrfToken,
      },
    };
  };

  beforeEach(async () => {
    prisma = createAuth03PrismaDouble();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              AUTH0_DOMAIN: "abogados-test.us.auth0.com",
              AUTH0_ISSUER_URL: "https://abogados-test.us.auth0.com/",
              AUTH0_AUDIENCE: "https://api.abogadoslaw.com",
              AUTH0_CLIENT_ID: "test-auth0-client-id-for-automated-testing",
              AUTH0_CLIENT_SECRET: "test-client-secret-minimum-32-chars!",
              APP_ORIGIN,
              CSRF_SECRET: "test-csrf-hmac-secret-minimum-32-chars-long!",
              OIDC_TRANSACTION_ENCRYPTION_KEY: ENCRYPTION_KEY,
            }),
          ],
        }),
        AuthModule,
        OrganizationsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    csrfService = moduleRef.get<CsrfService>(CsrfService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // 1. ORGANIZACIONES
  // =========================================================================

  it("TST-ORG-001: should create organization with valid fields, assign creator as ACTIVE ORG_OWNER and audit creation", async () => {
    const owner = registerAuthenticatedUser({
      id: "usr-owner-1",
      email: "owner@estudio.com",
      fullName: "Dr. Owner",
    });

    const res = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({
        name: "Estudio Jurídico Pérez & Asociados S.A.",
        tradeName: "Pérez Legal",
        cuit: "30-71234567-9",
      })
      .expect(HttpStatus.CREATED);

    expect(res.body.organization.id).toBeDefined();
    expect(res.body.organization.name).toBe(
      "Estudio Jurídico Pérez & Asociados S.A.",
    );
    expect(res.body.organization.tradeName).toBe("Pérez Legal");
    expect(res.body.organization.cuit).toBe("30-71234567-9");
    expect(res.body.organization.status).toBe(OrganizationStatus.ACTIVE);
    expect(res.body.membership.role).toBe(OrganizationRole.ORG_OWNER);
    expect(res.body.membership.status).toBe(MembershipStatus.ACTIVE);

    // Auditoría emitida
    const createdAudit = prisma._stores.auditLogs.find(
      (a) => a.action === "ORGANIZATION_CREATED",
    );
    expect(createdAudit).toBeDefined();
    expect(createdAudit.userId).toBe(owner.user.id);
    expect(createdAudit.organizationId).toBe(res.body.organization.id);
    expect(createdAudit.result).toBe("SUCCESS");
    expect(createdAudit.correlationId).toBeDefined();
  });

  it("TST-ORG-002: should reject organization creation when mandatory legal name is missing or blank", async () => {
    const owner = registerAuthenticatedUser({
      id: "usr-owner-2",
      email: "owner2@estudio.com",
      fullName: "Dr. Owner 2",
    });

    await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({ name: "   ", tradeName: "Sin Nombre Legal" })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it("TST-ORG-003 & TST-ORG-004 & TST-ORG-005: should allow ORG_OWNER to suspend/reactivate org, reject invalid transitions and block non-owners", async () => {
    const owner = registerAuthenticatedUser({
      id: "usr-owner-3",
      email: "owner3@estudio.com",
      fullName: "Dr. Owner 3",
    });
    const admin = registerAuthenticatedUser({
      id: "usr-admin-3",
      email: "admin3@estudio.com",
      fullName: "Admin 3",
    });

    const createRes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({ name: "Estudio Alpha" })
      .expect(HttpStatus.CREATED);

    const orgId = createRes.body.organization.id;

    // Agregar admin como ORG_ADMIN en la org
    await prisma.organizationMembership.create({
      data: {
        userId: admin.user.id,
        organizationId: orgId,
        role: OrganizationRole.ORG_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });

    // TST-ORG-005: ORG_ADMIN no puede suspender la organización -> 403
    await request(app.getHttpServer())
      .patch(`/api/organizations/${orgId}/status`)
      .set("Cookie", admin.authHeaders.Cookie)
      .set("Origin", admin.authHeaders.Origin)
      .set("X-CSRF-Token", admin.authHeaders["X-CSRF-Token"])
      .send({ status: OrganizationStatus.SUSPENDED })
      .expect(HttpStatus.FORBIDDEN);

    // TST-ORG-003: ORG_OWNER suspende ACTIVE -> SUSPENDED
    const suspRes = await request(app.getHttpServer())
      .patch(`/api/organizations/${orgId}/status`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({ status: OrganizationStatus.SUSPENDED })
      .expect(HttpStatus.OK);
    expect(suspRes.body.status).toBe(OrganizationStatus.SUSPENDED);

    // TST-ORG-004: transición inválida SUSPENDED -> SUSPENDED -> 400
    await request(app.getHttpServer())
      .patch(`/api/organizations/${orgId}/status`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({ status: OrganizationStatus.SUSPENDED })
      .expect(HttpStatus.BAD_REQUEST);

    // TST-ORG-003: reactivación SUSPENDED -> ACTIVE
    const reactRes = await request(app.getHttpServer())
      .patch(`/api/organizations/${orgId}/status`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({ status: OrganizationStatus.ACTIVE })
      .expect(HttpStatus.OK);
    expect(reactRes.body.status).toBe(OrganizationStatus.ACTIVE);

    // Transición a INACTIVE y rechazo de transición inválida INACTIVE -> ACTIVE
    await request(app.getHttpServer())
      .patch(`/api/organizations/${orgId}/status`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({ status: OrganizationStatus.INACTIVE })
      .expect(HttpStatus.OK);

    await request(app.getHttpServer())
      .patch(`/api/organizations/${orgId}/status`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({ status: OrganizationStatus.ACTIVE })
      .expect(HttpStatus.BAD_REQUEST);

    expect(
      prisma._stores.auditLogs.some(
        (a) => a.action === "ORGANIZATION_SUSPENDED",
      ),
    ).toBe(true);
    expect(
      prisma._stores.auditLogs.some(
        (a) => a.action === "ORGANIZATION_REACTIVATED",
      ),
    ).toBe(true);
  });

  // =========================================================================
  // 2. MEMBRESÍAS, ROLES Y AISLAMIENTO MULTI-ORGANIZACIÓN
  // =========================================================================

  it("TST-MEM-001, TST-MEM-002 & TST-ROL-004: should support multiple orgs per user with isolated roles (ORG_ADMIN in A, LAWYER in B)", async () => {
    const ownerA = registerAuthenticatedUser({
      id: "usr-owner-a",
      email: "ownera@a.com",
      fullName: "Owner A",
    });
    const ownerB = registerAuthenticatedUser({
      id: "usr-owner-b",
      email: "ownerb@b.com",
      fullName: "Owner B",
    });
    const multiUser = registerAuthenticatedUser({
      id: "usr-multi",
      email: "multi@legal.com",
      fullName: "Dra. Multi",
    });

    const orgARes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", ownerA.authHeaders.Cookie)
      .set("Origin", ownerA.authHeaders.Origin)
      .set("X-CSRF-Token", ownerA.authHeaders["X-CSRF-Token"])
      .send({ name: "Estudio A" })
      .expect(HttpStatus.CREATED);
    const orgAId = orgARes.body.organization.id;

    const orgBRes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", ownerB.authHeaders.Cookie)
      .set("Origin", ownerB.authHeaders.Origin)
      .set("X-CSRF-Token", ownerB.authHeaders["X-CSRF-Token"])
      .send({ name: "Estudio B" })
      .expect(HttpStatus.CREATED);
    const orgBId = orgBRes.body.organization.id;

    // Org C ajena
    await prisma.organization.create({ data: { name: "Estudio Ajeno C" } });

    // MultiUser es ORG_ADMIN en Org A y LAWYER en Org B
    await prisma.organizationMembership.create({
      data: {
        userId: multiUser.user.id,
        organizationId: orgAId,
        role: OrganizationRole.ORG_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });
    await prisma.organizationMembership.create({
      data: {
        userId: multiUser.user.id,
        organizationId: orgBId,
        role: OrganizationRole.LAWYER,
        status: MembershipStatus.ACTIVE,
      },
    });

    // Consultar organizaciones propias -> solo A y B (nunca C)
    const myOrgsRes = await request(app.getHttpServer())
      .get("/api/organizations")
      .set("Cookie", multiUser.authHeaders.Cookie)
      .expect(HttpStatus.OK);

    expect(myOrgsRes.body.organizations).toHaveLength(2);
    const orgRoles = Object.fromEntries(
      myOrgsRes.body.organizations.map((o: any) => [o.organizationId, o.role]),
    );
    expect(orgRoles[orgAId]).toBe(OrganizationRole.ORG_ADMIN);
    expect(orgRoles[orgBId]).toBe(OrganizationRole.LAWYER);

    // En Org A (ORG_ADMIN) SÍ puede listar miembros
    const membersA = await request(app.getHttpServer())
      .get(`/api/organizations/${orgAId}/members`)
      .set("Cookie", multiUser.authHeaders.Cookie)
      .expect(HttpStatus.OK);
    expect(membersA.body.members.length).toBeGreaterThanOrEqual(2);

    // En Org B (LAWYER) NO puede listar miembros -> 403 (rol de A NO se traslada a B)
    await request(app.getHttpServer())
      .get(`/api/organizations/${orgBId}/members`)
      .set("Cookie", multiUser.authHeaders.Cookie)
      .expect(HttpStatus.FORBIDDEN);
  });

  it("TST-ROL-001, TST-ROL-002, TST-ROL-003, TST-ROL-005 & TST-MEM-007: should enforce role rules, prevent self-elevation/ORG_OWNER escalation, protect last owner and allow explicit ownership transfer", async () => {
    const owner = registerAuthenticatedUser({
      id: "usr-own-r",
      email: "own@r.com",
      fullName: "Owner R",
    });
    const admin = registerAuthenticatedUser({
      id: "usr-adm-r",
      email: "adm@r.com",
      fullName: "Admin R",
    });
    const lawyer = registerAuthenticatedUser({
      id: "usr-law-r",
      email: "law@r.com",
      fullName: "Lawyer R",
    });

    const orgRes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({ name: "Estudio Roles" })
      .expect(HttpStatus.CREATED);
    const orgId = orgRes.body.organization.id;
    const ownerMembershipId = orgRes.body.membership.id;

    const adminMem = await prisma.organizationMembership.create({
      data: {
        userId: admin.user.id,
        organizationId: orgId,
        role: OrganizationRole.ORG_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });
    const lawyerMem = await prisma.organizationMembership.create({
      data: {
        userId: lawyer.user.id,
        organizationId: orgId,
        role: OrganizationRole.LAWYER,
        status: MembershipStatus.ACTIVE,
      },
    });

    // TST-MEM-007: No se puede suspender ni revocar al último ORG_OWNER activo
    await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/members/${ownerMembershipId}/suspend`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .expect(HttpStatus.CONFLICT);

    await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/members/${ownerMembershipId}/revoke`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .expect(HttpStatus.CONFLICT);

    // TST-ROL-002 & TST-ROL-003: ORG_ADMIN no puede cambiar roles ni autoelevarse a ORG_OWNER
    await request(app.getHttpServer())
      .patch(`/api/organizations/${orgId}/members/${adminMem.id}/role`)
      .set("Cookie", admin.authHeaders.Cookie)
      .set("Origin", admin.authHeaders.Origin)
      .set("X-CSRF-Token", admin.authHeaders["X-CSRF-Token"])
      .send({ role: OrganizationRole.ORG_OWNER })
      .expect(HttpStatus.FORBIDDEN);

    await request(app.getHttpServer())
      .patch(`/api/organizations/${orgId}/members/${lawyerMem.id}/role`)
      .set("Cookie", admin.authHeaders.Cookie)
      .set("Origin", admin.authHeaders.Origin)
      .set("X-CSRF-Token", admin.authHeaders["X-CSRF-Token"])
      .send({ role: OrganizationRole.ORG_ADMIN })
      .expect(HttpStatus.FORBIDDEN);

    // TST-ROL-002: ORG_OWNER tampoco puede cambiar su propio rol en endpoint de roles -> 403
    await request(app.getHttpServer())
      .patch(`/api/organizations/${orgId}/members/${ownerMembershipId}/role`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({ role: OrganizationRole.LAWYER })
      .expect(HttpStatus.FORBIDDEN);

    // No se puede asignar ORG_OWNER vía cambio ordinario de rol -> 400/403 (requiere transferencia explícita)
    const assignOwnerRes = await request(app.getHttpServer())
      .patch(`/api/organizations/${orgId}/members/${lawyerMem.id}/role`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({ role: OrganizationRole.ORG_OWNER });
    expect([HttpStatus.BAD_REQUEST, HttpStatus.FORBIDDEN]).toContain(
      assignOwnerRes.status,
    );

    // TST-ROL-001: ORG_OWNER cambia rol de LAWYER -> ASSISTANT exitosamente
    const roleRes = await request(app.getHttpServer())
      .patch(`/api/organizations/${orgId}/members/${lawyerMem.id}/role`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({ role: OrganizationRole.ASSISTANT })
      .expect(HttpStatus.OK);
    expect(roleRes.body.role).toBe(OrganizationRole.ASSISTANT);

    // TST-ROL-005: Transferencia de propiedad explícita y auditada (owner -> admin)
    const transferRes = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/transfer-ownership`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({ targetMembershipId: adminMem.id })
      .expect(HttpStatus.OK);

    expect(transferRes.body.newOwner.role).toBe(OrganizationRole.ORG_OWNER);
    expect(transferRes.body.previousOwner.role).toBe(
      OrganizationRole.ORG_ADMIN,
    );
    expect(
      prisma._stores.auditLogs.some(
        (a) => a.action === "OWNERSHIP_TRANSFERRED",
      ),
    ).toBe(true);
  });

  it("TST-MEM-004, TST-MEM-005 & TST-MEM-006: should suspend/reactivate/revoke members with restrictions, preserve identity, and reject inactive members", async () => {
    const owner = registerAuthenticatedUser({
      id: "usr-own-m",
      email: "own@m.com",
      fullName: "Owner M",
    });
    const admin = registerAuthenticatedUser({
      id: "usr-adm-m",
      email: "adm@m.com",
      fullName: "Admin M",
    });
    const staff = registerAuthenticatedUser({
      id: "usr-stf-m",
      email: "stf@m.com",
      fullName: "Staff M",
    });

    const orgRes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({ name: "Estudio Membresías" })
      .expect(HttpStatus.CREATED);
    const orgId = orgRes.body.organization.id;
    const ownerMemId = orgRes.body.membership.id;

    await prisma.organizationMembership.create({
      data: {
        userId: admin.user.id,
        organizationId: orgId,
        role: OrganizationRole.ORG_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });
    const staffMem = await prisma.organizationMembership.create({
      data: {
        userId: staff.user.id,
        organizationId: orgId,
        role: OrganizationRole.STAFF,
        status: MembershipStatus.ACTIVE,
      },
    });

    // ORG_ADMIN no puede suspender a ORG_OWNER -> 403
    await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/members/${ownerMemId}/suspend`)
      .set("Cookie", admin.authHeaders.Cookie)
      .set("Origin", admin.authHeaders.Origin)
      .set("X-CSRF-Token", admin.authHeaders["X-CSRF-Token"])
      .expect(HttpStatus.FORBIDDEN);

    // ORG_ADMIN suspende a STAFF -> OK
    const susp = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/members/${staffMem.id}/suspend`)
      .set("Cookie", admin.authHeaders.Cookie)
      .set("Origin", admin.authHeaders.Origin)
      .set("X-CSRF-Token", admin.authHeaders["X-CSRF-Token"])
      .expect(HttpStatus.OK);
    expect(susp.body.status).toBe(MembershipStatus.SUSPENDED);

    // STAFF suspendido no puede seleccionar la organización como activa -> 403
    await request(app.getHttpServer())
      .post("/api/organizations/active")
      .set("Cookie", staff.authHeaders.Cookie)
      .set("Origin", staff.authHeaders.Origin)
      .set("X-CSRF-Token", staff.authHeaders["X-CSRF-Token"])
      .send({ organizationId: orgId })
      .expect(HttpStatus.FORBIDDEN);

    // Reactivar STAFF -> OK
    const react = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/members/${staffMem.id}/reactivate`)
      .set("Cookie", admin.authHeaders.Cookie)
      .set("Origin", admin.authHeaders.Origin)
      .set("X-CSRF-Token", admin.authHeaders["X-CSRF-Token"])
      .expect(HttpStatus.OK);
    expect(react.body.status).toBe(MembershipStatus.ACTIVE);

    // Revocar STAFF -> OK, preserva identidad global y bloquea reactivación directa
    const rev = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/members/${staffMem.id}/revoke`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .expect(HttpStatus.OK);
    expect(rev.body.status).toBe(MembershipStatus.REVOKED);
    expect(prisma._stores.users.has(staff.user.id)).toBe(true);
    expect(prisma._stores.identities.has(`ident-${staff.user.id}`)).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/members/${staffMem.id}/reactivate`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .expect(HttpStatus.BAD_REQUEST);
  });

  // =========================================================================
  // 3. INVITACIONES
  // =========================================================================

  it("TST-INV-001 a TST-INV-009: should issue hashed single-use invitations, enforce Auth0 eligibility, reject invalid/expired/revoked/reused tokens and never log raw tokens", async () => {
    const owner = registerAuthenticatedUser({
      id: "usr-inv-owner",
      email: "owner@inv.com",
      fullName: "Owner Inv",
    });
    const admin = registerAuthenticatedUser({
      id: "usr-inv-admin",
      email: "admin@inv.com",
      fullName: "Admin Inv",
    });
    const invitee = registerAuthenticatedUser({
      id: "usr-invitee-1",
      email: "abogada@inv.com",
      fullName: "Dra. Invitada",
      withAuth0Identity: true,
    });
    const emailOnlyNoIdentity = registerAuthenticatedUser({
      id: "usr-no-auth0-id",
      email: "sinidentidad@inv.com",
      fullName: "Solo Email",
      withAuth0Identity: false,
    });

    const orgRes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({ name: "Estudio Invitaciones" })
      .expect(HttpStatus.CREATED);
    const orgId = orgRes.body.organization.id;

    await prisma.organizationMembership.create({
      data: {
        userId: admin.user.id,
        organizationId: orgId,
        role: OrganizationRole.ORG_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });

    // ORG_ADMIN no puede invitar como ORG_OWNER -> 403
    await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/invitations`)
      .set("Cookie", admin.authHeaders.Cookie)
      .set("Origin", admin.authHeaders.Origin)
      .set("X-CSRF-Token", admin.authHeaders["X-CSRF-Token"])
      .send({
        invitedEmail: "otro@inv.com",
        role: OrganizationRole.ORG_OWNER,
      })
      .expect(HttpStatus.FORBIDDEN);

    // Emitir invitación válida como LAWYER
    const invRes = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/invitations`)
      .set("Cookie", admin.authHeaders.Cookie)
      .set("Origin", admin.authHeaders.Origin)
      .set("X-CSRF-Token", admin.authHeaders["X-CSRF-Token"])
      .send({
        invitedEmail: "ABOGADA@INV.COM",
        role: OrganizationRole.LAWYER,
      })
      .expect(HttpStatus.CREATED);

    const rawToken: string = invRes.body.invitationToken;
    expect(rawToken).toBeDefined();
    expect(rawToken.length).toBeGreaterThanOrEqual(32);

    // En BD se persiste ÚNICAMENTE el hash SHA-256 (nunca rawToken)
    const storedInv = prisma._stores.invitations.get(invRes.body.invitation.id);
    expect(storedInv).toBeDefined();
    expect(storedInv.tokenHash).toBe(
      crypto.createHash("sha256").update(rawToken).digest("hex"),
    );
    expect(storedInv.tokenHash).not.toBe(rawToken);
    expect(storedInv.invitedById).toBe(admin.user.id);

    // TST-INV-003: Token incorrecto -> 400
    await request(app.getHttpServer())
      .post("/api/invitations/accept")
      .set("Cookie", invitee.authHeaders.Cookie)
      .set("Origin", invitee.authHeaders.Origin)
      .set("X-CSRF-Token", invitee.authHeaders["X-CSRF-Token"])
      .send({ token: "totally-invalid-token-value" })
      .expect(HttpStatus.BAD_REQUEST);

    // TST-INV-002: Aceptación válida -> crea membresía ACTIVE con rol LAWYER
    const acceptRes = await request(app.getHttpServer())
      .post("/api/invitations/accept")
      .set("Cookie", invitee.authHeaders.Cookie)
      .set("Origin", invitee.authHeaders.Origin)
      .set("X-CSRF-Token", invitee.authHeaders["X-CSRF-Token"])
      .send({ token: rawToken })
      .expect(HttpStatus.OK);

    expect(acceptRes.body.membership.role).toBe(OrganizationRole.LAWYER);
    expect(acceptRes.body.membership.status).toBe(MembershipStatus.ACTIVE);
    expect(acceptRes.body.membership.organizationId).toBe(orgId);

    // TST-INV-006: Reutilización de token ya aceptado -> 409 o 400
    const reuseRes = await request(app.getHttpServer())
      .post("/api/invitations/accept")
      .set("Cookie", invitee.authHeaders.Cookie)
      .set("Origin", invitee.authHeaders.Origin)
      .set("X-CSRF-Token", invitee.authHeaders["X-CSRF-Token"])
      .send({ token: rawToken });
    expect([HttpStatus.CONFLICT, HttpStatus.BAD_REQUEST]).toContain(
      reuseRes.status,
    );

    // TST-INV-007: Email coincidente SIN identidad Auth0 enrolada -> 403 Forbidden
    const invNoIdRes = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/invitations`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({
        invitedEmail: "sinidentidad@inv.com",
        role: OrganizationRole.ASSISTANT,
      })
      .expect(HttpStatus.CREATED);

    await request(app.getHttpServer())
      .post("/api/invitations/accept")
      .set("Cookie", emailOnlyNoIdentity.authHeaders.Cookie)
      .set("Origin", emailOnlyNoIdentity.authHeaders.Origin)
      .set("X-CSRF-Token", emailOnlyNoIdentity.authHeaders["X-CSRF-Token"])
      .send({ token: invNoIdRes.body.invitationToken })
      .expect(HttpStatus.FORBIDDEN);

    // TST-INV-004: Token expirado -> 400
    const invExpRes = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/invitations`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({
        invitedEmail: "abogada@inv.com",
        role: OrganizationRole.STAFF,
      })
      .expect(HttpStatus.CREATED);
    const expRow = prisma._stores.invitations.get(invExpRes.body.invitation.id);
    expRow.expiresAt = new Date(Date.now() - 60000);

    await request(app.getHttpServer())
      .post("/api/invitations/accept")
      .set("Cookie", invitee.authHeaders.Cookie)
      .set("Origin", invitee.authHeaders.Origin)
      .set("X-CSRF-Token", invitee.authHeaders["X-CSRF-Token"])
      .send({ token: invExpRes.body.invitationToken })
      .expect(HttpStatus.BAD_REQUEST);

    // TST-INV-005: Token revocado -> 400
    const invRevRes = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/invitations`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({
        invitedEmail: "abogada@inv.com",
        role: OrganizationRole.STAFF,
      })
      .expect(HttpStatus.CREATED);

    await request(app.getHttpServer())
      .post(
        `/api/organizations/${orgId}/invitations/${invRevRes.body.invitation.id}/revoke`,
      )
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .expect(HttpStatus.OK);

    await request(app.getHttpServer())
      .post("/api/invitations/accept")
      .set("Cookie", invitee.authHeaders.Cookie)
      .set("Origin", invitee.authHeaders.Origin)
      .set("X-CSRF-Token", invitee.authHeaders["X-CSRF-Token"])
      .send({ token: invRevRes.body.invitationToken })
      .expect(HttpStatus.BAD_REQUEST);

    // TST-INV-009: Cero tokens en texto claro ni hashes en AuditLog
    const serializedAudit = JSON.stringify(prisma._stores.auditLogs);
    expect(serializedAudit).not.toContain(rawToken);
    expect(serializedAudit).not.toContain(storedInv.tokenHash);
  });

  // =========================================================================
  // 4. ORGANIZACIÓN ACTIVA Y SEGURIDAD
  // =========================================================================

  it("TST-ACT-001 a TST-ACT-005 & TST-SEC-001 a TST-SEC-005: should manage active organization safely in BFF session, block foreign/suspended orgs, enforce CSRF and isolate audit logs", async () => {
    const user1 = registerAuthenticatedUser({
      id: "usr-act-1",
      email: "act1@legal.com",
      fullName: "Dr. Activo 1",
    });
    const user2 = registerAuthenticatedUser({
      id: "usr-act-2",
      email: "act2@legal.com",
      fullName: "Dr. Activo 2",
    });

    // TST-SEC-001: Sin sesión -> 401
    await request(app.getHttpServer())
      .get("/api/organizations")
      .expect(HttpStatus.UNAUTHORIZED);

    // TST-SEC-004: Mutación sin CSRF -> 403
    await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", [`app_session=${user1.rawSecret}`])
      .set("Origin", APP_ORIGIN)
      .send({ name: "Sin CSRF" })
      .expect(HttpStatus.FORBIDDEN);

    // Crear Org 1 (user1) y Org 2 (user2)
    const org1Res = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", user1.authHeaders.Cookie)
      .set("Origin", user1.authHeaders.Origin)
      .set("X-CSRF-Token", user1.authHeaders["X-CSRF-Token"])
      .send({ name: "Estudio 1" })
      .expect(HttpStatus.CREATED);
    const org1Id = org1Res.body.organization.id;

    const org2Res = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", user2.authHeaders.Cookie)
      .set("Origin", user2.authHeaders.Origin)
      .set("X-CSRF-Token", user2.authHeaders["X-CSRF-Token"])
      .send({ name: "Estudio 2" })
      .expect(HttpStatus.CREATED);
    const org2Id = org2Res.body.organization.id;
    const org2OwnerMemId = org2Res.body.membership.id;

    // TST-ACT-002: user1 intenta seleccionar Org 2 ajena conociendo su UUID -> 403
    await request(app.getHttpServer())
      .post("/api/organizations/active")
      .set("Cookie", user1.authHeaders.Cookie)
      .set("Origin", user1.authHeaders.Origin)
      .set("X-CSRF-Token", user1.authHeaders["X-CSRF-Token"])
      .send({ organizationId: org2Id })
      .expect(HttpStatus.FORBIDDEN);

    // TST-SEC-003: Manipulación cruzada -> user1 (owner de Org 1) intenta revocar membresía de Org 2 vía ruta de Org 1
    await request(app.getHttpServer())
      .post(`/api/organizations/${org1Id}/members/${org2OwnerMemId}/revoke`)
      .set("Cookie", user1.authHeaders.Cookie)
      .set("Origin", user1.authHeaders.Origin)
      .set("X-CSRF-Token", user1.authHeaders["X-CSRF-Token"])
      .expect(HttpStatus.NOT_FOUND);

    // Agregar user1 como LAWYER en Org 2 para probar cambio entre organizaciones
    const u1InOrg2 = await prisma.organizationMembership.create({
      data: {
        userId: user1.user.id,
        organizationId: org2Id,
        role: OrganizationRole.LAWYER,
        status: MembershipStatus.ACTIVE,
      },
    });

    // TST-ACT-001 & TST-ACT-004: Seleccionar Org 1 y luego cambiar a Org 2
    const sel1 = await request(app.getHttpServer())
      .post("/api/organizations/active")
      .set("Cookie", user1.authHeaders.Cookie)
      .set("Origin", user1.authHeaders.Origin)
      .set("X-CSRF-Token", user1.authHeaders["X-CSRF-Token"])
      .send({ organizationId: org1Id })
      .expect(HttpStatus.OK);
    expect(sel1.body.activeOrganization.organizationId).toBe(org1Id);
    expect(sel1.body.activeOrganization.role).toBe(OrganizationRole.ORG_OWNER);

    const sel2 = await request(app.getHttpServer())
      .post("/api/organizations/active")
      .set("Cookie", user1.authHeaders.Cookie)
      .set("Origin", user1.authHeaders.Origin)
      .set("X-CSRF-Token", user1.authHeaders["X-CSRF-Token"])
      .send({ organizationId: org2Id })
      .expect(HttpStatus.OK);
    expect(sel2.body.activeOrganization.organizationId).toBe(org2Id);
    expect(sel2.body.activeOrganization.role).toBe(OrganizationRole.LAWYER);

    // Resolver desde sesión BFF server-side
    const resolved = await request(app.getHttpServer())
      .get("/api/organizations/active")
      .set("Cookie", user1.authHeaders.Cookie)
      .expect(HttpStatus.OK);
    expect(resolved.body.activeOrganization.organizationId).toBe(org2Id);
    expect(resolved.body.activeOrganization.role).toBe(OrganizationRole.LAWYER);

    // TST-ACT-005: Suspender la membresía de user1 en Org 2 -> siguiente consulta activa rechaza con 403
    await prisma.organizationMembership.update({
      where: { id: u1InOrg2.id },
      data: { status: MembershipStatus.SUSPENDED, suspendedAt: new Date() },
    });

    await request(app.getHttpServer())
      .get("/api/organizations/active")
      .set("Cookie", user1.authHeaders.Cookie)
      .expect(HttpStatus.FORBIDDEN);

    // TST-SEC-005: Auditoría de Org 1 solo muestra eventos de Org 1 (nunca de Org 2)
    const audit1 = await request(app.getHttpServer())
      .get(`/api/organizations/${org1Id}/audit`)
      .set("Cookie", user1.authHeaders.Cookie)
      .expect(HttpStatus.OK);
    expect(audit1.body.events.length).toBeGreaterThan(0);
    for (const ev of audit1.body.events) {
      expect(ev.organizationId).toBe(org1Id);
    }
  });

  // =========================================================================
  // 5. VERIFICACIÓN ACOTADA: DESTINATARIO INVITACIONES Y AISLAMIENTO LEGACY
  // =========================================================================

  it("TST-INV-010 & TST-INV-011: should reject invitation acceptance by another authenticated user or mismatched Auth0 authEmail even if legacy User.email matches", async () => {
    const owner = registerAuthenticatedUser({
      id: "usr-rec-owner",
      email: "owner@rec.com",
      fullName: "Owner Rec",
    });
    const intendedUser = registerAuthenticatedUser({
      id: "usr-rec-target",
      email: "target@rec.com",
      fullName: "Target Rec",
    });
    const otherAuthUser = registerAuthenticatedUser({
      id: "usr-rec-other",
      email: "other@rec.com",
      fullName: "Other Auth User",
    });

    // Usuario con User.email = "mismatch@rec.com" pero UserIdentity.authEmail = "real-auth0@other.com"
    const mismatchedIdentityUser = registerAuthenticatedUser({
      id: "usr-rec-mismatch",
      email: "mismatch@rec.com",
      fullName: "Mismatch Email User",
      withAuth0Identity: false,
    });
    prisma._stores.identities.set("ident-mismatch", {
      ...createFixtureUserIdentity({
        id: "ident-mismatch",
        userId: mismatchedIdentityUser.user.id,
        subject: "auth0|mismatch-sub",
        authEmail: "real-auth0@other.com",
      }),
    });

    const orgRes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({ name: "Estudio Destinatario" })
      .expect(HttpStatus.CREATED);
    const orgId = orgRes.body.organization.id;

    // 1. Invitación con targetUserId explícito -> otro usuario autenticado con el token debe ser rechazado (403)
    const targetedInv = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/invitations`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({
        invitedEmail: intendedUser.user.email,
        targetUserId: intendedUser.user.id,
        role: OrganizationRole.LAWYER,
      })
      .expect(HttpStatus.CREATED);

    await request(app.getHttpServer())
      .post("/api/invitations/accept")
      .set("Cookie", otherAuthUser.authHeaders.Cookie)
      .set("Origin", otherAuthUser.authHeaders.Origin)
      .set("X-CSRF-Token", otherAuthUser.authHeaders["X-CSRF-Token"])
      .send({ token: targetedInv.body.invitationToken })
      .expect(HttpStatus.FORBIDDEN);

    // La invitación debe seguir PENDING y el destinatario legítimo aún puede aceptarla
    expect(
      prisma._stores.invitations.get(targetedInv.body.invitation.id).status,
    ).toBe(InvitationStatus.PENDING);

    await request(app.getHttpServer())
      .post("/api/invitations/accept")
      .set("Cookie", intendedUser.authHeaders.Cookie)
      .set("Origin", intendedUser.authHeaders.Origin)
      .set("X-CSRF-Token", intendedUser.authHeaders["X-CSRF-Token"])
      .send({ token: targetedInv.body.invitationToken })
      .expect(HttpStatus.OK);

    // 2. Invitación por email -> usuario cuya identidad Auth0 tiene otro authEmail es rechazado (403) aunque User.email coincida
    const mismatchInv = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/invitations`)
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({
        invitedEmail: "mismatch@rec.com",
        role: OrganizationRole.ASSISTANT,
      })
      .expect(HttpStatus.CREATED);

    await request(app.getHttpServer())
      .post("/api/invitations/accept")
      .set("Cookie", mismatchedIdentityUser.authHeaders.Cookie)
      .set("Origin", mismatchedIdentityUser.authHeaders.Origin)
      .set("X-CSRF-Token", mismatchedIdentityUser.authHeaders["X-CSRF-Token"])
      .send({ token: mismatchInv.body.invitationToken })
      .expect(HttpStatus.FORBIDDEN);
  });

  it("TST-LEG-001: modifying legacy User.role=ADMIN and User.organizationId must NEVER grant privilege escalation or cross-org access in AUTH-03", async () => {
    const owner = registerAuthenticatedUser({
      id: "usr-leg-owner",
      email: "owner@leg.com",
      fullName: "Owner Leg",
    });
    const attacker = registerAuthenticatedUser({
      id: "usr-leg-att",
      email: "att@leg.com",
      fullName: "Attacker Leg",
    });

    const orgRes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", owner.authHeaders.Cookie)
      .set("Origin", owner.authHeaders.Origin)
      .set("X-CSRF-Token", owner.authHeaders["X-CSRF-Token"])
      .send({ name: "Estudio Protegido Legacy" })
      .expect(HttpStatus.CREATED);
    const orgId = orgRes.body.organization.id;

    // Manipular campos legacy de attacker: role = ADMIN, organizationId = orgId
    const storedAttacker = prisma._stores.users.get(attacker.user.id);
    storedAttacker.role = "ADMIN";
    storedAttacker.organizationId = orgId;

    // Sin membresía real -> 403 en members, audit y active org
    await request(app.getHttpServer())
      .get(`/api/organizations/${orgId}/members`)
      .set("Cookie", attacker.authHeaders.Cookie)
      .expect(HttpStatus.FORBIDDEN);

    await request(app.getHttpServer())
      .post("/api/organizations/active")
      .set("Cookie", attacker.authHeaders.Cookie)
      .set("Origin", attacker.authHeaders.Origin)
      .set("X-CSRF-Token", attacker.authHeaders["X-CSRF-Token"])
      .send({ organizationId: orgId })
      .expect(HttpStatus.FORBIDDEN);

    // Con membresía LAWYER (pese a User.role=ADMIN) -> sigue sin poder administrar (403)
    await prisma.organizationMembership.create({
      data: {
        userId: attacker.user.id,
        organizationId: orgId,
        role: OrganizationRole.LAWYER,
        status: MembershipStatus.ACTIVE,
      },
    });

    await request(app.getHttpServer())
      .get(`/api/organizations/${orgId}/members`)
      .set("Cookie", attacker.authHeaders.Cookie)
      .expect(HttpStatus.FORBIDDEN);

    await request(app.getHttpServer())
      .get(`/api/organizations/${orgId}/audit`)
      .set("Cookie", attacker.authHeaders.Cookie)
      .expect(HttpStatus.FORBIDDEN);
  });
});
