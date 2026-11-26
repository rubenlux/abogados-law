/**
 * AUTH-04 — Suite de Integración PostgreSQL 18 REAL (abogados_test bajo abogados_app_user NOBYPASSRLS)
 * Especificación: SPEC-AUTH-004 v0.2.0 — APPROVED | Expediente: AUTH04-IMPLEMENTATION-001
 *
 * Cubre explícitamente TODOS los casos de integración y BD real del catálogo §15.1:
 * - TST-A04-001 .. TST-A04-014 (Aislamiento HTTP/App + Proyecciones + Legacy Immunity + Multi-org switch)
 * - TST-A04-015 .. TST-A04-021 (PostgreSQL RLS real, privilegios abogados_app_user, pool connection_limit=1)
 * - TST-A04-022 .. TST-A04-025 (Tabla puente _ExpedienteToUser Prisma M:N + RLS doble EXISTS)
 * - TST-A04-026 .. TST-A04-033 (Entidades IA, Uso/Cuota, Judicial, EventLog/AuditLog, OCR async, Cron + EmployeeMetric)
 *
 * REGLA ESTRICTA:
 * - Todas las operaciones del runtime NestJS y las pruebas RLS corren como `abogados_app_user` (`NOBYPASSRLS`)
 *   conectado vía `APP_RUNTIME_DATABASE_URL` sobre `abogados_test`.
 * - `adminPrisma` (dueño de tablas en `abogados_test`) se utiliza ÚNICAMENTE para seed de fixtures,
 *   simulaciones de corrupción/históricos `organizationId IS NULL`, y limpieza en `afterAll`.
 */

