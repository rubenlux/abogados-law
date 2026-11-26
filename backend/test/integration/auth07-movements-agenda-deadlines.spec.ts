/**
 * AUTH-07 — Suite TDS Real sobre PostgreSQL 18 (abogados_test bajo abogados_app_user NOBYPASSRLS)
 * Expediente: AUTH07-PROCEDURAL-MOVEMENTS-AGENDA-IMPLEMENTATION-001
 *
 * Cubre exhaustivamente:
 * - 9.1 Movimientos procesales (alta, cronología asc/desc + orden estable, detalle, edición, anulación trazable, validaciones cross-tenant)
 * - 9.2 Agenda judicial / Eventos programados (alta con/sin expediente, día/semana/mes, filtros, detalle, edición, completar, cancelar, fechas, responsable, superposición no bloqueante con advertencia)
 * - 9.3 Vencimientos (alta manual sin cálculo jurídico automático, pendientes/vencidos/próximos/cumplidos, identificación de vencido sin mutar estado persistido, marcar cumplido con auditoría de usuario/fecha, cancelar, filtros)
 * - 9.4 Seguridad, multi-tenancy RLS, IDOR (404), tampering de organizationId (403), matriz de roles y proyecciones, inmunidad legacy y auditoría atómica en AuditLog.
 */

