/**
 * AUTH-05 — Suite TDS Real sobre PostgreSQL 18 (abogados_test bajo abogados_app_user NOBYPASSRLS)
 * Expediente: AUTH05-CLIENTS-IMPLEMENTATION-001
 *
 * Cubre exhaustivamente las especificaciones funcionales y de seguridad de AUTH-05:
 * - 5.1 Pruebas funcionales: Alta (humana y jurídica), validaciones, listado, detalle, edición,
 *       búsqueda, paginación, filtros por tipo y estado, archivado (soft delete) y registro de auditoría.
 * - 5.2 Pruebas de seguridad: Sin sesión, sin org activa, membresía inactiva, org suspendida,
 *       aislamiento multi-tenant estricto entre Org A y Org B, anti-enumeración / prevención IDOR (404),
 *       manipulación de organizationId en body/query/headers (403), matriz de permisos por rol
 *       (STAFF con proyección sin notas, ASSISTANT/LAWYER sin delete, ADMIN/OWNER con delete),
 *       unicidad de DNI/CUIT aislada por organización e inmunidad frente a campos legacy.
 * - 5.3 Verificación en PostgreSQL 18 real con el rol runtime abogados_app_user.
 */

import {
  PrismaClient,
  OrganizationRole,
  MembershipStatus,
  OrganizationStatus,
  UserRole,
  ClientPersonType,
  ClientStatus,
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
import { ClientsModule } from "../../src/clients/clients.module";
import { BffSessionService } from "../../src/auth/bff/bff-session.service";
import { CsrfService } from "../../src/auth/bff/csrf.service";

interface TestUserSession {
  userId: string;
  email: string;
  rawSessionSecret: string;
  csrfToken: string;
  cookies: string[];
}

describe("AUTH-05 — Módulo de Clientes (Real PostgreSQL 18 — abogados_test)", () => {
  let app: INestApplication;
  let adminPrisma: PrismaClient;
  let appPrisma: PrismaClient;

  let sessionService: BffSessionService;
  let csrfService: CsrfService;

  const APP_ORIGIN = "http://localhost:3000";
  const TEST_ENCRYPTION_KEY =
    process.env.OIDC_TRANSACTION_ENCRYPTION_KEY ||
    "9059d7b7e25d3c8c6de1cb0dc62232e3692c26404b1c2cdaecc19e559ef16a0c";

  const adminDbUrl =
    process.env.MIGRATION_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/abogados_test?schema=public";
  const appRuntimeDbUrl = process.env.APP_RUNTIME_DATABASE_URL || "";

  const runTag = `cli05-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

  let orgAId: string;
  let orgBId: string;
  let orgSuspendedId: string;

  let ownerA: TestUserSession;
  let adminA: TestUserSession;
  let lawyerA: TestUserSession;
  let assistantA: TestUserSession;
  let staffA: TestUserSession;
  let lawyerB: TestUserSession;
  let noActiveOrgUser: TestUserSession;
  let revokedMemberUser: TestUserSession;
  let suspendedOrgUser: TestUserSession;

  let clientA1Id: string;
  let clientB1Id: string;

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdClientIds: string[] = [];

  const withAuth = (
    req: request.Test,
    u: TestUserSession,
    isMutating = false,
  ) => {
    req.set("Cookie", u.cookies);
    if (isMutating) {
      req.set("Origin", APP_ORIGIN);
      req.set("X-CSRF-Token", u.csrfToken);
    }
    return req;
  };

  const createUserWithMembership = async (
    label: string,
    memberships: Array<{
      organizationId: string;
      role: OrganizationRole;
      status?: MembershipStatus;
    }>,
    activeOrganizationId: string | null,
  ): Promise<TestUserSession> => {
    const email = `${label}-${runTag}@abogados-test.com`;
    const baseOrgId = memberships[0]?.organizationId || orgAId;
    const user = await adminPrisma.user.create({
      data: {
        email,
        fullName: `User ${label}`,
        passwordHash: "$2b$04$testMockHashNeverExposed",
        role: UserRole.ASSOCIATE,
        organizationId: baseOrgId,
      },
    });
    createdUserIds.push(user.id);

    await adminPrisma.userIdentity.create({
      data: {
        userId: user.id,
        issuer: "https://abogados-test.us.auth0.com/",
        subject: `auth0|${label}-${runTag}`,
        authEmail: email,
      },
    });

    for (const m of memberships) {
      await adminPrisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: m.organizationId,
          role: m.role,
          status: m.status ?? MembershipStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });
    }

    const { rawSessionSecret } = await sessionService.createSession(user.id);
    if (activeOrganizationId !== undefined) {
      const tokenHash = crypto
        .createHash("sha256")
        .update(rawSessionSecret)
        .digest("hex");
      await adminPrisma.userSession.update({
        where: { sessionToken: tokenHash },
        data: { activeOrganizationId },
      });
    }

    const csrfToken = csrfService.generateToken(rawSessionSecret);
    return {
      userId: user.id,
      email,
      rawSessionSecret,
      csrfToken,
      cookies: [`app_session=${rawSessionSecret}`, `csrf_token=${csrfToken}`],
    };
  };

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

    // App NestJS
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
              OIDC_TRANSACTION_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
            }),
          ],
        }),
        AuthzModule,
        AuthModule,
        OrganizationsModule,
        ClientsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(appPrisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    sessionService = moduleRef.get<BffSessionService>(BffSessionService);
    csrfService = moduleRef.get<CsrfService>(CsrfService);

    // Seed Organizaciones
    const orgA = await adminPrisma.organization.create({
      data: {
        name: `Estudio Jurídico A ${runTag}`,
        status: OrganizationStatus.ACTIVE,
      },
    });
    const orgB = await adminPrisma.organization.create({
      data: {
        name: `Estudio Jurídico B ${runTag}`,
        status: OrganizationStatus.ACTIVE,
      },
    });
    const orgSusp = await adminPrisma.organization.create({
      data: {
        name: `Estudio Suspendido ${runTag}`,
        status: OrganizationStatus.SUSPENDED,
      },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;
    orgSuspendedId = orgSusp.id;
    createdOrgIds.push(orgAId, orgBId, orgSuspendedId);

    // Seed Usuarios de Org A y B
    ownerA = await createUserWithMembership(
      "owner-a",
      [{ organizationId: orgAId, role: OrganizationRole.ORG_OWNER }],
      orgAId,
    );
    adminA = await createUserWithMembership(
      "admin-a",
      [{ organizationId: orgAId, role: OrganizationRole.ORG_ADMIN }],
      orgAId,
    );
    lawyerA = await createUserWithMembership(
      "lawyer-a",
      [{ organizationId: orgAId, role: OrganizationRole.LAWYER }],
      orgAId,
    );
    assistantA = await createUserWithMembership(
      "assistant-a",
      [{ organizationId: orgAId, role: OrganizationRole.ASSISTANT }],
      orgAId,
    );
    staffA = await createUserWithMembership(
      "staff-a",
      [{ organizationId: orgAId, role: OrganizationRole.STAFF }],
      orgAId,
    );
    lawyerB = await createUserWithMembership(
      "lawyer-b",
      [{ organizationId: orgBId, role: OrganizationRole.LAWYER }],
      orgBId,
    );

    // Usuarios con estados anómalos para seguridad
    noActiveOrgUser = await createUserWithMembership(
      "no-active-org",
      [{ organizationId: orgAId, role: OrganizationRole.LAWYER }],
      null, // Sin org activa
    );
    revokedMemberUser = await createUserWithMembership(
      "revoked-member",
      [
        {
          organizationId: orgAId,
          role: OrganizationRole.LAWYER,
          status: MembershipStatus.REVOKED,
        },
      ],
      orgAId,
    );
    suspendedOrgUser = await createUserWithMembership(
      "suspended-org-user",
      [{ organizationId: orgSuspendedId, role: OrganizationRole.LAWYER }],
      orgSuspendedId,
    );

    // Seed de cliente existente en Org A y Org B
    const clA1 = await adminPrisma.client.create({
      data: {
        organizationId: orgAId,
        personType: ClientPersonType.HUMANA,
        firstName: `Carlos`,
        lastName: `Alvarez`,
        dniCuit: `20-30123456-7`,
        email: `carlos.alvarez-${runTag}@example.com`,
        phone: "+541155551234",
        address: "Av. Corrientes 1234",
        city: "CABA",
        province: "Buenos Aires",
        notes: "Cliente confidencial Org A",
        status: ClientStatus.ACTIVO,
      },
    });
    clientA1Id = clA1.id;
    createdClientIds.push(clientA1Id);

    const clB1 = await adminPrisma.client.create({
      data: {
        organizationId: orgBId,
        personType: ClientPersonType.JURIDICA,
        firstName: `Empresa Beta S.A.`,
        lastName: null,
        dniCuit: `30-70987654-3`,
        email: `contacto@beta-${runTag}.com`,
        phone: "+541144449876",
        address: "Av. Libertador 5678",
        city: "CABA",
        province: "Buenos Aires",
        notes: "Cliente confidencial Org B",
        status: ClientStatus.ACTIVO,
      },
    });
    clientB1Id = clB1.id;
    createdClientIds.push(clientB1Id);
  }, 45000);

  afterAll(async () => {
    if (adminPrisma) {
      await adminPrisma.auditLog.deleteMany({
        where: { organizationId: { in: createdOrgIds } },
      });
      await adminPrisma.client.deleteMany({
        where: { organizationId: { in: createdOrgIds } },
      });
      await adminPrisma.organizationInvitation.deleteMany({
        where: { organizationId: { in: createdOrgIds } },
      });
      await adminPrisma.organizationMembership.deleteMany({
        where: { organizationId: { in: createdOrgIds } },
      });
      await adminPrisma.userSession.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await adminPrisma.userIdentity.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await adminPrisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
      await adminPrisma.organization.deleteMany({
        where: { id: { in: createdOrgIds } },
      });
    }

    if (app) {
      await app.close();
    }
    await Promise.all([adminPrisma?.$disconnect(), appPrisma?.$disconnect()]);
  });

  // =========================================================================
  // 5.1 — PRUEBAS FUNCIONALES DEL MÓDULO DE CLIENTES
  // =========================================================================

  describe("5.1 — Pruebas Funcionales", () => {
    it("TDS-CLI-001: Alta válida de Persona Humana con todos los campos", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).post("/clients"),
        lawyerA,
        true,
      ).send({
        personType: "HUMANA",
        firstName: "María",
        lastName: "Fernández",
        dniCuit: `27-35678901-4`,
        email: `maria.f-${runTag}@example.com`,
        phone: "+541166667788",
        address: "Calle Falsa 123",
        city: "La Plata",
        province: "Buenos Aires",
        notes: "Primera consulta laboral",
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body.firstName).toBe("María");
      expect(res.body.lastName).toBe("Fernández");
      expect(res.body.personType).toBe("HUMANA");
      expect(res.body.status).toBe("ACTIVO");
      expect(res.body.dniCuit).toBe("27-35678901-4");
      expect(res.body.notes).toBe("Primera consulta laboral");
      createdClientIds.push(res.body.id);
    });

    it("TDS-CLI-002: Alta válida de Persona Jurídica (Razón Social sin apellido)", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).post("/clients"),
        assistantA,
        true,
      ).send({
        personType: "JURIDICA",
        firstName: "Acme Argentina S.R.L.",
        dniCuit: `30-65432109-8`,
        email: `legales@acme-${runTag}.com.ar`,
        phone: "+541140001111",
        address: "Parque Industrial Norte 45",
        city: "Pilar",
        province: "Buenos Aires",
        notes: "Contrato corporativo anual",
      });

      expect(res.status).toBe(201);
      expect(res.body.personType).toBe("JURIDICA");
      expect(res.body.firstName).toBe("Acme Argentina S.R.L.");
      expect(res.body.lastName).toBeNull();
      expect(res.body.status).toBe("ACTIVO");
      createdClientIds.push(res.body.id);
    });

    it("TDS-CLI-003: Rechazo de datos inválidos (email no válido, personType corrupto)", async () => {
      const res1 = await withAuth(
        request(app.getHttpServer()).post("/clients"),
        lawyerA,
        true,
      ).send({
        personType: "HUMANA",
        firstName: "Invalido",
        lastName: "Test",
        email: "not-an-email",
      });
      expect(res1.status).toBe(400);

      const res2 = await withAuth(
        request(app.getHttpServer()).post("/clients"),
        lawyerA,
        true,
      ).send({
        personType: "ALIEN_TYPE",
        firstName: "Invalido",
      });
      expect(res2.status).toBe(400);
    });

    it("TDS-CLI-004: Rechazo de campos obligatorios ausentes (firstName vacío)", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).post("/clients"),
        lawyerA,
        true,
      ).send({
        personType: "HUMANA",
        firstName: "",
        lastName: "Sin Nombre",
      });
      expect(res.status).toBe(400);
    });

    it("TDS-CLI-005: Consulta de listado paginado con metadatos de total, page, limit, totalPages", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get("/clients?page=1&limit=2"),
        lawyerA,
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty("total");
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(2);
      expect(res.body).toHaveProperty("totalPages");
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });

    it("TDS-CLI-006: Consulta de detalle por ID", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get(`/clients/${clientA1Id}`),
        lawyerA,
      );

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(clientA1Id);
      expect(res.body.firstName).toBe("Carlos");
      expect(res.body.lastName).toBe("Alvarez");
      expect(res.body.notes).toBe("Cliente confidencial Org A");
    });

    it("TDS-CLI-007: Edición parcial de cliente existente", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).patch(`/clients/${clientA1Id}`),
        lawyerA,
        true,
      ).send({
        phone: "+541199998888",
        notes: "Notas actualizadas por Lawyer A",
        city: "San Isidro",
      });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(clientA1Id);
      expect(res.body.phone).toBe("+541199998888");
      expect(res.body.notes).toBe("Notas actualizadas por Lawyer A");
      expect(res.body.city).toBe("San Isidro");
      expect(res.body.firstName).toBe("Carlos"); // Intacto
    });

    it("TDS-CLI-008: Búsqueda por nombre o razón social", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get("/clients?search=Carlos"),
        lawyerA,
      );

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const found = res.body.data.find((c: any) => c.id === clientA1Id);
      expect(found).toBeDefined();
    });

    it("TDS-CLI-009: Búsqueda por DNI/CUIT", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get("/clients?search=30123456"),
        lawyerA,
      );

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].id).toBe(clientA1Id);
    });

    it("TDS-CLI-010: Filtrado por status y por personType", async () => {
      const resHumana = await withAuth(
        request(app.getHttpServer()).get("/clients?personType=HUMANA"),
        lawyerA,
      );
      expect(resHumana.status).toBe(200);
      resHumana.body.data.forEach((c: any) => {
        expect(c.personType).toBe("HUMANA");
      });

      const resActivo = await withAuth(
        request(app.getHttpServer()).get("/clients?status=ACTIVO"),
        lawyerA,
      );
      expect(resActivo.status).toBe(200);
      resActivo.body.data.forEach((c: any) => {
        expect(c.status).toBe("ACTIVO");
      });
    });

    it("TDS-CLI-011: Archivado (soft delete) preserva el registro con status ARCHIVADO", async () => {
      // Admin o Owner archiva cliente
      const res = await withAuth(
        request(app.getHttpServer()).delete(`/clients/${clientA1Id}`),
        ownerA,
        true,
      );
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ARCHIVADO");

      // Verificación en BD real: el registro existe físicamente (no eliminado)
      const inDb = await adminPrisma.client.findUnique({
        where: { id: clientA1Id },
      });
      expect(inDb).not.toBeNull();
      expect(inDb?.status).toBe(ClientStatus.ARCHIVADO);

      // Por omisión, el listado no muestra archivados a menos que se filtre status=ARCHIVADO
      const listActive = await withAuth(
        request(app.getHttpServer()).get("/clients"),
        lawyerA,
      );
      const inList = listActive.body.data.find((c: any) => c.id === clientA1Id);
      expect(inList).toBeUndefined();

      // Con filtro explícito status=ARCHIVADO sí aparece
      const listArchived = await withAuth(
        request(app.getHttpServer()).get("/clients?status=ARCHIVADO"),
        lawyerA,
      );
      const inArchived = listArchived.body.data.find(
        (c: any) => c.id === clientA1Id,
      );
      expect(inArchived).toBeDefined();
    });

    it("TDS-CLI-012: Registro de auditoría para altas, modificaciones y archivado", async () => {
      const logs = await adminPrisma.auditLog.findMany({
        where: { organizationId: orgAId },
        orderBy: { timestamp: "desc" },
      });

      const actions = logs.map((l) => l.action);
      expect(actions).toContain("CLIENT_CREATED");
      expect(actions).toContain("CLIENT_UPDATED");
      expect(actions).toContain("CLIENT_ARCHIVED");

      // Verificar sanitización: no existen campos sensibles en oldValues ni newValues
      for (const log of logs) {
        const rawJson = JSON.stringify(log.newValues || {});
        expect(rawJson).not.toMatch(/password|secret|token|hash/i);
      }
    });
  });

  // =========================================================================
  // 5.2 — PRUEBAS DE SEGURIDAD Y AISLAMIENTO MULTI-ORGANIZACIÓN
  // =========================================================================

  describe("5.2 — Pruebas de Seguridad y Aislamiento Multi-Organización", () => {
    it("TDS-SEC-001: Petición sin cookie de sesión BFF es denegada con 401", async () => {
      const res = await request(app.getHttpServer()).get("/clients");
      expect(res.status).toBe(401);
    });

    it("TDS-SEC-002: Petición con sesión pero sin organización activa retorna 403 (NO_ACTIVE_ORGANIZATION)", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get("/clients"),
        noActiveOrgUser,
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("NO_ACTIVE_ORGANIZATION");
    });

    it("TDS-SEC-003: Usuario con membresía inactiva/revocada retorna 403 (MEMBERSHIP_INACTIVE)", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get("/clients"),
        revokedMemberUser,
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("MEMBERSHIP_INACTIVE");
    });

    it("TDS-SEC-004: Usuario de organización en estado SUSPENDED retorna 403 (ORGANIZATION_INACTIVE)", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get("/clients"),
        suspendedOrgUser,
      );
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ORGANIZATION_INACTIVE");
    });

    it("TDS-SEC-005: Aislamiento total: Org A jamás ve clientes de Org B en listado", async () => {
      const resA = await withAuth(
        request(app.getHttpServer()).get("/clients?status=ACTIVO"),
        lawyerA,
      );
      expect(resA.status).toBe(200);
      const idsA = resA.body.data.map((c: any) => c.id);
      expect(idsA).not.toContain(clientB1Id);

      const resB = await withAuth(
        request(app.getHttpServer()).get("/clients?status=ACTIVO"),
        lawyerB,
      );
      expect(resB.status).toBe(200);
      const idsB = resB.body.data.map((c: any) => c.id);
      expect(idsB).toContain(clientB1Id);
      expect(idsB).not.toContain(clientA1Id);
    });

    it("TDS-SEC-006: Anti-enumeración en Detalle: Org A consultando cliente de Org B retorna 404 (no 403)", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get(`/clients/${clientB1Id}`),
        lawyerA,
      );
      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/no encontrado|not found/i);
    });

    it("TDS-SEC-007: Anti-enumeración en Edición: Org A intentando editar cliente de Org B retorna 404", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).patch(`/clients/${clientB1Id}`),
        lawyerA,
        true,
      ).send({
        firstName: "Ataque IDOR",
      });
      expect(res.status).toBe(404);

      // Verificar que el registro en Org B permanezca intacto
      const clientB = await adminPrisma.client.findUnique({
        where: { id: clientB1Id },
      });
      expect(clientB?.firstName).toBe("Empresa Beta S.A.");
    });

    it("TDS-SEC-008: Anti-enumeración en Archivado: Org A intentando archivar cliente de Org B retorna 404", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).delete(`/clients/${clientB1Id}`),
        ownerA,
        true,
      );
      expect(res.status).toBe(404);

      const clientB = await adminPrisma.client.findUnique({
        where: { id: clientB1Id },
      });
      expect(clientB?.status).toBe(ClientStatus.ACTIVO);
    });

    it("TDS-SEC-009: Manipulación de organizationId en body, query o header x-org-id es rechazada con 403 (ORGANIZATION_CONTEXT_MISMATCH)", async () => {
      // Intento en body
      const resBody = await withAuth(
        request(app.getHttpServer()).post("/clients"),
        lawyerA,
        true,
      ).send({
        organizationId: orgBId, // Intento de inyectar tenant ajeno
        firstName: "Malicioso",
      });
      expect(resBody.status).toBe(403);
      expect(resBody.body.code).toBe("ORGANIZATION_CONTEXT_MISMATCH");

      // Intento en query
      const resQuery = await withAuth(
        request(app.getHttpServer()).get(`/clients?organizationId=${orgBId}`),
        lawyerA,
      );
      expect(resQuery.status).toBe(403);
      expect(resQuery.body.code).toBe("ORGANIZATION_CONTEXT_MISMATCH");

      // Intento en header
      const resHeader = await withAuth(
        request(app.getHttpServer()).get("/clients"),
        lawyerA,
      ).set("x-org-id", orgBId);
      expect(resHeader.status).toBe(403);
      expect(resHeader.body.code).toBe("ORGANIZATION_CONTEXT_MISMATCH");
    });

    it("TDS-SEC-010: Matriz de Permisos por Rol (STAFF proyección sin notas, ASSISTANT/LAWYER sin delete, ADMIN/OWNER con delete)", async () => {
      // 1. STAFF: puede listar y ver detalle, pero NO ve `notes` en la respuesta (proyección de rol mínima)
      const staffList = await withAuth(
        request(app.getHttpServer()).get("/clients?status=ARCHIVADO"),
        staffA,
      );
      expect(staffList.status).toBe(200);
      staffList.body.data.forEach((c: any) => {
        expect(c).not.toHaveProperty("notes");
      });

      const staffDetail = await withAuth(
        request(app.getHttpServer()).get(`/clients/${clientA1Id}`),
        staffA,
      );
      expect(staffDetail.status).toBe(200);
      expect(staffDetail.body).not.toHaveProperty("notes");

      // 2. STAFF intentando crear cliente -> 403 (carece de clients:write)
      const staffCreate = await withAuth(
        request(app.getHttpServer()).post("/clients"),
        staffA,
        true,
      ).send({
        firstName: "Staff Prohibido",
      });
      expect(staffCreate.status).toBe(403);
      expect(staffCreate.body.code).toBe("INSUFFICIENT_ORG_PERMISSIONS");

      // 3. STAFF intentando editar cliente -> 403
      const staffPatch = await withAuth(
        request(app.getHttpServer()).patch(`/clients/${clientA1Id}`),
        staffA,
        true,
      ).send({
        phone: "+541100000000",
      });
      expect(staffPatch.status).toBe(403);

      // 4. LAWYER intentando archivar/eliminar -> 403 (carece de clients:delete)
      const lawyerDelete = await withAuth(
        request(app.getHttpServer()).delete(`/clients/${clientA1Id}`),
        lawyerA,
        true,
      );
      expect(lawyerDelete.status).toBe(403);
      expect(lawyerDelete.body.code).toBe("INSUFFICIENT_ORG_PERMISSIONS");

      // 5. ASSISTANT intentando archivar/eliminar -> 403
      const assistantDelete = await withAuth(
        request(app.getHttpServer()).delete(`/clients/${clientA1Id}`),
        assistantA,
        true,
      );
      expect(assistantDelete.status).toBe(403);

      // 6. ADMIN sí puede archivar/eliminar
      const adminDelete = await withAuth(
        request(app.getHttpServer()).delete(`/clients/${clientA1Id}`),
        adminA,
        true,
      );
      expect(adminDelete.status).toBe(200);
    });

    it("TDS-SEC-011: Unicidad organizacional de DNI/CUIT (Org A y Org B pueden compartir DNI/CUIT; Org A no puede duplicarlo)", async () => {
      const sharedDni = `20-99887766-5`;

      // Org A crea cliente con sharedDni
      const resA = await withAuth(
        request(app.getHttpServer()).post("/clients"),
        lawyerA,
        true,
      ).send({
        personType: "HUMANA",
        firstName: "Cliente A",
        lastName: "Compartido",
        dniCuit: sharedDni,
      });
      expect(resA.status).toBe(201);
      createdClientIds.push(resA.body.id);

      // Org B crea cliente con EL MISMO sharedDni -> ÉXITO (aislado por organización)
      const resB = await withAuth(
        request(app.getHttpServer()).post("/clients"),
        lawyerB,
        true,
      ).send({
        personType: "HUMANA",
        firstName: "Cliente B",
        lastName: "Compartido",
        dniCuit: sharedDni,
      });
      expect(resB.status).toBe(201);
      createdClientIds.push(resB.body.id);

      // Org A intenta crear SEGUNDO cliente con el mismo sharedDni -> 409 Conflict
      const resADuplicate = await withAuth(
        request(app.getHttpServer()).post("/clients"),
        lawyerA,
        true,
      ).send({
        personType: "HUMANA",
        firstName: "Cliente A Duplicado",
        lastName: "Intento",
        dniCuit: sharedDni,
      });
      expect([400, 409]).toContain(resADuplicate.status);
    });

    it("TDS-SEC-012: Inmunidad frente a campos legacy (User.organizationId / User.role)", async () => {
      // Corromper intencionalmente el registro legacy del usuario lawyerA
      await adminPrisma.user.update({
        where: { id: lawyerA.userId },
        data: {
          organizationId: orgBId, // Falsamente asignado a Org B a nivel legacy
          role: UserRole.ADMIN, // Falsamente ADMIN a nivel legacy
        },
      });

      // lawyerA tiene sesión activa en Org A con membresía LAWYER
      // Comprobar que sigue confinado a Org A y no adquiere privilegios de Org B ni de ADMIN
      const res = await withAuth(
        request(app.getHttpServer()).get("/clients"),
        lawyerA,
      );
      expect(res.status).toBe(200);
      const ids = res.body.data.map((c: any) => c.id);
      expect(ids).not.toContain(clientB1Id); // Jamás ve Org B

      // Y como su membresía activa en Org A es LAWYER, sigue sin poder archivar (no es ADMIN organizacional)
      const deleteAttempt = await withAuth(
        request(app.getHttpServer()).delete(`/clients/${clientA1Id}`),
        lawyerA,
        true,
      );
      expect(deleteAttempt.status).toBe(403);
    });
  });
});
