/**
 * AUTH-09 ADDENDUM — Suite TDS Real del Generador de Escritos con Asistente IA
 * Expediente: AUTH09-LEGAL-DRAFTING-IMPLEMENTATION-001 (Addendum IA Legal)
 *
 * Ejecuta sobre PostgreSQL 18 real (abogados_test / abogados_app_user NOBYPASSRLS),
 * almacenamiento privado AUTH-08 real y un doble controlado del proveedor IA (LEGAL_AI_PROVIDER)
 * según §9 del Addendum.
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
  TipoMovimientoProcesal,
  LegalDraftCategory,
  LegalDraftDocumentType,
} from "@prisma/client";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import {
  BadGatewayException,
  GatewayTimeoutException,
  INestApplication,
  Logger,
  ServiceUnavailableException,
  ValidationPipe,
} from "@nestjs/common";
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
import { DocumentsManagementModule } from "../../src/documents/documents-management.module";
import { LegalDraftsModule } from "../../src/legal-drafts/legal-drafts.module";
import {
  ILegalAiProvider,
  LEGAL_AI_PROVIDER,
  LegalAiGenerationRequest,
  LegalAiGenerationResponse,
} from "../../src/legal-drafts/legal-ai.provider";
import { BffSessionService } from "../../src/auth/bff/bff-session.service";
import { CsrfService } from "../../src/auth/bff/csrf.service";

interface TestUserSession {
  userId: string;
  email: string;
  rawSessionSecret: string;
  csrfToken: string;
  cookies: string[];
}

const VALID_PDF_REF = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n--doc-ref--",
  "utf8",
);

const ALL_16_ADDENDUM_TYPES: Array<{
  category: LegalDraftCategory;
  documentType: LegalDraftDocumentType;
}> = [
  // 10 Escritos judiciales
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.DEMANDA,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.CONTESTACION_DEMANDA,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.EXCEPCION,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.APERTURA_PRUEBA,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.ALEGATO,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.APELACION,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.CONTESTACION_TRASLADO,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.PRONTO_DESPACHO,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.MEDIDA_CAUTELAR,
  },
  {
    category: LegalDraftCategory.ESCRITO_JUDICIAL,
    documentType: LegalDraftDocumentType.ESCRITO_LIBRE,
  },
  // 6 Contratos
  {
    category: LegalDraftCategory.CONTRATO,
    documentType: LegalDraftDocumentType.CONTRATO_LOCACION,
  },
  {
    category: LegalDraftCategory.CONTRATO,
    documentType: LegalDraftDocumentType.CONTRATO_SERVICIOS,
  },
  {
    category: LegalDraftCategory.CONTRATO,
    documentType: LegalDraftDocumentType.CONTRATO_NDA,
  },
  {
    category: LegalDraftCategory.CONTRATO,
    documentType: LegalDraftDocumentType.CONTRATO_COMPRAVENTA,
  },
  {
    category: LegalDraftCategory.CONTRATO,
    documentType: LegalDraftDocumentType.CONTRATO_MUTUO,
  },
  {
    category: LegalDraftCategory.CONTRATO,
    documentType: LegalDraftDocumentType.OTRO_CONTRATO,
  },
];

describe("AUTH-09 ADDENDUM — Generador de Escritos con Asistente IA (TDS Real)", () => {
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

  const runTag = `ai09-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const storageRoot = path.join(os.tmpdir(), `abogados-auth09-ai-${runTag}`);
  const prevStorageRoot = process.env.DOCUMENT_STORAGE_ROOT;

  let orgAId: string;
  let orgBId: string;
  let lawyerA: TestUserSession;
  let assistantA: TestUserSession;
  let staffA: TestUserSession;
  let lawyerB: TestUserSession;

  let expAId: string;
  let expBId: string;
  let docAId: string;
  let docBId: string;
  let tplAId: string;
  let tplBId: string;

  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];

  // Doble controlado del proveedor IA (según §9 del Addendum)
  let providerAvailable = true;
  let nextProviderBehavior: "OK" | "TIMEOUT" | "ERROR" | "INVALID_XSS" = "OK";
  const recordedProviderRequests: LegalAiGenerationRequest[] = [];

  const controlledAiProvider: ILegalAiProvider = {
    getStatus: () => ({
      available: providerAvailable,
      provider: "openai-controlled-double",
      model: "gpt-4o-mini",
      ...(providerAvailable
        ? {}
        : {
            reason:
              "Proveedor de IA no configurado. Puede continuar con el editor manual.",
          }),
    }),
    generate: async (
      req: LegalAiGenerationRequest,
    ): Promise<LegalAiGenerationResponse> => {
      recordedProviderRequests.push(req);
      if (!providerAvailable) {
        throw new ServiceUnavailableException("Proveedor de IA no configurado");
      }
      const behavior = nextProviderBehavior;
      nextProviderBehavior = "OK";
      if (behavior === "TIMEOUT") {
        throw new GatewayTimeoutException("AI provider timeout");
      }
      if (behavior === "ERROR") {
        throw new BadGatewayException("AI provider upstream failure");
      }
      if (behavior === "INVALID_XSS") {
        return {
          title: "Malicious Output",
          content: {
            type: "doc",
            content: [
              { type: "script", content: [{ type: "text", text: "alert(1)" }] },
            ],
          },
          missingData: [],
          warnings: [],
          citationsUsed: [],
          model: "gpt-4o-mini",
          provider: "openai-controlled-double",
        };
      }

      return {
        title: `Borrador IA (${req.mode})`,
        content: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 2, textAlign: "center" },
              content: [
                { type: "text", text: `BORRADOR GENERADO (${req.mode})` },
              ],
            },
            {
              type: "paragraph",
              attrs: { textAlign: "justify" },
              content: [
                {
                  type: "text",
                  text: "Borrador basado únicamente en antecedentes verificados. [DATO PENDIENTE DE CONFIRMAR: domicilio procesal].",
                },
              ],
            },
          ],
        },
        missingData: ["Confirmar domicilio procesal constituido"],
        warnings: ["Borrador generado por IA — requiere revisión profesional."],
        citationsUsed: [],
        model: "gpt-4o-mini",
        provider: "openai-controlled-double",
      };
    },
  };

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
    orgId: string,
    role: OrganizationRole,
  ): Promise<TestUserSession> => {
    const email = `${label}-${runTag}@abogados-test.com`;
    const user = await adminPrisma.user.create({
      data: {
        email,
        fullName: `Dr. ${label}`,
        passwordHash: "$2b$04$testMockHashNeverExposed",
        role: UserRole.ASSOCIATE,
        organizationId: orgId,
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

    await adminPrisma.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId: orgId,
        role,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date(),
      },
    });

    const { rawSessionSecret } = await sessionService.createSession(user.id);
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawSessionSecret)
      .digest("hex");
    await adminPrisma.userSession.update({
      where: { sessionToken: tokenHash },
      data: { activeOrganizationId: orgId },
    });

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
      throw new Error("APP_RUNTIME_DATABASE_URL is required");
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
              OPENAI_API_KEY: "sk-test-secret-key-never-expose-999999",
              LEGAL_AI_MODEL: "gpt-4o-mini",
              LEGAL_AI_TIMEOUT_MS: 5000,
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
        MovimientosModule,
        DocumentsManagementModule,
        LegalDraftsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(appPrisma)
      .overrideProvider(LEGAL_AI_PROVIDER)
      .useValue(controlledAiProvider)
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

    const orgA = await adminPrisma.organization.create({
      data: {
        name: `Estudio IA Alfa ${runTag}`,
        status: OrganizationStatus.ACTIVE,
      },
    });
    const orgB = await adminPrisma.organization.create({
      data: {
        name: `Estudio IA Beta ${runTag}`,
        status: OrganizationStatus.ACTIVE,
      },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;
    createdOrgIds.push(orgAId, orgBId);

    lawyerA = await createUserWithMembership(
      "lawyerA",
      orgAId,
      OrganizationRole.LAWYER,
    );
    assistantA = await createUserWithMembership(
      "assistantA",
      orgAId,
      OrganizationRole.ASSISTANT,
    );
    staffA = await createUserWithMembership(
      "staffA",
      orgAId,
      OrganizationRole.STAFF,
    );
    lawyerB = await createUserWithMembership(
      "lawyerB",
      orgBId,
      OrganizationRole.LAWYER,
    );

    const cliA = await adminPrisma.client.create({
      data: {
        organizationId: orgAId,
        personType: ClientPersonType.HUMANA,
        firstName: "Lucía",
        lastName: "Fernández",
        dniCuit: `27-${Date.now().toString().slice(-8)}-3`,
        status: ClientStatus.ACTIVO,
      },
    });

    const expA = await adminPrisma.expediente.create({
      data: {
        organizationId: orgAId,
        caratula: `Fernández c/ Transporte Norte SA s/ Daños (${runTag})`,
        numeroExpediente: `EXP-IA-A-${runTag.slice(-5)}`,
        juzgado: "Juzgado Civil N° 8",
        jurisdiccion: "CABA",
        fuero: "CIVIL",
        descripcion:
          "NOTA_CONFIDENCIAL_CAUSA_ALFA: accidente ocurrido el 15/03/2026",
        estado: ExpedienteEstado.EN_TRAMITE,
      },
    });
    const expB = await adminPrisma.expediente.create({
      data: {
        organizationId: orgBId,
        caratula: `SECRETO_ORG_BETA c/ Otros (${runTag})`,
        numeroExpediente: `EXP-IA-B-${runTag.slice(-5)}`,
        juzgado: "Juzgado Comercial N° 2",
        jurisdiccion: "NACION",
        fuero: "COMERCIAL",
        descripcion: "NOTA_SECRETA_BETA_NUNCA_LEER",
        estado: ExpedienteEstado.EN_TRAMITE,
      },
    });
    expAId = expA.id;
    expBId = expB.id;

    // Partes de Org A
    await adminPrisma.expedienteParte.createMany({
      data: [
        {
          organizationId: orgAId,
          expedienteId: expAId,
          clientId: cliA.id,
          nombre: "Lucía Fernández",
          rol: RolParteProcesal.ACTOR,
          esCliente: true,
        },
        {
          organizationId: orgAId,
          expedienteId: expAId,
          nombre: "Transporte Norte SA",
          rol: RolParteProcesal.DEMANDADO,
          esCliente: false,
        },
      ],
    });

    // Movimiento procesal activo y uno anulado (el anulado NO debe enviarse como vigente)
    await adminPrisma.movimientoProcesal.createMany({
      data: [
        {
          organizationId: orgAId,
          expedienteId: expAId,
          tipo: TipoMovimientoProcesal.TRASLADO,
          titulo: "Traslado de contestación de demanda",
          descripcion: "Plazo de 5 días hábiles para contestar",
          fechaActuacion: new Date("2026-04-10T10:00:00Z"),
          registradoPorId: lawyerA.userId,
        },
        {
          organizationId: orgAId,
          expedienteId: expAId,
          tipo: TipoMovimientoProcesal.OTRO,
          titulo: "MOVIMIENTO_ANULADO_NO_USAR",
          fechaActuacion: new Date("2026-04-01T10:00:00Z"),
          registradoPorId: lawyerA.userId,
          anuladoAt: new Date("2026-04-02T10:00:00Z"),
          anuladoMotivo: "Error de carga",
        },
      ],
    });

    // Subir documentos reales AUTH-08 en Org A y Org B
    const upA = await withAuth(
      request(app.getHttpServer())
        .post("/documents")
        .field("title", "Pericia Mecánica Verificada Alfa")
        .field("category", "INFORME")
        .field("expedienteId", expAId)
        .attach("file", VALID_PDF_REF, {
          filename: "pericia-alfa.pdf",
          contentType: "application/pdf",
        }),
      lawyerA,
      true,
    ).expect(201);
    docAId = upA.body.id;

    const upB = await withAuth(
      request(app.getHttpServer())
        .post("/documents")
        .field("title", "Documento Secreto Beta")
        .field("category", "CONTRATO")
        .field("expedienteId", expBId)
        .attach("file", VALID_PDF_REF, {
          filename: "secreto-beta.pdf",
          contentType: "application/pdf",
        }),
      lawyerB,
      true,
    ).expect(201);
    docBId = upB.body.id;

    // Plantillas en Org A y Org B
    const tplA = await adminPrisma.legalDraftTemplate.create({
      data: {
        organizationId: orgAId,
        name: "Plantilla Demanda Alfa con Variables",
        category: LegalDraftCategory.ESCRITO_JUDICIAL,
        documentType: LegalDraftDocumentType.DEMANDA,
        baseInstructions: "Seguir estructura de demanda de daños",
        variables: [
          "caratula",
          "numero_expediente",
          "tribunal",
          "actor",
          "demandado",
          "monto_reclamado",
        ],
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Autos: {{caratula}} | Expte: {{numero_expediente}} | Tribunal: {{tribunal}} | Actor: {{actor}} | Demandado: {{demandado}} | Monto: {{monto_reclamado}}",
                },
              ],
            },
          ],
        },
        createdById: lawyerA.userId,
      },
    });
    const tplB = await adminPrisma.legalDraftTemplate.create({
      data: {
        organizationId: orgBId,
        name: "Plantilla Privada Beta",
        category: LegalDraftCategory.ESCRITO_JUDICIAL,
        documentType: LegalDraftDocumentType.DEMANDA,
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "CONTENIDO_BETA" }],
            },
          ],
        },
        createdById: lawyerB.userId,
      },
    });
    tplAId = tplA.id;
    tplBId = tplB.id;
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
        await adminPrisma.movimientoProcesal.deleteMany({
          where: { organizationId: { in: createdOrgIds } },
        });
        await adminPrisma.expedienteParte.deleteMany({
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
      if (prevStorageRoot === undefined)
        delete process.env.DOCUMENT_STORAGE_ROOT;
      else process.env.DOCUMENT_STORAGE_ROOT = prevStorageRoot;
      fs.rmSync(storageRoot, { recursive: true, force: true });
      await app?.close();
      await appPrisma?.$disconnect();
      await adminPrisma?.$disconnect();
    }
  });

  it("TDS-AI-001: Catálogo de 16 tipos (10 judiciales + 6 contratos), estado IA sin API key y causas recientes reales", async () => {
    const catRes = await withAuth(
      request(app.getHttpServer()).get("/legal-drafts/catalog"),
      lawyerA,
    ).expect(200);

    expect(Array.isArray(catRes.body.judicial)).toBe(true);
    expect(Array.isArray(catRes.body.contracts)).toBe(true);
    expect(catRes.body.judicial).toHaveLength(10);
    expect(catRes.body.contracts).toHaveLength(6);

    const statusRes = await withAuth(
      request(app.getHttpServer()).get("/legal-drafts/ai/status"),
      lawyerA,
    ).expect(200);
    expect(typeof statusRes.body.available).toBe("boolean");
    expect(JSON.stringify(statusRes.body)).not.toContain("sk-test-secret-key");

    const recentRes = await withAuth(
      request(app.getHttpServer()).get("/legal-drafts/recent-cases"),
      lawyerA,
    ).expect(200);
    expect(Array.isArray(recentRes.body.data)).toBe(true);
    const expItem = recentRes.body.data.find((e: any) => e.id === expAId);
    expect(expItem).toBeDefined();
    expect(expItem.movimientosCount).toBe(1); // Solo el movimiento activo, NO el anulado
    expect(recentRes.body.data.some((e: any) => e.id === expBId)).toBe(false);
  });

  it("TDS-AI-002: Generación IA con causa real recupera partes, movimientos activos, notas y documentos AUTH-08 sin modificar la causa", async () => {
    const res = await withAuth(
      request(app.getHttpServer())
        .post("/legal-drafts/ai/generate")
        .send({
          category: LegalDraftCategory.ESCRITO_JUDICIAL,
          documentType: LegalDraftDocumentType.DEMANDA,
          expedienteId: expAId,
          sourceTemplateId: tplAId,
          referenceDocumentIds: [docAId],
          instructions:
            "Redactar demanda por daños y perjuicios con base en la pericia mecánica.",
        }),
      lawyerA,
      true,
    ).expect(201);

    expect(res.body.isAiGenerated).toBe(true);
    expect(res.body.expedienteId).toBe(expAId);
    expect(res.body.sourceTemplateId).toBe(tplAId);
    expect(res.body.versions).toHaveLength(1);
    expect(res.body.versions[0].generatedByAi).toBe(true);
    expect(Array.isArray(res.body.aiMetadata?.missingData)).toBe(true);
    expect(res.body.aiMetadata?.contextSummary?.partesCount).toBe(2);
    expect(res.body.aiMetadata?.contextSummary?.movimientosCount).toBe(1);
    expect(res.body.aiMetadata?.contextSummary?.referenceDocumentsCount).toBe(
      1,
    );
    expect(
      res.body.aiMetadata?.contextSummary?.unresolvedTemplateVars,
    ).toContain("monto_reclamado");

    // Verificar que el contexto enviado al proveedor incluye partes, movimiento activo, nota y doc AUTH-08,
    // y excluye movimientos anulados y cualquier dato de Org B
    const lastPrompt =
      recordedProviderRequests[recordedProviderRequests.length - 1]
        ?.userPrompt || "";
    expect(lastPrompt).toContain("Lucía Fernández");
    expect(lastPrompt).toContain("Transporte Norte SA");
    expect(lastPrompt).toContain("Traslado de contestación de demanda");
    expect(lastPrompt).toContain("NOTA_CONFIDENCIAL_CAUSA_ALFA");
    expect(lastPrompt).toContain("Pericia Mecánica Verificada Alfa");
    expect(lastPrompt).toContain(
      "[DATO PENDIENTE DE CONFIRMAR: monto_reclamado]",
    );
    expect(lastPrompt).not.toContain("MOVIMIENTO_ANULADO_NO_USAR");
    expect(lastPrompt).not.toContain("SECRETO_ORG_BETA");
    expect(lastPrompt).not.toContain("NOTA_SECRETA_BETA");

    // Sin efectos colaterales sobre movimientos de la causa
    const movCount = await adminPrisma.movimientoProcesal.count({
      where: { organizationId: orgAId, expedienteId: expAId, anuladoAt: null },
    });
    expect(movCount).toBe(1);
  });

  it("TDS-AI-003: Generación sin causa (contrato) y sin plantilla funciona y valida los 16 tipos documentales", async () => {
    for (const item of ALL_16_ADDENDUM_TYPES) {
      const res = await withAuth(
        request(app.getHttpServer())
          .post("/legal-drafts/ai/generate")
          .send({
            category: item.category,
            documentType: item.documentType,
            instructions: `Generar borrador de ${item.documentType} según criterios verificados.`,
          }),
        lawyerA,
        true,
      ).expect(201);

      expect(res.body.documentType).toBe(item.documentType);
      expect(res.body.category).toBe(item.category);
      expect(res.body.isAiGenerated).toBe(true);
    }
  });

  it("TDS-AI-004: Aislamiento multi-tenant y RBAC — causa/plantilla/documento de Org B rechazados con 404; STAFF y ASSISTANT bloqueados con 403", async () => {
    // STAFF y ASSISTANT no tienen ai:use -> 403
    await withAuth(
      request(app.getHttpServer()).post("/legal-drafts/ai/generate").send({
        category: LegalDraftCategory.CONTRATO,
        documentType: LegalDraftDocumentType.CONTRATO_NDA,
        instructions: "Intentar generar sin ai:use",
      }),
      staffA,
      true,
    ).expect(403);

    await withAuth(
      request(app.getHttpServer()).post("/legal-drafts/ai/generate").send({
        category: LegalDraftCategory.CONTRATO,
        documentType: LegalDraftDocumentType.CONTRATO_NDA,
        instructions: "Intentar generar sin ai:use",
      }),
      assistantA,
      true,
    ).expect(403);

    // Causa de Org B -> 404
    await withAuth(
      request(app.getHttpServer()).post("/legal-drafts/ai/generate").send({
        category: LegalDraftCategory.ESCRITO_JUDICIAL,
        documentType: LegalDraftDocumentType.DEMANDA,
        expedienteId: expBId,
        instructions: "Acceso indebido a causa ajena",
      }),
      lawyerA,
      true,
    ).expect(404);

    // Documento AUTH-08 de Org B -> 404
    await withAuth(
      request(app.getHttpServer())
        .post("/legal-drafts/ai/generate")
        .send({
          category: LegalDraftCategory.ESCRITO_JUDICIAL,
          documentType: LegalDraftDocumentType.DEMANDA,
          expedienteId: expAId,
          referenceDocumentIds: [docBId],
          instructions: "Acceso indebido a documento ajeno",
        }),
      lawyerA,
      true,
    ).expect(404);

    // Plantilla de Org B -> 404
    await withAuth(
      request(app.getHttpServer()).post("/legal-drafts/ai/generate").send({
        category: LegalDraftCategory.ESCRITO_JUDICIAL,
        documentType: LegalDraftDocumentType.DEMANDA,
        sourceTemplateId: tplBId,
        instructions: "Acceso indebido a plantilla ajena",
      }),
      lawyerA,
      true,
    ).expect(404);
  });

  it("TDS-AI-005: Regeneración y asistencia IA no sobrescriben versiones guardadas y permiten propuesta explícita o nueva versión", async () => {
    const created = await withAuth(
      request(app.getHttpServer()).post("/legal-drafts/ai/generate").send({
        category: LegalDraftCategory.CONTRATO,
        documentType: LegalDraftDocumentType.CONTRATO_LOCACION,
        instructions: "Contrato de locación por 24 meses.",
      }),
      lawyerA,
      true,
    ).expect(201);

    const draftId = created.body.id;
    const v1Text = created.body.versions[0].plainText;

    // 1. Consultar información faltante (sin crear versión)
    const missingRes = await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${draftId}/ai/assist`)
        .send({ mode: "MISSING_INFO" }),
      lawyerA,
      true,
    ).expect(200);
    expect(Array.isArray(missingRes.body.missingData)).toBe(true);

    // 2. Mejorar redacción como propuesta (applyAsNewVersion: false) -> NO altera v1 ni incrementa currentVersionNumber
    const proposalRes = await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${draftId}/ai/assist`)
        .send({
          mode: "IMPROVE",
          instructions: "Mejorar claridad formal",
          applyAsNewVersion: false,
        }),
      lawyerA,
      true,
    ).expect(200);
    expect(proposalRes.body.applied).toBe(false);
    expect(proposalRes.body.proposedContent?.type).toBe("doc");

    const afterProp = await withAuth(
      request(app.getHttpServer()).get(`/legal-drafts/${draftId}`),
      lawyerA,
    ).expect(200);
    expect(afterProp.body.currentVersionNumber).toBe(1);
    expect(afterProp.body.versions[0].plainText).toBe(v1Text);

    // 3. Regenerar aplicando como nueva versión (applyAsNewVersion: true) -> crea v2 preservando v1 intacta
    const regenRes = await withAuth(
      request(app.getHttpServer())
        .post(`/legal-drafts/${draftId}/ai/assist`)
        .send({
          mode: "REGENERATE",
          instructions: "Incorporar cláusula de depósito en garantía",
          applyAsNewVersion: true,
        }),
      lawyerA,
      true,
    ).expect(200);
    expect(regenRes.body.applied).toBe(true);
    expect(regenRes.body.version.versionNumber).toBe(2);

    const afterRegen = await withAuth(
      request(app.getHttpServer()).get(`/legal-drafts/${draftId}/versions`),
      lawyerA,
    ).expect(200);
    expect(afterRegen.body).toHaveLength(2);
    expect(afterRegen.body[1].plainText).toBe(v1Text);
  });

  it("TDS-AI-006: Ausencia de API keys en frontend y no filtración de contenido sensible ni API keys en logs técnicos", async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, "log")
      .mockImplementation(() => undefined);
    const errorSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    try {
      await withAuth(
        request(app.getHttpServer()).post("/legal-drafts/ai/generate").send({
          category: LegalDraftCategory.ESCRITO_JUDICIAL,
          documentType: LegalDraftDocumentType.DEMANDA,
          expedienteId: expAId,
          instructions: "SECRETO_SENSIBLE_DEL_CLIENTE_XYZ123",
        }),
        lawyerA,
        true,
      ).expect(201);

      const allLogs = [
        ...logSpy.mock.calls.flat().map(String),
        ...errorSpy.mock.calls.flat().map(String),
      ].join("\n");
      expect(allLogs).not.toContain("sk-test-secret-key");
      expect(allLogs).not.toContain("SECRETO_SENSIBLE_DEL_CLIENTE_XYZ123");
      expect(allLogs).not.toContain("NOTA_CONFIDENCIAL_CAUSA_ALFA");
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }

    // Verificar que frontend/src no contiene OPENAI_API_KEY ni llamadas directas a api.openai.com
    const frontendSrc = path.resolve(__dirname, "../../../frontend/src");
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
      });
    for (const file of walk(frontendSrc)) {
      const text = fs.readFileSync(file, "utf8");
      expect(text).not.toContain("OPENAI_API_KEY");
      expect(text).not.toContain("api.openai.com");
    }
  });

  it("TDS-AI-007: Manejo controlado de timeout (504), fallo proveedor (502), respuesta XSS inválida (502) y fallback manual cuando IA no está configurada (503)", async () => {
    const countBefore = await adminPrisma.legalWriting.count({
      where: { organizationId: orgAId },
    });

    // Timeout -> 504
    nextProviderBehavior = "TIMEOUT";
    await withAuth(
      request(app.getHttpServer()).post("/legal-drafts/ai/generate").send({
        category: LegalDraftCategory.CONTRATO,
        documentType: LegalDraftDocumentType.CONTRATO_MUTUO,
        instructions: "Prueba de timeout",
      }),
      lawyerA,
      true,
    ).expect(504);

    // Fallo de proveedor -> 502
    nextProviderBehavior = "ERROR";
    await withAuth(
      request(app.getHttpServer()).post("/legal-drafts/ai/generate").send({
        category: LegalDraftCategory.CONTRATO,
        documentType: LegalDraftDocumentType.CONTRATO_MUTUO,
        instructions: "Prueba de error upstream",
      }),
      lawyerA,
      true,
    ).expect(502);

    // Respuesta con nodo <script> malicioso -> bloqueada 502 sin persistir
    nextProviderBehavior = "INVALID_XSS";
    await withAuth(
      request(app.getHttpServer()).post("/legal-drafts/ai/generate").send({
        category: LegalDraftCategory.CONTRATO,
        documentType: LegalDraftDocumentType.CONTRATO_MUTUO,
        instructions: "Prueba de respuesta maliciosa",
      }),
      lawyerA,
      true,
    ).expect(502);

    // Ningún borrador huérfano creado tras errores
    const countAfterErrors = await adminPrisma.legalWriting.count({
      where: { organizationId: orgAId },
    });
    expect(countAfterErrors).toBe(countBefore);

    // Proveedor no configurado -> status available: false, /ai/generate -> 503, editor manual sin causa -> 201
    providerAvailable = false;
    try {
      const st = await withAuth(
        request(app.getHttpServer()).get("/legal-drafts/ai/status"),
        lawyerA,
      ).expect(200);
      expect(st.body.available).toBe(false);

      await withAuth(
        request(app.getHttpServer()).post("/legal-drafts/ai/generate").send({
          category: LegalDraftCategory.CONTRATO,
          documentType: LegalDraftDocumentType.CONTRATO_LOCACION,
          instructions: "Sin proveedor",
        }),
        lawyerA,
        true,
      ).expect(503);

      // Editor manual sigue funcionando (incluso sin expedienteId para contratos)
      const manual = await withAuth(
        request(app.getHttpServer()).post("/legal-drafts").send({
          title: "Contrato Manual sin IA",
          category: LegalDraftCategory.CONTRATO,
          documentType: LegalDraftDocumentType.CONTRATO_LOCACION,
        }),
        lawyerA,
        true,
      ).expect(201);
      expect(manual.body.isAiGenerated).toBe(false);
      expect(manual.body.expedienteId).toBeNull();
    } finally {
      providerAvailable = true;
    }
  });
});
