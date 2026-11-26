/**
 * AUTH-09 — Suite TDS Real de Escritos y Redacción Jurídica
 * Expediente: AUTH09-LEGAL-DRAFTING-IMPLEMENTATION-001
 *
 * Ejecuta sobre PostgreSQL 18 real (abogados_test / abogados_app_user NOBYPASSRLS)
 * y almacenamiento privado AUTH-08 real en disco (DOCUMENT_STORAGE_ROOT aislado).
 *
 * Cubre:
 * - 14.1 Funcionales: alta, edición, versiones inmutables, plantillas (copia independiente,
 *        duplicar, editar, archivar), flujo de revisión y transiciones, exportación real
 *        DOCX/PDF verificada en binario + hash + integración AUTH-08, archivado y filtros.
 * - 14.2 Seguridad: 401, CSRF, org suspendida, membresía suspendida, IDOR multi-tenant,
 *        spoofing organizationId, RBAC (STAFF/ASSISTANT/LAWYER/ADMIN/OWNER), segregación
 *        de funciones (prohibición de autoaprobación), bloqueo de PATCH status, bloqueo
 *        de edición de plantilla de sistema y sanitización anti-XSS/scripts/iframes.
 * - 14.3 Concurrencia e integridad: versiones concurrentes, aprobaciones concurrentes,
 *        exportaciones concurrentes / idempotencia sin duplicar documentos AUTH-08.
 * - 14.4 RLS real con abogados_app_user (NOBYPASSRLS), fail-closed sin contexto,
 *        aislamiento A/B e inmutabilidad por GRANT en LegalDraftVersion.
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
  LegalDraftDocumentType,
  LegalDraftStatus,
} from "@prisma/client";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { assertSafeTestDatabaseUrl } from "../helpers/db-guard";
import { PrismaService } from "../../src/prisma.service";
import { AuthModule } from "../../src/auth/auth.module";
import { AuthzModule } from "../../src/authz/authz.module";
import { OrganizationsModule } from "../../src/organizations/organizations.module";
import { ClientsModule } from "../../src/clients/clients.module";
import { ExpedientesModule } from "../../src/expedientes/expedientes.module";
import { DocumentsManagementModule } from "../../src/documents/documents-management.module";
import { LegalDraftsModule } from "../../src/legal-drafts/legal-drafts.module";
import { BffSessionService } from "../../src/auth/bff/bff-session.service";
import { CsrfService } from "../../src/auth/bff/csrf.service";
import { ScopedPrismaService } from "../../src/authz/scoped-prisma.service";

interface TestUserSession {
  userId: string;
  email: string;
  rawSessionSecret: string;
  csrfToken: string;
  cookies: string[];
}

const SYSTEM_DEMANDA_TEMPLATE_ID = "00000000-0000-4000-8000-000000000901";

const buildTipTapDoc = (headingText: string, bodyText: string) => ({
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2, textAlign: "center" },
      content: [{ type: "text", text: headingText }],
    },
    {
      type: "paragraph",
      attrs: { textAlign: "justify" },
      content: [
        { type: "text", marks: [{ type: "bold" }], text: "SEÑOR/A JUEZ: " },
        { type: "text", text: bodyText },
      ],
    },
    {
      type: "orderedList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Primer punto petitorio verificado." },
              ],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Segundo punto petitorio verificado." },
              ],
            },
          ],
        },
      ],
    },
  ],
});

const binaryParser = (
  res: request.Response,
  callback: (err: Error | null, body: Buffer) => void,
) => {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
};

describe("AUTH-09 — Escritos y Redacción Jurídica (Real PostgreSQL 18 + DOCX/PDF + AUTH-08)", () => {
  let app: INestApplication;
  let adminPrisma: PrismaClient;
  let appPrisma: PrismaClient;
  let sessionService: BffSessionService;
  let csrfService: CsrfService;
  let scopedPrisma: ScopedPrismaService;

  const APP_ORIGIN = "http://localhost:3000";
  const TEST_ENCRYPTION_KEY =
    process.env.OIDC_TRANSACTION_ENCRYPTION_KEY ||
    "9059d7b7e25d3c8c6de1cb0dc62232e3692c26404b1c2cdaecc19e559ef16a0c";
  const adminDbUrl =
    process.env.MIGRATION_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/abogados_test?schema=public";
  const appRuntimeDbUrl = process.env.APP_RUNTIME_DATABASE_URL || "";

  const runTag = `drf09-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const storageRoot = path.join(os.tmpdir(), `abogados-auth09-${runTag}`);
  const prevStorageRoot = process.env.DOCUMENT_STORAGE_ROOT;

  let orgAId: string;
  let orgBId: string;
  let orgSuspendedId: string;

  let ownerA: TestUserSession;
  let adminA: TestUserSession;
  let lawyerA1: TestUserSession;
  let lawyerA2: TestUserSession;
  let assistantA: TestUserSession;
  let staffA: TestUserSession;
  let lawyerB: TestUserSession;
  let suspendedMemberUser: TestUserSession;
  let suspendedOrgUser: TestUserSession;

  let clientAId: string;
  let clientBId: string;
  let expAId: string;
  let expBId: string;

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
        fullName: `Dr. ${label}`,
        passwordHash: "$2b$04$testMockHashNeverExposed",
        role: UserRole.ASSOCIATE,
        organizationId: baseOrgId,
      },
    });
    createdUserIds.push(user.id);

    await adminPrisma.userIdentity.create({
      data: {
        userId: user.id,
        issuer: "https://abogados-test.local/",
        subject: `auth0|${label}-${runTag}`,
        provider: "auth0",
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
    if (!appRuntimeDbUrl) {
      throw new Error("APP_RUNTIME_DATABASE_URL is required for AUTH-09 TDS");
    }
    assertSafeTestDatabaseUrl(appRuntimeDbUrl);

    fs.mkdirSync(storageRoot, { recursive: true });
    process.env.DOCUMENT_STORAGE_ROOT = storageRoot;

    adminPrisma = new PrismaClient({
      datasources: { db: { url: adminDbUrl } },
    });
    appPrisma = new PrismaClient({
      datasources: { db: { url: appRuntimeDbUrl } },
    });
    await adminPrisma.$connect();
    await appPrisma.$connect();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              NODE_ENV: "test",
              DATABASE_URL: appRuntimeDbUrl,
              APP_ORIGIN,
              OIDC_TRANSACTION_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
              CSRF_SECRET:
                process.env.CSRF_SECRET ||
                "test-csrf-hmac-secret-for-automated-testing-32-chars-min!",
              DOCUMENT_STORAGE_ROOT: storageRoot,
              AUTH0_DOMAIN: "abogados-test.us.auth0.com",
              AUTH0_CLIENT_ID: "test-client-id",
              AUTH0_CLIENT_SECRET: "test-client-secret",
              AUTH0_CALLBACK_URL: "http://localhost:3000/auth/callback",
            }),
          ],
        }),
        AuthModule,
        AuthzModule,
        OrganizationsModule,
        ClientsModule,
        ExpedientesModule,
        DocumentsManagementModule,
        LegalDraftsModule,
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

    sessionService = moduleRef.get(BffSessionService);
    csrfService = moduleRef.get(CsrfService);
    scopedPrisma = moduleRef.get(ScopedPrismaService);

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

    ownerA = await createUserWithMembership(
      "ownerA",
      [{ organizationId: orgAId, role: OrganizationRole.ORG_OWNER }],
      orgAId,
    );
    adminA = await createUserWithMembership(
      "adminA",
      [{ organizationId: orgAId, role: OrganizationRole.ORG_ADMIN }],
      orgAId,
    );
    lawyerA1 = await createUserWithMembership(
      "lawyerA1",
      [{ organizationId: orgAId, role: OrganizationRole.LAWYER }],
      orgAId,
    );
    lawyerA2 = await createUserWithMembership(
      "lawyerA2",
      [{ organizationId: orgAId, role: OrganizationRole.LAWYER }],
      orgAId,
    );
    assistantA = await createUserWithMembership(
      "assistantA",
      [{ organizationId: orgAId, role: OrganizationRole.ASSISTANT }],
      orgAId,
    );
    staffA = await createUserWithMembership(
      "staffA",
      [{ organizationId: orgAId, role: OrganizationRole.STAFF }],
      orgAId,
    );
    lawyerB = await createUserWithMembership(
      "lawyerB",
      [{ organizationId: orgBId, role: OrganizationRole.LAWYER }],
      orgBId,
    );
    suspendedMemberUser = await createUserWithMembership(
      "suspMember",
      [
        {
          organizationId: orgAId,
          role: OrganizationRole.LAWYER,
          status: MembershipStatus.SUSPENDED,
        },
      ],
      orgAId,
    );
    suspendedOrgUser = await createUserWithMembership(
      "suspOrg",
      [{ organizationId: orgSuspendedId, role: OrganizationRole.LAWYER }],
      orgSuspendedId,
    );

    const cliA = await adminPrisma.client.create({
      data: {
        organizationId: orgAId,
        personType: ClientPersonType.HUMANA,
        firstName: "Carlos",
        lastName: "Gómez",
        dniCuit: `20-${Date.now().toString().slice(-8)}-1`,
        status: ClientStatus.ACTIVO,
      },
    });
    const cliB = await adminPrisma.client.create({
      data: {
        organizationId: orgBId,
        personType: ClientPersonType.HUMANA,
        firstName: "Ana",
        lastName: "Martínez",
        dniCuit: `27-${Date.now().toString().slice(-8)}-2`,
        status: ClientStatus.ACTIVO,
      },
    });
    clientAId = cliA.id;
    clientBId = cliB.id;

    const expA = await adminPrisma.expediente.create({
      data: {
        organizationId: orgAId,
        caratula: `Gómez c/ Constructora SA s/ Daños (${runTag})`,
        numeroExpediente: `EXP-A-${runTag.slice(-6)}`,
        juzgado: "Juzgado Civil N° 12",
        jurisdiccion: "CABA",
        estado: ExpedienteEstado.EN_TRAMITE,
      },
    });
    const expB = await adminPrisma.expediente.create({
      data: {
        organizationId: orgBId,
        caratula: `Martínez c/ Banco Sur s/ Cobro (${runTag})`,
        numeroExpediente: `EXP-B-${runTag.slice(-6)}`,
        juzgado: "Juzgado Comercial N° 4",
        jurisdiccion: "NACION",
        estado: ExpedienteEstado.EN_TRAMITE,
      },
    });
    expAId = expA.id;
    expBId = expB.id;
  }, 30000);

  afterAll(async () => {
    try {
      if (createdOrgIds.length > 0) {
        await adminPrisma.legalDraftExport.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await adminPrisma.legalDraftReview.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await adminPrisma.legalDraftVersion.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await adminPrisma.legalWriting.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await adminPrisma.legalDraftTemplate.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await adminPrisma.documentFileVersion.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await adminPrisma.document.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await adminPrisma.auditLog.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await adminPrisma.expediente.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await adminPrisma.client.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
      }
      if (createdUserIds.length > 0) {
        await adminPrisma.userSession.deleteMany({
          where: { userId: { in: createdUserIds } },
        });
        await adminPrisma.organizationMembership.deleteMany({
          where: { userId: { in: createdUserIds } },
        });
        await adminPrisma.userIdentity.deleteMany({
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
    } finally {
      if (prevStorageRoot === undefined) {
        delete process.env.DOCUMENT_STORAGE_ROOT;
      } else {
        process.env.DOCUMENT_STORAGE_ROOT = prevStorageRoot;
      }
      fs.rmSync(storageRoot, { recursive: true, force: true });
      await app?.close();
      await appPrisma?.$disconnect();
      await adminPrisma?.$disconnect();
    }
  });

  // Shared state for sequential functional tests
  let draft1Id: string;
  let draft1V1Id: string;
  let draft1V2Id: string;
  let orgTemplateId: string;
  let docxExportId: string;

  // =========================================================================
  // 14.1 PRUEBAS FUNCIONALES
  // =========================================================================

  it("TDS-DRF-001: Crear escrito vinculado a expediente y cliente, genera v1 inmutable, plainText y AuditLog", async () => {
    const content = buildTipTapDoc(
      "PROMUEVE DEMANDA POR DAÑOS",
      "Vengo a promover formal demanda por incumplimiento contractual verificado.",
    );

    const res = await withAuth(
      request(app.getHttpServer())
        .post("/legal-drafts")
        .send({
          expedienteId: expAId,
          clientId: clientAId,
          title: "Demanda Principal — Daños y Perjuicios",
          documentType: LegalDraftDocumentType.DEMANDA,
          jurisdiction: "CABA",
          courtName: "Juzgado Civil N° 12",
          caseNumber: `EXP-A-${runTag.slice(-6)}`,
          content,
          changeNote: "Redacción inicial v1",
        }),
      lawyerA1,
      true,
    ).expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe(LegalDraftStatus.DRAFT);
    expect(res.body.currentVersionNumber).toBe(1);
    expect(res.body.expedienteId).toBe(expAId);
    expect(res.body.clientId).toBe(clientAId);
    expect(Array.isArray(res.body.versions)).toBe(true);
    expect(res.body.versions).toHaveLength(1);
    expect(res.body.versions[0].versionNumber).toBe(1);
    expect(res.body.versions[0].plainText).toContain(
      "incumplimiento contractual verificado",
    );

    draft1Id = res.body.id;
    draft1V1Id = res.body.versions[0].id;

    const audit = await adminPrisma.auditLog.findFirst({
      where: {
        organizationId: orgAId,
        entityTable: "LegalWriting",
        entityId: draft1Id,
        action: "LEGAL_DRAFT_CREATED",
      },
    });
    expect(audit).not.toBeNull();
  });

  it("TDS-DRF-002: Editar metadatos, guardar nueva versión v2 y preservar v1 inmutable", async () => {
    const patchRes = await withAuth(
      request(app.getHttpServer()).patch(`/legal-drafts/${draft1Id}`).send({
        title: "Demanda Principal — Daños y Perjuicios (Revisada)",
        courtName: "Juzgado Nacional en lo Civil N° 12",
      }),
      lawyerA1,
      true,
    ).expect(200);
    expect(patchRes.body.title).toContain("Revisada");

    const v2Content = buildTipTapDoc(
      "PROMUEVE DEMANDA POR DAÑOS — VERSIÓN 2",
      "Se incorporan pruebas documentales y liquidación detallada.",
    );

    const v2Res = await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${draft1Id}/versions`)
        .send({
          content: v2Content,
          changeNote: "Incorporación de liquidación",
        }),
      lawyerA1,
      true,
    ).expect(201);

    expect(v2Res.body.versionNumber).toBe(2);
    expect(v2Res.body.plainText).toContain("liquidación detallada");
    draft1V2Id = v2Res.body.id;

    const versionsRes = await withAuth(
      request(app.getHttpServer()).get(`/legal-drafts/${draft1Id}/versions`),
      lawyerA1,
    ).expect(200);
    expect(versionsRes.body).toHaveLength(2);
    expect(versionsRes.body[0].versionNumber).toBe(2);
    expect(versionsRes.body[1].versionNumber).toBe(1);

    // v1 permanece intacta
    const v1Check = await withAuth(
      request(app.getHttpServer()).get(
        `/legal-drafts/${draft1Id}/versions/${draft1V1Id}`,
      ),
      lawyerA1,
    ).expect(200);
    expect(v1Check.body.plainText).toContain(
      "incumplimiento contractual verificado",
    );
    expect(v1Check.body.plainText).not.toContain("liquidación detallada");
  });

  it("TDS-DRF-003: Plantillas — listar (sistema + propias), crear, editar, duplicar, crear escrito independiente y archivar", async () => {
    // Listar debe incluir plantillas orientativas de sistema
    const listInit = await withAuth(
      request(app.getHttpServer()).get("/legal-templates"),
      lawyerA1,
    ).expect(200);
    expect(
      listInit.body.data.some(
        (t: any) => t.id === SYSTEM_DEMANDA_TEMPLATE_ID && t.isSystemTemplate,
      ),
    ).toBe(true);

    // Crear plantilla de organización
    const createdTpl = await withAuth(
      request(app.getHttpServer())
        .post("/legal-templates")
        .send({
          name: "Plantilla Oficio Bancario del Estudio",
          description: "Modelo editable orientativo del estudio",
          documentType: LegalDraftDocumentType.OFICIO,
          content: buildTipTapDoc(
            "OFICIO JUDICIAL — [COMPLETAR DESTINATARIO]",
            "Texto original de plantilla del estudio.",
          ),
        }),
      lawyerA1,
      true,
    ).expect(201);
    orgTemplateId = createdTpl.body.id;
    expect(createdTpl.body.isSystemTemplate).toBe(false);

    // Crear escrito desde plantilla
    const draftFromTpl = await withAuth(
      request(app.getHttpServer()).post("/legal-drafts").send({
        expedienteId: expAId,
        sourceTemplateId: orgTemplateId,
        title: "Oficio al Banco Central",
        documentType: LegalDraftDocumentType.OFICIO,
      }),
      lawyerA1,
      true,
    ).expect(201);
    expect(draftFromTpl.body.sourceTemplateId).toBe(orgTemplateId);
    expect(draftFromTpl.body.versions[0].plainText).toContain(
      "Texto original de plantilla del estudio",
    );

    // Editar la plantilla NO debe alterar el escrito ya creado
    await withAuth(
      request(app.getHttpServer())
        .patch(`/legal-templates/${orgTemplateId}`)
        .send({
          content: buildTipTapDoc(
            "OFICIO MODIFICADO",
            "Nuevo texto modificado en plantilla.",
          ),
        }),
      lawyerA1,
      true,
    ).expect(200);

    const recheckDraft = await withAuth(
      request(app.getHttpServer()).get(`/legal-drafts/${draftFromTpl.body.id}`),
      lawyerA1,
    ).expect(200);
    expect(recheckDraft.body.versions[0].plainText).toContain(
      "Texto original de plantilla del estudio",
    );
    expect(recheckDraft.body.versions[0].plainText).not.toContain(
      "Nuevo texto modificado",
    );

    // Duplicar plantilla
    const dupRes = await withAuth(
      request(app.getHttpServer())
        .post(`/legal-templates/${orgTemplateId}/duplicate`)
        .send({}),
      lawyerA1,
      true,
    ).expect(201);
    expect(dupRes.body.id).not.toBe(orgTemplateId);
    expect(dupRes.body.isSystemTemplate).toBe(false);

    // Archivar plantilla duplicada
    await withAuth(
      request(app.getHttpServer()).delete(`/legal-templates/${dupRes.body.id}`),
      lawyerA1,
      true,
    ).expect(200);
  });

  it("TDS-DRF-004: Flujo de revisión (DRAFT -> IN_REVIEW -> CHANGES_REQUESTED -> v3 -> IN_REVIEW -> APPROVED -> FINALIZED), rechazo de transiciones inválidas e invalidación por nueva versión", async () => {
    // Transiciones inválidas desde DRAFT deben rechazarse
    await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${draft1Id}/finalize`)
        .send({}),
      lawyerA2,
      true,
    ).expect(400);

    await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${draft1Id}/approve`)
        .send({ versionId: draft1V2Id }),
      lawyerA2,
      true,
    ).expect(400);

    // Enviar a revisión (v2)
    const submit1 = await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${draft1Id}/submit-review`)
        .send({ reviewerId: lawyerA2.userId, comments: "Revisar monto" }),
      lawyerA1,
      true,
    ).expect(200);
    expect(submit1.body.status).toBe(LegalDraftStatus.IN_REVIEW);

    // Revisor solicita cambios
    const reqChanges = await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${draft1Id}/request-changes`)
        .send({ comments: "Falta precisar domicilio procesal" }),
      lawyerA2,
      true,
    ).expect(200);
    expect(reqChanges.body.status).toBe(LegalDraftStatus.CHANGES_REQUESTED);

    // Autor guarda nueva versión v3 -> vuelve a DRAFT
    const v3Res = await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${draft1Id}/versions`)
        .send({
          content: buildTipTapDoc(
            "PROMUEVE DEMANDA POR DAÑOS — VERSIÓN 3 FINAL",
            "Domicilio procesal precisado y liquidación completa lista para aprobación.",
          ),
          changeNote: "Domicilio procesal corregido",
        }),
      lawyerA1,
      true,
    ).expect(201);
    const v3Id = v3Res.body.id;
    expect(v3Res.body.versionNumber).toBe(3);

    // Reenviar a revisión
    await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${draft1Id}/submit-review`)
        .send({ reviewerId: lawyerA2.userId }),
      lawyerA1,
      true,
    ).expect(200);

    // Aprobar indicando versión equivocada (v2) debe fallar
    await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${draft1Id}/approve`)
        .send({ versionId: draft1V2Id }),
      lawyerA2,
      true,
    ).expect(400);

    // Revisor distinto aprueba v3
    const approved = await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${draft1Id}/approve`)
        .send({ versionId: v3Id, comments: "Aprobado conforme revisión" }),
      lawyerA2,
      true,
    ).expect(200);
    expect(approved.body.status).toBe(LegalDraftStatus.APPROVED);

    // Finalizar
    const finalized = await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${draft1Id}/finalize`)
        .send({}),
      lawyerA2,
      true,
    ).expect(200);
    expect(finalized.body.status).toBe(LegalDraftStatus.FINALIZED);

    // Crear nueva versión v4 sobre escrito FINALIZED vuelve a DRAFT pero preserva aprobación histórica de v3
    const v4Res = await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${draft1Id}/versions`)
        .send({
          content: buildTipTapDoc(
            "PROMUEVE DEMANDA — V4 POST FINALIZACIÓN",
            "Nueva revisión posterior que invalida estado aprobado.",
          ),
          changeNote: "Actualización posterior",
        }),
      lawyerA1,
      true,
    ).expect(201);
    expect(v4Res.body.versionNumber).toBe(4);

    const detailAfterV4 = await withAuth(
      request(app.getHttpServer()).get(`/legal-drafts/${draft1Id}`),
      lawyerA1,
    ).expect(200);
    expect(detailAfterV4.body.status).toBe(LegalDraftStatus.DRAFT);
    expect(
      detailAfterV4.body.reviews.some(
        (r: any) => r.versionId === v3Id && r.status === "APPROVED",
      ),
    ).toBe(true);
    expect(
      detailAfterV4.body.reviews.some(
        (r: any) => r.versionId === v4Res.body.id && r.status === "APPROVED",
      ),
    ).toBe(false);
  });

  it("TDS-DRF-005: Generación real DOCX y PDF, verificación de binarios/SHA-256, integración AUTH-08 sin MovimientoProcesal automático", async () => {
    const movCountBefore = await adminPrisma.movimientoProcesal.count({
      where: { organizationId: orgAId, expedienteId: expAId },
    });

    // Exportar DOCX de v2
    const docxRes = await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${draft1Id}/export`)
        .send({
          versionId: draft1V2Id,
          format: "DOCX",
          idempotencyKey: `exp-docx-${runTag}`,
          options: {
            fontFamily: "Times New Roman",
            fontSizePt: 12,
            lineSpacing: 1.5,
            marginTopCm: 2.5,
            marginBottomCm: 2.5,
            marginLeftCm: 3.0,
            marginRightCm: 2.5,
            headerText: "Estudio Alfa — Uso Interno",
            footerText: "Confidencial",
          },
        }),
      lawyerA1,
      true,
    ).expect(201);

    expect(docxRes.body.format).toBe("DOCX");
    expect(docxRes.body.versionId).toBe(draft1V2Id);
    expect(docxRes.body.storageDocumentId).toBeDefined();
    expect(docxRes.body.sha256).toMatch(/^[a-f0-9]{64}$/);
    docxExportId = docxRes.body.id;

    // Descargar DOCX y verificar firma ZIP/OOXML + SHA-256 real
    const docxDownload = await withAuth(
      request(app.getHttpServer())
        .get(`/legal-drafts/${draft1Id}/exports/${docxExportId}/download`)
        .buffer(true)
        .parse(binaryParser),
      lawyerA1,
    ).expect(200);

    const docxBuf: Buffer = docxDownload.body;
    expect(docxBuf.subarray(0, 4)).toEqual(
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    );
    expect(docxBuf.toString("latin1")).toContain("word/document.xml");
    const actualDocxHash = crypto
      .createHash("sha256")
      .update(docxBuf)
      .digest("hex");
    expect(actualDocxHash).toBe(docxRes.body.sha256);
    expect(docxDownload.headers["content-disposition"]).toContain("attachment");
    expect(docxDownload.headers["x-content-type-options"]).toBe("nosniff");
    expect(docxDownload.headers["cache-control"]).toContain("no-store");

    // Exportar PDF de v2
    const pdfRes = await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${draft1Id}/export`)
        .send({
          versionId: draft1V2Id,
          format: "PDF",
          idempotencyKey: `exp-pdf-${runTag}`,
        }),
      lawyerA1,
      true,
    ).expect(201);

    expect(pdfRes.body.format).toBe("PDF");
    expect(pdfRes.body.sha256).toMatch(/^[a-f0-9]{64}$/);

    const pdfDownload = await withAuth(
      request(app.getHttpServer())
        .get(`/legal-drafts/${draft1Id}/exports/${pdfRes.body.id}/download`)
        .buffer(true)
        .parse(binaryParser),
      lawyerA1,
    ).expect(200);

    const pdfBuf: Buffer = pdfDownload.body;
    expect(pdfBuf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(pdfBuf.length).toBeGreaterThan(500);
    const actualPdfHash = crypto
      .createHash("sha256")
      .update(pdfBuf)
      .digest("hex");
    expect(actualPdfHash).toBe(pdfRes.body.sha256);

    // Verificar documento AUTH-08 vinculado al expediente
    const auth08Doc = await withAuth(
      request(app.getHttpServer()).get(
        `/documents/${docxRes.body.storageDocumentId}`,
      ),
      lawyerA1,
    ).expect(200);
    expect(auth08Doc.body.expedienteId).toBe(expAId);
    expect(auth08Doc.body.versions[0].sha256).toBe(docxRes.body.sha256);

    // Exportar NO genera MovimientoProcesal automático
    const movCountAfter = await adminPrisma.movimientoProcesal.count({
      where: { organizationId: orgAId, expedienteId: expAId },
    });
    expect(movCountAfter).toBe(movCountBefore);

    // Listar exportaciones
    const listExports = await withAuth(
      request(app.getHttpServer()).get(`/legal-drafts/${draft1Id}/exports`),
      lawyerA1,
    ).expect(200);
    expect(listExports.body.length).toBeGreaterThanOrEqual(2);
  });

  it("TDS-DRF-006: Filtros de listado y archivado lógico preservando historial", async () => {
    const filtered = await withAuth(
      request(app.getHttpServer()).get(
        `/legal-drafts?expedienteId=${expAId}&documentType=DEMANDA&search=Revisada`,
      ),
      lawyerA1,
    ).expect(200);
    expect(filtered.body.data.some((d: any) => d.id === draft1Id)).toBe(true);

    // Crear un escrito adicional para archivar
    const toArchive = await withAuth(
      request(app.getHttpServer())
        .post("/legal-drafts")
        .send({
          expedienteId: expAId,
          title: "Escrito Borrador a Archivar",
          documentType: LegalDraftDocumentType.SOLICITUD,
          content: buildTipTapDoc("SOLICITUD", "Texto temporal."),
        }),
      lawyerA1,
      true,
    ).expect(201);

    const archived = await withAuth(
      request(app.getHttpServer()).delete(`/legal-drafts/${toArchive.body.id}`),
      lawyerA1,
      true,
    ).expect(200);
    expect(archived.body.status).toBe(LegalDraftStatus.ARCHIVED);
    expect(archived.body.archivedAt).toBeTruthy();

    // No se puede crear nueva versión sobre un escrito archivado
    await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${toArchive.body.id}/versions`)
        .send({
          content: buildTipTapDoc("INTENTO", "No permitido en archivado"),
        }),
      lawyerA1,
      true,
    ).expect(400);
  });

  // =========================================================================
  // 14.2 PRUEBAS DE SEGURIDAD
  // =========================================================================

  it("TDS-DRF-SEC-001: 401 sin sesión, 403 CSRF inválido, 403 org suspendida y membresía suspendida", async () => {
    await request(app.getHttpServer()).get("/legal-drafts").expect(401);

    // CSRF faltante
    await request(app.getHttpServer())
      .post("/legal-drafts")
      .set("Cookie", lawyerA1.cookies)
      .set("Origin", APP_ORIGIN)
      .send({
        expedienteId: expAId,
        title: "Sin CSRF",
        documentType: LegalDraftDocumentType.OTRO,
        content: buildTipTapDoc("T", "B"),
      })
      .expect(403);

    // Org suspendida
    await withAuth(
      request(app.getHttpServer()).get("/legal-drafts"),
      suspendedOrgUser,
    ).expect(403);

    // Membresía suspendida
    await withAuth(
      request(app.getHttpServer()).get("/legal-drafts"),
      suspendedMemberUser,
    ).expect(403);
  });

  it("TDS-DRF-SEC-002: RBAC (STAFF bloqueado, ASSISTANT sin aprobación/plantillas) y segregación de funciones (prohibición de autoaprobación)", async () => {
    // STAFF no puede leer, crear ni descargar escritos ni plantillas
    await withAuth(
      request(app.getHttpServer()).get("/legal-drafts"),
      staffA,
    ).expect(403);
    await withAuth(
      request(app.getHttpServer()).get(`/legal-drafts/${draft1Id}`),
      staffA,
    ).expect(403);
    await withAuth(
      request(app.getHttpServer()).get(
        `/legal-drafts/${draft1Id}/exports/${docxExportId}/download`,
      ),
      staffA,
    ).expect(403);
    await withAuth(
      request(app.getHttpServer()).get("/legal-templates"),
      staffA,
    ).expect(403);

    // ASSISTANT puede crear/editar escritos, pero NO gestionar plantillas ni aprobar
    await withAuth(
      request(app.getHttpServer())
        .post("/legal-templates")
        .send({
          name: "Plantilla No Autorizada",
          documentType: LegalDraftDocumentType.OTRO,
          content: buildTipTapDoc("X", "Y"),
        }),
      assistantA,
      true,
    ).expect(403);

    const asstDraft = await withAuth(
      request(app.getHttpServer())
        .post("/legal-drafts")
        .send({
          expedienteId: expAId,
          title: "Borrador de Asistente",
          documentType: LegalDraftDocumentType.PRESENTACION_SIMPLE,
          content: buildTipTapDoc(
            "PRESENTA",
            "Borrador redactado por asistente.",
          ),
        }),
      assistantA,
      true,
    ).expect(201);

    await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${asstDraft.body.id}/submit-review`)
        .send({}),
      assistantA,
      true,
    ).expect(200);

    // ASSISTANT no tiene legal_drafts:approve
    await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${asstDraft.body.id}/approve`)
        .send({ versionId: asstDraft.body.versions[0].id }),
      assistantA,
      true,
    ).expect(403);

    // Segregación de funciones: incluso ORG_OWNER NO puede autoaprobar su propio escrito
    const ownerDraft = await withAuth(
      request(app.getHttpServer())
        .post("/legal-drafts")
        .send({
          expedienteId: expAId,
          title: "Escrito del Owner",
          documentType: LegalDraftDocumentType.RECURSO,
          content: buildTipTapDoc("RECURSO", "Texto redactado por owner."),
        }),
      ownerA,
      true,
    ).expect(201);

    await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${ownerDraft.body.id}/submit-review`)
        .send({}),
      ownerA,
      true,
    ).expect(200);

    await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${ownerDraft.body.id}/approve`)
        .send({ versionId: ownerDraft.body.versions[0].id }),
      ownerA,
      true,
    ).expect(403);

    // Otro profesional con permiso (adminA) sí puede aprobarlo
    await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${ownerDraft.body.id}/approve`)
        .send({ versionId: ownerDraft.body.versions[0].id }),
      adminA,
      true,
    ).expect(200);
  });

  it("TDS-DRF-SEC-003: IDOR cross-tenant, spoofing organizationId, PATCH status prohibido, plantilla sistema inmutable y rechazo anti-XSS", async () => {
    // Org B no puede leer escrito, versiones, exportaciones ni plantilla de Org A
    await withAuth(
      request(app.getHttpServer()).get(`/legal-drafts/${draft1Id}`),
      lawyerB,
    ).expect(404);
    await withAuth(
      request(app.getHttpServer()).get(
        `/legal-drafts/${draft1Id}/versions/${draft1V1Id}`,
      ),
      lawyerB,
    ).expect(404);
    await withAuth(
      request(app.getHttpServer()).get(
        `/legal-drafts/${draft1Id}/exports/${docxExportId}/download`,
      ),
      lawyerB,
    ).expect(404);
    await withAuth(
      request(app.getHttpServer()).get(`/legal-templates/${orgTemplateId}`),
      lawyerB,
    ).expect(404);

    // Spoofing organizationId rechazado por ActiveOrgContextGuard (403 Forbidden)
    await withAuth(
      request(app.getHttpServer())
        .post("/legal-drafts")
        .send({
          organizationId: orgBId,
          expedienteId: expAId,
          title: "Spoof",
          documentType: LegalDraftDocumentType.OTRO,
          content: buildTipTapDoc("A", "B"),
        }),
      lawyerA1,
      true,
    ).expect(403);

    // Expediente o cliente de Org B rechazado con 404
    await withAuth(
      request(app.getHttpServer())
        .post("/legal-drafts")
        .send({
          expedienteId: expBId,
          title: "Expediente Ajeno",
          documentType: LegalDraftDocumentType.OTRO,
          content: buildTipTapDoc("A", "B"),
        }),
      lawyerA1,
      true,
    ).expect(404);

    await withAuth(
      request(app.getHttpServer())
        .post("/legal-drafts")
        .send({
          expedienteId: expAId,
          clientId: clientBId,
          title: "Cliente Ajeno",
          documentType: LegalDraftDocumentType.OTRO,
          content: buildTipTapDoc("A", "B"),
        }),
      lawyerA1,
      true,
    ).expect(404);

    // Plantilla de Org B usada por Org A -> 404
    await withAuth(
      request(app.getHttpServer()).post("/legal-drafts").send({
        expedienteId: expAId,
        sourceTemplateId: orgTemplateId,
        title: "Plantilla Ajena",
        documentType: LegalDraftDocumentType.OTRO,
      }),
      lawyerB,
      true,
    ).expect(404);

    // No se puede modificar ni archivar plantilla de sistema
    await withAuth(
      request(app.getHttpServer())
        .patch(`/legal-templates/${SYSTEM_DEMANDA_TEMPLATE_ID}`)
        .send({ name: "Hack Sistema" }),
      ownerA,
      true,
    ).expect(403);

    await withAuth(
      request(app.getHttpServer()).delete(
        `/legal-templates/${SYSTEM_DEMANDA_TEMPLATE_ID}`,
      ),
      ownerA,
      true,
    ).expect(403);

    // Cambio de estado vía PATCH genérico prohibido
    await withAuth(
      request(app.getHttpServer()).patch(`/legal-drafts/${draft1Id}`).send({
        status: LegalDraftStatus.APPROVED,
      }),
      lawyerA1,
      true,
    ).expect(400);

    // Rechazo de nodos maliciosos (script/iframe/objetos embebidos)
    await withAuth(
      request(app.getHttpServer())
        .post("/legal-drafts")
        .send({
          expedienteId: expAId,
          title: "XSS Payload",
          documentType: LegalDraftDocumentType.OTRO,
          content: {
            type: "doc",
            content: [
              { type: "script", content: [{ type: "text", text: "alert(1)" }] },
            ],
          },
        }),
      lawyerA1,
      true,
    ).expect(400);

    await withAuth(
      request(app.getHttpServer())
        .post("/legal-drafts")
        .send({
          expedienteId: expAId,
          title: "Iframe Payload",
          documentType: LegalDraftDocumentType.OTRO,
          content: {
            type: "doc",
            content: [
              { type: "iframe", attrs: { src: "javascript:alert(1)" } },
            ],
          },
        }),
      lawyerA1,
      true,
    ).expect(400);
  });

  // =========================================================================
  // 14.3 CONCURRENCIA E INTEGRIDAD
  // =========================================================================

  it("TDS-DRF-CONC-001: Dos nuevas versiones concurrentes se serializan sin colisión ni pérdida de versiones", async () => {
    const concDraft = await withAuth(
      request(app.getHttpServer())
        .post("/legal-drafts")
        .send({
          expedienteId: expAId,
          title: "Escrito Concurrencia Versiones",
          documentType: LegalDraftDocumentType.ALEGATO,
          content: buildTipTapDoc("ALEGATO V1", "Base concurrente."),
        }),
      lawyerA1,
      true,
    ).expect(201);

    const [r1, r2] = await Promise.all([
      withAuth(
        request(app.getHttpServer())
          .post(`/legal-drafts/${concDraft.body.id}/versions`)
          .send({
            content: buildTipTapDoc("ALEGATO A", "Cambio concurrente A"),
            changeNote: "Concurrente A",
          }),
        lawyerA1,
        true,
      ),
      withAuth(
        request(app.getHttpServer())
          .post(`/legal-drafts/${concDraft.body.id}/versions`)
          .send({
            content: buildTipTapDoc("ALEGATO B", "Cambio concurrente B"),
            changeNote: "Concurrente B",
          }),
        lawyerA2,
        true,
      ),
    ]);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect([r1.body.versionNumber, r2.body.versionNumber].sort()).toEqual([
      2, 3,
    ]);
  });

  it("TDS-DRF-CONC-002: Dos aprobaciones concurrentes — solo una triunfa y la segunda falla controladamente", async () => {
    const concRev = await withAuth(
      request(app.getHttpServer())
        .post("/legal-drafts")
        .send({
          expedienteId: expAId,
          title: "Escrito Concurrencia Aprobación",
          documentType: LegalDraftDocumentType.INCIDENTE,
          content: buildTipTapDoc("INCIDENTE", "Texto para doble aprobación."),
        }),
      lawyerA1,
      true,
    ).expect(201);

    const v1Id = concRev.body.versions[0].id;
    await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${concRev.body.id}/submit-review`)
        .send({}),
      lawyerA1,
      true,
    ).expect(200);

    const [a1, a2] = await Promise.all([
      withAuth(
        request(app.getHttpServer())
          .post(`/legal-drafts/${concRev.body.id}/approve`)
          .send({ versionId: v1Id, comments: "Aprobación 1" }),
        lawyerA2,
        true,
      ),
      withAuth(
        request(app.getHttpServer())
          .post(`/legal-drafts/${concRev.body.id}/approve`)
          .send({ versionId: v1Id, comments: "Aprobación 2" }),
        adminA,
        true,
      ),
    ]);

    const statuses = [a1.status, a2.status].sort();
    expect(statuses[0]).toBe(200);
    expect([400, 409]).toContain(statuses[1]);
  });

  it("TDS-DRF-CONC-003: Exportación concurrente y reintento idempotente no duplican documentos en AUTH-08", async () => {
    const idemKey = `idem-conc-${runTag}`;
    const docCountBefore = await adminPrisma.document.count({
      where: { organizationId: orgAId },
    });

    const [e1, e2] = await Promise.all([
      withAuth(
        request(app.getHttpServer())
          .post(`/legal-drafts/${draft1Id}/export`)
          .send({
            versionId: draft1V1Id,
            format: "PDF",
            idempotencyKey: idemKey,
          }),
        lawyerA1,
        true,
      ),
      withAuth(
        request(app.getHttpServer())
          .post(`/legal-drafts/${draft1Id}/export`)
          .send({
            versionId: draft1V1Id,
            format: "PDF",
            idempotencyKey: idemKey,
          }),
        lawyerA1,
        true,
      ),
    ]);

    expect([200, 201]).toContain(e1.status);
    expect([200, 201]).toContain(e2.status);
    expect(e1.body.id).toBe(e2.body.id);
    expect(e1.body.storageDocumentId).toBe(e2.body.storageDocumentId);

    // Reintento posterior con la misma clave tampoco duplica
    const e3 = await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${draft1Id}/export`)
        .send({
          versionId: draft1V1Id,
          format: "PDF",
          idempotencyKey: idemKey,
        }),
      lawyerA1,
      true,
    );
    expect([200, 201]).toContain(e3.status);
    expect(e3.body.id).toBe(e1.body.id);

    const docCountAfter = await adminPrisma.document.count({
      where: { organizationId: orgAId },
    });
    expect(docCountAfter - docCountBefore).toBe(1);
  });

  it("TDS-DRF-CONC-004: Error en almacenamiento AUTH-08 no deja LegalDraftExport huérfano ni temporales .tmp residuales", async () => {
    const docsService = app.get(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("../../src/documents/documents-management.service")
        .DocumentsManagementService,
    );
    const exportCountBefore = await adminPrisma.legalDraftExport.count({
      where: { organizationId: orgAId, legalDraftId: draft1Id },
    });

    const spy = jest
      .spyOn(docsService, "createWithFile")
      .mockRejectedValueOnce(new Error("Simulated AUTH-08 storage failure"));

    try {
      await withAuth(
        request(app.getHttpServer())
          .post(`/legal-drafts/${draft1Id}/export`)
          .send({
            versionId: draft1V1Id,
            format: "DOCX",
            idempotencyKey: `fail-storage-${runTag}`,
            options: { fontSizePt: 11 },
          }),
        lawyerA1,
        true,
      ).expect(500);
    } finally {
      spy.mockRestore();
    }

    const exportCountAfter = await adminPrisma.legalDraftExport.count({
      where: { organizationId: orgAId, legalDraftId: draft1Id },
    });
    expect(exportCountAfter).toBe(exportCountBefore);

    const tmpDir = path.join(storageRoot, ".tmp");
    const leftovers = fs.existsSync(tmpDir) ? fs.readdirSync(tmpDir) : [];
    expect(leftovers).toHaveLength(0);
  });

  // =========================================================================
  // 14.4 PRUEBAS RLS REALES (abogados_app_user NOBYPASSRLS)
  // =========================================================================

  it("TDS-DRF-RLS-001: Fail-closed sin contexto GUC en las 5 tablas AUTH-09", async () => {
    const [writings, versions, templates, reviews, exportsList] =
      await Promise.all([
        appPrisma.legalWriting.findMany(),
        appPrisma.legalDraftVersion.findMany(),
        appPrisma.legalDraftTemplate.findMany(),
        appPrisma.legalDraftReview.findMany(),
        appPrisma.legalDraftExport.findMany(),
      ]);

    expect(writings).toHaveLength(0);
    expect(versions).toHaveLength(0);
    expect(templates).toHaveLength(0);
    expect(reviews).toHaveLength(0);
    expect(exportsList).toHaveLength(0);
  });

  it("TDS-DRF-RLS-002: Aislamiento A/B real, bloqueo de INSERT cross-tenant e inmutabilidad física en LegalDraftVersion", async () => {
    // Con contexto Org B no ve ningún registro de Org A
    await scopedPrisma.runInOrgContext(
      { organizationId: orgBId },
      async (tx) => {
        const w = await tx.legalWriting.findFirst({ where: { id: draft1Id } });
        const v = await tx.legalDraftVersion.findFirst({
          where: { id: draft1V1Id },
        });
        const t = await tx.legalDraftTemplate.findFirst({
          where: { id: orgTemplateId },
        });
        const ex = await tx.legalDraftExport.findFirst({
          where: { id: docxExportId },
        });

        expect(w).toBeNull();
        expect(v).toBeNull();
        expect(t).toBeNull();
        expect(ex).toBeNull();

        // Pero sí puede leer las plantillas de sistema (solo lectura)
        const sysTpl = await tx.legalDraftTemplate.findFirst({
          where: { id: SYSTEM_DEMANDA_TEMPLATE_ID },
        });
        expect(sysTpl).not.toBeNull();
        expect(sysTpl?.isSystemTemplate).toBe(true);
      },
    );

    // INSERT cross-tenant falla con 42501
    await expect(
      scopedPrisma.runInOrgContext({ organizationId: orgBId }, (tx) =>
        tx.legalWriting.create({
          data: {
            organizationId: orgAId,
            expedienteId: expAId,
            title: "Cross Tenant Insert",
            documentType: LegalDraftDocumentType.OTRO,
            createdById: lawyerB.userId,
          },
        }),
      ),
    ).rejects.toThrow(/row-level security|42501|permission denied/i);

    // UPDATE en LegalDraftVersion falla por privilegio mínimo (inmutable en PostgreSQL)
    await expect(
      scopedPrisma.runInOrgContext({ organizationId: orgAId }, (tx) =>
        tx.legalDraftVersion.update({
          where: { id: draft1V1Id },
          data: { plainText: "mutación ilegal" },
        }),
      ),
    ).rejects.toThrow(/permission denied|42501/i);
  });
});
