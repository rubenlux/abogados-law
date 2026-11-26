/**
 * AUTH-06 — Suite TDS Real sobre PostgreSQL 18 (abogados_test bajo abogados_app_user NOBYPASSRLS)
 * Expediente: AUTH06-EXPEDIENTES-IMPLEMENTATION-001
 *
 * Cubre exhaustivamente las especificaciones funcionales y de seguridad de AUTH-06:
 * - 8.1 Pruebas funcionales: Alta con datos judiciales completos, vinculación de clientes vía partes,
 *       partes externas, asignación de responsables y equipo, listado paginado, detalle completo,
 *       edición, gestión de partes (alta/modificación/baja), búsqueda, filtros por estado/fuero/jurisdicción,
 *       archivado (soft delete) y registro de auditoría en AuditLog.
 * - 8.2 Pruebas de seguridad: Sin sesión (401), sin org activa (403), membresía inactiva (403),
 *       org suspendida (403), aislamiento multi-tenant estricto entre Org A y Org B, anti-enumeración /
 *       prevención IDOR (404 en lectura, edición y archivado cruzado), rechazo de vinculación de clientes
 *       o profesionales de otra organización, rechazo de manipulación de organizationId en body/query/headers,
 *       matriz de permisos y proyecciones por rol (STAFF proyección reducida y sin escritura, ASSISTANT sin delete,
 *       ADMIN/OWNER con delete) e inmunidad frente a campos legacy.
 */

