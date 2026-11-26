/**
 * AUTH-08 — Pruebas TDS de Almacenamiento Privado, Fallos y Compensación (§10.3)
 * Expediente: AUTH08-DOCUMENT-MANAGEMENT-IMPLEMENTATION-001
 *
 * Cubre explícitamente:
 * - Rechazo de DOCUMENT_STORAGE_ROOT en directorio público.
 * - Rechazo de path traversal y rutas absolutas en storageKey.
 * - Rechazo de sobrescritura de objeto existente (apertura exclusiva wx -> ConflictException).
 * - Fallo de lectura de archivo físico inexistente y detección de corrupción SHA-256.
 * - Compensación explícita ante fallo de persistencia PostgreSQL (elimina objeto promovido + limpia .tmp, 0 huérfanos).
 * - Compensación explícita ante fallo de auditoría (elimina objeto promovido + limpia .tmp, 0 huérfanos).
 */

import { ConfigService } from "@nestjs/config";
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";
import { OrganizationRole } from "@prisma/client";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  DocumentStorageService,
  NoOpDocumentMalwareScanner,
} from "../../src/documents/document-storage.service";
import { DocumentsManagementService } from "../../src/documents/documents-management.service";

describe("AUTH-08 §10.3 — Almacenamiento Privado, Integridad y Compensación", () => {
  const runTag = `stg08-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const rootDir = path.join(os.tmpdir(), `abogados-stg-${runTag}`);
  let storage: DocumentStorageService;

  const makeConfig = (dir: string) =>
    ({
      get: (key: string) => (key === "DOCUMENT_STORAGE_ROOT" ? dir : undefined),
    }) as unknown as ConfigService;

  beforeAll(() => {
    storage = new DocumentStorageService(makeConfig(rootDir));
  });

  afterAll(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it("TDS-STG-001: Rechaza DOCUMENT_STORAGE_ROOT dentro de directorios públicos", () => {
    expect(
      () =>
        new DocumentStorageService(
          makeConfig(path.join(os.tmpdir(), "app/frontend/public/docs")),
        ),
    ).toThrow(InternalServerErrorException);
  });

  it("TDS-STG-002: Bloquea path traversal y rutas absolutas en resolveSafePath", () => {
    expect(() => storage.resolveSafePath("../../etc/passwd")).toThrow(
      BadRequestException,
    );
    expect(() => storage.resolveSafePath("/etc/passwd")).toThrow(
      BadRequestException,
    );
    expect(() => storage.resolveSafePath("C:\\Windows\\win.ini")).toThrow(
      BadRequestException,
    );
  });

  it("TDS-STG-003: Prohíbe sobrescritura de objeto existente (apertura exclusiva wx)", async () => {
    const tmp1 = path.join(storage.getTempDir(), "file1.tmp");
    const tmp2 = path.join(storage.getTempDir(), "file2.tmp");
    fs.writeFileSync(tmp1, "%PDF-1.4 content-1");
    fs.writeFileSync(tmp2, "%PDF-1.4 content-2");

    const key = storage.buildStorageKey("org-1", "doc-1", 1);
    await storage.promoteTempFile(tmp1, key);

    // Segundo intento sobre la misma storageKey debe fallar con ConflictException
    await expect(storage.promoteTempFile(tmp2, key)).rejects.toThrow(
      ConflictException,
    );

    await storage.removeTempFile(tmp1);
    await storage.removeTempFile(tmp2);
    await storage.deletePromotedObject(key);
  });

  it("TDS-STG-004: Fallo de lectura de archivo inexistente y detección de hash SHA-256 corrupto", async () => {
    const missingKey = storage.buildStorageKey("org-1", "doc-missing", 1);
    await expect(
      storage.verifyAndOpenReadStream(missingKey, "0".repeat(64)),
    ).rejects.toThrow(InternalServerErrorException);

    const tmp = path.join(storage.getTempDir(), "corrupt-test.tmp");
    const bytes = Buffer.from("%PDF-1.4 original");
    fs.writeFileSync(tmp, bytes);
    const key = storage.buildStorageKey("org-1", "doc-corrupt", 1);
    await storage.promoteTempFile(tmp, key);
    await storage.removeTempFile(tmp);

    const wrongHash = "f".repeat(64);
    await expect(
      storage.verifyAndOpenReadStream(key, wrongHash),
    ).rejects.toThrow(ConflictException);

    await storage.deletePromotedObject(key);
  });

  it("TDS-STG-005: Compensación ante fallo de PostgreSQL elimina objeto promovido y limpia .tmp (0 huérfanos)", async () => {
    const tmpFile = path.join(storage.getTempDir(), "db-fail.tmp");
    fs.writeFileSync(tmpFile, "%PDF-1.4 valid pdf content");

    let callCount = 0;
    const failingScopedPrisma = {
      runInOrgContext: async (_ctx: any, fn: any) => {
        callCount++;
        if (callCount === 1) {
          // Primera llamada: validación de asociaciones (sin asociaciones)
          return fn({});
        }
        // Segunda llamada: fallo simulado de PostgreSQL en INSERT
        throw new Error("Simulated PostgreSQL write failure");
      },
    } as any;

    const svc = new DocumentsManagementService(
      failingScopedPrisma,
      { record: jest.fn() } as any,
      storage,
      new NoOpDocumentMalwareScanner(),
    );

    const beforeTenantsDir = path.join(rootDir, "tenants", "org-comp-db");
    await expect(
      svc.createWithFile(
        { title: "Falla PG" },
        {
          originalname: "test.pdf",
          mimetype: "application/pdf",
          size: fs.statSync(tmpFile).size,
          path: tmpFile,
        },
        {
          userId: "u-1",
          organizationId: "org-comp-db",
          membershipId: "m-1",
          orgRole: OrganizationRole.LAWYER,
          correlationId: "corr-1",
        },
      ),
    ).rejects.toThrow("Simulated PostgreSQL write failure");

    // Archivo temporal eliminado
    expect(fs.existsSync(tmpFile)).toBe(false);

    // 0 archivos binarios huérfanos en tenants/org-comp-db
    const countBinFiles = (dir: string): number => {
      if (!fs.existsSync(dir)) return 0;
      let count = 0;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        count += entry.isDirectory() ? countBinFiles(full) : 1;
      }
      return count;
    };
    expect(countBinFiles(beforeTenantsDir)).toBe(0);
  });

  it("TDS-STG-006: Compensación ante fallo de auditoría elimina objeto promovido y limpia .tmp (0 huérfanos)", async () => {
    const tmpFile = path.join(storage.getTempDir(), "audit-fail.tmp");
    fs.writeFileSync(tmpFile, "%PDF-1.4 valid pdf audit test");

    const scopedPrisma = {
      runInOrgContext: async (_ctx: any, fn: any) => {
        const fakeTx = {
          document: {
            create: async () => ({ id: "doc-audit-fail" }),
          },
        };
        return fn(fakeTx);
      },
    } as any;

    const failingAudit = {
      record: async () => {
        throw new Error("Simulated AuditLog failure");
      },
    } as any;

    const svc = new DocumentsManagementService(
      scopedPrisma,
      failingAudit,
      storage,
      new NoOpDocumentMalwareScanner(),
    );

    await expect(
      svc.createWithFile(
        { title: "Falla Audit" },
        {
          originalname: "audit.pdf",
          mimetype: "application/pdf",
          size: fs.statSync(tmpFile).size,
          path: tmpFile,
        },
        {
          userId: "u-1",
          organizationId: "org-comp-audit",
          membershipId: "m-1",
          orgRole: OrganizationRole.LAWYER,
          correlationId: "corr-2",
        },
      ),
    ).rejects.toThrow("Simulated AuditLog failure");

    expect(fs.existsSync(tmpFile)).toBe(false);
    const auditDir = path.join(rootDir, "tenants", "org-comp-audit");
    const countBinFiles = (dir: string): number => {
      if (!fs.existsSync(dir)) return 0;
      let count = 0;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        count += entry.isDirectory() ? countBinFiles(full) : 1;
      }
      return count;
    };
    expect(countBinFiles(auditDir)).toBe(0);
  });
});