import {
  PrismaClient,
  OrganizationRole,
  MembershipStatus,
  OrganizationStatus,
  UserRole,
  ExpedienteEstado,
  TipoMovimientoProcesal,
  TipoEventoAgenda,
  EstadoEventoAgenda,
  TipoVencimiento,
  PrioridadVencimiento,
  EstadoVencimiento,
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
import { ExpedientesModule } from "../../src/expedientes/expedientes.module";
import { AgendaModule } from "../../src/agenda/agenda.module";
import { MovimientosModule } from "../../src/movimientos/movimientos.module";
import { VencimientosModule } from "../../src/vencimientos/vencimientos.module";
import { BffSessionService } from "../../src/auth/bff/bff-session.service";
import { CsrfService } from "../../src/auth/bff/csrf.service";

interface TestUserSession {
  userId: string;
  email: string;
  rawSessionSecret: string;
  csrfToken: string;
  cookies: string[];
}

describe("AUTH-07 — Movimientos Procesales, Agenda Judicial y Vencimientos (Real PostgreSQL 18)", () => {
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

  const runTag = `auth07-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

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

  let expAId: string;
  let expBId: string;

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdExpIds: string[] = [];

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
        ExpedientesModule,
        AgendaModule,
        MovimientosModule,
        VencimientosModule,
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

    const orgA = await adminPrisma.organization.create({
      data: {
        name: `Estudio A ${runTag}`,
        status: OrganizationStatus.ACTIVE,
      },
    });
    const orgB = await adminPrisma.organization.create({
      data: {
        name: `Estudio B ${runTag}`,
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
      "no-org",
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

    const expA = await adminPrisma.expediente.create({
      data: {
        organization: { connect: { id: orgAId } },
        caratula: `García c/ Empresa A s/ Daños ${runTag}`,
        numeroExpediente: `EXP-07A-${runTag}`,
        juzgado: "Juzgado Civil 14",
        jurisdiccion: "NACION",
        estado: ExpedienteEstado.EN_TRAMITE,
      },
    });
    const expB = await adminPrisma.expediente.create({
      data: {
        organization: { connect: { id: orgBId } },
        caratula: `Rodríguez c/ Empresa B s/ Cobro ${runTag}`,
        numeroExpediente: `EXP-07B-${runTag}`,
        juzgado: "Juzgado Comercial 3",
        jurisdiccion: "CABA",
        estado: ExpedienteEstado.EN_TRAMITE,
      },
    });
    expAId = expA.id;
    expBId = expB.id;
    createdExpIds.push(expAId, expBId);
  });

  afterAll(async () => {
    if (app) await app.close();
    if (adminPrisma) {
      if (createdOrgIds.length > 0) {
        await adminPrisma.movimientoProcesal.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await adminPrisma.agendaEvent.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await adminPrisma.vencimiento.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await adminPrisma.auditLog.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
      }
      if (createdExpIds.length > 0) {
        await adminPrisma.expediente.deleteMany({
          where: { id: { in: createdExpIds } },
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
  // 9.1 MOVIMIENTOS PROCESALES (FUNCIONAL)
  // =========================================================================
  describe("9.1 Movimientos Procesales — Pruebas Funcionales", () => {
    let mov1Id: string;
    let mov2Id: string;
    let mov3Id: string;

    it("TDS-MOV-001: Alta de movimiento diferenciando fechaActuacion y fechaRegistro", async () => {
      const fechaActuacion = "2026-01-15T14:00:00.000Z";
      const res = await withAuth(
        request(app.getHttpServer())
          .post("/movimientos")
          .send({
            expedienteId: expAId,
            tipo: TipoMovimientoProcesal.PRESENTACION,
            titulo: `Escrito de demanda ${runTag}`,
            descripcion: "Presentación inicial con prueba documental",
            fechaActuacion,
            referencia: "ESC-001/2026",
            metadatos: { fojas: 18 },
          }),
        lawyerA,
        true,
      ).expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.tipo).toBe(TipoMovimientoProcesal.PRESENTACION);
      expect(res.body.fechaActuacion).toBe(fechaActuacion);
      expect(res.body.fechaRegistro).toBeDefined();
      expect(res.body.fechaRegistro).not.toBe(fechaActuacion);
      expect(res.body.registradoPorId).toBe(lawyerA.userId);
      expect(res.body.origen).toBe("MANUAL");
      expect(res.body.referencia).toBe("ESC-001/2026");

      mov1Id = res.body.id;
    });

    it("TDS-MOV-002: Cronología ordenada asc/desc con orden secundario estable para misma fechaActuacion", async () => {
      // Crear 2 movimientos adicionales con la misma fechaActuacion posterior a mov1
      const sameDate = "2026-02-20T12:00:00.000Z";
      const r2 = await withAuth(
        request(app.getHttpServer()).post("/movimientos").send({
          expedienteId: expAId,
          tipo: TipoMovimientoProcesal.PROVIDENCIA,
          titulo: "Providencia traslado",
          fechaActuacion: sameDate,
        }),
        lawyerA,
        true,
      ).expect(201);
      mov2Id = r2.body.id;

      await new Promise((r) => setTimeout(r, 15));

      const r3 = await withAuth(
        request(app.getHttpServer()).post("/movimientos").send({
          expedienteId: expAId,
          tipo: TipoMovimientoProcesal.NOTIFICACION,
          titulo: "Cédula librada",
          fechaActuacion: sameDate,
        }),
        lawyerA,
        true,
      ).expect(201);
      mov3Id = r3.body.id;

      // Orden descendente (más reciente primero; para misma fechaActuacion, fechaRegistro desc)
      const descRes = await withAuth(
        request(app.getHttpServer()).get(
          `/movimientos?expedienteId=${expAId}&order=desc&page=1&limit=20`,
        ),
        lawyerA,
      ).expect(200);

      expect(descRes.body.data.length).toBeGreaterThanOrEqual(3);
      const idsDesc = descRes.body.data.map((m: any) => m.id);
      expect(idsDesc.indexOf(mov3Id)).toBeLessThan(idsDesc.indexOf(mov2Id));
      expect(idsDesc.indexOf(mov2Id)).toBeLessThan(idsDesc.indexOf(mov1Id));

      // Orden ascendente
      const ascRes = await withAuth(
        request(app.getHttpServer()).get(
          `/movimientos?expedienteId=${expAId}&order=asc&page=1&limit=20`,
        ),
        lawyerA,
      ).expect(200);

      const idsAsc = ascRes.body.data.map((m: any) => m.id);
      expect(idsAsc.indexOf(mov1Id)).toBeLessThan(idsAsc.indexOf(mov2Id));
      expect(idsAsc.indexOf(mov2Id)).toBeLessThan(idsAsc.indexOf(mov3Id));
    });

    it("TDS-MOV-003: Consultar detalle y editar movimiento autorizado", async () => {
      const detRes = await withAuth(
        request(app.getHttpServer()).get(`/movimientos/${mov1Id}`),
        lawyerA,
      ).expect(200);
      expect(detRes.body.id).toBe(mov1Id);
      expect(detRes.body.descripcion).toBe(
        "Presentación inicial con prueba documental",
      );

      const editRes = await withAuth(
        request(app.getHttpServer())
          .patch(`/movimientos/${mov1Id}`)
          .send({
            titulo: `Demanda rectificada ${runTag}`,
            referencia: "ESC-001-BIS/2026",
          }),
        lawyerA,
        true,
      ).expect(200);
      expect(editRes.body.titulo).toBe(`Demanda rectificada ${runTag}`);
      expect(editRes.body.referencia).toBe("ESC-001-BIS/2026");
    });

    it("TDS-MOV-004: Baja lógica / anulación trazable por ORG_ADMIN", async () => {
      const res = await withAuth(
        request(app.getHttpServer())
          .delete(`/movimientos/${mov3Id}`)
          .send({ motivo: "Error de carga duplicada" }),
        adminA,
        true,
      ).expect(200);

      expect(res.body.anuladoAt).toBeTruthy();
      expect(res.body.anuladoPorId).toBe(adminA.userId);

      // Por defecto excluido de cronología activa
      const listActive = await withAuth(
        request(app.getHttpServer()).get(
          `/movimientos?expedienteId=${expAId}&page=1&limit=20`,
        ),
        lawyerA,
      ).expect(200);
      expect(listActive.body.data.some((m: any) => m.id === mov3Id)).toBe(
        false,
      );

      // Visible cuando includeAnulados=true
      const listAll = await withAuth(
        request(app.getHttpServer()).get(
          `/movimientos?expedienteId=${expAId}&includeAnulados=true&page=1&limit=20`,
        ),
        lawyerA,
      ).expect(200);
      expect(listAll.body.data.some((m: any) => m.id === mov3Id)).toBe(true);
    });

    it("TDS-MOV-005: Rechaza expediente inexistente o de otra organización (404)", async () => {
      await withAuth(
        request(app.getHttpServer()).post("/movimientos").send({
          expedienteId: crypto.randomUUID(),
          tipo: TipoMovimientoProcesal.OTRO,
          titulo: "No existe",
          fechaActuacion: "2026-03-01T10:00:00.000Z",
        }),
        lawyerA,
        true,
      ).expect(404);

      await withAuth(
        request(app.getHttpServer()).post("/movimientos").send({
          expedienteId: expBId,
          tipo: TipoMovimientoProcesal.OTRO,
          titulo: "Expediente ajeno Org B",
          fechaActuacion: "2026-03-01T10:00:00.000Z",
        }),
        lawyerA,
        true,
      ).expect(404);
    });
  });

  // =========================================================================
  // 9.2 AGENDA JUDICIAL / EVENTOS PROGRAMADOS (FUNCIONAL)
  // =========================================================================
  describe("9.2 Agenda Judicial — Pruebas Funcionales", () => {
    let ev1Id: string;
    let evGeneralId: string;

    it("TDS-AGE-001: Crear evento asociado a expediente y evento general sin expediente", async () => {
      const res1 = await withAuth(
        request(app.getHttpServer())
          .post("/agenda/actividades")
          .send({
            expedienteId: expAId,
            titulo: `Audiencia preliminar ${runTag}`,
            descripcion: "Audiencia art. 360 CPCCN",
            tipo: TipoEventoAgenda.AUDIENCIA,
            fechaInicio: "2026-06-10T13:00:00.000Z",
            fechaFin: "2026-06-10T14:30:00.000Z",
            ubicacion: "Zoom / Juzgado Civil 14",
            responsableId: lawyerA.userId,
          }),
        lawyerA,
        true,
      ).expect(201);

      expect(res1.body.event).toHaveProperty("id");
      expect(res1.body.event.estado).toBe(EstadoEventoAgenda.PROGRAMADO);
      expect(res1.body.event.responsableId).toBe(lawyerA.userId);
      expect(res1.body.overlapWarning.hasOverlap).toBe(false);
      ev1Id = res1.body.event.id;

      // Evento general del estudio (sin expedienteId)
      const res2 = await withAuth(
        request(app.getHttpServer())
          .post("/agenda/actividades")
          .send({
            titulo: `Reunión interna socios ${runTag}`,
            tipo: TipoEventoAgenda.REUNION_INTERNA,
            fechaInicio: "2026-06-15T15:00:00.000Z",
            fechaFin: "2026-06-15T16:00:00.000Z",
            responsableId: assistantA.userId,
          }),
        assistantA,
        true,
      ).expect(201);

      expect(res2.body.event.expedienteId).toBeNull();
      evGeneralId = res2.body.event.id;
    });

    it("TDS-AGE-002: Permite superposición legítima sin bloquear y devuelve overlapWarning", async () => {
      const resOverlap = await withAuth(
        request(app.getHttpServer())
          .post("/agenda/actividades")
          .send({
            titulo: `Llamada paralela ${runTag}`,
            tipo: TipoEventoAgenda.LLAMADA,
            fechaInicio: "2026-06-10T13:30:00.000Z",
            fechaFin: "2026-06-10T14:00:00.000Z",
            responsableId: lawyerA.userId,
          }),
        lawyerA,
        true,
      ).expect(201);

      expect(resOverlap.body.event).toHaveProperty("id");
      expect(resOverlap.body.overlapWarning.hasOverlap).toBe(true);
      expect(resOverlap.body.overlapWarning.overlappingEventIds).toContain(
        ev1Id,
      );
    });

    it("TDS-AGE-003: Listar eventos por rango día, semana, mes y filtros (responsable, tipo, estado)", async () => {
      // Rango día (10 de junio)
      const dayRes = await withAuth(
        request(app.getHttpServer()).get(
          `/agenda/actividades?from=2026-06-10T00:00:00.000Z&to=2026-06-10T23:59:59.999Z&page=1&limit=20`,
        ),
        lawyerA,
      ).expect(200);
      expect(dayRes.body.data.some((e: any) => e.id === ev1Id)).toBe(true);
      expect(dayRes.body.data.some((e: any) => e.id === evGeneralId)).toBe(
        false,
      );

      // Rango semana (8 al 14 de junio)
      const weekRes = await withAuth(
        request(app.getHttpServer()).get(
          `/agenda/actividades?from=2026-06-08T00:00:00.000Z&to=2026-06-14T23:59:59.999Z&page=1&limit=20`,
        ),
        lawyerA,
      ).expect(200);
      expect(weekRes.body.data.some((e: any) => e.id === ev1Id)).toBe(true);
      expect(weekRes.body.data.some((e: any) => e.id === evGeneralId)).toBe(
        false,
      );

      // Rango mes completo (junio 2026)
      const monthRes = await withAuth(
        request(app.getHttpServer()).get(
          `/agenda/actividades?from=2026-06-01T00:00:00.000Z&to=2026-06-30T23:59:59.999Z&page=1&limit=20`,
        ),
        lawyerA,
      ).expect(200);
      expect(monthRes.body.data.some((e: any) => e.id === ev1Id)).toBe(true);
      expect(monthRes.body.data.some((e: any) => e.id === evGeneralId)).toBe(
        true,
      );

      // Filtro por responsable + tipo
      const filteredRes = await withAuth(
        request(app.getHttpServer()).get(
          `/agenda/actividades?responsableId=${assistantA.userId}&tipo=REUNION_INTERNA&page=1&limit=20`,
        ),
        lawyerA,
      ).expect(200);
      expect(
        filteredRes.body.data.every(
          (e: any) => e.responsableId === assistantA.userId,
        ),
      ).toBe(true);
      expect(filteredRes.body.data.some((e: any) => e.id === evGeneralId)).toBe(
        true,
      );
    });

    it("TDS-AGE-004: Detalle, editar, completar y cancelar eventos", async () => {
      const det = await withAuth(
        request(app.getHttpServer()).get(`/agenda/actividades/${ev1Id}`),
        lawyerA,
      ).expect(200);
      expect(det.body.id).toBe(ev1Id);

      const edited = await withAuth(
        request(app.getHttpServer())
          .patch(`/agenda/actividades/${ev1Id}`)
          .send({
            estado: EstadoEventoAgenda.CONFIRMADO,
            ubicacion: "Sala 2 - Palacio de Tribunales",
          }),
        lawyerA,
        true,
      ).expect(200);
      expect(edited.body.event.estado).toBe(EstadoEventoAgenda.CONFIRMADO);
      expect(edited.body.event.ubicacion).toBe(
        "Sala 2 - Palacio de Tribunales",
      );

      const completed = await withAuth(
        request(app.getHttpServer())
          .post(`/agenda/actividades/${ev1Id}/completar`)
          .send({}),
        lawyerA,
        true,
      ).expect(200);
      expect(completed.body.estado).toBe(EstadoEventoAgenda.COMPLETADO);

      const cancelled = await withAuth(
        request(app.getHttpServer())
          .post(`/agenda/actividades/${evGeneralId}/cancelar`)
          .send({}),
        lawyerA,
        true,
      ).expect(200);
      expect(cancelled.body.estado).toBe(EstadoEventoAgenda.CANCELADO);
    });

    it("TDS-AGE-005: Validaciones de fechas (fechaFin < fechaInicio -> 400; from > to -> 400), responsable ajeno (403) y expediente ajeno (404)", async () => {
      await withAuth(
        request(app.getHttpServer()).post("/agenda/actividades").send({
          titulo: "Fechas invertidas",
          tipo: TipoEventoAgenda.AUDIENCIA,
          fechaInicio: "2026-06-10T15:00:00.000Z",
          fechaFin: "2026-06-10T14:00:00.000Z",
        }),
        lawyerA,
        true,
      ).expect(400);

      await withAuth(
        request(app.getHttpServer()).get(
          "/agenda/actividades?from=2026-06-20T00:00:00.000Z&to=2026-06-10T00:00:00.000Z",
        ),
        lawyerA,
      ).expect(400);

      // Responsable de Org B -> 403
      await withAuth(
        request(app.getHttpServer()).post("/agenda/actividades").send({
          titulo: "Responsable externo",
          tipo: TipoEventoAgenda.REUNION_INTERNA,
          fechaInicio: "2026-06-20T10:00:00.000Z",
          responsableId: lawyerB.userId,
        }),
        lawyerA,
        true,
      ).expect(403);

      // Expediente de Org B -> 404
      await withAuth(
        request(app.getHttpServer()).post("/agenda/actividades").send({
          titulo: "Expediente externo",
          tipo: TipoEventoAgenda.AUDIENCIA,
          fechaInicio: "2026-06-20T10:00:00.000Z",
          expedienteId: expBId,
        }),
        lawyerA,
        true,
      ).expect(404);
    });
  });

  // =========================================================================
  // 9.3 VENCIMIENTOS (FUNCIONAL)
  // =========================================================================
  describe("9.3 Vencimientos — Pruebas Funcionales", () => {
    let venPastId: string;
    let venUpcomingId: string;
    let venCancelId: string;

    it("TDS-VEN-001: Alta manual sin cálculo jurídico automático (fechaLimite exacta ingresada por usuario)", async () => {
      const pastIso = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
      const soonIso = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
      const laterIso = new Date(
        Date.now() + 20 * 24 * 3600 * 1000,
      ).toISOString();

      const rPast = await withAuth(
        request(app.getHttpServer())
          .post("/vencimientos")
          .send({
            expedienteId: expAId,
            titulo: `Contestar traslado vencido ${runTag}`,
            descripcion: "Plazo manual ingresado por profesional",
            tipo: TipoVencimiento.PROCESAL,
            fechaLimite: pastIso,
            prioridad: PrioridadVencimiento.CRITICA,
            responsableId: lawyerA.userId,
          }),
        lawyerA,
        true,
      ).expect(201);

      expect(rPast.body.fechaLimite).toBe(pastIso);
      expect(rPast.body.origenFechaLimite).toBe("MANUAL");
      expect(rPast.body.estado).toBe(EstadoVencimiento.PENDIENTE);
      expect(rPast.body.estaVencido).toBe(true);
      venPastId = rPast.body.id;

      const rSoon = await withAuth(
        request(app.getHttpServer())
          .post("/vencimientos")
          .send({
            expedienteId: expAId,
            titulo: `Presentar alegato próximo ${runTag}`,
            tipo: TipoVencimiento.PRESENTACION,
            fechaLimite: soonIso,
            prioridad: PrioridadVencimiento.ALTA,
            responsableId: assistantA.userId,
          }),
        lawyerA,
        true,
      ).expect(201);
      expect(rSoon.body.estaVencido).toBe(false);
      venUpcomingId = rSoon.body.id;

      const rLater = await withAuth(
        request(app.getHttpServer())
          .post("/vencimientos")
          .send({
            titulo: `Trámite interno cancelable ${runTag}`,
            tipo: TipoVencimiento.INTERNO,
            fechaLimite: laterIso,
            prioridad: PrioridadVencimiento.BAJA,
          }),
        assistantA,
        true,
      ).expect(201);
      venCancelId = rLater.body.id;
    });

    it("TDS-VEN-002: Vencimiento pasado se identifica como vencido (estaVencido=true) SIN mutar estado persistido en BD", async () => {
      const resVencidos = await withAuth(
        request(app.getHttpServer()).get(
          "/vencimientos?scope=vencidos&page=1&limit=20",
        ),
        lawyerA,
      ).expect(200);

      const found = resVencidos.body.data.find((v: any) => v.id === venPastId);
      expect(found).toBeDefined();
      expect(found.estaVencido).toBe(true);
      expect(found.estado).toBe(EstadoVencimiento.PENDIENTE);

      // Verificación directa en BD: estado persistido NO fue alterado automáticamente
      const dbRow = await adminPrisma.vencimiento.findUnique({
        where: { id: venPastId },
      });
      expect(dbRow?.estado).toBe(EstadoVencimiento.PENDIENTE);
    });

    it("TDS-VEN-003: Listar pendientes, próximos y filtrar por responsable y prioridad", async () => {
      const proximos = await withAuth(
        request(app.getHttpServer()).get(
          "/vencimientos?scope=proximos&upcomingDays=7&page=1&limit=20",
        ),
        lawyerA,
      ).expect(200);
      expect(proximos.body.data.some((v: any) => v.id === venUpcomingId)).toBe(
        true,
      );
      expect(proximos.body.data.some((v: any) => v.id === venPastId)).toBe(
        false,
      );

      const byPrioResp = await withAuth(
        request(app.getHttpServer()).get(
          `/vencimientos?prioridad=ALTA&responsableId=${assistantA.userId}&page=1&limit=20`,
        ),
        lawyerA,
      ).expect(200);
      expect(
        byPrioResp.body.data.some((v: any) => v.id === venUpcomingId),
      ).toBe(true);
      expect(
        byPrioResp.body.data.every(
          (v: any) =>
            v.prioridad === PrioridadVencimiento.ALTA &&
            v.responsableId === assistantA.userId,
        ),
      ).toBe(true);
    });

    it("TDS-VEN-004: Marcar cumplido (registra cumplidoAt y cumplidoPorId), editar y cancelar", async () => {
      const edited = await withAuth(
        request(app.getHttpServer())
          .patch(`/vencimientos/${venUpcomingId}`)
          .send({
            estado: EstadoVencimiento.EN_CURSO,
            observaciones: "Borrador revisado",
          }),
        lawyerA,
        true,
      ).expect(200);
      expect(edited.body.estado).toBe(EstadoVencimiento.EN_CURSO);

      const completed = await withAuth(
        request(app.getHttpServer())
          .post(`/vencimientos/${venUpcomingId}/cumplir`)
          .send({ observaciones: "Presentado electrónicamente en PJN" }),
        lawyerA,
        true,
      ).expect(200);
      expect(completed.body.estado).toBe(EstadoVencimiento.CUMPLIDO);
      expect(completed.body.cumplidoAt).toBeTruthy();
      expect(completed.body.cumplidoPorId).toBe(lawyerA.userId);
      expect(completed.body.estaVencido).toBe(false);

      const cancelled = await withAuth(
        request(app.getHttpServer())
          .post(`/vencimientos/${venCancelId}/cancelar`)
          .send({}),
        lawyerA,
        true,
      ).expect(200);
      expect(cancelled.body.estado).toBe(EstadoVencimiento.CANCELADO);
    });

    it("TDS-VEN-005: Validación de fechaLimite inválida (400)", async () => {
      await withAuth(
        request(app.getHttpServer()).post("/vencimientos").send({
          titulo: "Fecha mala",
          fechaLimite: "no-es-fecha",
        }),
        lawyerA,
        true,
      ).expect(400);
    });
  });

  // =========================================================================
  // 9.4 SEGURIDAD, MULTI-TENANCY RLS, PERMISOS, PROYECCIONES Y AUDITORÍA
  // =========================================================================
  describe("9.4 Seguridad, Aislamiento Multi-Tenant, Permisos y Auditoría", () => {
    let movBId: string;
    let evBId: string;
    let venBId: string;

    beforeAll(async () => {
      // Seed recursos en Org B para pruebas IDOR y aislamiento
      const rMovB = await withAuth(
        request(app.getHttpServer())
          .post("/movimientos")
          .send({
            expedienteId: expBId,
            tipo: TipoMovimientoProcesal.SENTENCIA,
            titulo: `Sentencia confidencial B ${runTag}`,
            descripcion: "Confidencial Org B",
            fechaActuacion: "2026-04-01T12:00:00.000Z",
          }),
        lawyerB,
        true,
      ).expect(201);
      movBId = rMovB.body.id;

      const rEvB = await withAuth(
        request(app.getHttpServer())
          .post("/agenda/actividades")
          .send({
            expedienteId: expBId,
            titulo: `Audiencia confidencial B ${runTag}`,
            descripcion: "Confidencial Org B",
            tipo: TipoEventoAgenda.AUDIENCIA,
            fechaInicio: "2026-07-01T14:00:00.000Z",
            responsableId: lawyerB.userId,
          }),
        lawyerB,
        true,
      ).expect(201);
      evBId = rEvB.body.event.id;

      const rVenB = await withAuth(
        request(app.getHttpServer())
          .post("/vencimientos")
          .send({
            expedienteId: expBId,
            titulo: `Vencimiento confidencial B ${runTag}`,
            descripcion: "Confidencial Org B",
            tipo: TipoVencimiento.PROCESAL,
            fechaLimite: "2026-07-10T12:00:00.000Z",
            responsableId: lawyerB.userId,
          }),
        lawyerB,
        true,
      ).expect(201);
      venBId = rVenB.body.id;
    });

    it("TDS-SEC07-001: Sin sesión retorna 401 en los tres módulos", async () => {
      await request(app.getHttpServer()).get("/movimientos").expect(401);
      await request(app.getHttpServer()).get("/agenda/actividades").expect(401);
      await request(app.getHttpServer()).get("/vencimientos").expect(401);
    });

    it("TDS-SEC07-002: Sin organización activa, membresía revocada y organización suspendida retornan 403", async () => {
      const rNoOrg = await withAuth(
        request(app.getHttpServer()).get("/movimientos"),
        noActiveOrgUser,
      ).expect(403);
      expect(JSON.stringify(rNoOrg.body)).toContain("NO_ACTIVE_ORGANIZATION");

      const rRev = await withAuth(
        request(app.getHttpServer()).get("/agenda/actividades"),
        revokedMemberUser,
      ).expect(403);
      expect(JSON.stringify(rRev.body)).toContain("MEMBERSHIP_INACTIVE");

      const rSusp = await withAuth(
        request(app.getHttpServer()).get("/vencimientos"),
        suspendedOrgUser,
      ).expect(403);
      expect(JSON.stringify(rSusp.body)).toContain("ORGANIZATION_INACTIVE");
    });

    it("TDS-SEC07-003: Aislamiento multi-tenant estricto entre Org A y Org B en listados (RLS activo)", async () => {
      const mA = await withAuth(
        request(app.getHttpServer()).get("/movimientos?page=1&limit=50"),
        lawyerA,
      ).expect(200);
      expect(mA.body.data.some((x: any) => x.id === movBId)).toBe(false);

      const eA = await withAuth(
        request(app.getHttpServer()).get("/agenda/actividades?page=1&limit=50"),
        lawyerA,
      ).expect(200);
      expect(eA.body.data.some((x: any) => x.id === evBId)).toBe(false);

      const vA = await withAuth(
        request(app.getHttpServer()).get("/vencimientos?page=1&limit=50"),
        lawyerA,
      ).expect(200);
      expect(vA.body.data.some((x: any) => x.id === venBId)).toBe(false);
    });

    it("TDS-SEC07-004: Protección IDOR / anti-enumeración (404) en movimientos, agenda y vencimientos de Org B", async () => {
      // Movimientos IDOR
      await withAuth(
        request(app.getHttpServer()).get(`/movimientos/${movBId}`),
        lawyerA,
      ).expect(404);
      await withAuth(
        request(app.getHttpServer())
          .patch(`/movimientos/${movBId}`)
          .send({ titulo: "Hack" }),
        lawyerA,
        true,
      ).expect(404);
      await withAuth(
        request(app.getHttpServer()).delete(`/movimientos/${movBId}`),
        adminA,
        true,
      ).expect(404);

      // Agenda IDOR
      await withAuth(
        request(app.getHttpServer()).get(`/agenda/actividades/${evBId}`),
        lawyerA,
      ).expect(404);
      await withAuth(
        request(app.getHttpServer())
          .patch(`/agenda/actividades/${evBId}`)
          .send({ titulo: "Hack" }),
        lawyerA,
        true,
      ).expect(404);
      await withAuth(
        request(app.getHttpServer())
          .post(`/agenda/actividades/${evBId}/cancelar`)
          .send({}),
        lawyerA,
        true,
      ).expect(404);

      // Vencimientos IDOR
      await withAuth(
        request(app.getHttpServer()).get(`/vencimientos/${venBId}`),
        lawyerA,
      ).expect(404);
      await withAuth(
        request(app.getHttpServer())
          .patch(`/vencimientos/${venBId}`)
          .send({ titulo: "Hack" }),
        lawyerA,
        true,
      ).expect(404);
      await withAuth(
        request(app.getHttpServer())
          .post(`/vencimientos/${venBId}/cumplir`)
          .send({}),
        lawyerA,
        true,
      ).expect(404);
    });

    it("TDS-SEC07-005: Manipulación de organizationId en query/body/header rechazada con 403", async () => {
      const qRes = await withAuth(
        request(app.getHttpServer()).get(
          `/movimientos?organizationId=${orgBId}`,
        ),
        lawyerA,
      );
      expect([400, 403]).toContain(qRes.status);

      const hRes = await withAuth(
        request(app.getHttpServer())
          .get("/vencimientos")
          .set("X-Organization-Id", orgBId),
        lawyerA,
      );
      expect([400, 403]).toContain(hRes.status);

      const bRes = await withAuth(
        request(app.getHttpServer()).post("/vencimientos").send({
          titulo: "Spoof org",
          fechaLimite: "2026-08-01T12:00:00.000Z",
          organizationId: orgBId,
        }),
        lawyerA,
        true,
      );
      expect([400, 403]).toContain(bRes.status);
    });

    it("TDS-SEC07-006: Matriz de permisos por rol y proyecciones STAFF", async () => {
      // STAFF: lee con proyección limitada (sin descripcion/metadatos/ubicacion/observaciones)
      const staffMovs = await withAuth(
        request(app.getHttpServer()).get(
          `/movimientos?expedienteId=${expAId}&page=1&limit=10`,
        ),
        staffA,
      ).expect(200);
      expect(staffMovs.body.data.length).toBeGreaterThan(0);
      expect(staffMovs.body.data[0].descripcion).toBeUndefined();
      expect(staffMovs.body.data[0].metadatos).toBeUndefined();

      const staffEvs = await withAuth(
        request(app.getHttpServer()).get("/agenda/actividades?page=1&limit=10"),
        staffA,
      ).expect(200);
      expect(staffEvs.body.data.length).toBeGreaterThan(0);
      expect(staffEvs.body.data[0].descripcion).toBeUndefined();
      expect(staffEvs.body.data[0].ubicacion).toBeUndefined();

      const staffVens = await withAuth(
        request(app.getHttpServer()).get("/vencimientos?page=1&limit=10"),
        staffA,
      ).expect(200);
      expect(staffVens.body.data.length).toBeGreaterThan(0);
      expect(staffVens.body.data[0].descripcion).toBeUndefined();
      expect(staffVens.body.data[0].observaciones).toBeUndefined();

      // STAFF no puede mutar ninguno de los 3 -> 403
      await withAuth(
        request(app.getHttpServer()).post("/movimientos").send({
          expedienteId: expAId,
          tipo: TipoMovimientoProcesal.OTRO,
          titulo: "Staff no",
          fechaActuacion: "2026-05-01T12:00:00.000Z",
        }),
        staffA,
        true,
      ).expect(403);
      await withAuth(
        request(app.getHttpServer()).post("/agenda/actividades").send({
          titulo: "Staff no",
          tipo: TipoEventoAgenda.OTRO,
          fechaInicio: "2026-05-01T12:00:00.000Z",
        }),
        staffA,
        true,
      ).expect(403);
      await withAuth(
        request(app.getHttpServer()).post("/vencimientos").send({
          titulo: "Staff no",
          fechaLimite: "2026-05-01T12:00:00.000Z",
        }),
        staffA,
        true,
      ).expect(403);

      // ASSISTANT no puede crear movimientos (cases:write) -> 403
      await withAuth(
        request(app.getHttpServer()).post("/movimientos").send({
          expedienteId: expAId,
          tipo: TipoMovimientoProcesal.OTRO,
          titulo: "Assistant no puede crear mov",
          fechaActuacion: "2026-05-01T12:00:00.000Z",
        }),
        assistantA,
        true,
      ).expect(403);

      // LAWYER no puede anular movimientos (cases:delete) -> 403
      const movAny = staffMovs.body.data[0].id;
      await withAuth(
        request(app.getHttpServer()).delete(`/movimientos/${movAny}`),
        lawyerA,
        true,
      ).expect(403);

      // OWNER puede consultar con proyección completa
      const ownerMov = await withAuth(
        request(app.getHttpServer()).get(`/movimientos/${movAny}`),
        ownerA,
      ).expect(200);
      expect(ownerMov.body.registradoPorId).toBeDefined();
    });

    it("TDS-SEC07-007: Inmunidad frente a corrupción de campos legacy User.role y User.organizationId", async () => {
      await adminPrisma.user.update({
        where: { id: staffA.userId },
        data: { role: UserRole.ADMIN, organizationId: orgBId },
      });

      // Sigue siendo STAFF en Org A -> 403 en escritura
      await withAuth(
        request(app.getHttpServer()).post("/vencimientos").send({
          titulo: "Escalada legacy",
          fechaLimite: "2026-08-01T12:00:00.000Z",
        }),
        staffA,
        true,
      ).expect(403);

      // Sigue aislado a Org A (no ve Org B)
      const vList = await withAuth(
        request(app.getHttpServer()).get("/vencimientos?page=1&limit=50"),
        staffA,
      ).expect(200);
      expect(vList.body.data.some((v: any) => v.id === venBId)).toBe(false);
    });

    it("TDS-SEC07-008: Auditoría atómica en AuditLog para todas las mutaciones de AUTH-07", async () => {
      const logs = await adminPrisma.auditLog.findMany({
        where: {
          organizationId: orgAId,
          entityTable: {
            in: ["MovimientoProcesal", "AgendaEvent", "Vencimiento"],
          },
        },
        orderBy: { timestamp: "desc" },
      });

      const actions = logs.map((l) => l.action);
      expect(actions).toContain("MOVIMIENTO_CREATED");
      expect(actions).toContain("MOVIMIENTO_UPDATED");
      expect(actions).toContain("MOVIMIENTO_ANNULLED");
      expect(actions).toContain("AGENDA_EVENT_CREATED");
      expect(actions).toContain("AGENDA_EVENT_UPDATED");
      expect(actions).toContain("AGENDA_EVENT_COMPLETED");
      expect(actions).toContain("AGENDA_EVENT_CANCELLED");
      expect(actions).toContain("VENCIMIENTO_CREATED");
      expect(actions).toContain("VENCIMIENTO_UPDATED");
      expect(actions).toContain("VENCIMIENTO_COMPLETED");
      expect(actions).toContain("VENCIMIENTO_CANCELLED");
    });
  });
});
