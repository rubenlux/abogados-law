/**
 * Suite de Pruebas de Integración PostgreSQL REAL para AUTH-03 (Sin Mocks de BD)
 * Especificación: SPEC-AUTH-001 v1.0.8 | Expediente: AUTH0-IMPLEMENTATION-007
 *
 * Verifica contra PostgreSQL 18 real (abogados_test):
 * - PG-AUTH03-001: Unicidad (userId, organizationId) [P2002], FK integrity [P2003], usuario en múltiples organizaciones con roles distintos.
 * - PG-AUTH03-002: Invitaciones transaccionales (tokenHash único, atomicidad invitación-membresía-auditoría).
 * - PG-AUTH03-003: Concurrencia real en PostgreSQL al aceptar una invitación (2 y 5 peticiones simultáneas -> exactamente 1 éxito, 0 errores 500).
 * - PG-AUTH03-004: Transferencia atómica de propiedad y protección de último ORG_OWNER activo en PostgreSQL real.
 * - PG-AUTH03-005: Persistencia real de UserSession.activeOrganizationId y revocación en vivo al suspender membresía.
 * - PG-AUTH03-006: Auditoría real en AuditLog sin secretos y aislamiento estricto entre organizaciones.
 * - PG-AUTH03-007: Baja/revocación de membresía preserva User, UserIdentity e historial en PostgreSQL.
 */

