/**
 * Validación de Aislamiento Fail-Closed de Entorno y Base de Datos.
 * Especificación: SPEC-TST-001 (OBS-003, OBS-004, OBS-005, TST-HARNESS-006)
 */
import { assertSafeTestDatabaseUrl } from "../helpers/db-guard";

describe("Environment Isolation and Database Guard (TST-HARNESS-006)", () => {
  it("should enforce test environment variables without production/development fallback", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(process.env.DATABASE_URL).toBe(
      "postgresql://postgres:postgres@localhost:5432/abogados_test?schema=public",
    );
    expect(process.env.JWT_SECRET).toBe(
      "test-jwt-secret-key-for-automated-testing-32-chars-minimum!",
    );
  });

  it("should approve valid local test database URL", () => {
    expect(() =>
      assertSafeTestDatabaseUrl(
        "postgresql://postgres:postgres@localhost:5432/abogados_test?schema=public",
      ),
    ).not.toThrow();

    expect(() =>
      assertSafeTestDatabaseUrl(
        "postgresql://postgres:postgres@127.0.0.1:5432/abogados_test",
      ),
    ).not.toThrow();
  });

  it("should reject unauthorized remote host fail-closed", () => {
    expect(() =>
      assertSafeTestDatabaseUrl(
        "postgresql://user:pass@aws-rds-prod.com:5432/abogados_test",
      ),
    ).toThrow(/Host 'aws-rds-prod.com' no autorizado/);
  });

  it("should reject development or production database name fail-closed", () => {
    expect(() =>
      assertSafeTestDatabaseUrl(
        "postgresql://postgres:postgres@localhost:5432/abogados_db",
      ),
    ).toThrow(/Base de datos 'abogados_db' no autorizada/);

    expect(() =>
      assertSafeTestDatabaseUrl(
        "postgresql://postgres:postgres@localhost:5432/abogados_production",
      ),
    ).toThrow(/Base de datos 'abogados_production' no autorizada/);
  });

  it("should reject non-postgresql protocol fail-closed", () => {
    expect(() =>
      assertSafeTestDatabaseUrl(
        "mysql://root:pass@localhost:3306/abogados_test",
      ),
    ).toThrow(/Protocolo 'mysql:' no autorizado/);
  });
});
