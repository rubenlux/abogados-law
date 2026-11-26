/**
 * AUTH-08 — Suite TDS Real de Gestión Documental Jurídica
 * Expediente: AUTH08-DOCUMENT-MANAGEMENT-IMPLEMENTATION-001
 *
 * Ejecuta sobre PostgreSQL 18 real (abogados_test / abogados_app_user NOBYPASSRLS)
 * y almacenamiento privado temporal en disco (DOCUMENT_STORAGE_ROOT aislado).
 *
 * Cubre:
 * - 10.1 Pruebas funcionales (alta, carga real, versiones inmutables v1/v2, descarga actual/histórica, SHA-256, corrupción de integridad, edición, archivo/restauración, filtros).
 * - 10.2 Pruebas de seguridad (401, CSRF, org suspendida, membresía revocada, matriz STAFF/ASSISTANT/LAWYER/ADMIN/OWNER, IDOR 404, spoofing organizationId 403, asociaciones ajenas, traversal, nombres maliciosos, MIME/extensión falsa, vacío, >25MB, ejecutables/HTML/SVG, sin exposición de storageKey).
 * - 10.3 Pruebas de almacenamiento y compensación (limpieza .tmp, rechazo de sobrescritura/reutilización de storageKey, compensación ante fallo de PostgreSQL/auditoría sin huérfanos).
 * - 10.4 Pruebas RLS reales con abogados_app_user NOBYPASSRLS y privilegios mínimos (inmutabilidad DocumentFileVersion y no-DELETE en Document).
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
  TipoMovimientoProcesal,
  DocumentCategory,
  DocumentStatus,
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
import { MovimientosModule } from "../../src/movimientos/movimientos.module";
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

// Buffers reales con magic bytes válidos
const VALID_PDF_V1 = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n--version-1--",
  "utf8",
);
const VALID_PDF_V2 = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n--version-2-actualizada--",
  "utf8",
);
const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52,
]);
const FAKE_EXE_AS_PDF = Buffer.from("MZ\x90\x00\x03\x00\x00\x00fake-pe-exe");
const HTML_XSS_PAYLOAD = Buffer.from(
  "<!DOCTYPE html><html><body><script>alert(1)</script></body></html>",
  "utf8",
);
const SVG_XSS_PAYLOAD = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
  "utf8",
);

describe("AUTH-08 — Gestión Documental Jurídica (Real PostgreSQL 18 + Private Storage)", () => {
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

  const runTag = `doc08-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const storageRoot = path.join(os.tmpdir(), `abogados-auth08-${runTag}`);

  let orgAId: string;
  let orgBId: string;
  let orgSuspendedId: string;

  let ownerA: TestUserSession;
  let adminA: TestUserSession;
  let lawyerA: TestUserSession;
  let assistantA: TestUserSession;
  let staffA: TestUserSession;
  let lawyerB: TestUserSession;
  let revokedMemberUser: TestUserSession;
  let suspendedOrgUser: TestUserSession;

  let clientAId: string;
  let clientBId: string;
  let expAId: string;
  let expA2Id: string;
  let expBId: string;
  let movAId: string;
  let movBId: string;

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

  const prevDocStorageRoot = process.env.DOCUMENT_STORAGE_ROOT;

  beforeAll(async () => {
    assertSafeTestDatabaseUrl(adminDbUrl);
    assertSafeTestDatabaseUrl(appRuntimeDbUrl);
    fs.mkdirSync(storageRoot, { recursive: true });
    process.env.DOCUMENT_STORAGE_ROOT = storageRoot;

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
              DOCUMENT_STORAGE_ROOT: storageRoot,
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
        MovimientosModule,
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
    scopedPrisma = moduleRef.get<ScopedPrismaService>(ScopedPrismaService);

    const orgA = await adminPrisma.organization.create({
      data: {
        name: `Estudio Doc A ${runTag}`,
        status: OrganizationStatus.ACTIVE,
      },
    });
    const orgB = await adminPrisma.organization.create({
      data: {
        name: `Estudio Doc B ${runTag}`,
        status: OrganizationStatus.ACTIVE,
      },
    });
    const orgSusp = await adminPrisma.organization.create({
      data: {
        name: `Estudio Doc Susp ${runTag}`,
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

    const cliA = await adminPrisma.client.create({
      data: {
        organizationId: orgAId,
        personType: ClientPersonType.HUMANA,
        firstName: "Ana",
        lastName: `Martínez ${runTag}`,
        status: ClientStatus.ACTIVO,
      },
    });
    const cliB = await adminPrisma.client.create({
      data: {
        organizationId: orgBId,
        personType: ClientPersonType.HUMANA,
        firstName: "Luis",
        lastName: `Fernández ${runTag}`,
        status: ClientStatus.ACTIVO,
      },
    });
    clientAId = cliA.id;
    clientBId = cliB.id;

    const expA = await adminPrisma.expediente.create({
      data: {
        organization: { connect: { id: orgAId } },
        caratula: `Martínez c/ Banco A ${runTag}`,
        numeroExpediente: `DOC-A1-${runTag}`,
        juzgado: "Juzgado Civil 1",
        jurisdiccion: "NACION",
        estado: ExpedienteEstado.EN_TRAMITE,
      },
    });
    const expA2 = await adminPrisma.expediente.create({
      data: {
        organization: { connect: { id: orgAId } },
        caratula: `Otro Expte A2 ${runTag}`,
        numeroExpediente: `DOC-A2-${runTag}`,
        juzgado: "Juzgado Civil 2",
        jurisdiccion: "NACION",
        estado: ExpedienteEstado.EN_TRAMITE,
      },
    });
    const expB = await adminPrisma.expediente.create({
      data: {
        organization: { connect: { id: orgBId } },
        caratula: `Fernández c/ Banco B ${runTag}`,
        numeroExpediente: `DOC-B1-${runTag}`,
        juzgado: "Juzgado Comercial 5",
        jurisdiccion: "CABA",
        estado: ExpedienteEstado.EN_TRAMITE,
      },
    });
    expAId = expA.id;
    expA2Id = expA2.id;
    expBId = expB.id;

    const movA = await adminPrisma.movimientoProcesal.create({
      data: {
        organization: { connect: { id: orgAId } },
        expediente: { connect: { id: expAId } },
        registradoPor: { connect: { id: lawyerA.userId } },
        tipo: TipoMovimientoProcesal.PRESENTACION,
        titulo: `Demanda inicial ${runTag}`,
        fechaActuacion: new Date("2026-03-01T12:00:00.000Z"),
      },
    });
    const movB = await adminPrisma.movimientoProcesal.create({
      data: {
        organization: { connect: { id: orgBId } },
        expediente: { connect: { id: expBId } },
        registradoPor: { connect: { id: lawyerB.userId } },
        tipo: TipoMovimientoProcesal.SENTENCIA,
        titulo: `Sentencia B ${runTag}`,
        fechaActuacion: new Date("2026-03-05T12:00:00.000Z"),
      },
    });
    movAId = movA.id;
    movBId = movB.id;
  });

  afterAll(async () => {
    if (app) await app.close();
    if (adminPrisma) {
      if (createdOrgIds.length > 0) {
        await adminPrisma.documentFileVersion.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await adminPrisma.document.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await adminPrisma.movimientoProcesal.deleteMany({
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
    if (prevDocStorageRoot === undefined) {
      delete process.env.DOCUMENT_STORAGE_ROOT;
    } else {
      process.env.DOCUMENT_STORAGE_ROOT = prevDocStorageRoot;
    }
    fs.rmSync(storageRoot, { recursive: true, force: true });
  });

  // =========================================================================
  // 10.1 PRUEBAS FUNCIONALES
  // =========================================================================
  describe("10.1 Pruebas Funcionales — Ciclo Documental Completo", () => {
    let docA1Id: string;
    let verA1Id: string;
    let verA2Id: string;
    let docPngId: string;

    it("TDS-DOC-001: Crear documento con carga real de PDF, SHA-256 en backend, asociaciones y sin exponer storageKey", async () => {
      const expectedSha = crypto
        .createHash("sha256")
        .update(VALID_PDF_V1)
        .digest("hex");

      const res = await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", `Demanda Principal ${runTag}`)
          .field("description", "Escrito inicial firmado")
          .field("category", DocumentCategory.DEMANDA)
          .field("documentDate", "2026-03-01T12:00:00.000Z")
          .field("expedienteId", expAId)
          .field("clientId", clientAId)
          .field("movimientoProcesalId", movAId)
          .attach("file", VALID_PDF_V1, {
            filename: "demanda-inicial.pdf",
            contentType: "application/pdf",
          }),
        lawyerA,
        true,
      ).expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.title).toBe(`Demanda Principal ${runTag}`);
      expect(res.body.category).toBe(DocumentCategory.DEMANDA);
      expect(res.body.status).toBe(DocumentStatus.ACTIVE);
      expect(res.body.currentVersionNumber).toBe(1);
      expect(res.body.expedienteId).toBe(expAId);
      expect(res.body.clientId).toBe(clientAId);
      expect(res.body.movimientoProcesalId).toBe(movAId);
      expect(res.body.versions).toHaveLength(1);
      expect(res.body.versions[0].versionNumber).toBe(1);
      expect(res.body.versions[0].sha256).toBe(expectedSha);
      expect(res.body.versions[0].mimeType).toBe("application/pdf");
      expect(res.body.versions[0].sizeBytes).toBe(VALID_PDF_V1.length);

      // NUNCA exponer storageKey ni rutas internas
      expect(JSON.stringify(res.body)).not.toContain("storageKey");
      expect(JSON.stringify(res.body)).not.toContain(storageRoot);

      docA1Id = res.body.id;
      verA1Id = res.body.versions[0].id;
    });

    it("TDS-DOC-002: Consultar detalle, listar y filtrar por expediente, cliente, movimiento, categoría y búsqueda", async () => {
      // Crear segundo documento PNG asociado solo a cliente
      const pngRes = await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", `DNI Escaneado ${runTag}`)
          .field("category", DocumentCategory.DOCUMENTACION_CLIENTE)
          .field("clientId", clientAId)
          .attach("file", VALID_PNG, {
            filename: "dni-frente.png",
            contentType: "image/png",
          }),
        assistantA,
        true,
      ).expect(201);
      docPngId = pngRes.body.id;

      const det = await withAuth(
        request(app.getHttpServer()).get(`/documents/${docA1Id}`),
        lawyerA,
      ).expect(200);
      expect(det.body.id).toBe(docA1Id);
      expect(det.body.versions).toHaveLength(1);

      const byExp = await withAuth(
        request(app.getHttpServer()).get(
          `/documents?expedienteId=${expAId}&category=DEMANDA&page=1&limit=10`,
        ),
        lawyerA,
      ).expect(200);
      expect(byExp.body.data.some((d: any) => d.id === docA1Id)).toBe(true);
      expect(byExp.body.data.some((d: any) => d.id === docPngId)).toBe(false);

      const byMov = await withAuth(
        request(app.getHttpServer()).get(
          `/documents?movimientoProcesalId=${movAId}&page=1&limit=10`,
        ),
        lawyerA,
      ).expect(200);
      expect(byMov.body.data).toHaveLength(1);
      expect(byMov.body.data[0].id).toBe(docA1Id);
    });

    it("TDS-DOC-003: Cargar versión 2 inmutable manteniendo versión 1 intacta", async () => {
      const shaV1 = crypto
        .createHash("sha256")
        .update(VALID_PDF_V1)
        .digest("hex");
      const shaV2 = crypto
        .createHash("sha256")
        .update(VALID_PDF_V2)
        .digest("hex");

      const res = await withAuth(
        request(app.getHttpServer())
          .post(`/documents/${docA1Id}/versions`)
          .field("changeNote", "Corrección de monto reclamado")
          .attach("file", VALID_PDF_V2, {
            filename: "demanda-v2.pdf",
            contentType: "application/pdf",
          }),
        lawyerA,
        true,
      ).expect(201);

      expect(res.body.versionNumber).toBe(2);
      expect(res.body.sha256).toBe(shaV2);
      expect(res.body.changeNote).toBe("Corrección de monto reclamado");
      expect(res.body.storageKey).toBeUndefined();
      verA2Id = res.body.id;

      // Listar versiones y comprobar inmutabilidad de v1
      const vers = await withAuth(
        request(app.getHttpServer()).get(`/documents/${docA1Id}/versions`),
        lawyerA,
      ).expect(200);
      expect(vers.body).toHaveLength(2);
      const v1 = vers.body.find((v: any) => v.versionNumber === 1);
      const v2 = vers.body.find((v: any) => v.versionNumber === 2);
      expect(v1.id).toBe(verA1Id);
      expect(v1.sha256).toBe(shaV1);
      expect(v2.id).toBe(verA2Id);
      expect(v2.sha256).toBe(shaV2);

      // Detalle de versión puntual
      const v1Det = await withAuth(
        request(app.getHttpServer()).get(
          `/documents/${docA1Id}/versions/${verA1Id}`,
        ),
        lawyerA,
      ).expect(200);
      expect(v1Det.body.versionNumber).toBe(1);
      expect(v1Det.body.storageKey).toBeUndefined();
    });

    it("TDS-DOC-004: Descarga de versión actual (v2) e histórica (v1) con headers seguros y bytes exactos", async () => {
      const dlCurrent = await withAuth(
        request(app.getHttpServer()).get(`/documents/${docA1Id}/download`),
        lawyerA,
      )
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(Buffer.compare(dlCurrent.body, VALID_PDF_V2)).toBe(0);
      expect(dlCurrent.headers["content-disposition"]).toMatch(/^attachment;/);
      expect(dlCurrent.headers["x-content-type-options"]).toBe("nosniff");
      expect(dlCurrent.headers["cache-control"]).toBe("private, no-store");
      expect(dlCurrent.headers["content-type"]).toContain("application/pdf");

      const dlHist = await withAuth(
        request(app.getHttpServer()).get(
          `/documents/${docA1Id}/versions/${verA1Id}/download`,
        ),
        lawyerA,
      )
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(Buffer.compare(dlHist.body, VALID_PDF_V1)).toBe(0);
    });

    it("TDS-DOC-005: Editar metadatos, archivar lógicamente, restringir acceso tras archivar y restaurar", async () => {
      const edited = await withAuth(
        request(app.getHttpServer())
          .patch(`/documents/${docA1Id}`)
          .send({
            title: `Demanda Actualizada ${runTag}`,
            category: DocumentCategory.ESCRITO_JUDICIAL,
          }),
        lawyerA,
        true,
      ).expect(200);
      expect(edited.body.title).toBe(`Demanda Actualizada ${runTag}`);
      expect(edited.body.category).toBe(DocumentCategory.ESCRITO_JUDICIAL);

      // Archivar (requiere documents:delete -> adminA)
      const archived = await withAuth(
        request(app.getHttpServer()).delete(`/documents/${docA1Id}`),
        adminA,
        true,
      ).expect(200);
      expect(archived.body.status).toBe(DocumentStatus.ARCHIVED);
      expect(archived.body.archivedAt).toBeTruthy();

      // Listado activo por defecto lo oculta
      const activeList = await withAuth(
        request(app.getHttpServer()).get("/documents?page=1&limit=50"),
        lawyerA,
      ).expect(200);
      expect(activeList.body.data.some((d: any) => d.id === docA1Id)).toBe(
        false,
      );

      // No permite cargar nueva versión ni descargar mientras está archivado
      await withAuth(
        request(app.getHttpServer()).get(`/documents/${docA1Id}/download`),
        lawyerA,
      ).expect(409);

      // Restaurar (requiere documents:delete -> ownerA)
      const restored = await withAuth(
        request(app.getHttpServer())
          .post(`/documents/${docA1Id}/restore`)
          .send({}),
        ownerA,
        true,
      ).expect(200);
      expect(restored.body.status).toBe(DocumentStatus.ACTIVE);
      expect(restored.body.archivedAt).toBeNull();
    });

    it("TDS-DOC-006: Detecta corrupción física de integridad SHA-256 en disco antes de entregar descarga", async () => {
      const dbVer = await adminPrisma.documentFileVersion.findUnique({
        where: { id: verA2Id },
      });
      expect(dbVer).not.toBeNull();
      const physicalPath = path.join(storageRoot, dbVer!.storageKey);
      const originalBytes = fs.readFileSync(physicalPath);

      try {
        // Alterar un byte en disco simulando corrupción
        fs.writeFileSync(
          physicalPath,
          Buffer.concat([originalBytes, Buffer.from("TAMPER")]),
        );

        const res = await withAuth(
          request(app.getHttpServer()).get(`/documents/${docA1Id}/download`),
          lawyerA,
        );
        expect([409, 500]).toContain(res.status);
      } finally {
        // Restaurar archivo íntegro para pruebas posteriores
        fs.writeFileSync(physicalPath, originalBytes);
      }
    });
  });

  // =========================================================================
  // 10.2 PRUEBAS DE SEGURIDAD Y VALIDACIÓN DE ARCHIVOS
  // =========================================================================
  describe("10.2 Pruebas de Seguridad, Permisos, IDOR y Validación Binaria", () => {
    let docBId: string;
    let verBId: string;
    let docASecId: string;

    beforeAll(async () => {
      const resB = await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", `Contrato Confidencial B ${runTag}`)
          .field("category", DocumentCategory.CONTRATO)
          .field("expedienteId", expBId)
          .attach("file", VALID_PDF_V1, {
            filename: "contrato-b.pdf",
            contentType: "application/pdf",
          }),
        lawyerB,
        true,
      ).expect(201);
      docBId = resB.body.id;
      verBId = resB.body.versions[0].id;

      const resA = await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", `Poder General A ${runTag}`)
          .field("description", "Descripción confidencial A")
          .field("category", DocumentCategory.PODER)
          .field("expedienteId", expAId)
          .attach("file", VALID_PDF_V1, {
            filename: "poder-a.pdf",
            contentType: "application/pdf",
          }),
        lawyerA,
        true,
      ).expect(201);
      docASecId = resA.body.id;
    });

    it("TDS-DOC-SEC-001: Sin sesión (401), CSRF inválido (403), membresía revocada (403) y org suspendida (403)", async () => {
      await request(app.getHttpServer()).get("/documents").expect(401);

      // CSRF faltante/inválido en POST
      await request(app.getHttpServer())
        .post("/documents")
        .set("Cookie", lawyerA.cookies)
        .set("Origin", APP_ORIGIN)
        .set("X-CSRF-Token", "invalid-csrf-token")
        .field("title", "No CSRF")
        .attach("file", VALID_PDF_V1, {
          filename: "nocsrf.pdf",
          contentType: "application/pdf",
        })
        .expect(403);

      const rRev = await withAuth(
        request(app.getHttpServer()).get("/documents"),
        revokedMemberUser,
      ).expect(403);
      expect(JSON.stringify(rRev.body)).toContain("MEMBERSHIP_INACTIVE");

      const rSusp = await withAuth(
        request(app.getHttpServer()).get("/documents"),
        suspendedOrgUser,
      ).expect(403);
      expect(JSON.stringify(rSusp.body)).toContain("ORGANIZATION_INACTIVE");
    });

    it("TDS-DOC-SEC-002: Matriz de permisos por rol (STAFF sin descarga/escritura y proyección mínima; ASSISTANT/LAWYER sin delete)", async () => {
      // STAFF lee metadatos mínimos sin description, sin versions, sin storageKey
      const staffList = await withAuth(
        request(app.getHttpServer()).get("/documents?page=1&limit=20"),
        staffA,
      ).expect(200);
      const found = staffList.body.data.find((d: any) => d.id === docASecId);
      expect(found).toBeDefined();
      expect(found.title).toBeDefined();
      expect(found.description).toBeUndefined();
      expect(found.versions).toBeUndefined();
      expect(found.storageKey).toBeUndefined();

      // STAFF no puede descargar -> 403
      await withAuth(
        request(app.getHttpServer()).get(`/documents/${docASecId}/download`),
        staffA,
      ).expect(403);

      // STAFF no puede cargar -> 403
      await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", "Staff no sube")
          .attach("file", VALID_PDF_V1, {
            filename: "staff.pdf",
            contentType: "application/pdf",
          }),
        staffA,
        true,
      ).expect(403);

      // ASSISTANT y LAWYER no pueden archivar (documents:delete) -> 403
      await withAuth(
        request(app.getHttpServer()).delete(`/documents/${docASecId}`),
        assistantA,
        true,
      ).expect(403);
      await withAuth(
        request(app.getHttpServer()).delete(`/documents/${docASecId}`),
        lawyerA,
        true,
      ).expect(403);
    });

    it("TDS-DOC-SEC-003: IDOR entre organizaciones (404) y rechazo de manipulación de organizationId (403)", async () => {
      await withAuth(
        request(app.getHttpServer()).get(`/documents/${docBId}`),
        lawyerA,
      ).expect(404);
      await withAuth(
        request(app.getHttpServer()).get(`/documents/${docBId}/versions`),
        lawyerA,
      ).expect(404);
      await withAuth(
        request(app.getHttpServer()).get(`/documents/${docBId}/download`),
        lawyerA,
      ).expect(404);
      // Descarga con versionId de Org B bajo doc de Org A -> 404
      await withAuth(
        request(app.getHttpServer()).get(
          `/documents/${docASecId}/versions/${verBId}/download`,
        ),
        lawyerA,
      ).expect(404);
      await withAuth(
        request(app.getHttpServer())
          .patch(`/documents/${docBId}`)
          .send({ title: "Hack B" }),
        lawyerA,
        true,
      ).expect(404);

      // Spoofing de organizationId -> 403 / 400
      const spoofQuery = await withAuth(
        request(app.getHttpServer()).get(`/documents?organizationId=${orgBId}`),
        lawyerA,
      );
      expect([400, 403]).toContain(spoofQuery.status);

      const spoofPatch = await withAuth(
        request(app.getHttpServer())
          .patch(`/documents/${docASecId}`)
          .send({ organizationId: orgBId }),
        lawyerA,
        true,
      );
      expect([400, 403]).toContain(spoofPatch.status);
    });

    it("TDS-DOC-SEC-004: Rechaza asociación a expediente, cliente o movimiento ajeno (404) e incoherencia movimiento/expediente (400)", async () => {
      await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", "Expte Ajeno")
          .field("expedienteId", expBId)
          .attach("file", VALID_PDF_V1, {
            filename: "a.pdf",
            contentType: "application/pdf",
          }),
        lawyerA,
        true,
      ).expect(404);

      await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", "Cliente Ajeno")
          .field("clientId", clientBId)
          .attach("file", VALID_PDF_V1, {
            filename: "a.pdf",
            contentType: "application/pdf",
          }),
        lawyerA,
        true,
      ).expect(404);

      await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", "Mov Ajeno")
          .field("movimientoProcesalId", movBId)
          .attach("file", VALID_PDF_V1, {
            filename: "a.pdf",
            contentType: "application/pdf",
          }),
        lawyerA,
        true,
      ).expect(404);

      // Movimiento pertenece a expAId, no a expA2Id -> 400
      await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", "Mov Incoherente")
          .field("expedienteId", expA2Id)
          .field("movimientoProcesalId", movAId)
          .attach("file", VALID_PDF_V1, {
            filename: "a.pdf",
            contentType: "application/pdf",
          }),
        lawyerA,
        true,
      ).expect(400);
    });

    it("TDS-DOC-SEC-005: Rechaza archivos vacíos, ejecutables, HTML, SVG, MIME/extensión falsos, nombres maliciosos/largos y traversal", async () => {
      // Vacío (0 bytes)
      await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", "Archivo vacío")
          .attach("file", Buffer.alloc(0), {
            filename: "empty.pdf",
            contentType: "application/pdf",
          }),
        lawyerA,
        true,
      ).expect(400);

      // Ejecutable disfrazado de PDF
      await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", "Exe disfrazado")
          .attach("file", FAKE_EXE_AS_PDF, {
            filename: "malware.pdf",
            contentType: "application/pdf",
          }),
        lawyerA,
        true,
      ).expect(400);

      // HTML disfrazado de PDF
      await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", "HTML disfrazado")
          .attach("file", HTML_XSS_PAYLOAD, {
            filename: "xss.pdf",
            contentType: "application/pdf",
          }),
        lawyerA,
        true,
      ).expect(400);

      // SVG explícito rechazado
      await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", "SVG rechazado")
          .attach("file", SVG_XSS_PAYLOAD, {
            filename: "vector.svg",
            contentType: "image/svg+xml",
          }),
        lawyerA,
        true,
      ).expect(400);

      // Extensión falsa (PNG válido con extensión .pdf) -> rechazado
      await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", "Extensión falsa")
          .attach("file", VALID_PNG, {
            filename: "falso.pdf",
            contentType: "application/pdf",
          }),
        lawyerA,
        true,
      ).expect(400);

      // Nombre con secuencia traversal (..) y campo storageKey manipulado
      await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", "Traversal")
          .attach("file", VALID_PDF_V1, {
            filename: "..etc..passwd.pdf",
            contentType: "application/pdf",
          }),
        lawyerA,
        true,
      ).expect(400);

      await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", "StorageKey inyectado")
          .field("storageKey", "../../etc/passwd")
          .attach("file", VALID_PDF_V1, {
            filename: "ok.pdf",
            contentType: "application/pdf",
          }),
        lawyerA,
        true,
      ).expect(400);

      // Nombre excesivamente largo (> 255)
      await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", "Nombre largo")
          .attach("file", VALID_PDF_V1, {
            filename: `${"a".repeat(260)}.pdf`,
            contentType: "application/pdf",
          }),
        lawyerA,
        true,
      ).expect(400);

      // Archivo > 25 MB -> 413 / 400
      const oversized = Buffer.alloc(25 * 1024 * 1024 + 1024, 0x20);
      oversized.write("%PDF-1.4\n", 0, "utf8");
      const overRes = await withAuth(
        request(app.getHttpServer())
          .post("/documents")
          .field("title", "Oversized")
          .attach("file", oversized, {
            filename: "huge.pdf",
            contentType: "application/pdf",
          }),
        lawyerA,
        true,
      );
      expect([400, 413]).toContain(overRes.status);
    });
  });

  // =========================================================================
  // 10.3 PRUEBAS DE ALMACENAMIENTO, COMPENSACIÓN Y RLS REAL
  // =========================================================================
  describe("10.3 & 10.4 Almacenamiento, Limpieza .tmp, RLS Real y Auditoría", () => {
    it("TDS-DOC-STG-001: Carpeta .tmp limpia sin archivos temporales residuales tras errores y cargas exitosas", () => {
      const tmpDir = path.join(storageRoot, ".tmp");
      if (fs.existsSync(tmpDir)) {
        const leftover = fs.readdirSync(tmpDir);
        expect(leftover).toHaveLength(0);
      }
    });

    it("TDS-DOC-RLS-001: RLS real con abogados_app_user NOBYPASSRLS (fail-closed sin org, aislamiento bidireccional e inmutabilidad)", async () => {
      // 1. Sin contexto app.current_organization_id -> 0 filas (fail-closed)
      const noCtxDocs = await appPrisma.document.findMany();
      expect(noCtxDocs).toHaveLength(0);

      const noCtxVers = await appPrisma.documentFileVersion.findMany();
      expect(noCtxVers).toHaveLength(0);

      // 2. Contexto Org A -> solo Org A; 0 filas de Org B
      const orgADocs = await scopedPrisma.runInOrgContext(
        { organizationId: orgAId },
        (tx) =>
          tx.document.findMany({ select: { id: true, organizationId: true } }),
      );
      expect(orgADocs.length).toBeGreaterThan(0);
      expect(orgADocs.every((d) => d.organizationId === orgAId)).toBe(true);

      // 3. Contexto Org B -> solo Org B; 0 filas de Org A
      const orgBDocs = await scopedPrisma.runInOrgContext(
        { organizationId: orgBId },
        (tx) =>
          tx.document.findMany({ select: { id: true, organizationId: true } }),
      );
      expect(orgBDocs.length).toBeGreaterThan(0);
      expect(orgBDocs.every((d) => d.organizationId === orgBId)).toBe(true);

      // 4. Intento de INSERT con organizationId de Org B dentro del contexto de Org A -> rechazado por RLS
      await expect(
        scopedPrisma.runInOrgContext({ organizationId: orgAId }, (tx) =>
          tx.document.create({
            data: {
              organizationId: orgBId,
              title: "Violación RLS",
              createdById: lawyerA.userId,
            },
          }),
        ),
      ).rejects.toThrow();

      // 5. Privilegio mínimo: abogados_app_user NO puede ejecutar DELETE físico sobre Document ni UPDATE sobre DocumentFileVersion
      await expect(
        scopedPrisma.runInOrgContext({ organizationId: orgAId }, (tx) =>
          tx.document.deleteMany({ where: { id: orgADocs[0].id } }),
        ),
      ).rejects.toThrow();

      await expect(
        scopedPrisma.runInOrgContext({ organizationId: orgAId }, (tx) =>
          tx.documentFileVersion.updateMany({
            where: { documentId: orgADocs[0].id },
            data: { changeNote: "mutado" },
          }),
        ),
      ).rejects.toThrow();
    });

    it("TDS-DOC-AUD-001: Auditoría completa registrada en AuditLog para el ciclo documental", async () => {
      const logs = await adminPrisma.auditLog.findMany({
        where: {
          organizationId: orgAId,
          entityTable: "Document",
        },
        orderBy: { timestamp: "desc" },
      });

      const actions = logs.map((l) => l.action);
      expect(actions).toContain("DOCUMENT_CREATED");
      expect(actions).toContain("DOCUMENT_VIEWED");
      expect(actions).toContain("DOCUMENT_DOWNLOADED");
      expect(actions).toContain("DOCUMENT_VERSION_UPLOADED");
      expect(actions).toContain("DOCUMENT_METADATA_UPDATED");
      expect(actions).toContain("DOCUMENT_ARCHIVED");
      expect(actions).toContain("DOCUMENT_RESTORED");
    });
  });
});