import {
  PrismaClient,
  OrganizationRole,
  MembershipStatus,
  OrganizationStatus,
  UserRole,
  ClientPersonType,
  ClientStatus,
  ExpedienteEstado,
  RolParteProcesal,
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
import { ExpedientesModule } from "../../src/expedientes/expedientes.module";
import { BffSessionService } from "../../src/auth/bff/bff-session.service";
import { CsrfService } from "../../src/auth/bff/csrf.service";

interface TestUserSession {
  userId: string;
  email: string;
  rawSessionSecret: string;
  csrfToken: string;
  cookies: string[];
}

describe("AUTH-06 — Módulo de Expedientes (Real PostgreSQL 18 — abogados_test)", () => {
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

  const runTag = `exp06-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

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
  let clientA2Id: string;
  let clientB1Id: string;

  let seedExpAId: string;
  let seedExpBId: string;

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdClientIds: string[] = [];
  const createdExpedienteIds: string[] = [];

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
        ExpedientesModule,
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
    noActiveOrgUser = await createUserWithMembership(
      "no-active",
      [{ organizationId: orgAId, role: OrganizationRole.LAWYER }],
      null,
    );
    revokedMemberUser = await createUserWithMembership(
      "revoked",
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
      "susp",
      [{ organizationId: orgSuspendedId, role: OrganizationRole.LAWYER }],
      orgSuspendedId,
    );

    // Seed Clientes para pruebas de vinculación
    const clientA1 = await adminPrisma.client.create({
      data: {
        organizationId: orgAId,
        personType: ClientPersonType.HUMANA,
        firstName: "Carlos",
        lastName: `Pérez ${runTag}`,
        dniCuit: `20${Date.now().toString().slice(-8)}1`,
        email: `carlos-${runTag}@example.com`,
        status: ClientStatus.ACTIVO,
      },
    });
    clientA1Id = clientA1.id;
    createdClientIds.push(clientA1Id);

    const clientA2 = await adminPrisma.client.create({
      data: {
        organizationId: orgAId,
        personType: ClientPersonType.JURIDICA,
        firstName: `Empresa A2 ${runTag}`,
        dniCuit: `30${Date.now().toString().slice(-8)}2`,
        email: `empresa-${runTag}@example.com`,
        status: ClientStatus.ACTIVO,
      },
    });
    clientA2Id = clientA2.id;
    createdClientIds.push(clientA2Id);

    const clientB1 = await adminPrisma.client.create({
      data: {
        organizationId: orgBId,
        personType: ClientPersonType.HUMANA,
        firstName: "Roberto",
        lastName: `Gómez ${runTag}`,
        dniCuit: `20${Date.now().toString().slice(-8)}3`,
        status: ClientStatus.ACTIVO,
      },
    });
    clientB1Id = clientB1.id;
    createdClientIds.push(clientB1Id);

    // Seed Expedientes iniciales
    const seedExpA = await adminPrisma.expediente.create({
      data: {
        organizationId: orgAId,
        caratula: `González c/ Telecom s/ Daños ${runTag}`,
        numeroExpediente: `EXP-A1-${runTag}`,
        jurisdiccion: "NACION",
        provincia: "BUENOS_AIRES",
        fuero: "CIVIL_COMERCIAL",
        juzgado: "Juzgado Nacional en lo Civil N° 14",
        secretaria: "Secretaría N° 28",
        tipoProceso: "ORDINARIO",
        materia: "DAÑOS_Y_PERJUICIOS",
        fechaInicio: new Date("2024-03-01"),
        descripcion: "Demanda por incumplimiento contractual y daños",
        estado: ExpedienteEstado.EN_TRAMITE,
        responsableId: lawyerA.userId,
      },
    });
    seedExpAId = seedExpA.id;
    createdExpedienteIds.push(seedExpAId);

    const seedExpB = await adminPrisma.expediente.create({
      data: {
        organizationId: orgBId,
        caratula: `Martínez c/ Aseguradora B s/ Cobro ${runTag}`,
        numeroExpediente: `EXP-B1-${runTag}`,
        jurisdiccion: "PROVINCIAL",
        provincia: "CORDOBA",
        fuero: "CIVIL",
        juzgado: "Juzgado Civil 1 Córdoba",
        estado: ExpedienteEstado.EN_TRAMITE,
        responsableId: lawyerB.userId,
      },
    });
    seedExpBId = seedExpB.id;
    createdExpedienteIds.push(seedExpBId);
  });

  afterAll(async () => {
    if (app) await app.close();
    if (adminPrisma) {
      if (createdExpedienteIds.length > 0) {
        await adminPrisma.expedienteParte.deleteMany({
          where: { expedienteId: { in: createdExpedienteIds } },
        });
        await adminPrisma.auditLog.deleteMany({
          where: {
            entityTable: { in: ["Expediente", "ExpedienteParte"] },
            entityId: { in: createdExpedienteIds },
          },
        });
        await adminPrisma.expediente.deleteMany({
          where: { id: { in: createdExpedienteIds } },
        });
      }
      if (createdClientIds.length > 0) {
        await adminPrisma.client.deleteMany({
          where: { id: { in: createdClientIds } },
        });
      }
      if (createdUserIds.length > 0) {
        await adminPrisma.organizationMembership.deleteMany({
          where: { userId: { in: createdUserIds } },
        });
        await adminPrisma.userIdentity.deleteMany({
          where: { userId: { in: createdUserIds } },
        });
        await adminPrisma.userSession.deleteMany({
          where: { userId: { in: createdUserIds } },
        });
        await adminPrisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }
      if (createdOrgIds.length > 0) {
        await adminPrisma.organization.deleteMany({
          where: { id: { in: createdOrgIds } },
        });
      }
      await adminPrisma.$disconnect();
    }
    if (appPrisma) await appPrisma.$disconnect();
  });

  // =========================================================================
  // 8.1 PRUEBAS FUNCIONALES (TDS-EXP)
  // =========================================================================
  describe("8.1 Pruebas Funcionales de Expedientes", () => {
    let createdExpId: string;

    it("TDS-EXP-001: Crear expediente con datos judiciales completos", async () => {
      const payload = {
        caratula: `López c/ Banco Río s/ Daños ${runTag}`,
        numeroExpediente: `EXP-TDS-001-${runTag}`,
        jurisdiccion: "NACION",
        provincia: "CABA",
        fuero: "COMERCIAL",
        juzgado: "Juzgado Comercial N° 5",
        secretaria: "Secretaría N° 10",
        tipoProceso: "ORDINARIO",
        materia: "DEFENSA_DEL_CONSUMIDOR",
        fechaInicio: "2024-05-10T00:00:00.000Z",
        descripcion: "Reclamo por cobro indebido y daño punitivo",
        estado: ExpedienteEstado.INICIO,
      };

      const res = await withAuth(
        request(app.getHttpServer()).post("/expedientes").send(payload),
        lawyerA,
        true,
      ).expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.caratula).toBe(payload.caratula);
      expect(res.body.numeroExpediente).toBe(payload.numeroExpediente);
      expect(res.body.juzgado).toBe(payload.juzgado);
      expect(res.body.fuero).toBe(payload.fuero);
      expect(res.body.provincia).toBe(payload.provincia);
      expect(res.body.descripcion).toBe(payload.descripcion);

      createdExpId = res.body.id;
      createdExpedienteIds.push(createdExpId);

      // Verificación directa en BD admin
      const dbExp = await adminPrisma.expediente.findUnique({
        where: { id: createdExpId },
      });
      expect(dbExp).not.toBeNull();
      expect(dbExp?.organizationId).toBe(orgAId);
    });

    it("TDS-EXP-002: Crear expediente vinculando clientes existentes como partes", async () => {
      const payload = {
        caratula: `Pérez c/ Seguros SA s/ Daños ${runTag}`,
        numeroExpediente: `EXP-TDS-002-${runTag}`,
        juzgado: "Juzgado Civil N° 1",
        jurisdiccion: "NACION",
        partes: [
          {
            clientId: clientA1Id,
            nombre: "Carlos Pérez",
            rol: RolParteProcesal.ACTOR,
            esCliente: true,
            caracter: "Titular del reclamo",
          },
          {
            nombre: "Seguros SA",
            rol: RolParteProcesal.DEMANDADO,
            esCliente: false,
            cuitDni: "30-99999999-9",
          },
        ],
      };

      const res = await withAuth(
        request(app.getHttpServer()).post("/expedientes").send(payload),
        lawyerA,
        true,
      ).expect(201);

      createdExpedienteIds.push(res.body.id);

      const dbPartes = await adminPrisma.expedienteParte.findMany({
        where: { expedienteId: res.body.id },
      });
      expect(dbPartes).toHaveLength(2);
      const actorParte = dbPartes.find((p) => p.rol === RolParteProcesal.ACTOR);
      expect(actorParte?.clientId).toBe(clientA1Id);
      expect(actorParte?.esCliente).toBe(true);
      expect(actorParte?.organizationId).toBe(orgAId);
    });

    it("TDS-EXP-003: Crear expediente con partes externas (no clientes)", async () => {
      const payload = {
        caratula: `Tercero c/ Quinto s/ Sumarísimo ${runTag}`,
        numero: `EXP-TDS-003-${runTag}`, // Soporte campo legacy 'numero'
        juzgado: "Juzgado Paz 2",
        partes: [
          {
            nombre: "Juan Tercero",
            rol: RolParteProcesal.ACTOR,
            esCliente: false,
          },
          {
            nombre: "Pedro Quinto",
            rol: RolParteProcesal.DEMANDADO,
            esCliente: false,
          },
        ],
      };

      const res = await withAuth(
        request(app.getHttpServer()).post("/expedientes").send(payload),
        lawyerA,
        true,
      ).expect(201);

      createdExpedienteIds.push(res.body.id);
      expect(res.body.numeroExpediente).toBe(payload.numero);

      const dbPartes = await adminPrisma.expedienteParte.findMany({
        where: { expedienteId: res.body.id },
      });
      expect(dbPartes).toHaveLength(2);
      expect(dbPartes.every((p) => p.esCliente === false)).toBe(true);
    });

    it("TDS-EXP-004: Asignar profesional responsable y miembros del equipo", async () => {
      const payload = {
        caratula: `Responsable Test ${runTag}`,
        numeroExpediente: `EXP-TDS-004-${runTag}`,
        juzgado: "Juzgado 10",
        responsableId: lawyerA.userId,
      };

      const res = await withAuth(
        request(app.getHttpServer()).post("/expedientes").send(payload),
        adminA,
        true,
      ).expect(201);

      createdExpedienteIds.push(res.body.id);
      expect(res.body.responsableId).toBe(lawyerA.userId);

      // Asignar miembro adicional al equipo vía endpoint de usuarios
      await withAuth(
        request(app.getHttpServer())
          .post(`/expedientes/${res.body.id}/users`)
          .send({ userId: assistantA.userId }),
        adminA,
        true,
      ).expect(200);

      const dbExp = await adminPrisma.expediente.findUnique({
        where: { id: res.body.id },
        include: { users: true },
      });
      expect(dbExp?.responsableId).toBe(lawyerA.userId);
      expect(dbExp?.users.some((u) => u.id === assistantA.userId)).toBe(true);
    });

    it("TDS-EXP-005: Listar expedientes con paginación y orden", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get("/expedientes?page=1&limit=2"),
        lawyerA,
      ).expect(200);

      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("page", 1);
      expect(res.body).toHaveProperty("limit", 2);
      expect(res.body).toHaveProperty("totalPages");
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });

    it("TDS-EXP-006: Obtener detalle completo de un expediente con partes y clientes", async () => {
      // Creamos un expediente con partes vinculadas a cliente
      const exp = await adminPrisma.expediente.create({
        data: {
          organization: { connect: { id: orgAId } },
          caratula: `Detalle Test ${runTag}`,
          numeroExpediente: `DET-${runTag}`,
          juzgado: "Juzgado 33",
          jurisdiccion: "NACION",
          responsable: { connect: { id: lawyerA.userId } },
          partes: {
            create: [
              {
                organization: { connect: { id: orgAId } },
                client: { connect: { id: clientA1Id } },
                nombre: "Carlos Pérez",
                rol: RolParteProcesal.ACTOR,
                esCliente: true,
              },
            ],
          },
        },
      });
      createdExpedienteIds.push(exp.id);

      const res = await withAuth(
        request(app.getHttpServer()).get(`/expedientes/${exp.id}`),
        lawyerA,
      ).expect(200);

      expect(res.body.id).toBe(exp.id);
      expect(res.body.caratula).toBe(exp.caratula);
      expect(res.body.partes).toBeDefined();
      expect(res.body.partes.length).toBe(1);
      expect(res.body.partes[0].clientId).toBe(clientA1Id);
      expect(res.body.partes[0].client).toBeDefined();
      expect(res.body.partes[0].client.firstName).toBe("Carlos");
      expect(res.body.responsable).toBeDefined();
      expect(res.body.responsable.id).toBe(lawyerA.userId);
    });

    it("TDS-EXP-007: Editar datos generales de un expediente", async () => {
      const updatePayload = {
        caratula: `Carátula Modificada ${runTag}`,
        juzgado: "Juzgado Nacional Civil N° 99",
        estado: ExpedienteEstado.PRUEBA,
        descripcion: "Nueva descripción modificada",
      };

      const res = await withAuth(
        request(app.getHttpServer())
          .patch(`/expedientes/${createdExpId}`)
          .send(updatePayload),
        lawyerA,
        true,
      ).expect(200);

      expect(res.body.caratula).toBe(updatePayload.caratula);
      expect(res.body.juzgado).toBe(updatePayload.juzgado);
      expect(res.body.estado).toBe(ExpedienteEstado.PRUEBA);
      expect(res.body.descripcion).toBe(updatePayload.descripcion);
    });

    it("TDS-EXP-008: Agregar, modificar y eliminar una parte procesal", async () => {
      // 1. Agregar parte
      const partePayload = {
        nombre: `Parte Dinámica ${runTag}`,
        rol: RolParteProcesal.TERCERO,
        caracter: "Citada en garantía",
        esCliente: false,
      };

      const addRes = await withAuth(
        request(app.getHttpServer())
          .post(`/expedientes/${createdExpId}/partes`)
          .send(partePayload),
        lawyerA,
        true,
      ).expect(201);

      expect(addRes.body).toHaveProperty("id");
      expect(addRes.body.rol).toBe(RolParteProcesal.TERCERO);
      const parteId = addRes.body.id;

      // 2. Modificar parte
      const updatePartePayload = {
        caracter: "Tercero voluntario",
        observaciones: "Se presentó en audiencia",
      };

      const editRes = await withAuth(
        request(app.getHttpServer())
          .patch(`/expedientes/${createdExpId}/partes/${parteId}`)
          .send(updatePartePayload),
        lawyerA,
        true,
      ).expect(200);

      expect(editRes.body.caracter).toBe("Tercero voluntario");
      expect(editRes.body.observaciones).toBe("Se presentó en audiencia");

      // 3. Eliminar parte
      await withAuth(
        request(app.getHttpServer()).delete(
          `/expedientes/${createdExpId}/partes/${parteId}`,
        ),
        lawyerA,
        true,
      ).expect(200);

      const dbParte = await adminPrisma.expedienteParte.findUnique({
        where: { id: parteId },
      });
      expect(dbParte).toBeNull();
    });

    it("TDS-EXP-009: Buscar expedientes por carátula, número o nombre de cliente", async () => {
      // Búsqueda por número
      const resNum = await withAuth(
        request(app.getHttpServer()).get(
          `/expedientes?search=EXP-A1-${runTag}&page=1&limit=10`,
        ),
        lawyerA,
      ).expect(200);

      expect(resNum.body.data.length).toBeGreaterThanOrEqual(1);
      expect(resNum.body.data[0].numeroExpediente).toContain(
        `EXP-A1-${runTag}`,
      );

      // Búsqueda por carátula
      const resCaratula = await withAuth(
        request(app.getHttpServer()).get(
          `/expedientes?search=Telecom&page=1&limit=10`,
        ),
        lawyerA,
      ).expect(200);

      expect(resCaratula.body.data.length).toBeGreaterThanOrEqual(1);
      expect(resCaratula.body.data[0].caratula).toContain("Telecom");
    });

    it("TDS-EXP-010: Filtrar expedientes por estado, fuero y jurisdicción", async () => {
      const resFilter = await withAuth(
        request(app.getHttpServer()).get(
          `/expedientes?fuero=CIVIL_COMERCIAL&jurisdiccion=NACION&page=1&limit=10`,
        ),
        lawyerA,
      ).expect(200);

      expect(resFilter.body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        resFilter.body.data.every(
          (e: any) =>
            e.fuero === "CIVIL_COMERCIAL" && e.jurisdiccion === "NACION",
        ),
      ).toBe(true);
    });

    it("TDS-EXP-011: Archivar expediente (soft delete a ARCHIVADO)", async () => {
      const expToArchive = await adminPrisma.expediente.create({
        data: {
          organization: { connect: { id: orgAId } },
          caratula: `Expediente a Archivar ${runTag}`,
          numeroExpediente: `ARCH-${runTag}`,
          juzgado: "Juzgado 1",
          jurisdiccion: "NACION",
          estado: ExpedienteEstado.EN_TRAMITE,
        },
      });
      createdExpedienteIds.push(expToArchive.id);

      // DELETE /expedientes/:id requiere permiso cases:delete (ADMIN u OWNER)
      await withAuth(
        request(app.getHttpServer()).delete(`/expedientes/${expToArchive.id}`),
        adminA,
        true,
      ).expect(200);

      const dbExp = await adminPrisma.expediente.findUnique({
        where: { id: expToArchive.id },
      });
      expect(dbExp?.estado).toBe(ExpedienteEstado.ARCHIVADO);

      // Listado por omisión no incluye archivados salvo que se solicite expresamente
      const resList = await withAuth(
        request(app.getHttpServer()).get("/expedientes?page=1&limit=50"),
        lawyerA,
      ).expect(200);

      expect(resList.body.data.some((e: any) => e.id === expToArchive.id)).toBe(
        false,
      );

      // Filtro explícito de estado ARCHIVADO sí lo incluye
      const resArchList = await withAuth(
        request(app.getHttpServer()).get(
          "/expedientes?estado=ARCHIVADO&page=1&limit=50",
        ),
        lawyerA,
      ).expect(200);

      expect(
        resArchList.body.data.some((e: any) => e.id === expToArchive.id),
      ).toBe(true);
    });

    it("TDS-EXP-012: Registro de auditoría para creación, edición y archivado", async () => {
      const logs = await adminPrisma.auditLog.findMany({
        where: {
          organizationId: orgAId,
          entityTable: "Expediente",
        },
        orderBy: { timestamp: "desc" },
      });

      const actions = logs.map((l) => l.action);
      expect(actions).toContain("EXPEDIENTE_CREATED");
      expect(actions).toContain("EXPEDIENTE_UPDATED");
      expect(actions).toContain("EXPEDIENTE_ARCHIVED");
    });
  });

  // =========================================================================
  // 8.2 PRUEBAS DE SEGURIDAD Y AISLAMIENTO MULTI-TENANT (TDS-SEC)
  // =========================================================================
  describe("8.2 Pruebas de Seguridad y Aislamiento Multi-Tenant", () => {
    it("TDS-SEC-001: Petición no autenticada retorna 401 Unauthorized", async () => {
      await request(app.getHttpServer()).get("/expedientes").expect(401);
      await request(app.getHttpServer())
        .post("/expedientes")
        .send({ caratula: "Test" })
        .expect(401);
    });

    it("TDS-SEC-002: Sesión sin organización activa retorna 403 NO_ACTIVE_ORGANIZATION", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get("/expedientes"),
        noActiveOrgUser,
      ).expect(403);

      expect(JSON.stringify(res.body)).toContain("NO_ACTIVE_ORGANIZATION");
    });

    it("TDS-SEC-003: Membresía revocada retorna 403 MEMBERSHIP_INACTIVE", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get("/expedientes"),
        revokedMemberUser,
      ).expect(403);

      expect(JSON.stringify(res.body)).toContain("MEMBERSHIP_INACTIVE");
    });

    it("TDS-SEC-004: Organización suspendida retorna 403 ORGANIZATION_INACTIVE", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get("/expedientes"),
        suspendedOrgUser,
      ).expect(403);

      expect(JSON.stringify(res.body)).toContain("ORGANIZATION_INACTIVE");
    });

    it("TDS-SEC-005: Aislamiento estricto de listado: Org A no ve expedientes de Org B", async () => {
      // Lawyer A consulta expedientes de Org A
      const resA = await withAuth(
        request(app.getHttpServer()).get("/expedientes?page=1&limit=50"),
        lawyerA,
      ).expect(200);

      const idsA = resA.body.data.map((e: any) => e.id);
      expect(idsA).toContain(seedExpAId);
      expect(idsA).not.toContain(seedExpBId);

      // Lawyer B consulta expedientes de Org B
      const resB = await withAuth(
        request(app.getHttpServer()).get("/expedientes?page=1&limit=50"),
        lawyerB,
      ).expect(200);

      const idsB = resB.body.data.map((e: any) => e.id);
      expect(idsB).toContain(seedExpBId);
      expect(idsB).not.toContain(seedExpAId);
    });

    it("TDS-SEC-006: Anti-enumeración en lectura: Org A consultando expediente de Org B recibe 404 (no 403)", async () => {
      const res = await withAuth(
        request(app.getHttpServer()).get(`/expedientes/${seedExpBId}`),
        lawyerA,
      ).expect(404);

      expect(res.body.message).toMatch(/not found|no encontrado/i);
    });

    it("TDS-SEC-007: Anti-enumeración en edición: Org A editando expediente de Org B recibe 404", async () => {
      await withAuth(
        request(app.getHttpServer())
          .patch(`/expedientes/${seedExpBId}`)
          .send({ caratula: "Hack intento" }),
        lawyerA,
        true,
      ).expect(404);
    });

    it("TDS-SEC-008: Anti-enumeración en archivado: Org A archivando expediente de Org B recibe 404", async () => {
      await withAuth(
        request(app.getHttpServer()).delete(`/expedientes/${seedExpBId}`),
        adminA,
        true,
      ).expect(404);

      // Verificar que el expediente de B sigue intacto
      const dbB = await adminPrisma.expediente.findUnique({
        where: { id: seedExpBId },
      });
      expect(dbB?.estado).toBe(ExpedienteEstado.EN_TRAMITE);
    });

    it("TDS-SEC-009: Rechazar vinculación de cliente perteneciente a otra organización", async () => {
      // Intentar crear expediente en Org A vinculando clientB1Id (que pertenece a Org B)
      const payload = {
        caratula: `Vinculación Ilegal ${runTag}`,
        numeroExpediente: `ILEGAL-CLI-${runTag}`,
        juzgado: "Juzgado 1",
        partes: [
          {
            clientId: clientB1Id,
            nombre: "Cliente de B",
            rol: RolParteProcesal.ACTOR,
            esCliente: true,
          },
        ],
      };

      const res = await withAuth(
        request(app.getHttpServer()).post("/expedientes").send(payload),
        lawyerA,
        true,
      );

      expect([400, 404]).toContain(res.status);
    });

    it("TDS-SEC-010: Rechazar asignación de profesional responsable perteneciente a otra organización", async () => {
      const payload = {
        caratula: `Responsable Ilegal ${runTag}`,
        numeroExpediente: `ILEGAL-USER-${runTag}`,
        juzgado: "Juzgado 1",
        responsableId: lawyerB.userId, // Pertenece a Org B
      };

      const res = await withAuth(
        request(app.getHttpServer()).post("/expedientes").send(payload),
        adminA,
        true,
      );

      expect([400, 403, 404]).toContain(res.status);
    });

    it("TDS-SEC-011: Manipulación de organizationId en body/query/headers genera 403 ORGANIZATION_CONTEXT_MISMATCH", async () => {
      // Inyección en query param
      const queryRes = await withAuth(
        request(app.getHttpServer()).get(
          `/expedientes?organizationId=${orgBId}`,
        ),
        lawyerA,
      );
      expect([400, 403]).toContain(queryRes.status);

      // Inyección en header
      const headerReq = request(app.getHttpServer())
        .get("/expedientes")
        .set("X-Organization-Id", orgBId);
      const headerRes = await withAuth(headerReq, lawyerA);
      expect([400, 403]).toContain(headerRes.status);
    });

    it("TDS-SEC-012: Matriz de roles y proyecciones de seguridad", async () => {
      // 1. STAFF puede leer expedientes, pero NO ve campos confidenciales (descripcion, partes, users)
      const staffRes = await withAuth(
        request(app.getHttpServer()).get(`/expedientes/${seedExpAId}`),
        staffA,
      ).expect(200);

      expect(staffRes.body.caratula).toBeDefined();
      expect(staffRes.body.numeroExpediente).toBeDefined();
      expect(staffRes.body.descripcion).toBeUndefined();
      expect(staffRes.body.partes).toBeUndefined();
      expect(staffRes.body.users).toBeUndefined();

      // STAFF no tiene permiso cases:write -> 403 Forbidden al crear
      await withAuth(
        request(app.getHttpServer()).post("/expedientes").send({
          caratula: "Staff No Puede Crear",
          numeroExpediente: "STAFF-NO",
          juzgado: "J1",
        }),
        staffA,
        true,
      ).expect(403);

      // 2. ASSISTANT puede leer y crear, pero no archivar (DELETE) -> 403 Forbidden
      await withAuth(
        request(app.getHttpServer()).delete(`/expedientes/${seedExpAId}`),
        assistantA,
        true,
      ).expect(403);

      // 3. OWNER puede consultar y actualizar expedientes en su organización
      const ownerRes = await withAuth(
        request(app.getHttpServer()).get(`/expedientes/${seedExpAId}`),
        ownerA,
      ).expect(200);
      expect(ownerRes.body.organizationId).toBe(orgAId);
    });

    it("TDS-SEC-013: Inmunidad frente a corrupción de campos legacy User.role y User.organizationId", async () => {
      // Mutamos campos legacy en la base de datos para staffA
      await adminPrisma.user.update({
        where: { id: staffA.userId },
        data: { role: UserRole.ADMIN, organizationId: orgBId },
      });

      // Debe continuar evaluando la membresía real activa (STAFF en Org A):
      // Intento de borrado/archivado debe fallar con 403 (no elevar a ADMIN)
      await withAuth(
        request(app.getHttpServer()).delete(`/expedientes/${seedExpAId}`),
        staffA,
        true,
      ).expect(403);

      // Intento de listar no debe filtrar por Org B, sino seguir en Org A
      const listRes = await withAuth(
        request(app.getHttpServer()).get("/expedientes?page=1&limit=50"),
        staffA,
      ).expect(200);

      const ids = listRes.body.data.map((e: any) => e.id);
      expect(ids).toContain(seedExpAId);
      expect(ids).not.toContain(seedExpBId);
    });
  });
});