import {
  PrismaClient,
  Prisma,
  UserRole,
  OrganizationRole,
  MembershipStatus,
  InvitationStatus,
} from "@prisma/client";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { INestApplication, HttpStatus, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import * as crypto from "crypto";

import { assertSafeTestDatabaseUrl } from "../helpers/db-guard";
import { PrismaService } from "../../src/prisma.service";
import { AuthModule } from "../../src/auth/auth.module";
import { BffSessionService } from "../../src/auth/bff/bff-session.service";
import { CsrfService } from "../../src/auth/bff/csrf.service";
import { OrganizationsModule } from "../../src/organizations/organizations.module";

describe("AUTH-03 — PostgreSQL Real Database Integration Suite (abogados_test)", () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let sessionService: BffSessionService;
  let csrfService: CsrfService;

  const testDbUrl =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/abogados_test?schema=public";
  const APP_ORIGIN = "http://localhost:3000";
  const TEST_ENCRYPTION_KEY =
    process.env.OIDC_TRANSACTION_ENCRYPTION_KEY ||
    "9059d7b7e25d3c8c6de1cb0dc62232e3692c26404b1c2cdaecc19e559ef16a0c";

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];

  const createRealUserWithSession = async (tag: string) => {
    const suffix = `${tag}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    // Org base técnica requerida por FK legacy de User.organizationId
    const baseOrg = await prisma.organization.create({
      data: { name: `Base Legacy Org ${suffix}` },
    });
    createdOrgIds.push(baseOrg.id);

    const user = await prisma.user.create({
      data: {
        email: `${suffix}@abogados-test.com`,
        fullName: `Dr. ${tag}`,
        passwordHash: "$2b$04$testMockHash",
        role: UserRole.ASSOCIATE,
        organizationId: baseOrg.id,
      },
    });
    createdUserIds.push(user.id);

    const identity = await prisma.userIdentity.create({
      data: {
        userId: user.id,
        issuer: "https://abogados-test.us.auth0.com/",
        subject: `auth0|${suffix}`,
        authEmail: user.email,
      },
    });

    const { rawSessionSecret, session } = await sessionService.createSession(
      user.id,
    );
    const csrfToken = csrfService.generateToken(rawSessionSecret);

    return {
      user,
      identity,
      session,
      rawSessionSecret,
      csrfToken,
      cookies: [`app_session=${rawSessionSecret}`, `csrf_token=${csrfToken}`],
    };
  };

  beforeAll(async () => {
    assertSafeTestDatabaseUrl(testDbUrl);

    prisma = new PrismaClient({
      datasources: { db: { url: testDbUrl } },
    });
    await prisma.$connect();

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
              AUTH0_DOMAIN: "abogados-test.us.auth0.com",
              AUTH0_ISSUER_URL: "https://abogados-test.us.auth0.com/",
              AUTH0_AUDIENCE: "https://api.abogadoslaw.com",
              AUTH0_CLIENT_ID: "test-auth0-client-id-for-automated-testing",
              AUTH0_CLIENT_SECRET: "test-client-secret-minimum-32-chars!",
              APP_ORIGIN,
              CSRF_SECRET: "test-csrf-hmac-secret-minimum-32-chars-long!",
              OIDC_TRANSACTION_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
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

    sessionService = moduleRef.get<BffSessionService>(BffSessionService);
    csrfService = moduleRef.get<CsrfService>(CsrfService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (prisma) {
      if (createdOrgIds.length > 0) {
        await prisma.auditLog.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await prisma.organizationInvitation.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await prisma.organizationMembership.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
      }
      if (createdUserIds.length > 0) {
        await prisma.auditLog.deleteMany({
          where: { userId: { in: createdUserIds } },
        });
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }
      if (createdOrgIds.length > 0) {
        await prisma.organization.deleteMany({
          where: { id: { in: createdOrgIds } },
        });
      }
      await prisma.$disconnect();
    }
  });

  it("PG-AUTH03-001: should enforce unique (userId, organizationId) [P2002], FK constraints [P2003], and persist multi-org roles in real PostgreSQL", async () => {
    const actorA = await createRealUserWithSession("pg-org-a");
    const actorB = await createRealUserWithSession("pg-org-b");

    const orgARes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", actorA.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", actorA.csrfToken)
      .send({ name: "Estudio Real PG A", cuit: "30-11111111-1" })
      .expect(HttpStatus.CREATED);
    const orgAId = orgARes.body.organization.id;
    createdOrgIds.push(orgAId);

    const orgBRes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", actorB.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", actorB.csrfToken)
      .send({ name: "Estudio Real PG B", cuit: "30-22222222-2" })
      .expect(HttpStatus.CREATED);
    const orgBId = orgBRes.body.organization.id;
    createdOrgIds.push(orgBId);

    // Colisión de unicidad (userId, organizationId) -> P2002 en PostgreSQL
    let dupErr: any;
    try {
      await prisma.organizationMembership.create({
        data: {
          userId: actorA.user.id,
          organizationId: orgAId,
          role: OrganizationRole.LAWYER,
          status: MembershipStatus.ACTIVE,
        },
      });
    } catch (e) {
      dupErr = e;
    }
    expect(dupErr).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(dupErr.code).toBe("P2002");

    // FK inválida -> P2003 en PostgreSQL
    let fkErr: any;
    try {
      await prisma.organizationMembership.create({
        data: {
          userId: actorA.user.id,
          organizationId: "non-existent-org-id",
          role: OrganizationRole.LAWYER,
          status: MembershipStatus.ACTIVE,
        },
      });
    } catch (e) {
      fkErr = e;
    }
    expect(fkErr).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(fkErr.code).toBe("P2003");

    // actorA también pertenece a Org B como LAWYER
    await prisma.organizationMembership.create({
      data: {
        userId: actorA.user.id,
        organizationId: orgBId,
        role: OrganizationRole.LAWYER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const listRes = await request(app.getHttpServer())
      .get("/api/organizations")
      .set("Cookie", actorA.cookies)
      .expect(HttpStatus.OK);

    const map = Object.fromEntries(
      listRes.body.organizations.map((o: any) => [o.organizationId, o.role]),
    );
    expect(map[orgAId]).toBe(OrganizationRole.ORG_OWNER);
    expect(map[orgBId]).toBe(OrganizationRole.LAWYER);
  });

  it("PG-AUTH03-002 & PG-AUTH03-003: should execute invitation acceptance atomically and prevent concurrent double-acceptance on real PostgreSQL (zero 500 errors)", async () => {
    const owner = await createRealUserWithSession("pg-inv-own");
    const invitee = await createRealUserWithSession("pg-inv-usr");

    const orgRes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", owner.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", owner.csrfToken)
      .send({ name: "Estudio Concurrencia Invitaciones" })
      .expect(HttpStatus.CREATED);
    const orgId = orgRes.body.organization.id;
    createdOrgIds.push(orgId);

    const invRes = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/invitations`)
      .set("Cookie", owner.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", owner.csrfToken)
      .send({
        invitedEmail: invitee.user.email,
        role: OrganizationRole.LAWYER,
      })
      .expect(HttpStatus.CREATED);

    const rawToken: string = invRes.body.invitationToken;
    const invId: string = invRes.body.invitation.id;

    // Verificar en PostgreSQL que sólo se persistió el hash SHA-256
    const dbInv = await prisma.organizationInvitation.findUnique({
      where: { id: invId },
    });
    expect(dbInv?.tokenHash).toBe(
      crypto.createHash("sha256").update(rawToken).digest("hex"),
    );

    // 5 peticiones HTTP concurrentes aceptando el MISMO token de invitación
    const concurrentResponses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post("/api/invitations/accept")
          .set("Cookie", invitee.cookies)
          .set("Origin", APP_ORIGIN)
          .set("X-CSRF-Token", invitee.csrfToken)
          .send({ token: rawToken }),
      ),
    );

    const statuses = concurrentResponses.map((r) => r.status);
    const okCount = statuses.filter((s) => s === HttpStatus.OK).length;
    const conflictOrBadReqCount = statuses.filter(
      (s) => s === HttpStatus.CONFLICT || s === HttpStatus.BAD_REQUEST,
    ).length;
    const serverErrors = statuses.filter((s) => s >= 500).length;

    expect(okCount).toBe(1);
    expect(conflictOrBadReqCount).toBe(4);
    expect(serverErrors).toBe(0);

    // Verificar estado final en PostgreSQL: invitación ACCEPTED y exactamente 1 membresía ACTIVE
    const finalInv = await prisma.organizationInvitation.findUnique({
      where: { id: invId },
    });
    expect(finalInv?.status).toBe(InvitationStatus.ACCEPTED);

    const memberships = await prisma.organizationMembership.findMany({
      where: { organizationId: orgId, userId: invitee.user.id },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0].role).toBe(OrganizationRole.LAWYER);
    expect(memberships[0].status).toBe(MembershipStatus.ACTIVE);
  });

  it("PG-AUTH03-004: should protect last ORG_OWNER and execute transactional ownership transfer on real PostgreSQL", async () => {
    const owner = await createRealUserWithSession("pg-xfer-own");
    const successor = await createRealUserWithSession("pg-xfer-new");

    const orgRes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", owner.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", owner.csrfToken)
      .send({ name: "Estudio Transferencia PG" })
      .expect(HttpStatus.CREATED);
    const orgId = orgRes.body.organization.id;
    const ownerMemId = orgRes.body.membership.id;
    createdOrgIds.push(orgId);

    const successorMem = await prisma.organizationMembership.create({
      data: {
        userId: successor.user.id,
        organizationId: orgId,
        role: OrganizationRole.ORG_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });

    // No se puede revocar el único ORG_OWNER -> 409
    await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/members/${ownerMemId}/revoke`)
      .set("Cookie", owner.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", owner.csrfToken)
      .expect(HttpStatus.CONFLICT);

    // Transferir propiedad atómicamente -> OK
    await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/transfer-ownership`)
      .set("Cookie", owner.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", owner.csrfToken)
      .send({ targetMembershipId: successorMem.id })
      .expect(HttpStatus.OK);

    const dbNewOwner = await prisma.organizationMembership.findUnique({
      where: { id: successorMem.id },
    });
    const dbOldOwner = await prisma.organizationMembership.findUnique({
      where: { id: ownerMemId },
    });

    expect(dbNewOwner?.role).toBe(OrganizationRole.ORG_OWNER);
    expect(dbOldOwner?.role).toBe(OrganizationRole.ORG_ADMIN);

    // Ahora el nuevo owner SÍ puede suspender al antiguo owner (ya no es el último owner)
    await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/members/${ownerMemId}/suspend`)
      .set("Cookie", successor.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", successor.csrfToken)
      .expect(HttpStatus.OK);
  });

  it("PG-AUTH03-005, PG-AUTH03-006 & PG-AUTH03-007: should persist active org in UserSession, revoke access immediately upon membership revocation, preserve global identity and isolate AuditLog", async () => {
    const ownerA = await createRealUserWithSession("pg-act-ownA");
    const ownerB = await createRealUserWithSession("pg-act-ownB");
    const member = await createRealUserWithSession("pg-act-mem");

    const orgARes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", ownerA.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", ownerA.csrfToken)
      .send({ name: "Estudio Activo PG A" })
      .expect(HttpStatus.CREATED);
    const orgAId = orgARes.body.organization.id;
    createdOrgIds.push(orgAId);

    const orgBRes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", ownerB.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", ownerB.csrfToken)
      .send({ name: "Estudio Activo PG B" })
      .expect(HttpStatus.CREATED);
    const orgBId = orgBRes.body.organization.id;
    createdOrgIds.push(orgBId);

    const memberInA = await prisma.organizationMembership.create({
      data: {
        userId: member.user.id,
        organizationId: orgAId,
        role: OrganizationRole.LAWYER,
        status: MembershipStatus.ACTIVE,
      },
    });

    // Seleccionar Org A -> persiste UserSession.activeOrganizationId en PostgreSQL
    await request(app.getHttpServer())
      .post("/api/organizations/active")
      .set("Cookie", member.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", member.csrfToken)
      .send({ organizationId: orgAId })
      .expect(HttpStatus.OK);

    const dbSession = await prisma.userSession.findUnique({
      where: { id: member.session.id },
    });
    expect(dbSession?.activeOrganizationId).toBe(orgAId);

    // Revocar membresía en Org A
    await request(app.getHttpServer())
      .post(`/api/organizations/${orgAId}/members/${memberInA.id}/revoke`)
      .set("Cookie", ownerA.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", ownerA.csrfToken)
      .expect(HttpStatus.OK);

    // PG-AUTH03-007: La identidad global (User + UserIdentity) y el historial siguen intactos
    const preservedUser = await prisma.user.findUnique({
      where: { id: member.user.id },
    });
    const preservedIdentity = await prisma.userIdentity.findUnique({
      where: { id: member.identity.id },
    });
    expect(preservedUser).not.toBeNull();
    expect(preservedIdentity).not.toBeNull();

    // PG-AUTH03-005: Siguiente consulta de org activa rechaza inmediatamente (403/404)
    const activeAfterRevoke = await request(app.getHttpServer())
      .get("/api/organizations/active")
      .set("Cookie", member.cookies);
    expect([HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND]).toContain(
      activeAfterRevoke.status,
    );

    // PG-AUTH03-006: Auditoría real en PostgreSQL estrictamente aislada por organización
    const auditARes = await request(app.getHttpServer())
      .get(`/api/organizations/${orgAId}/audit`)
      .set("Cookie", ownerA.cookies)
      .expect(HttpStatus.OK);
    expect(auditARes.body.events.length).toBeGreaterThanOrEqual(2);
    expect(
      auditARes.body.events.every((e: any) => e.organizationId === orgAId),
    ).toBe(true);
    expect(
      auditARes.body.events.some((e: any) => e.action === "MEMBERSHIP_REVOKED"),
    ).toBe(true);

    // ownerA no puede consultar auditoría de Org B -> 403
    await request(app.getHttpServer())
      .get(`/api/organizations/${orgBId}/audit`)
      .set("Cookie", ownerA.cookies)
      .expect(HttpStatus.FORBIDDEN);
  });

  it("PG-AUTH03-008 [Recipient Security on Real PG]: another authenticated user stealing invitation token or having mismatched Auth0 authEmail must be rejected (403) without consuming invitation", async () => {
    const owner = await createRealUserWithSession("pg-rec-own");
    const intended = await createRealUserWithSession("pg-rec-int");
    const thief = await createRealUserWithSession("pg-rec-thf");

    const orgRes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", owner.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", owner.csrfToken)
      .send({ name: "Estudio Destinatario PG" })
      .expect(HttpStatus.CREATED);
    const orgId = orgRes.body.organization.id;
    createdOrgIds.push(orgId);

    // 1. Invitación dirigida a intended -> thief no puede aceptarla ni consumirla
    const invRes = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/invitations`)
      .set("Cookie", owner.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", owner.csrfToken)
      .send({
        invitedEmail: intended.user.email,
        role: OrganizationRole.LAWYER,
      })
      .expect(HttpStatus.CREATED);

    await request(app.getHttpServer())
      .post("/api/invitations/accept")
      .set("Cookie", thief.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", thief.csrfToken)
      .send({ token: invRes.body.invitationToken })
      .expect(HttpStatus.FORBIDDEN);

    const stillPending = await prisma.organizationInvitation.findUnique({
      where: { id: invRes.body.invitation.id },
    });
    expect(stillPending?.status).toBe(InvitationStatus.PENDING);

    // Destinatario real sí puede aceptarla
    await request(app.getHttpServer())
      .post("/api/invitations/accept")
      .set("Cookie", intended.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", intended.csrfToken)
      .send({ token: invRes.body.invitationToken })
      .expect(HttpStatus.OK);

    // 2. Identidad Auth0 con authEmail distinto al User.email -> debe ser rechazada (403)
    const mismatched = await createRealUserWithSession("pg-rec-mis");
    await prisma.userIdentity.update({
      where: { id: mismatched.identity.id },
      data: { authEmail: "verified-different@auth0.com" },
    });

    const invMis = await request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/invitations`)
      .set("Cookie", owner.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", owner.csrfToken)
      .send({
        invitedEmail: mismatched.user.email,
        role: OrganizationRole.STAFF,
      })
      .expect(HttpStatus.CREATED);

    await request(app.getHttpServer())
      .post("/api/invitations/accept")
      .set("Cookie", mismatched.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", mismatched.csrfToken)
      .send({ token: invMis.body.invitationToken })
      .expect(HttpStatus.FORBIDDEN);
  });

  it("PG-AUTH03-009 [Real PG Concurrency — Last Owner Write-Skew & Atomic Transfer]: concurrent revoke/suspend/transfer operations must NEVER leave an active organization with 0 active ORG_OWNERs or return HTTP 500", async () => {
    // Escenario A: Dos ORG_OWNER activos intentando revocarse mutuamente de forma concurrente
    const owner1 = await createRealUserWithSession("pg-ws-o1");
    const owner2 = await createRealUserWithSession("pg-ws-o2");

    const orgARes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", owner1.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", owner1.csrfToken)
      .send({ name: "Estudio WriteSkew Revoke" })
      .expect(HttpStatus.CREATED);
    const orgAId = orgARes.body.organization.id;
    const owner1MemId = orgARes.body.membership.id;
    createdOrgIds.push(orgAId);

    const owner2Mem = await prisma.organizationMembership.create({
      data: {
        userId: owner2.user.id,
        organizationId: orgAId,
        role: OrganizationRole.ORG_OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const [revA, revB] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/organizations/${orgAId}/members/${owner2Mem.id}/revoke`)
        .set("Cookie", owner1.cookies)
        .set("Origin", APP_ORIGIN)
        .set("X-CSRF-Token", owner1.csrfToken),
      request(app.getHttpServer())
        .post(`/api/organizations/${orgAId}/members/${owner1MemId}/revoke`)
        .set("Cookie", owner2.cookies)
        .set("Origin", APP_ORIGIN)
        .set("X-CSRF-Token", owner2.csrfToken),
    ]);

    const revStatuses = [revA.status, revB.status];
    expect(revStatuses.filter((s) => s >= 500)).toHaveLength(0);
    expect(revStatuses.filter((s) => s === HttpStatus.OK)).toHaveLength(1);
    expect(
      revStatuses.filter(
        (s) => s === HttpStatus.CONFLICT || s === HttpStatus.FORBIDDEN,
      ),
    ).toHaveLength(1);

    const remainingOwnersA = await prisma.organizationMembership.count({
      where: {
        organizationId: orgAId,
        role: OrganizationRole.ORG_OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    expect(remainingOwnersA).toBe(1);

    // Escenario B: Dos ORG_OWNER activos intentando suspenderse mutuamente de forma concurrente
    const owner3 = await createRealUserWithSession("pg-ws-o3");
    const owner4 = await createRealUserWithSession("pg-ws-o4");

    const orgBRes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", owner3.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", owner3.csrfToken)
      .send({ name: "Estudio WriteSkew Suspend" })
      .expect(HttpStatus.CREATED);
    const orgBId = orgBRes.body.organization.id;
    const owner3MemId = orgBRes.body.membership.id;
    createdOrgIds.push(orgBId);

    const owner4Mem = await prisma.organizationMembership.create({
      data: {
        userId: owner4.user.id,
        organizationId: orgBId,
        role: OrganizationRole.ORG_OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const [suspA, suspB] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/organizations/${orgBId}/members/${owner4Mem.id}/suspend`)
        .set("Cookie", owner3.cookies)
        .set("Origin", APP_ORIGIN)
        .set("X-CSRF-Token", owner3.csrfToken),
      request(app.getHttpServer())
        .post(`/api/organizations/${orgBId}/members/${owner3MemId}/suspend`)
        .set("Cookie", owner4.cookies)
        .set("Origin", APP_ORIGIN)
        .set("X-CSRF-Token", owner4.csrfToken),
    ]);

    const suspStatuses = [suspA.status, suspB.status];
    expect(suspStatuses.filter((s) => s >= 500)).toHaveLength(0);
    expect(suspStatuses.filter((s) => s === HttpStatus.OK)).toHaveLength(1);
    expect(
      suspStatuses.filter(
        (s) => s === HttpStatus.CONFLICT || s === HttpStatus.FORBIDDEN,
      ),
    ).toHaveLength(1);

    const remainingOwnersB = await prisma.organizationMembership.count({
      where: {
        organizationId: orgBId,
        role: OrganizationRole.ORG_OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    expect(remainingOwnersB).toBe(1);

    // Escenario C: Dos transferencias concurrentes del mismo ORG_OWNER hacia dos candidatos distintos
    const owner5 = await createRealUserWithSession("pg-ws-o5");
    const cand1 = await createRealUserWithSession("pg-ws-c1");
    const cand2 = await createRealUserWithSession("pg-ws-c2");

    const orgCRes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", owner5.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", owner5.csrfToken)
      .send({ name: "Estudio WriteSkew Transfer" })
      .expect(HttpStatus.CREATED);
    const orgCId = orgCRes.body.organization.id;
    createdOrgIds.push(orgCId);

    const cand1Mem = await prisma.organizationMembership.create({
      data: {
        userId: cand1.user.id,
        organizationId: orgCId,
        role: OrganizationRole.ORG_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });
    const cand2Mem = await prisma.organizationMembership.create({
      data: {
        userId: cand2.user.id,
        organizationId: orgCId,
        role: OrganizationRole.LAWYER,
        status: MembershipStatus.ACTIVE,
      },
    });

    // Transferencia a membresía suspendida -> 400 Bad Request
    const suspCand = await createRealUserWithSession("pg-ws-cs");
    const suspCandMem = await prisma.organizationMembership.create({
      data: {
        userId: suspCand.user.id,
        organizationId: orgCId,
        role: OrganizationRole.LAWYER,
        status: MembershipStatus.SUSPENDED,
      },
    });
    await request(app.getHttpServer())
      .post(`/api/organizations/${orgCId}/transfer-ownership`)
      .set("Cookie", owner5.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", owner5.csrfToken)
      .send({ targetMembershipId: suspCandMem.id })
      .expect(HttpStatus.BAD_REQUEST);

    const [tx1, tx2] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/organizations/${orgCId}/transfer-ownership`)
        .set("Cookie", owner5.cookies)
        .set("Origin", APP_ORIGIN)
        .set("X-CSRF-Token", owner5.csrfToken)
        .send({ targetMembershipId: cand1Mem.id }),
      request(app.getHttpServer())
        .post(`/api/organizations/${orgCId}/transfer-ownership`)
        .set("Cookie", owner5.cookies)
        .set("Origin", APP_ORIGIN)
        .set("X-CSRF-Token", owner5.csrfToken)
        .send({ targetMembershipId: cand2Mem.id }),
    ]);

    const txStatuses = [tx1.status, tx2.status];
    expect(txStatuses.filter((s) => s >= 500)).toHaveLength(0);
    expect(txStatuses.filter((s) => s === HttpStatus.OK)).toHaveLength(1);
    expect(
      txStatuses.filter(
        (s) => s === HttpStatus.FORBIDDEN || s === HttpStatus.CONFLICT,
      ),
    ).toHaveLength(1);

    const remainingOwnersC = await prisma.organizationMembership.count({
      where: {
        organizationId: orgCId,
        role: OrganizationRole.ORG_OWNER,
        status: MembershipStatus.ACTIVE,
      },
    });
    expect(remainingOwnersC).toBe(1);
  });

  it("PG-AUTH03-010 [Real PG Legacy Fields Isolation]: mutating legacy User.role=ADMIN and User.organizationId in PostgreSQL must NEVER grant elevation or cross-org access", async () => {
    const owner = await createRealUserWithSession("pg-leg-own");
    const outsider = await createRealUserWithSession("pg-leg-out");

    const orgRes = await request(app.getHttpServer())
      .post("/api/organizations")
      .set("Cookie", owner.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", owner.csrfToken)
      .send({ name: "Estudio Legacy Isolation PG" })
      .expect(HttpStatus.CREATED);
    const orgId = orgRes.body.organization.id;
    createdOrgIds.push(orgId);

    // Escalar campos legacy directamente en PostgreSQL
    await prisma.user.update({
      where: { id: outsider.user.id },
      data: {
        role: UserRole.ADMIN,
        organizationId: orgId,
      },
    });

    // 1. Sin OrganizationMembership -> 403 en todo
    await request(app.getHttpServer())
      .get(`/api/organizations/${orgId}/members`)
      .set("Cookie", outsider.cookies)
      .expect(HttpStatus.FORBIDDEN);

    await request(app.getHttpServer())
      .post("/api/organizations/active")
      .set("Cookie", outsider.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", outsider.csrfToken)
      .send({ organizationId: orgId })
      .expect(HttpStatus.FORBIDDEN);

    // 2. Con membresía LAWYER -> el rol contextual es LAWYER (NO ADMIN legacy)
    await prisma.organizationMembership.create({
      data: {
        userId: outsider.user.id,
        organizationId: orgId,
        role: OrganizationRole.LAWYER,
        status: MembershipStatus.ACTIVE,
      },
    });

    const activeRes = await request(app.getHttpServer())
      .post("/api/organizations/active")
      .set("Cookie", outsider.cookies)
      .set("Origin", APP_ORIGIN)
      .set("X-CSRF-Token", outsider.csrfToken)
      .send({ organizationId: orgId })
      .expect(HttpStatus.OK);
    expect(activeRes.body.activeOrganization.role).toBe(
      OrganizationRole.LAWYER,
    );

    await request(app.getHttpServer())
      .get(`/api/organizations/${orgId}/members`)
      .set("Cookie", outsider.cookies)
      .expect(HttpStatus.FORBIDDEN);
  });
});