import {
  PrismaClient,
  OrganizationRole,
  MembershipStatus,
  OrganizationStatus,
  UserRole,
  DocumentoTipo,
  PlazoTipo,
  DraftType,
  RiskLevel,
  ActorType,
  LegalNormJurisdiccion,
  LegalNormFuero,
  JurisprudenceTribunal,
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
import { ScopedPrismaService } from "../../src/authz/scoped-prisma.service";
import { OrganizationsModule } from "../../src/organizations/organizations.module";
import { ExpedientesModule } from "../../src/expedientes/expedientes.module";
import { AgendaModule } from "../../src/agenda/agenda.module";
import { TemplatesModule } from "../../src/templates/templates.module";
import { JudicialEngineModule } from "../../src/judicial-engine/judicial-engine.module";
import { IAModule } from "../../src/ia/ia.module";
import { AdminModule } from "../../src/admin/admin.module";
import { AnalyticsModule } from "../../src/analytics/analytics.module";
import { ClientPortalModule } from "../../src/client-portal/client-portal.module";
import { SecurityCoreModule } from "../../src/core/security/security-core.module";
import { BffSessionService } from "../../src/auth/bff/bff-session.service";
import { CsrfService } from "../../src/auth/bff/csrf.service";
import { DocumentsService } from "../../src/expedientes/documents.service";
import { ExpedientesService } from "../../src/expedientes/expedientes.service";
import { AgendaService } from "../../src/agenda/agenda.service";
import { UsageControlService } from "../../src/admin/usage-control.service";
import { AnalyticsService } from "../../src/analytics/analytics.service";
import { JudicialScraperService } from "../../src/judicial-engine/judicial-scraper.service";
import { LegalSearchService } from "../../src/ia/legal/legal-search.service";
import { JurisprudenceSearchService } from "../../src/ia/jurisprudence/jurisprudence-search.service";

interface TestUserSession {
  userId: string;
  email: string;
  rawSessionSecret: string;
  csrfToken: string;
  cookies: string[];
}

describe("AUTH-04 — PostgreSQL 18 Real RLS & Multi-Tenant Isolation Suite (abogados_test / abogados_app_user)", () => {
  let adminPrisma: PrismaClient;
  let appPrisma: PrismaClient;
  let app: INestApplication;
  let sessionService: BffSessionService;
  let csrfService: CsrfService;
  let scopedPrisma: ScopedPrismaService;
  let documentsService: DocumentsService;
  let expedientesService: ExpedientesService;
  let agendaService: AgendaService;
  let usageControlService: UsageControlService;
  let analyticsService: AnalyticsService;

  const APP_ORIGIN = "http://localhost:3000";
  const PIXEL_SECRET =
    process.env.PIXEL_HMAC_SECRET ||
    "test-pixel-hmac-secret-for-testing-32-chars-minimum!";
  const TEST_ENCRYPTION_KEY =
    process.env.OIDC_TRANSACTION_ENCRYPTION_KEY ||
    "9059d7b7e25d3c8c6de1cb0dc62232e3692c26404b1c2cdaecc19e559ef16a0c";

  const adminDbUrl =
    process.env.MIGRATION_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/abogados_test?schema=public";

  const appRuntimeDbUrl = process.env.APP_RUNTIME_DATABASE_URL || "";

  const runTag = `a04-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

  // Fixtures compartidas
  let orgAId: string;
  let orgBId: string;
  let orgSuspendedId: string;

  let ownerA: TestUserSession;
  let lawyerA: TestUserSession;
  let assistantA: TestUserSession;
  let staffA: TestUserSession;
  let lawyerB: TestUserSession;
  let multiOrgUser: TestUserSession;
  let noActiveOrgUser: TestUserSession;

  let expAId: string;
  let expBId: string;
  let clientAId: string;
  let clientBId: string;
  let docAId: string;
  let docBId: string;
  let verAId: string;
  let verBId: string;
  let eventAId: string;
  let eventBId: string;
  let tplAId: string;
  let tplBId: string;
  let draftAId: string;
  let draftBId: string;
  let draftNullId: string;
  let riskAId: string;
  let riskBId: string;
  let chatSessionAId: string;
  let chatSessionBId: string;
  let chatSessionNullId: string;
  let chatMsgAId: string;
  let chatMsgBId: string;
  let judicialAccAId: string;
  let judicialAccBId: string;
  let metricNullId: string;
  let auditNullId: string;
  let eventLogNullId: string;
  let globalNormId: string;
  let globalJurisId: string;
  let globalCalId: string;
  let globalPlanId: string;

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];

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

    // Construir aplicación NestJS usando exclusivamente appPrisma (abogados_app_user NOBYPASSRLS)
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
              FORENSIC_KEY: "test-forensic-key-for-testing-32-chars-minimum!",
              OIDC_TRANSACTION_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
              OPENAI_API_KEY: "",
            }),
          ],
        }),
        AuthzModule,
        AuthModule,
        OrganizationsModule,
        ExpedientesModule,
        AgendaModule,
        TemplatesModule,
        JudicialEngineModule,
        IAModule,
        AdminModule,
        AnalyticsModule,
        ClientPortalModule,
        SecurityCoreModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(appPrisma)
      .overrideProvider(JudicialScraperService)
      .useValue({
        scrapeMovements: jest.fn().mockResolvedValue({
          status: "NEW_MOVEMENTS",
          movements: [
            {
              tipo: "PROVIDENCIA",
              descripcion: "Movimiento sincronizado en test",
            },
          ],
        }),
      })
      .overrideProvider(LegalSearchService)
      .useValue({
        search: jest.fn().mockResolvedValue([]),
        findByArticle: jest.fn().mockResolvedValue([]),
        getVersionHistory: jest.fn().mockResolvedValue([]),
        detectConflicts: jest.fn().mockResolvedValue([]),
        getStats: jest.fn().mockResolvedValue({ total: 0 }),
      })
      .overrideProvider(JurisprudenceSearchService)
      .useValue({
        search: jest.fn().mockResolvedValue({ results: [] }),
        listAll: jest.fn().mockResolvedValue([]),
        findById: jest.fn().mockResolvedValue(null),
        getStats: jest.fn().mockResolvedValue({ total: 0 }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    sessionService = moduleRef.get<BffSessionService>(BffSessionService);
    csrfService = moduleRef.get<CsrfService>(CsrfService);
    scopedPrisma = moduleRef.get<ScopedPrismaService>(ScopedPrismaService);
    documentsService = moduleRef.get<DocumentsService>(DocumentsService);
    expedientesService = moduleRef.get<ExpedientesService>(ExpedientesService);
    agendaService = moduleRef.get<AgendaService>(AgendaService);
    usageControlService =
      moduleRef.get<UsageControlService>(UsageControlService);
    analyticsService = moduleRef.get<AnalyticsService>(AnalyticsService);

    // Seed Organizaciones
    const orgA = await adminPrisma.organization.create({
      data: {
        name: `Estudio Alfa ${runTag}`,
        status: OrganizationStatus.ACTIVE,
      },
    });
    const orgB = await adminPrisma.organization.create({
      data: {
        name: `Estudio Beta ${runTag}`,
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

    // Seed Usuarios y Sesiones BFF
    ownerA = await createUserWithMembership(
      "owner-a",
      [{ organizationId: orgAId, role: OrganizationRole.ORG_OWNER }],
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
    multiOrgUser = await createUserWithMembership(
      "multi-org",
      [
        { organizationId: orgAId, role: OrganizationRole.ORG_ADMIN },
        { organizationId: orgBId, role: OrganizationRole.STAFF },
      ],
      orgAId,
    );
    noActiveOrgUser = await createUserWithMembership(
      "no-active-org",
      [{ organizationId: orgAId, role: OrganizationRole.LAWYER }],
      null,
    );

    // Seed Entidades en Org A y Org B
    const expA = await adminPrisma.expediente.create({
      data: {
        caratula: `Alfa Caso Confidencial ${runTag}`,
        numeroExpediente: `EXP-A-${runTag}`,
        juzgado: "Juzgado Civil 1",
        jurisdiccion: "NACION",
        tags: ["estrategia-confidencial-a"],
        organizationId: orgAId,
      },
    });
    const expB = await adminPrisma.expediente.create({
      data: {
        caratula: `Beta Caso Confidencial ${runTag}`,
        numeroExpediente: `EXP-B-${runTag}`,
        juzgado: "Juzgado Comercial 2",
        jurisdiccion: "CABA",
        tags: ["estrategia-confidencial-b"],
        organizationId: orgBId,
      },
    });
    expAId = expA.id;
    expBId = expB.id;

    const clientA = await adminPrisma.client.create({
      data: {
        firstName: "Juan",
        lastName: `Alfa ${runTag}`,
        organizationId: orgAId,
      },
    });
    const clientB = await adminPrisma.client.create({
      data: {
        firstName: "Maria",
        lastName: `Beta ${runTag}`,
        organizationId: orgBId,
      },
    });
    clientAId = clientA.id;
    clientBId = clientB.id;

    const docA = await adminPrisma.documento.create({
      data: {
        expedienteId: expAId,
        organizationId: orgAId,
        tipo: DocumentoTipo.ESCRITO,
        storagePath: `orgs/${orgAId}/expedientes/${expAId}/documents/seed/v1/seed-a`,
        fileName: "demanda-alfa.pdf",
        fileSize: 2048,
        mimeType: "application/pdf",
        hashSha256: "hash-doc-a",
        ocrContent: "Texto confidencial OCR de Alfa",
      },
    });
    const docB = await adminPrisma.documento.create({
      data: {
        expedienteId: expBId,
        organizationId: orgBId,
        tipo: DocumentoTipo.ESCRITO,
        storagePath: `orgs/${orgBId}/expedientes/${expBId}/documents/seed/v1/seed-b`,
        fileName: "demanda-beta.pdf",
        fileSize: 4096,
        mimeType: "application/pdf",
        hashSha256: "hash-doc-b",
        ocrContent: "Texto confidencial OCR de Beta",
      },
    });
    docAId = docA.id;
    docBId = docB.id;

    const verA = await adminPrisma.documentVersion.create({
      data: {
        documentId: docAId,
        organizationId: orgAId,
        versionNumber: 1,
        storagePath: `orgs/${orgAId}/expedientes/${expAId}/documents/${docAId}/v1/ver-a`,
        fileName: "demanda-alfa-v1.pdf",
        mimeType: "application/pdf",
        fileSize: 2048,
        hashSha256: "hash-ver-a",
        ocrContent: "OCR version 1 Alfa",
        uploadedBy: lawyerA.userId,
      },
    });
    const verB = await adminPrisma.documentVersion.create({
      data: {
        documentId: docBId,
        organizationId: orgBId,
        versionNumber: 1,
        storagePath: `orgs/${orgBId}/expedientes/${expBId}/documents/${docBId}/v1/ver-b`,
        fileName: "demanda-beta-v1.pdf",
        mimeType: "application/pdf",
        fileSize: 4096,
        hashSha256: "hash-ver-b",
        ocrContent: "OCR version 1 Beta",
        uploadedBy: lawyerB.userId,
      },
    });
    verAId = verA.id;
    verBId = verB.id;

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const evA = await adminPrisma.eventoAgenda.create({
      data: {
        expedienteId: expAId,
        organizationId: orgAId,
        titulo: `Vencimiento Alfa ${runTag}`,
        descripcion: "Nota estratégica privada de Alfa",
        fechaVencimiento: tomorrow,
        tipoPlazo: PlazoTipo.FATAL,
        isCritical: true,
      },
    });
    const evB = await adminPrisma.eventoAgenda.create({
      data: {
        expedienteId: expBId,
        organizationId: orgBId,
        titulo: `Vencimiento Beta ${runTag}`,
        descripcion: "Nota estratégica privada de Beta",
        fechaVencimiento: tomorrow,
        tipoPlazo: PlazoTipo.FATAL,
        isCritical: true,
      },
    });
    eventAId = evA.id;
    eventBId = evB.id;

    const tplA = await adminPrisma.legalTemplate.create({
      data: {
        organizationId: orgAId,
        name: `Plantilla Alfa ${runTag}`,
        content: "Hola {{cliente}} en Alfa",
        variables: ["cliente"],
        category: "Demanda",
      },
    });
    const tplB = await adminPrisma.legalTemplate.create({
      data: {
        organizationId: orgBId,
        name: `Plantilla Beta ${runTag}`,
        content: "Hola {{cliente}} en Beta",
        variables: ["cliente"],
        category: "Demanda",
      },
    });
    tplAId = tplA.id;
    tplBId = tplB.id;

    const jAccA = await adminPrisma.judicialAccount.create({
      data: {
        organizationId: orgAId,
        jurisdiction: "PJN",
        username: `pjn-alfa-${runTag}`,
        encryptedPassword: "enc:secret-alfa-never-expose",
        status: "ACTIVE",
      },
    });
    const jAccB = await adminPrisma.judicialAccount.create({
      data: {
        organizationId: orgBId,
        jurisdiction: "PJN",
        username: `pjn-beta-${runTag}`,
        encryptedPassword: "enc:secret-beta-never-expose",
        status: "ACTIVE",
      },
    });
    judicialAccAId = jAccA.id;
    judicialAccBId = jAccB.id;

    await adminPrisma.tenantUsage.createMany({
      data: [
        { organizationId: orgAId, aiTokensUsed: 100, periodEnd: tomorrow },
        { organizationId: orgBId, aiTokensUsed: 500, periodEnd: tomorrow },
      ],
    });

    await adminPrisma.aIInteraction.createMany({
      data: [
        {
          organizationId: orgAId,
          userId: lawyerA.userId,
          endpoint: "/ai/chat",
          promptTokens: 10,
          completionTokens: 10,
          costUsd: 0.001,
          response: "resp-a",
        },
        {
          organizationId: orgBId,
          userId: lawyerB.userId,
          endpoint: "/ai/chat",
          promptTokens: 20,
          completionTokens: 20,
          costUsd: 0.002,
          response: "resp-b",
        },
      ],
    });

    const chatA = await adminPrisma.aIChatSession.create({
      data: {
        expedienteId: expAId,
        userId: lawyerA.userId,
        organizationId: orgAId,
        title: "Chat Alfa",
      },
    });
    const chatB = await adminPrisma.aIChatSession.create({
      data: {
        expedienteId: expBId,
        userId: lawyerB.userId,
        organizationId: orgBId,
        title: "Chat Beta",
      },
    });
    const chatNull = await adminPrisma.aIChatSession.create({
      data: {
        expedienteId: "general-workspace-user",
        userId: lawyerA.userId,
        organizationId: null,
        title: "Chat Ambiguo Histórico",
      },
    });
    chatSessionAId = chatA.id;
    chatSessionBId = chatB.id;
    chatSessionNullId = chatNull.id;

    const msgA = await adminPrisma.aIChatMessage.create({
      data: {
        sessionId: chatSessionAId,
        organizationId: orgAId,
        role: "user",
        content: "Mensaje Alfa",
      },
    });
    const msgB = await adminPrisma.aIChatMessage.create({
      data: {
        sessionId: chatSessionBId,
        organizationId: orgBId,
        role: "user",
        content: "Mensaje Beta",
      },
    });
    chatMsgAId = msgA.id;
    chatMsgBId = msgB.id;

    const dA = await adminPrisma.legalDraft.create({
      data: {
        userId: lawyerA.userId,
        organizationId: orgAId,
        expedienteId: expAId,
        draftType: DraftType.DEMANDA,
        jurisdiction: "NACION",
        fuero: "CIVIL",
        facts: "Hechos Alfa",
      },
    });
    const dB = await adminPrisma.legalDraft.create({
      data: {
        userId: lawyerB.userId,
        organizationId: orgBId,
        expedienteId: expBId,
        draftType: DraftType.DEMANDA,
        jurisdiction: "CABA",
        fuero: "COMERCIAL",
        facts: "Hechos Beta",
      },
    });
    const dNull = await adminPrisma.legalDraft.create({
      data: {
        userId: lawyerA.userId,
        organizationId: null,
        expedienteId: null,
        draftType: DraftType.OTRO,
        jurisdiction: "NACION",
        fuero: "CIVIL",
        facts: "Hechos Históricos Ambiguos",
      },
    });
    draftAId = dA.id;
    draftBId = dB.id;
    draftNullId = dNull.id;

    const rA = await adminPrisma.legalRiskAnalysis.create({
      data: {
        expedienteId: expAId,
        organizationId: orgAId,
        userId: lawyerA.userId,
        score: 30,
        riskLevel: RiskLevel.BAJO,
        factors: {},
        explanation: "Riesgo Alfa",
      },
    });
    const rB = await adminPrisma.legalRiskAnalysis.create({
      data: {
        expedienteId: expBId,
        organizationId: orgBId,
        userId: lawyerB.userId,
        score: 85,
        riskLevel: RiskLevel.ALTO,
        factors: {},
        explanation: "Riesgo Beta",
      },
    });
    riskAId = rA.id;
    riskBId = rB.id;

    const todayDate = new Date("2026-11-20T00:00:00.000Z");
    await adminPrisma.employeeMetric.create({
      data: {
        userId: lawyerA.userId,
        organizationId: orgAId,
        date: todayDate,
        aiPromptsUsed: 5,
      },
    });
    await adminPrisma.employeeMetric.create({
      data: {
        userId: lawyerB.userId,
        organizationId: orgBId,
        date: todayDate,
        aiPromptsUsed: 9,
      },
    });
    const mNull = await adminPrisma.employeeMetric.create({
      data: {
        userId: staffA.userId,
        organizationId: null,
        date: new Date("2026-11-19T00:00:00.000Z"),
        aiPromptsUsed: 1,
      },
    });
    metricNullId = mNull.id;

    await adminPrisma.auditLog.create({
      data: {
        userId: ownerA.userId,
        organizationId: orgAId,
        action: "TEST_AUDIT_A",
        result: "SUCCESS",
      },
    });
    await adminPrisma.auditLog.create({
      data: {
        userId: lawyerB.userId,
        organizationId: orgBId,
        action: "TEST_AUDIT_B",
        result: "SUCCESS",
      },
    });
    const aNull = await adminPrisma.auditLog.create({
      data: {
        userId: null,
        organizationId: null,
        action: "PLATFORM_EVENT_NULL_ORG",
        result: "SUCCESS",
      },
    });
    auditNullId = aNull.id;

    await adminPrisma.eventLog.create({
      data: {
        actorType: ActorType.USER,
        actorId: lawyerA.userId,
        organizationId: orgAId,
        eventType: "TEST_EVT_A",
      },
    });
    await adminPrisma.eventLog.create({
      data: {
        actorType: ActorType.USER,
        actorId: lawyerB.userId,
        organizationId: orgBId,
        eventType: "TEST_EVT_B",
      },
    });
    const eNull = await adminPrisma.eventLog.create({
      data: {
        actorType: ActorType.SYSTEM,
        organizationId: null,
        eventType: "PLATFORM_SYSTEM_EVENT",
      },
    });
    eventLogNullId = eNull.id;

    // Seed Tablas Globales Cat E
    const norm = await adminPrisma.legalNorm.create({
      data: {
        jurisdiccion: LegalNormJurisdiccion.NACION,
        fuero: LegalNormFuero.CIVIL,
        tipoNorma: "LEY",
        nombre: `CCyC ${runTag}`,
        numeroNorma: `LEY-${runTag}`,
        articulo: "1716",
        textoCompleto: "Deber de reparar.",
        fechaVigencia: new Date("2015-08-01T00:00:00.000Z"),
      },
    });
    globalNormId = norm.id;

    const juris = await adminPrisma.jurisprudence.create({
      data: {
        tribunal: JurisprudenceTribunal.CSJN,
        nroExpediente: `CSJ-${runTag}`,
        fecha: new Date("2024-05-01T00:00:00.000Z"),
        jurisdiccion: "NACION",
        fuero: LegalNormFuero.CIVIL,
        tema: ["Daños"],
        resumen: "Sumario test",
        textoCompleto: "Texto completo fallo test",
      },
    });
    globalJurisId = juris.id;

    const cal = await adminPrisma.calendarioJudicial.create({
      data: {
        jurisdiccion: `TEST-${runTag}`,
        fecha: new Date("2026-12-25T00:00:00.000Z"),
        descripcion: "Feriado Test",
      },
    });
    globalCalId = cal.id;

    const plan = await adminPrisma.subscriptionPlan.create({
      data: {
        code: `PLAN-${runTag}`,
        name: "Plan Test",
        maxUsers: 10,
        maxStorageGb: 50,
        maxCases: 500,
        maxAiTokens: 100000,
        features: ["rag"],
      },
    });
    globalPlanId = plan.id;
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (appPrisma) {
      await appPrisma.$disconnect();
    }
    if (adminPrisma) {
      // Limpieza ordenada por FKs con rol dueño
      const orgs = createdOrgIds;
      const users = createdUserIds;
      if (orgs.length > 0) {
        await adminPrisma.documentVersion.deleteMany({
          where: { organizationId: { in: orgs } },
        });
        await adminPrisma.documento.deleteMany({
          where: { organizationId: { in: orgs } },
        });
        await adminPrisma.eventoAgenda.deleteMany({
          where: { organizationId: { in: orgs } },
        });
        await adminPrisma.legalRiskAnalysis.deleteMany({
          where: { organizationId: { in: orgs } },
        });
        await adminPrisma.legalDraft.deleteMany({
          where: {
            OR: [{ organizationId: { in: orgs } }, { id: draftNullId }],
          },
        });
        await adminPrisma.aIChatMessage.deleteMany({
          where: {
            OR: [
              { organizationId: { in: orgs } },
              { sessionId: chatSessionNullId },
            ],
          },
        });
        await adminPrisma.aIChatSession.deleteMany({
          where: {
            OR: [{ organizationId: { in: orgs } }, { id: chatSessionNullId }],
          },
        });
        await adminPrisma.aIInteraction.deleteMany({
          where: { organizationId: { in: orgs } },
        });
        await adminPrisma.tenantUsage.deleteMany({
          where: { organizationId: { in: orgs } },
        });
        await adminPrisma.legalTemplate.deleteMany({
          where: { organizationId: { in: orgs } },
        });
        await adminPrisma.judicialAccount.deleteMany({
          where: { organizationId: { in: orgs } },
        });
        await adminPrisma.client.deleteMany({
          where: { organizationId: { in: orgs } },
        });
        await adminPrisma.expediente.deleteMany({
          where: { organizationId: { in: orgs } },
        });
        await adminPrisma.employeeMetric.deleteMany({
          where: {
            OR: [{ organizationId: { in: orgs } }, { id: metricNullId }],
          },
        });
        await adminPrisma.eventLog.deleteMany({
          where: {
            OR: [{ organizationId: { in: orgs } }, { id: eventLogNullId }],
          },
        });
        await adminPrisma.auditLog.deleteMany({
          where: {
            OR: [{ organizationId: { in: orgs } }, { id: auditNullId }],
          },
        });
        await adminPrisma.organizationInvitation.deleteMany({
          where: { organizationId: { in: orgs } },
        });
        await adminPrisma.organizationMembership.deleteMany({
          where: { organizationId: { in: orgs } },
        });
      }
      if (users.length > 0) {
        await adminPrisma.userSession.deleteMany({
          where: { userId: { in: users } },
        });
        await adminPrisma.userIdentity.deleteMany({
          where: { userId: { in: users } },
        });
        await adminPrisma.user.deleteMany({ where: { id: { in: users } } });
      }
      if (orgs.length > 0) {
        await adminPrisma.organization.deleteMany({
          where: { id: { in: orgs } },
        });
      }
      if (globalNormId)
        await adminPrisma.legalNorm.deleteMany({ where: { id: globalNormId } });
      if (globalJurisId)
        await adminPrisma.jurisprudence.deleteMany({
          where: { id: globalJurisId },
        });
      if (globalCalId)
        await adminPrisma.calendarioJudicial.deleteMany({
          where: { id: globalCalId },
        });
      if (globalPlanId)
        await adminPrisma.subscriptionPlan.deleteMany({
          where: { id: globalPlanId },
        });

      await adminPrisma.$disconnect();
    }
  });

  // =========================================================================
  // SECCIÓN A: AISLAMIENTO ENTRE ORGANIZACIONES Y PROYECCIONES POR ROL
  // =========================================================================

  it("TST-A04-001: Listado de Expediente, Client, EventoAgenda y LegalTemplate bajo Org A retorna solo Org A (0 de Org B)", async () => {
    const expRes = await withAuth(
      request(app.getHttpServer()).get("/expedientes"),
      lawyerA,
    ).expect(200);
    expect(expRes.body.some((e: any) => e.id === expAId)).toBe(true);
    expect(expRes.body.some((e: any) => e.id === expBId)).toBe(false);

    const agendaRes = await withAuth(
      request(app.getHttpServer()).get("/agenda"),
      lawyerA,
    ).expect(200);
    expect(agendaRes.body.some((e: any) => e.id === eventAId)).toBe(true);
    expect(agendaRes.body.some((e: any) => e.id === eventBId)).toBe(false);

    const tplRes = await withAuth(
      request(app.getHttpServer()).get("/templates"),
      lawyerA,
    ).expect(200);
    expect(tplRes.body.some((t: any) => t.id === tplAId)).toBe(true);
    expect(tplRes.body.some((t: any) => t.id === tplBId)).toBe(false);

    // Client listado directo bajo ScopedPrismaService + RLS
    const clients = await scopedPrisma.runInOrgContext(
      { organizationId: orgAId },
      (tx) => tx.client.findMany({ where: { organizationId: orgAId } }),
    );
    expect(clients.some((c) => c.id === clientAId)).toBe(true);
    expect(clients.some((c) => c.id === clientBId)).toBe(false);
  });

  it("TST-A04-002: Acceso por UUID válido de Org B (Expediente, Documento, DocumentVersion, LegalDraft, LegalRiskAnalysis) retorna 404", async () => {
    await withAuth(
      request(app.getHttpServer()).get(`/ai/draft/${draftBId}`),
      lawyerA,
    ).expect(404);
    await withAuth(
      request(app.getHttpServer()).get(`/ai/risk-score/${expBId}`),
      lawyerA,
    ).expect(404);
    await withAuth(
      request(app.getHttpServer()).get(
        `/documents/compare/${verBId}/${verBId}`,
      ),
      lawyerA,
    ).expect(404);

    // Verificación anti-IDOR directa vía ScopedPrismaService para Expediente y Documento
    const foundExp = await scopedPrisma.runInOrgContext(
      { organizationId: orgAId },
      (tx) =>
        tx.expediente.findFirst({
          where: { id: expBId, organizationId: orgAId },
        }),
    );
    const foundDoc = await scopedPrisma.runInOrgContext(
      { organizationId: orgAId },
      (tx) =>
        tx.documento.findFirst({
          where: { id: docBId, organizationId: orgAId },
        }),
    );
    expect(foundExp).toBeNull();
    expect(foundDoc).toBeNull();
  });

  it("TST-A04-003: Escritura/eliminación sobre UUID de Org B retorna 404 y deja intactas las filas en PostgreSQL", async () => {
    // Legal hold en documento de Org B desde ownerA
    await withAuth(
      request(app.getHttpServer())
        .patch(`/documents/${docBId}/legal-hold`)
        .send({ status: true, reason: "idor" }),
      ownerA,
      true,
    ).expect(404);

    const docBAfter = await adminPrisma.documento.findUnique({
      where: { id: docBId },
    });
    expect(docBAfter?.legalHold).toBe(false);

    // Generar plantilla de Org B desde lawyerA
    await withAuth(
      request(app.getHttpServer())
        .post(`/templates/${tplBId}/generate`)
        .send({ cliente: "Hacker" }),
      lawyerA,
      true,
    ).expect(404);

    // Limpiar chat de expediente de Org B desde lawyerA
    await withAuth(
      request(app.getHttpServer()).delete(`/ai/chat/${expBId}/history`),
      lawyerA,
      true,
    ).expect(404);

    const msgBAfter = await adminPrisma.aIChatMessage.findUnique({
      where: { id: chatMsgBId },
    });
    expect(msgBAfter).not.toBeNull();
  });

  it("TST-A04-004: Creación indirecta de EventoAgenda, Documento, AIChatSession o LegalRiskAnalysis sobre expedienteId de Org B retorna 404 y crea 0 filas", async () => {
    const beforeEvents = await adminPrisma.eventoAgenda.count({
      where: { expedienteId: expBId },
    });
    await withAuth(
      request(app.getHttpServer()).post("/agenda/eventos").send({
        titulo: "Inyectado",
        fechaVencimiento: new Date().toISOString(),
        expedienteId: expBId,
      }),
      lawyerA,
      true,
    ).expect(404);
    expect(
      await adminPrisma.eventoAgenda.count({ where: { expedienteId: expBId } }),
    ).toBe(beforeEvents);

    const beforeVers = await adminPrisma.documentVersion.count({
      where: { documentId: docBId },
    });
    await withAuth(
      request(app.getHttpServer())
        .post(`/documents/${docBId}/versions`)
        .send({ filename: "evil.pdf", size: 123, mimetype: "application/pdf" }),
      lawyerA,
      true,
    ).expect(404);
    expect(
      await adminPrisma.documentVersion.count({
        where: { documentId: docBId },
      }),
    ).toBe(beforeVers);

    const beforeChats = await adminPrisma.aIChatSession.count({
      where: { expedienteId: expBId },
    });
    await withAuth(
      request(app.getHttpServer())
        .post(`/ai/chat/${expBId}`)
        .send({ message: "Leer expediente ajeno" }),
      lawyerA,
      true,
    ).expect(404);
    expect(
      await adminPrisma.aIChatSession.count({
        where: { expedienteId: expBId },
      }),
    ).toBe(beforeChats);

    const beforeRisks = await adminPrisma.legalRiskAnalysis.count({
      where: { expedienteId: expBId },
    });
    await withAuth(
      request(app.getHttpServer()).post(`/ai/risk-score/${expBId}`).send({}),
      lawyerA,
      true,
    ).expect(404);
    expect(
      await adminPrisma.legalRiskAnalysis.count({
        where: { expedienteId: expBId },
      }),
    ).toBe(beforeRisks);
  });

  it("TST-A04-005: GET /documents/compare/:v1/:v2 con v1 (Org A) y v2 (Org B) retorna 404 Not Found", async () => {
    await withAuth(
      request(app.getHttpServer()).get(
        `/documents/compare/${verAId}/${verBId}`,
      ),
      lawyerA,
    ).expect(404);
  });

  it("TST-A04-006: Subida de versión rechaza body.path arbitrario (400), genera clave canónica orgs/{orgA}/... y oculta storagePath", async () => {
    // 1. Path traversal / ruta arbitraria rechazada (400)
    await withAuth(
      request(app.getHttpServer())
        .post(`/documents/${docAId}/versions`)
        .send({ path: "/etc/passwd", filename: "test.pdf" }),
      lawyerA,
      true,
    ).expect(400);

    // 2. Subida válida sin path -> genera storagePath canónico en PG y lo omite en JSON
    const okRes = await withAuth(
      request(app.getHttpServer()).post(`/documents/${docAId}/versions`).send({
        filename: "escrito-v2.pdf",
        size: 2048,
        mimetype: "application/pdf",
      }),
      lawyerA,
      true,
    ).expect(201);

    expect(okRes.body.storagePath).toBeUndefined();
    expect(okRes.body.id).toBeDefined();

    const persisted = await adminPrisma.documentVersion.findUnique({
      where: { id: okRes.body.id },
    });
    expect(persisted?.organizationId).toBe(orgAId);
    expect(persisted?.storagePath).toMatch(
      new RegExp(
        `^orgs/${orgAId}/expedientes/${expAId}/documents/${docAId}/v\\d+/[0-9a-f-]{36}$`,
      ),
    );
  });

  it("TST-A04-007: Manipular organizationId: orgB en body/query estando activo en Org A se rechaza (400/403) sin afectar Org B", async () => {
    const beforeExpB = await adminPrisma.expediente.count({
      where: { organizationId: orgBId },
    });
    const resExp = await withAuth(
      request(app.getHttpServer())
        .post("/expedientes")
        .send({
          caratula: "Inyeccion Org B",
          numero: `INJ-${runTag}`,
          juzgado: "J1",
          jurisdiccion: "NACION",
          organizationId: orgBId,
        }),
      lawyerA,
      true,
    );
    expect([400, 403]).toContain(resExp.status);
    expect(
      await adminPrisma.expediente.count({ where: { organizationId: orgBId } }),
    ).toBe(beforeExpB);

    const resTpl = await withAuth(
      request(app.getHttpServer()).post("/templates").send({
        name: "Evil",
        content: "x",
        variables: [],
        organizationId: orgBId,
      }),
      ownerA,
      true,
    );
    expect([400, 403]).toContain(resTpl.status);

    const resAgenda = await withAuth(
      request(app.getHttpServer()).get(`/agenda?organizationId=${orgBId}`),
      lawyerA,
    );
    expect([400, 403]).toContain(resAgenda.status);
  });

  it("TST-A04-008: Sesión BFF con activeOrganizationId = NULL recibe 403 Forbidden (NO_ACTIVE_ORGANIZATION)", async () => {
    const res = await withAuth(
      request(app.getHttpServer()).get("/expedientes"),
      noActiveOrgUser,
    ).expect(403);
    expect(JSON.stringify(res.body)).toContain("NO_ACTIVE_ORGANIZATION");
  });

  it("TST-A04-009: Mutar User.role = ADMIN y User.organizationId = orgB en PostgreSQL real NO otorga elevación ni acceso cruzado", async () => {
    await adminPrisma.user.update({
      where: { id: staffA.userId },
      data: { role: UserRole.ADMIN, organizationId: orgBId },
    });

    // Sigue siendo STAFF en Org A -> 403 al intentar crear expediente
    await withAuth(
      request(app.getHttpServer()).post("/expedientes").send({
        caratula: "Escalada Legacy",
        numero: "ESC-1",
        juzgado: "J1",
        jurisdiccion: "NACION",
      }),
      staffA,
      true,
    ).expect(403);

    // Lectura de agenda sigue estrictamente en Org A (0 eventos de Org B)
    const agendaRes = await withAuth(
      request(app.getHttpServer()).get("/agenda"),
      staffA,
    ).expect(200);
    expect(agendaRes.body.some((e: any) => e.id === eventBId)).toBe(false);
    expect(agendaRes.body.some((e: any) => e.id === eventAId)).toBe(true);
  });

  it("TST-A04-010: Membresía suspendida o revocada durante sesión activa bloquea inmediatamente la siguiente petición (403)", async () => {
    const tempUser = await createUserWithMembership(
      "revoke-mid-session",
      [{ organizationId: orgAId, role: OrganizationRole.LAWYER }],
      orgAId,
    );

    await withAuth(
      request(app.getHttpServer()).get("/expedientes"),
      tempUser,
    ).expect(200);

    await adminPrisma.organizationMembership.update({
      where: {
        userId_organizationId: {
          userId: tempUser.userId,
          organizationId: orgAId,
        },
      },
      data: { status: MembershipStatus.SUSPENDED, suspendedAt: new Date() },
    });

    await withAuth(
      request(app.getHttpServer()).get("/expedientes"),
      tempUser,
    ).expect(403);
  });

  it("TST-A04-011: Organización pasada a SUSPENDED bloquea operaciones de datos (403)", async () => {
    const suspUser = await createUserWithMembership(
      "susp-org-user",
      [{ organizationId: orgSuspendedId, role: OrganizationRole.ORG_OWNER }],
      orgSuspendedId,
    );

    await withAuth(
      request(app.getHttpServer()).get("/expedientes"),
      suspUser,
    ).expect(403);
  });

  it("TST-A04-012: Matriz de roles + proyecciones de columnas en HTTP/PG real (STAFF, ASSISTANT, LAWYER, ORG_OWNER)", async () => {
    // STAFF: Expediente sin tags/users/documentos; EventoAgenda sin descripcion
    const staffExpRes = await withAuth(
      request(app.getHttpServer()).get("/expedientes"),
      staffA,
    ).expect(200);
    const staffExp = staffExpRes.body.find((e: any) => e.id === expAId);
    expect(staffExp).toBeDefined();
    expect(staffExp.caratula).toBeDefined();
    expect(staffExp.tags).toBeUndefined();
    expect(staffExp.documentos).toBeUndefined();
    expect(staffExp.users).toBeUndefined();

    const staffAgendaRes = await withAuth(
      request(app.getHttpServer()).get("/agenda"),
      staffA,
    ).expect(200);
    const staffEvent = staffAgendaRes.body.find((e: any) => e.id === eventAId);
    expect(staffEvent).toBeDefined();
    expect(staffEvent.titulo).toBeDefined();
    expect(staffEvent.descripcion).toBeUndefined();

    // STAFF sin acceso a documentos, plantillas ni IA
    await withAuth(
      request(app.getHttpServer()).get(
        `/documents/compare/${verAId}/${verAId}`,
      ),
      staffA,
    ).expect(403);
    await withAuth(
      request(app.getHttpServer()).get("/templates"),
      staffA,
    ).expect(403);
    await withAuth(
      request(app.getHttpServer()).get(`/ai/risk-score/${expAId}`),
      staffA,
    ).expect(403);

    // ASSISTANT: templates sin content; sin legal-hold; sin ai:use
    const asstTplRes = await withAuth(
      request(app.getHttpServer()).get("/templates"),
      assistantA,
    ).expect(200);
    const asstTpl = asstTplRes.body.find((t: any) => t.id === tplAId);
    expect(asstTpl).toBeDefined();
    expect(asstTpl.content).toBeUndefined();

    await withAuth(
      request(app.getHttpServer())
        .patch(`/documents/${docAId}/legal-hold`)
        .send({ status: true }),
      assistantA,
      true,
    ).expect(403);
    await withAuth(
      request(app.getHttpServer()).get(`/ai/risk-score/${expAId}`),
      assistantA,
    ).expect(403);

    // LAWYER: sin documents:sensitive (legal-hold) ni templates:write
    await withAuth(
      request(app.getHttpServer())
        .patch(`/documents/${docAId}/legal-hold`)
        .send({ status: true }),
      lawyerA,
      true,
    ).expect(403);
    await withAuth(
      request(app.getHttpServer())
        .post("/templates")
        .send({ name: "No", content: "x", variables: [] }),
      lawyerA,
      true,
    ).expect(403);
  });

  it("TST-A04-013: Usuario multi-org (ORG_ADMIN en A, STAFF en B) cambia org activa A -> B con cambio inmediato de rol y datos", async () => {
    // En Org A (ORG_ADMIN): ve expA y puede crear plantilla
    const listA = await withAuth(
      request(app.getHttpServer()).get("/expedientes"),
      multiOrgUser,
    ).expect(200);
    expect(listA.body.some((e: any) => e.id === expAId)).toBe(true);
    expect(listA.body.some((e: any) => e.id === expBId)).toBe(false);

    // Cambiar org activa a Org B mediante AUTH-03
    await withAuth(
      request(app.getHttpServer())
        .post("/api/organizations/active")
        .send({ organizationId: orgBId }),
      multiOrgUser,
      true,
    ).expect(200);

    // En Org B (STAFF): solo ve expB (sin tags), 0 de Org A, y 403 al escribir
    const listB = await withAuth(
      request(app.getHttpServer()).get("/expedientes"),
      multiOrgUser,
    ).expect(200);
    expect(listB.body.some((e: any) => e.id === expBId)).toBe(true);
    expect(listB.body.some((e: any) => e.id === expAId)).toBe(false);
    expect(listB.body.find((e: any) => e.id === expBId)?.tags).toBeUndefined();

    await withAuth(
      request(app.getHttpServer()).post("/expedientes").send({
        caratula: "Blocked in B",
        numero: "BLK-B",
        juzgado: "J",
        jurisdiccion: "CABA",
      }),
      multiOrgUser,
      true,
    ).expect(403);
  });

  it("TST-A04-014: Endpoints prototipales/legacy responden Fail-Closed incluso con sesión ORG_OWNER autenticada", async () => {
    for (const ep of [
      () =>
        withAuth(request(app.getHttpServer()).get("/admin/tenants"), ownerA),
      () =>
        withAuth(request(app.getHttpServer()).get("/admin-api/logs"), ownerA),
      () => withAuth(request(app.getHttpServer()).get("/events/logs"), ownerA),
      () =>
        withAuth(
          request(app.getHttpServer())
            .post("/client-portal/login")
            .send({ email: "a@b.com", cuit: "1" }),
          ownerA,
          true,
        ),
      () =>
        withAuth(
          request(app.getHttpServer())
            .post("/auth/refresh")
            .send({ refresh_token: "x" }),
          ownerA,
          true,
        ),
    ]) {
      const res = await ep();
      expect([403, 404, 410]).toContain(res.status);
    }
  });

  // =========================================================================
  // SECCIÓN B: POSTGRESQL RLS REAL, POOL SAFETY Y PRIVILEGIOS DE ROL
  // =========================================================================

  it("TST-A04-015: Verifica abogados_app_user (NOSUPERUSER, NOBYPASSRLS, no owner, sin DDL/TRUNCATE) y consulta sin GUC retorna 0 filas", async () => {
    const roleRows = await appPrisma.$queryRaw<
      Array<{
        current_user: string;
        rolsuper: boolean;
        rolbypassrls: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
      }>
    >`
      SELECT current_user, r.rolsuper, r.rolbypassrls, r.rolcreatedb, r.rolcreaterole
      FROM pg_roles r
      WHERE r.rolname = current_user
    `;
    expect(roleRows[0]?.current_user).toBe("abogados_app_user");
    expect(roleRows[0]?.rolsuper).toBe(false);
    expect(roleRows[0]?.rolbypassrls).toBe(false);
    expect(roleRows[0]?.rolcreatedb).toBe(false);
    expect(roleRows[0]?.rolcreaterole).toBe(false);

    // No es propietario de ninguna tabla en public
    const ownedTables = await appPrisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tableowner = current_user
    `;
    expect(ownedTables).toHaveLength(0);

    // Sin capacidad DDL ni TRUNCATE
    await expect(
      appPrisma.$executeRawUnsafe(
        `CREATE TABLE public.__rls_forbidden_ddl_test (id int)`,
      ),
    ).rejects.toThrow(/42501|permission denied/i);

    await expect(
      appPrisma.$executeRawUnsafe(`TRUNCATE TABLE "Expediente"`),
    ).rejects.toThrow(/42501|permission denied/i);

    // Sin GUC configurado -> 0 filas visibles (Fail-Closed)
    const withoutGuc = await appPrisma.expediente.findMany();
    expect(withoutGuc).toHaveLength(0);
  });

  it("TST-A04-016: RLS SELECT en las 16 tablas Cat A + Cat B bajo abogados_app_user retorna solo Org A y oculta organizationId IS NULL", async () => {
    await scopedPrisma.runInOrgContext(
      { organizationId: orgAId },
      async (tx) => {
        const checks: Array<{
          name: string;
          rows: Array<{ organizationId?: string | null }>;
        }> = [
          {
            name: "Expediente",
            rows: await tx.expediente.findMany({
              select: { organizationId: true },
            }),
          },
          {
            name: "Client",
            rows: await tx.client.findMany({
              select: { organizationId: true },
            }),
          },
          {
            name: "Documento",
            rows: await tx.documento.findMany({
              select: { organizationId: true },
            }),
          },
          {
            name: "DocumentVersion",
            rows: await tx.documentVersion.findMany({
              select: { organizationId: true },
            }),
          },
          {
            name: "EventoAgenda",
            rows: await tx.eventoAgenda.findMany({
              select: { organizationId: true },
            }),
          },
          {
            name: "LegalTemplate",
            rows: await tx.legalTemplate.findMany({
              select: { organizationId: true },
            }),
          },
          {
            name: "JudicialAccount",
            rows: await tx.judicialAccount.findMany({
              select: { organizationId: true },
            }),
          },
          {
            name: "TenantUsage",
            rows: await tx.tenantUsage.findMany({
              select: { organizationId: true },
            }),
          },
          {
            name: "AIInteraction",
            rows: await tx.aIInteraction.findMany({
              select: { organizationId: true },
            }),
          },
          {
            name: "AIChatSession",
            rows: await tx.aIChatSession.findMany({
              select: { organizationId: true },
            }),
          },
          {
            name: "AIChatMessage",
            rows: await tx.aIChatMessage.findMany({
              select: { organizationId: true },
            }),
          },
          {
            name: "LegalDraft",
            rows: await tx.legalDraft.findMany({
              select: { organizationId: true },
            }),
          },
          {
            name: "LegalRiskAnalysis",
            rows: await tx.legalRiskAnalysis.findMany({
              select: { organizationId: true },
            }),
          },
          {
            name: "EmployeeMetric",
            rows: await tx.employeeMetric.findMany({
              select: { organizationId: true },
            }),
          },
          {
            name: "AuditLog",
            rows: await tx.auditLog.findMany({
              select: { organizationId: true },
            }),
          },
          {
            name: "EventLog",
            rows: await tx.eventLog.findMany({
              select: { organizationId: true },
            }),
          },
        ];

        for (const { name, rows } of checks) {
          expect({ table: name, count: rows.length }).toEqual({
            table: name,
            count: expect.any(Number),
          });
          expect(rows.length).toBeGreaterThanOrEqual(1);
          for (const r of rows) {
            expect(r.organizationId).toBe(orgAId);
          }
        }

        // Confirmar explícitamente que los registros NULL no son visibles
        expect(
          await tx.legalDraft.findFirst({ where: { id: draftNullId } }),
        ).toBeNull();
        expect(
          await tx.aIChatSession.findFirst({
            where: { id: chatSessionNullId },
          }),
        ).toBeNull();
        expect(
          await tx.employeeMetric.findFirst({ where: { id: metricNullId } }),
        ).toBeNull();
        expect(
          await tx.auditLog.findFirst({ where: { id: auditNullId } }),
        ).toBeNull();
        expect(
          await tx.eventLog.findFirst({ where: { id: eventLogNullId } }),
        ).toBeNull();
      },
    );
  });

  it("TST-A04-017: RLS INSERT con orgB bajo GUC orgA falla con 42501; UPDATE/DELETE sobre IDs de Org B afectan 0 filas", async () => {
    await expect(
      scopedPrisma.runInOrgContext({ organizationId: orgAId }, async (tx) => {
        await tx.client.create({
          data: {
            firstName: "Cross",
            lastName: "Tenant",
            organizationId: orgBId,
          },
        });
      }),
    ).rejects.toThrow(/42501|row-level security/i);

    await scopedPrisma.runInOrgContext(
      { organizationId: orgAId },
      async (tx) => {
        const upd = await tx.client.updateMany({
          where: { id: clientBId },
          data: { firstName: "Hacked" },
        });
        expect(upd.count).toBe(0);

        const del = await tx.client.deleteMany({
          where: { id: clientBId },
        });
        expect(del.count).toBe(0);
      },
    );

    const stillIntact = await adminPrisma.client.findUnique({
      where: { id: clientBId },
    });
    expect(stillIntact?.firstName).toBe("Maria");
  });

  it("TST-A04-018: Pool connection_limit=1 (mismo pg_backend_pid): Tx1 (orgA COMMIT) -> Query sin GUC (0 filas) -> Tx2 (orgB)", async () => {
    const singleConnUrl = `${appRuntimeDbUrl}&connection_limit=1`;
    const poolClient = new PrismaClient({
      datasources: { db: { url: singleConnUrl } },
    });
    await poolClient.$connect();

    try {
      const pid1 = await poolClient.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${orgAId}, true)`;
        const rows = await tx.expediente.findMany({
          select: { id: true, organizationId: true },
        });
        expect(rows.length).toBeGreaterThanOrEqual(1);
        expect(rows.every((r) => r.organizationId === orgAId)).toBe(true);
        const [{ pid }] = await tx.$queryRaw<
          Array<{ pid: number }>
        >`SELECT pg_backend_pid() AS pid`;
        return pid;
      });

      // Sin GUC en la MISMA conexión física -> 0 filas
      const [{ pid: pidMid }] = await poolClient.$queryRaw<
        Array<{ pid: number }>
      >`SELECT pg_backend_pid() AS pid`;
      expect(pidMid).toBe(pid1);
      const leaked = await poolClient.expediente.findMany();
      expect(leaked).toHaveLength(0);

      // Tx 2 en la MISMA conexión física para Org B -> solo Org B
      const pid2 = await poolClient.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${orgBId}, true)`;
        const rows = await tx.expediente.findMany({
          select: { id: true, organizationId: true },
        });
        expect(rows.length).toBeGreaterThanOrEqual(1);
        expect(rows.every((r) => r.organizationId === orgBId)).toBe(true);
        const [{ pid }] = await tx.$queryRaw<
          Array<{ pid: number }>
        >`SELECT pg_backend_pid() AS pid`;
        return pid;
      });
      expect(pid2).toBe(pid1);
    } finally {
      await poolClient.$disconnect();
    }
  });

  it("TST-A04-019: Pool connection_limit=1 (mismo pg_backend_pid): Tx1 (orgA ROLLBACK por error) -> Query sin GUC retorna 0 filas", async () => {
    const singleConnUrl = `${appRuntimeDbUrl}&connection_limit=1`;
    const poolClient = new PrismaClient({
      datasources: { db: { url: singleConnUrl } },
    });
    await poolClient.$connect();

    try {
      let pidBeforeRollback = 0;
      await expect(
        poolClient.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${orgAId}, true)`;
          const [{ pid }] = await tx.$queryRaw<
            Array<{ pid: number }>
          >`SELECT pg_backend_pid() AS pid`;
          pidBeforeRollback = pid;
          const rows = await tx.expediente.findMany();
          expect(rows.length).toBeGreaterThanOrEqual(1);
          throw new Error("FORCED_ROLLBACK_TEST");
        }),
      ).rejects.toThrow("FORCED_ROLLBACK_TEST");

      const [{ pid: pidAfter }] = await poolClient.$queryRaw<
        Array<{ pid: number }>
      >`SELECT pg_backend_pid() AS pid`;
      expect(pidAfter).toBe(pidBeforeRollback);
      const afterRollbackRows = await poolClient.expediente.findMany();
      expect(afterRollbackRows).toHaveLength(0);
    } finally {
      await poolClient.$disconnect();
    }
  });

  it("TST-A04-020: AuditLog y EventLog son append-only para abogados_app_user (UPDATE y DELETE rechazados con 42501)", async () => {
    await expect(
      scopedPrisma.runInOrgContext({ organizationId: orgAId }, async (tx) => {
        await tx.$executeRaw`UPDATE "AuditLog" SET "action" = 'TAMPERED' WHERE "organizationId" = ${orgAId}`;
      }),
    ).rejects.toThrow(/42501|permission denied/i);

    await expect(
      scopedPrisma.runInOrgContext({ organizationId: orgAId }, async (tx) => {
        await tx.$executeRaw`DELETE FROM "AuditLog" WHERE "organizationId" = ${orgAId}`;
      }),
    ).rejects.toThrow(/42501|permission denied/i);

    await expect(
      scopedPrisma.runInOrgContext({ organizationId: orgAId }, async (tx) => {
        await tx.$executeRaw`UPDATE "EventLog" SET "eventType" = 'TAMPERED' WHERE "organizationId" = ${orgAId}`;
      }),
    ).rejects.toThrow(/42501|permission denied/i);

    await expect(
      scopedPrisma.runInOrgContext({ organizationId: orgAId }, async (tx) => {
        await tx.$executeRaw`DELETE FROM "EventLog" WHERE "organizationId" = ${orgAId}`;
      }),
    ).rejects.toThrow(/42501|permission denied/i);
  });

  it("TST-A04-021: Tablas globales Cat E permiten SELECT a abogados_app_user y rechazan INSERT/UPDATE/DELETE (42501)", async () => {
    expect(
      (await appPrisma.legalNorm.findMany({ where: { id: globalNormId } }))
        .length,
    ).toBe(1);
    expect(
      (await appPrisma.jurisprudence.findMany({ where: { id: globalJurisId } }))
        .length,
    ).toBe(1);
    expect(
      (
        await appPrisma.calendarioJudicial.findMany({
          where: { id: globalCalId },
        })
      ).length,
    ).toBe(1);
    expect(
      (
        await appPrisma.subscriptionPlan.findMany({
          where: { id: globalPlanId },
        })
      ).length,
    ).toBe(1);
    expect(
      Array.isArray(await appPrisma.jurisprudenceChunk.findMany({ take: 1 })),
    ).toBe(true);
    expect(
      Array.isArray(
        await appPrisma.jurisprudenceCitation.findMany({ take: 1 }),
      ),
    ).toBe(true);

    await expect(
      appPrisma.calendarioJudicial.create({
        data: {
          jurisdiccion: "FORBIDDEN",
          fecha: new Date(),
          descripcion: "No write",
        },
      }),
    ).rejects.toThrow(/42501|permission denied/i);

    await expect(
      appPrisma.subscriptionPlan.update({
        where: { id: globalPlanId },
        data: { name: "Tampered" },
      }),
    ).rejects.toThrow(/42501|permission denied/i);

    await expect(
      appPrisma.legalNorm.delete({ where: { id: globalNormId } }),
    ).rejects.toThrow(/42501|permission denied/i);
  });

  // =========================================================================
  // SECCIÓN C: TABLA PUENTE _ExpedienteToUser (PRISMA M:N + RLS REAL)
  // =========================================================================

  it("TST-A04-023: _ExpedienteToUser Prisma M:N connect de miembro ACTIVE en Org A persiste correctamente", async () => {
    await scopedPrisma.runInOrgContext(
      { organizationId: orgAId },
      async (tx) => {
        const updated = await tx.expediente.update({
          where: { id: expAId },
          data: { users: { connect: { id: lawyerA.userId } } },
          include: { users: { select: { id: true, fullName: true } } },
        });
        expect(updated.users.some((u) => u.id === lawyerA.userId)).toBe(true);
      },
    );
  });

  it("TST-A04-022: _ExpedienteToUser include bajo Org A retorna asignaciones de Org A; Org B recibe 0 filas", async () => {
    const visibleA = await scopedPrisma.runInOrgContext(
      { organizationId: orgAId },
      (tx) =>
        tx.$queryRaw<
          Array<{ A: string; B: string }>
        >`SELECT "A", "B" FROM "_ExpedienteToUser" WHERE "A" = ${expAId}`,
    );
    expect(visibleA).toHaveLength(1);

    const visibleB = await scopedPrisma.runInOrgContext(
      { organizationId: orgBId },
      (tx) =>
        tx.$queryRaw<
          Array<{ A: string; B: string }>
        >`SELECT "A", "B" FROM "_ExpedienteToUser" WHERE "A" = ${expAId}`,
    );
    expect(visibleB).toHaveLength(0);
  });

  it("TST-A04-024: _ExpedienteToUser disconnect funciona en Org A; Org B no puede desconectar asignaciones de Org A", async () => {
    // Asegurar asignación en Org A
    await scopedPrisma.runInOrgContext(
      { organizationId: orgAId },
      async (tx) => {
        await tx.expediente.update({
          where: { id: expAId },
          data: { users: { connect: { id: ownerA.userId } } },
        });
      },
    );

    // Org B intenta eliminar directamente en _ExpedienteToUser -> 0 filas afectadas
    const deletedByB = await scopedPrisma.runInOrgContext(
      { organizationId: orgBId },
      (tx) =>
        tx.$executeRaw`DELETE FROM "_ExpedienteToUser" WHERE "A" = ${expAId} AND "B" = ${ownerA.userId}`,
    );
    expect(deletedByB).toBe(0);

    // Org A desconecta limpiamente vía Prisma M:N
    await scopedPrisma.runInOrgContext(
      { organizationId: orgAId },
      async (tx) => {
        const updated = await tx.expediente.update({
          where: { id: expAId },
          data: { users: { disconnect: { id: ownerA.userId } } },
          include: { users: { select: { id: true } } },
        });
        expect(updated.users.some((u) => u.id === ownerA.userId)).toBe(false);
      },
    );
  });

  it("TST-A04-025: Asignación cruzada en _ExpedienteToUser rechazada en aplicación (403/404) Y bloqueada por RLS WITH CHECK (42501)", async () => {
    // 1. Capa de aplicación: ExpedientesService.assignUser rechaza asignar lawyerB a expA (403) y lawyerB a expA desde Org B (404)
    await expect(
      expedientesService.assignUser(expAId, lawyerB.userId, {
        userId: ownerA.userId,
        organizationId: orgAId,
        membershipId: "m-owner-a",
        orgRole: OrganizationRole.ORG_OWNER,
        correlationId: "corr-25a",
      }),
    ).rejects.toThrow(/ACTIVE membership/i);

    await expect(
      expedientesService.assignUser(expAId, lawyerB.userId, {
        userId: lawyerB.userId,
        organizationId: orgBId,
        membershipId: "m-lawyer-b",
        orgRole: OrganizationRole.LAWYER,
        correlationId: "corr-25b",
      }),
    ).rejects.toThrow(/Expediente not found/i);

    // 2. Capa PostgreSQL RLS directa bajo abogados_app_user: asignar lawyerB (solo miembro de Org B) a expA (Org A) -> 42501
    await expect(
      scopedPrisma.runInOrgContext({ organizationId: orgAId }, async (tx) => {
        await tx.$executeRaw`INSERT INTO "_ExpedienteToUser" ("A", "B") VALUES (${expAId}, ${lawyerB.userId})`;
      }),
    ).rejects.toThrow(/42501|row-level security/i);

    // 3. Desde Org B intentar asignar lawyerB a expA (Org A) -> 42501
    await expect(
      scopedPrisma.runInOrgContext({ organizationId: orgBId }, async (tx) => {
        await tx.$executeRaw`INSERT INTO "_ExpedienteToUser" ("A", "B") VALUES (${expAId}, ${lawyerB.userId})`;
      }),
    ).rejects.toThrow(/42501|row-level security/i);
  });

  // =========================================================================
  // SECCIÓN D: IA, CUOTAS, JUDICIAL, EVENTLOG/AUDITLOG, OCR ASYNC Y CRON
  // =========================================================================

  it("TST-A04-026: AIInteraction y TenantUsage en UsageControlService aislados por org activa + RLS", async () => {
    const quotaOk = await usageControlService.checkAiQuota(orgAId, 100);
    expect(quotaOk).toBe(true);

    await usageControlService.trackUsage(
      orgAId,
      250,
      "/ai/test",
      lawyerA.userId,
    );

    const usageA = await adminPrisma.tenantUsage.findUnique({
      where: { organizationId: orgAId },
    });
    const usageB = await adminPrisma.tenantUsage.findUnique({
      where: { organizationId: orgBId },
    });
    expect(usageA?.aiTokensUsed).toBe(350);
    expect(usageB?.aiTokensUsed).toBe(500);

    // RLS impide que Org A vea o modifique TenantUsage/AIInteraction de Org B
    await scopedPrisma.runInOrgContext(
      { organizationId: orgAId },
      async (tx) => {
        expect(
          await tx.tenantUsage.findFirst({ where: { organizationId: orgBId } }),
        ).toBeNull();
        expect(
          await tx.aIInteraction.findMany({
            where: { organizationId: orgBId },
          }),
        ).toHaveLength(0);
      },
    );
  });

  it("TST-A04-027: AIChatSession (general y por expediente) + AIChatMessage persisten organizationId y aíslan Org B", async () => {
    // Chat general en Org A
    const genRes = await withAuth(
      request(app.getHttpServer())
        .post("/ai/chat/general-workspace-user")
        .send({ message: "Consulta general Org A" }),
      lawyerA,
      true,
    ).expect(201);
    expect(genRes.body.sessionId).toBeDefined();

    const persistedGen = await adminPrisma.aIChatSession.findUnique({
      where: { id: genRes.body.sessionId },
    });
    expect(persistedGen?.organizationId).toBe(orgAId);

    // Org B no puede leer historial del expediente de Org A
    await withAuth(
      request(app.getHttpServer()).get(`/ai/chat/${expAId}/history`),
      lawyerB,
    ).expect(404);

    // Org B no ve mensajes de Org A en chat general
    const histB = await withAuth(
      request(app.getHttpServer()).get(
        "/ai/chat/general-workspace-user/history",
      ),
      lawyerB,
    ).expect(200);
    expect(
      histB.body.some((m: any) => m.content === "Consulta general Org A"),
    ).toBe(false);
  });

  it("TST-A04-028: LegalDraft (con y sin expediente) fija organizationId desde contexto, ignora body.userId y oculta NULL", async () => {
    const createRes = await withAuth(
      request(app.getHttpServer()).post("/ai/draft").send({
        userId: lawyerB.userId, // debe ignorarse/sobrescribirse con req.orgContext.userId
        type: "DEMANDA",
        jurisdiction: "NACION",
        fuero: "CIVIL",
        facts: "Hechos sin expediente en Org A",
      }),
      lawyerA,
      true,
    ).expect(201);

    const draftRow = await adminPrisma.legalDraft.findUnique({
      where: { id: createRes.body.id },
    });
    expect(draftRow?.organizationId).toBe(orgAId);
    expect(draftRow?.userId).toBe(lawyerA.userId);

    // Org B recibe 404 al consultar ese borrador y al consultar el borrador NULL
    await withAuth(
      request(app.getHttpServer()).get(`/ai/draft/${createRes.body.id}`),
      lawyerB,
    ).expect(404);
    await withAuth(
      request(app.getHttpServer()).get(`/ai/draft/${draftNullId}`),
      lawyerA,
    ).expect(404);
  });

  it("TST-A04-029: LegalRiskAnalysis exige ai:use, valida pertenencia de expedienteId, persiste organizationId y aísla Org B", async () => {
    const res = await withAuth(
      request(app.getHttpServer()).post(`/ai/risk-score/${expAId}`).send({}),
      lawyerA,
      true,
    ).expect(201);

    const saved = await adminPrisma.legalRiskAnalysis.findUnique({
      where: { id: res.body.id },
    });
    expect(saved?.organizationId).toBe(orgAId);
    expect(saved?.userId).toBe(lawyerA.userId);

    await withAuth(
      request(app.getHttpServer()).get(`/ai/risk-score/${expAId}`),
      lawyerB,
    ).expect(404);
  });

  it("TST-A04-030: JudicialAccount RLS + JudicialSyncService.syncCase propaga organizationId y sync-system bloqueado (403)", async () => {
    // syncCase válido en Org A propaga organizationId al EventoAgenda creado
    const syncRes = await withAuth(
      request(app.getHttpServer()).post(`/judicial/sync/${expAId}`).send({}),
      lawyerA,
      true,
    ).expect(201);
    expect(syncRes.body.success).toBe(true);

    const syncedEvents = await adminPrisma.eventoAgenda.findMany({
      where: { expedienteId: expAId, titulo: { contains: "[PJN]" } },
    });
    expect(syncedEvents.length).toBeGreaterThanOrEqual(1);
    expect(syncedEvents.every((e) => e.organizationId === orgAId)).toBe(true);

    // syncCase con expediente de Org B -> 404
    await withAuth(
      request(app.getHttpServer()).post(`/judicial/sync/${expBId}`).send({}),
      lawyerA,
      true,
    ).expect(404);

    // sync-system bloqueado para usuarios tenant (403)
    await withAuth(
      request(app.getHttpServer()).post("/judicial/sync-system").send({}),
      ownerA,
      true,
    ).expect(403);

    // JudicialAccount RLS
    await scopedPrisma.runInOrgContext(
      { organizationId: orgAId },
      async (tx) => {
        const accounts = await tx.judicialAccount.findMany();
        expect(accounts.some((a) => a.id === judicialAccAId)).toBe(true);
        expect(accounts.some((a) => a.id === judicialAccBId)).toBe(false);
      },
    );
  });

  it("TST-A04-031: EventLog y AuditLog — /events/collect usa org validada, /events/logs bloqueado y AuditLog oculta NULL", async () => {
    // GET /events/logs bloqueado Fail-Closed
    await withAuth(
      request(app.getHttpServer()).get("/events/logs"),
      ownerA,
    ).expect(403);

    // POST /events/collect firmado con HMAC + sesión BFF Org A, intentando spoofing de organizationId = orgB -> rechazado 403
    const bodySpoof = { eventType: "VIEW_DOC", organizationId: orgBId };
    const ts = String(Date.now());
    const nonce = crypto.randomBytes(8).toString("hex");
    const sigSpoof = crypto
      .createHmac("sha256", PIXEL_SECRET)
      .update("" + ts + nonce + JSON.stringify(bodySpoof))
      .digest("hex");

    const spoofRes = await withAuth(
      request(app.getHttpServer())
        .post("/events/collect")
        .set("X-Timestamp", ts)
        .set("X-Nonce", nonce)
        .set("X-Signature", sigSpoof)
        .send(bodySpoof),
      lawyerA,
      true,
    );
    expect([400, 403]).toContain(spoofRes.status);

    // POST /events/collect válido sin spoofing persiste EventLog bajo orgA
    const bodyOk = {
      eventType: "VIEW_DOC",
      entityType: "EXPEDIENTE",
      entityId: expAId,
    };
    const ts2 = String(Date.now());
    const nonce2 = crypto.randomBytes(8).toString("hex");
    const sigOk = crypto
      .createHmac("sha256", PIXEL_SECRET)
      .update("" + ts2 + nonce2 + JSON.stringify(bodyOk))
      .digest("hex");

    await withAuth(
      request(app.getHttpServer())
        .post("/events/collect")
        .set("X-Timestamp", ts2)
        .set("X-Nonce", nonce2)
        .set("X-Signature", sigOk)
        .send(bodyOk),
      lawyerA,
      true,
    ).expect(201);

    const createdEvt = await adminPrisma.eventLog.findFirst({
      where: { entityId: expAId, eventType: "VIEW_DOC" },
    });
    expect(createdEvt?.organizationId).toBe(orgAId);

    // AuditLog bajo RLS no expone organizationId IS NULL ni registros de Org B
    await scopedPrisma.runInOrgContext(
      { organizationId: orgAId },
      async (tx) => {
        const logs = await tx.auditLog.findMany();
        expect(logs.every((l) => l.organizationId === orgAId)).toBe(true);
        expect(logs.some((l) => l.id === auditNullId)).toBe(false);
      },
    );
  });

  it("TST-A04-032: OCR asíncrono (DocumentsService.processOCR) ejecuta bajo ScopedPrismaService y rechaza orgId erróneo (0 filas)", async () => {
    const beforeContent = (
      await adminPrisma.documentVersion.findUnique({ where: { id: verAId } })
    )?.ocrContent;

    // Invocación con organizationId equivocado (orgB) intentando mutar verAId -> 0 filas afectadas
    const wrongResult = await documentsService.processOCR(orgBId, verAId);
    expect(wrongResult.updatedCount).toBe(0);
    expect(
      (await adminPrisma.documentVersion.findUnique({ where: { id: verAId } }))
        ?.ocrContent,
    ).toBe(beforeContent);

    // Invocación con organizationId correcto (orgA) -> 1 fila actualizada bajo abogados_app_user
    const okResult = await documentsService.processOCR(orgAId, verAId);
    expect(okResult.updatedCount).toBe(1);
    expect(
      (await adminPrisma.documentVersion.findUnique({ where: { id: verAId } }))
        ?.ocrContent,
    ).toContain("OCR");
  });

  it("TST-A04-033: Cron de vencimientos (AgendaService.handleCron) itera por org ACTIVE sin mezclar tenants + EmployeeMetric aislado por RLS", async () => {
    const summary = await agendaService.handleCron();
    expect(summary).toBeDefined();
    expect(Array.isArray(summary.perOrganization)).toBe(true);

    const entryA = summary.perOrganization.find(
      (o) => o.organizationId === orgAId,
    );
    const entryB = summary.perOrganization.find(
      (o) => o.organizationId === orgBId,
    );
    const entrySusp = summary.perOrganization.find(
      (o) => o.organizationId === orgSuspendedId,
    );

    expect(entryA).toBeDefined();
    expect(entryA!.urgentCount).toBeGreaterThanOrEqual(1);
    expect(entryB).toBeDefined();
    expect(entryB!.urgentCount).toBeGreaterThanOrEqual(1);
    expect(entrySusp).toBeUndefined();

    // EmployeeMetric persiste organizationId desde contexto y queda aislado por RLS
    await analyticsService.updateEmployeeMetrics(
      orgAId,
      ownerA.userId,
      "AI",
      3,
    );

    await scopedPrisma.runInOrgContext(
      { organizationId: orgAId },
      async (tx) => {
        const metricsA = await tx.employeeMetric.findMany();
        expect(
          metricsA.some(
            (m) => m.userId === ownerA.userId && m.organizationId === orgAId,
          ),
        ).toBe(true);
        expect(metricsA.every((m) => m.organizationId === orgAId)).toBe(true);
        expect(metricsA.some((m) => m.id === metricNullId)).toBe(false);
      },
    );
  });
});
