/**
 * AUTH-04 — Suite TDS de Primitivas de Autorización, Proyecciones por Rol y Contención Fail-Closed
 * Especificación: SPEC-AUTH-004 v0.2.0 — APPROVED | Expediente: AUTH04-IMPLEMENTATION-001
 *
 * Cubre explícitamente:
 * - TST-A04-006 (unit): Validación de storagePath canónico y ausencia de rutas físicas en proyecciones.
 * - TST-A04-008 (unit): ActiveOrgContextGuard rechaza sesión sin activeOrganizationId (403 NO_ACTIVE_ORGANIZATION)
 *                       y bloquea manipulación de organizationId en query/body/headers.
 * - TST-A04-012 (unit): Matriz declarativa de permisos (§8.1), OrgPermissionGuard y proyecciones mínimas de columnas (§8.2)
 *                       para STAFF, ASSISTANT, LAWYER, ORG_ADMIN y ORG_OWNER.
 * - TST-A04-014 (HTTP): Contención Fail-Closed (403) en endpoints prototipales de plataforma, portal legacy,
 *                       refresh legacy HS256 e ingesta global de conocimiento.
 * - ScopedPrismaService (unit): Fail-Closed ante organizationId vacío y prohibición de cambio anidado de tenant.
 */

import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import * as request from "supertest";
import {
  MembershipStatus,
  OrganizationRole,
  OrganizationStatus,
} from "@prisma/client";

import {
  ORG_PERMISSIONS_KEY,
  RequireOrgPermissions,
} from "../../src/authz/decorators/require-org-permissions.decorator";
import {
  ROLE_PERMISSIONS,
  hasOrgPermissions,
  buildCanonicalStoragePath,
  FORBIDDEN_RESPONSE_FIELDS,
  EXPEDIENTE_SELECT_BY_ROLE,
  EVENTO_AGENDA_SELECT_BY_ROLE,
  DOCUMENTO_SELECT_BY_ROLE,
  DOCUMENT_VERSION_SELECT_BY_ROLE,
  LEGAL_TEMPLATE_SELECT_BY_ROLE,
  JUDICIAL_ACCOUNT_SELECT_BY_ROLE,
} from "../../src/authz/permissions";
import { ActiveOrgContextGuard } from "../../src/authz/guards/active-org-context.guard";
import { OrgPermissionGuard } from "../../src/authz/guards/org-permission.guard";
import { PlatformBlockedGuard } from "../../src/authz/guards/platform-blocked.guard";
import { ScopedPrismaService } from "../../src/authz/scoped-prisma.service";
import { PrismaService } from "../../src/prisma.service";
import { AdminMasterController } from "../../src/admin/admin-master.controller";
import { AdminApiController } from "../../src/admin/admin-api.controller";
import { AdminDataService } from "../../src/admin/admin-data.service";
import { AnalyticsController } from "../../src/analytics/analytics.controller";
import { AnalyticsService } from "../../src/analytics/analytics.service";
import { ClientPortalController } from "../../src/client-portal/client-portal.controller";
import { ClientPortalService } from "../../src/client-portal/client-portal.service";
import { AuthController } from "../../src/auth/auth.controller";
import { AuthService } from "../../src/auth/auth.service";
import { IAController } from "../../src/ia/ia.controller";
import { IAService } from "../../src/ia/ia.service";
import { LegalController } from "../../src/ia/legal/legal.controller";
import { LegalIngestionService } from "../../src/ia/legal/legal-ingestion.service";
import { LegalSearchService } from "../../src/ia/legal/legal-search.service";
import { JurisprudenceController } from "../../src/ia/jurisprudence/jurisprudence.controller";
import { JurisprudenceIngestionService } from "../../src/ia/jurisprudence/jurisprudence-ingestion.service";
import { JurisprudenceSearchService } from "../../src/ia/jurisprudence/jurisprudence-search.service";
import { JurisprudenceCrawlerService } from "../../src/ia/jurisprudence/jurisprudence-crawler.service";
import { JudicialController } from "../../src/judicial-engine/judicial.controller";
import { JudicialSyncService } from "../../src/judicial-engine/judicial-sync.service";
import { BffSessionGuard } from "../../src/auth/guards/bff-session.guard";
import { CsrfGuard } from "../../src/auth/guards/csrf.guard";

describe("AUTH-04 — Primitivas de Autorización, Proyecciones y Contención Fail-Closed", () => {
  describe("TST-A04-006 (unit): Claves canónicas de storagePath y exclusión en proyecciones", () => {
    it("genera storagePath prefijado por organización/expediente/documento/versión y nunca expone storagePath en select", () => {
      const orgId = "11111111-1111-4111-8111-111111111111";
      const expId = "22222222-2222-4222-8222-222222222222";
      const docId = "33333333-3333-4333-8333-333333333333";

      const key = buildCanonicalStoragePath({
        organizationId: orgId,
        expedienteId: expId,
        documentId: docId,
        versionNumber: 3,
      });

      expect(key).toMatch(
        new RegExp(
          `^orgs/${orgId}/expedientes/${expId}/documents/${docId}/v3/[0-9a-f-]{36}$`,
        ),
      );

      for (const role of Object.values(OrganizationRole)) {
        const docSelect = DOCUMENTO_SELECT_BY_ROLE[role];
        const verSelect = DOCUMENT_VERSION_SELECT_BY_ROLE[role];
        if (docSelect) {
          expect(
            (docSelect as Record<string, unknown>).storagePath,
          ).toBeUndefined();
        }
        if (verSelect) {
          expect(
            (verSelect as Record<string, unknown>).storagePath,
          ).toBeUndefined();
        }
      }
    });
  });

  describe("TST-A04-008 (unit): ActiveOrgContextGuard Fail-Closed", () => {
    const createMockExecutionContext = (
      req: Record<string, any>,
    ): ExecutionContext =>
      ({
        switchToHttp: () => ({ getRequest: () => req }),
        getHandler: () => () => undefined,
        getClass: () => class DummyController {},
      }) as unknown as ExecutionContext;

    it("rechaza con 403 NO_ACTIVE_ORGANIZATION cuando UserSession.activeOrganizationId es null", async () => {
      const prismaMock = {
        organizationMembership: { findUnique: jest.fn() },
      };
      const guard = new ActiveOrgContextGuard(
        prismaMock as unknown as PrismaService,
      );

      const req = {
        user: { id: "user-1", organizationId: "legacy-org-id", role: "ADMIN" },
        session: { id: "sess-1", activeOrganizationId: null },
        headers: {},
        query: {},
        body: {},
        params: {},
      };

      await expect(
        guard.canActivate(createMockExecutionContext(req)),
      ).rejects.toThrow(ForbiddenException);

      try {
        await guard.canActivate(createMockExecutionContext(req));
      } catch (err: any) {
        const resp = err.getResponse();
        expect(JSON.stringify(resp)).toContain("NO_ACTIVE_ORGANIZATION");
      }
      expect(
        prismaMock.organizationMembership.findUnique,
      ).not.toHaveBeenCalled();
    });

    it("rechaza 401 si no existe req.user o req.session", async () => {
      const prismaMock = {
        organizationMembership: { findUnique: jest.fn() },
      };
      const guard = new ActiveOrgContextGuard(
        prismaMock as unknown as PrismaService,
      );

      await expect(
        guard.canActivate(createMockExecutionContext({ headers: {} })),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("rechaza 403 si el cliente intenta manipular organizationId distinto en query, body o header x-org-id", async () => {
      const orgA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      const orgB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

      const prismaMock = {
        organizationMembership: {
          findUnique: jest.fn().mockResolvedValue({
            id: "mem-1",
            userId: "user-1",
            organizationId: orgA,
            role: OrganizationRole.LAWYER,
            status: MembershipStatus.ACTIVE,
            organization: { id: orgA, status: OrganizationStatus.ACTIVE },
          }),
        },
      };
      const guard = new ActiveOrgContextGuard(
        prismaMock as unknown as PrismaService,
      );

      for (const tampered of [
        { query: { organizationId: orgB }, body: {}, headers: {}, params: {} },
        { query: {}, body: { organizationId: orgB }, headers: {}, params: {} },
        { query: {}, body: {}, headers: { "x-org-id": orgB }, params: {} },
      ]) {
        const req = {
          user: { id: "user-1", organizationId: orgB, role: "ADMIN" },
          session: { id: "sess-1", activeOrganizationId: orgA },
          ...tampered,
        };
        await expect(
          guard.canActivate(createMockExecutionContext(req)),
        ).rejects.toThrow(ForbiddenException);
      }
    });

    it("inyecta req.orgContext inmutable exclusivamente desde activeOrganizationId + membresía ACTIVE", async () => {
      const orgA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      const prismaMock = {
        organizationMembership: {
          findUnique: jest.fn().mockResolvedValue({
            id: "mem-a",
            userId: "user-1",
            organizationId: orgA,
            role: OrganizationRole.STAFF,
            status: MembershipStatus.ACTIVE,
            organization: { id: orgA, status: OrganizationStatus.ACTIVE },
          }),
        },
      };
      const guard = new ActiveOrgContextGuard(
        prismaMock as unknown as PrismaService,
      );
      const req: Record<string, any> = {
        user: {
          id: "user-1",
          organizationId: "legacy-other-org",
          role: "ADMIN",
        },
        session: { id: "sess-1", activeOrganizationId: orgA },
        headers: {},
        query: {},
        body: {},
        params: {},
      };

      const allowed = await guard.canActivate(createMockExecutionContext(req));
      expect(allowed).toBe(true);
      expect(req.orgContext).toBeDefined();
      expect(req.orgContext.organizationId).toBe(orgA);
      expect(req.orgContext.orgRole).toBe(OrganizationRole.STAFF);
      expect(req.orgContext.userId).toBe("user-1");
      expect(Object.isFrozen(req.orgContext)).toBe(true);
    });
  });

  describe("TST-A04-012 (unit): Matriz de Permisos §8.1 y Proyecciones de Columnas §8.2", () => {
    it("cumple exactamente la matriz de permisos declarativos por rol (§8.1)", () => {
      expect(
        hasOrgPermissions(OrganizationRole.STAFF, [
          "cases:read",
          "agenda:read",
          "clients:read",
          "knowledge:read",
        ]),
      ).toBe(true);
      expect(hasOrgPermissions(OrganizationRole.STAFF, ["cases:write"])).toBe(
        false,
      );
      expect(
        hasOrgPermissions(OrganizationRole.STAFF, ["documents:read"]),
      ).toBe(false);
      expect(
        hasOrgPermissions(OrganizationRole.STAFF, ["templates:read"]),
      ).toBe(false);
      expect(hasOrgPermissions(OrganizationRole.STAFF, ["ai:use"])).toBe(false);

      expect(
        hasOrgPermissions(OrganizationRole.ASSISTANT, [
          "documents:read",
          "documents:write",
          "agenda:write",
          "templates:read",
          "clients:write",
        ]),
      ).toBe(true);
      expect(
        hasOrgPermissions(OrganizationRole.ASSISTANT, ["cases:write"]),
      ).toBe(false);
      expect(
        hasOrgPermissions(OrganizationRole.ASSISTANT, ["documents:sensitive"]),
      ).toBe(false);
      expect(hasOrgPermissions(OrganizationRole.ASSISTANT, ["ai:use"])).toBe(
        false,
      );
      expect(
        hasOrgPermissions(OrganizationRole.ASSISTANT, ["judicial:sync"]),
      ).toBe(false);

      expect(
        hasOrgPermissions(OrganizationRole.LAWYER, [
          "cases:write",
          "ai:use",
          "judicial:sync",
          "documents:read",
          "templates:read",
        ]),
      ).toBe(true);
      expect(hasOrgPermissions(OrganizationRole.LAWYER, ["cases:delete"])).toBe(
        false,
      );
      expect(
        hasOrgPermissions(OrganizationRole.LAWYER, ["documents:sensitive"]),
      ).toBe(false);
      expect(
        hasOrgPermissions(OrganizationRole.LAWYER, ["templates:write"]),
      ).toBe(false);
      expect(
        hasOrgPermissions(OrganizationRole.LAWYER, [
          "judicial:manage_accounts",
        ]),
      ).toBe(false);
      expect(hasOrgPermissions(OrganizationRole.LAWYER, ["audit:read"])).toBe(
        false,
      );

      expect(
        hasOrgPermissions(OrganizationRole.ORG_ADMIN, [
          "cases:delete",
          "documents:sensitive",
          "templates:write",
          "judicial:manage_accounts",
          "usage:read",
          "audit:read",
          "members:manage",
        ]),
      ).toBe(true);
      expect(
        hasOrgPermissions(OrganizationRole.ORG_ADMIN, ["members:change_role"]),
      ).toBe(false);
      expect(
        hasOrgPermissions(OrganizationRole.ORG_ADMIN, ["org:manage_status"]),
      ).toBe(false);
      expect(
        hasOrgPermissions(OrganizationRole.ORG_ADMIN, [
          "org:transfer_ownership",
        ]),
      ).toBe(false);

      expect(
        hasOrgPermissions(OrganizationRole.ORG_OWNER, [
          "members:change_role",
          "org:manage_status",
          "org:transfer_ownership",
          "documents:sensitive",
          "ai:use",
        ]),
      ).toBe(true);

      expect(Object.keys(ROLE_PERMISSIONS)).toHaveLength(5);
    });

    it("OrgPermissionGuard aplica Fail-Closed cuando falta @RequireOrgPermissions o el rol carece del permiso", () => {
      const reflector = new Reflector();
      const guard = new OrgPermissionGuard(reflector);

      class TestCtrl {
        @RequireOrgPermissions("ai:use")
        aiHandler() {}
        unannotatedHandler() {}
      }

      const makeCtx = (handler: any, orgRole?: OrganizationRole) =>
        ({
          switchToHttp: () => ({
            getRequest: () => ({
              orgContext: orgRole
                ? {
                    userId: "u-1",
                    organizationId: "org-1",
                    membershipId: "m-1",
                    orgRole,
                    correlationId: "corr-1",
                  }
                : undefined,
            }),
          }),
          getHandler: () => handler,
          getClass: () => TestCtrl,
        }) as unknown as ExecutionContext;

      expect(
        Reflect.getMetadata(ORG_PERMISSIONS_KEY, TestCtrl.prototype.aiHandler),
      ).toEqual(["ai:use"]);

      expect(() =>
        guard.canActivate(
          makeCtx(TestCtrl.prototype.aiHandler, OrganizationRole.ASSISTANT),
        ),
      ).toThrow(ForbiddenException);
      expect(
        guard.canActivate(
          makeCtx(TestCtrl.prototype.aiHandler, OrganizationRole.LAWYER),
        ),
      ).toBe(true);
      expect(() =>
        guard.canActivate(
          makeCtx(
            TestCtrl.prototype.unannotatedHandler,
            OrganizationRole.ORG_OWNER,
          ),
        ),
      ).toThrow(ForbiddenException);
    });

    it("aplica proyecciones mínimas de columnas por rol (§8.2) y nunca expone columnas prohibidas", () => {
      // STAFF: metadatos mínimos en Expediente y EventoAgenda
      const staffExp = EXPEDIENTE_SELECT_BY_ROLE[
        OrganizationRole.STAFF
      ] as Record<string, any>;
      expect(staffExp.id).toBe(true);
      expect(staffExp.caratula).toBe(true);
      expect(staffExp.numeroExpediente).toBe(true);
      expect(staffExp.tags).toBeUndefined();
      expect(staffExp.documentos).toBeUndefined();
      expect(staffExp.drafts).toBeUndefined();
      expect(staffExp.riskAnalyses).toBeUndefined();
      expect(staffExp.users).toBeUndefined();

      const staffAgenda = EVENTO_AGENDA_SELECT_BY_ROLE[
        OrganizationRole.STAFF
      ] as Record<string, any>;
      expect(staffAgenda.titulo).toBe(true);
      expect(staffAgenda.fechaVencimiento).toBe(true);
      expect(staffAgenda.descripcion).toBeUndefined();

      // ASSISTANT: sin ocrContent ni storagePath en documentos; sin content en LegalTemplate
      const assistantDoc = DOCUMENTO_SELECT_BY_ROLE[
        OrganizationRole.ASSISTANT
      ] as Record<string, any>;
      expect(assistantDoc.fileName).toBe(true);
      expect(assistantDoc.ocrContent).toBeUndefined();
      expect(assistantDoc.storagePath).toBeUndefined();

      const assistantTpl = LEGAL_TEMPLATE_SELECT_BY_ROLE[
        OrganizationRole.ASSISTANT
      ] as Record<string, any>;
      expect(assistantTpl.name).toBe(true);
      expect(assistantTpl.content).toBeUndefined();

      // LAWYER: incluye ocrContent y template.content, pero NUNCA storagePath
      const lawyerDoc = DOCUMENTO_SELECT_BY_ROLE[
        OrganizationRole.LAWYER
      ] as Record<string, any>;
      expect(lawyerDoc.ocrContent).toBe(true);
      expect(lawyerDoc.storagePath).toBeUndefined();

      const lawyerTpl = LEGAL_TEMPLATE_SELECT_BY_ROLE[
        OrganizationRole.LAWYER
      ] as Record<string, any>;
      expect(lawyerTpl.content).toBe(true);

      // ORG_ADMIN / ORG_OWNER: JudicialAccount sin encryptedPassword
      const adminJudicial = JUDICIAL_ACCOUNT_SELECT_BY_ROLE[
        OrganizationRole.ORG_ADMIN
      ] as Record<string, any>;
      expect(adminJudicial.jurisdiction).toBe(true);
      expect(adminJudicial.username).toBe(true);
      expect(adminJudicial.encryptedPassword).toBeUndefined();

      expect(FORBIDDEN_RESPONSE_FIELDS).toEqual(
        expect.arrayContaining([
          "passwordHash",
          "refreshTokenHash",
          "sessionToken",
          "codeVerifier",
          "tokenHash",
          "encryptedPassword",
          "storagePath",
        ]),
      );
    });
  });

  describe("ScopedPrismaService (unit): Fail-Closed y prohibición de tenant switch anidado", () => {
    it("rechaza organizationId vacío y ejecuta set_config(..., true) como primera sentencia de $transaction", async () => {
      const executedRaw: unknown[] = [];
      const mockTx = {
        $executeRaw: jest.fn(async (...args: unknown[]) => {
          executedRaw.push(args);
          return 1;
        }),
      };
      const prismaMock = {
        $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) =>
          cb(mockTx),
        ),
      };

      const scoped = new ScopedPrismaService(
        prismaMock as unknown as PrismaService,
      );

      await expect(
        scoped.runInOrgContext({ organizationId: "" }, async () => "nope"),
      ).rejects.toThrow(BadRequestException);

      const orgA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      const orgB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

      const result = await scoped.runInOrgContext(
        { organizationId: orgA },
        async (tx) => {
          expect(tx).toBe(mockTx);
          // Intento de cambio de tenant anidado debe fallar Fail-Closed
          await expect(
            scoped.runInOrgContext(
              { organizationId: orgB },
              async () => "switch",
            ),
          ).rejects.toThrow(ForbiddenException);
          return "ok";
        },
      );

      expect(result).toBe("ok");
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.$executeRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe("TST-A04-014 (HTTP): Contención Fail-Closed en endpoints prototipales, legacy e ingesta global", () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [
              () => ({
                PIXEL_HMAC_SECRET: "test-pixel-hmac-secret-minimum-32-chars!!",
              }),
            ],
          }),
        ],
        controllers: [
          AdminMasterController,
          AdminApiController,
          AnalyticsController,
          ClientPortalController,
          AuthController,
          IAController,
          LegalController,
          JurisprudenceController,
          JudicialController,
        ],
        providers: [
          PlatformBlockedGuard,
          { provide: PrismaService, useValue: {} },
          { provide: AdminDataService, useValue: {} },
          {
            provide: AnalyticsService,
            useValue: { trackEvent: jest.fn(), getRecentEvents: jest.fn() },
          },
          {
            provide: ClientPortalService,
            useValue: {
              login: jest.fn(),
              getMyCases: jest.fn(),
              getCaseDetail: jest.fn(),
            },
          },
          {
            provide: AuthService,
            useValue: { refresh: jest.fn(), logout: jest.fn() },
          },
          {
            provide: IAService,
            useValue: {
              askLegalAssistant: jest.fn(),
              analyzeDocument: jest.fn(),
              ingestLegalNorm: jest.fn(),
            },
          },
          {
            provide: LegalIngestionService,
            useValue: {
              ingestNorm: jest.fn(),
              ingestBatch: jest.fn(),
              createNewVersion: jest.fn(),
            },
          },
          {
            provide: LegalSearchService,
            useValue: {
              search: jest.fn(),
              findByArticle: jest.fn(),
              getVersionHistory: jest.fn(),
              detectConflicts: jest.fn(),
              getStats: jest.fn(),
            },
          },
          {
            provide: JurisprudenceIngestionService,
            useValue: { ingestJurisprudence: jest.fn() },
          },
          {
            provide: JurisprudenceSearchService,
            useValue: {
              getStats: jest.fn(),
              listAll: jest.fn(),
              search: jest.fn(),
              findById: jest.fn(),
            },
          },
          {
            provide: JurisprudenceCrawlerService,
            useValue: { importFromSource: jest.fn() },
          },
          {
            provide: JudicialSyncService,
            useValue: { syncCase: jest.fn(), syncSystem: jest.fn() },
          },
        ],
      })
        .overrideGuard(BffSessionGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(CsrfGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(ActiveOrgContextGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(OrgPermissionGuard)
        .useValue({ canActivate: () => true })
        .compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
      );
      await app.init();
    });

    afterAll(async () => {
      if (app) {
        await app.close();
      }
    });

    const blockedEndpoints: Array<{
      method: "get" | "post";
      path: string;
      body?: Record<string, any>;
    }> = [
      { method: "get", path: "/admin/tenants" },
      { method: "get", path: "/admin/stats" },
      { method: "get", path: "/admin-api/stats" },
      { method: "get", path: "/admin-api/logs" },
      { method: "get", path: "/admin-api/traffic" },
      { method: "get", path: "/events/logs" },
      {
        method: "post",
        path: "/client-portal/login",
        body: { email: "a@b.com", cuit: "20123456789" },
      },
      {
        method: "post",
        path: "/auth/refresh",
        body: { refresh_token: "legacy-token" },
      },
      {
        method: "post",
        path: "/ia/ingest",
        body: {
          titulo: "t",
          texto: "x",
          jurisdiccion: "NACION",
          fuero: "CIVIL",
          tipo: "LEY",
          articulo: "1",
        },
      },
      { method: "post", path: "/legal/ingest", body: {} },
      { method: "post", path: "/legal/ingest/batch", body: { norms: [] } },
      {
        method: "post",
        path: "/legal/version/11111111-1111-4111-8111-111111111111",
        body: {},
      },
      {
        method: "post",
        path: "/jurisprudence/import",
        body: { query: "daños" },
      },
      { method: "post", path: "/jurisprudence/ingest", body: {} },
      { method: "post", path: "/judicial/sync-system" },
    ];

    it.each(blockedEndpoints)(
      "bloquea Fail-Closed $method $path con 403/404/410",
      async ({ method, path, body }) => {
        const req = request(app.getHttpServer())[method](path);
        if (body) {
          req.send(body);
        }
        const res = await req;
        expect([403, 404, 410]).toContain(res.status);
      },
    );
  });
});
