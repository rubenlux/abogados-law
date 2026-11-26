/**
 * Validador Estructural Fail-Closed de Base de Datos para Pruebas.
 * Especificación: SPEC-TST-001 (OBS-003)
 *
 * Exige estrictamente:
 * - Protocolo: postgresql: o postgres:
 * - Host: localhost o 127.0.0.1
 * - Base de datos: abogados_test
 *
 * Rechaza cualquier host remoto, host Docker ajeno, base de desarrollo o producción.
 */
export function assertSafeTestDatabaseUrl(url: string | undefined): void {
  if (!url || typeof url !== "string" || url.trim() === "") {
    throw new Error(
      "FATAL [DB-GUARD]: DATABASE_URL no está definida en el entorno de pruebas.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (err) {
    throw new Error(
      `FATAL [DB-GUARD]: DATABASE_URL tiene un formato no válido: ${(err as Error).message}`,
    );
  }

  // 1. Validación de Protocolo
  const allowedProtocols = ["postgresql:", "postgres:"];
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new Error(
      `FATAL [DB-GUARD]: Protocolo '${parsed.protocol}' no autorizado. Debe ser 'postgresql:' o 'postgres:'.`,
    );
  }

  // 2. Validación de Host (Strict Allowlist)
  const allowedHosts = ["localhost", "127.0.0.1"];
  if (!allowedHosts.includes(parsed.hostname.toLowerCase())) {
    throw new Error(
      `FATAL [DB-GUARD]: Host '${parsed.hostname}' no autorizado para pruebas. ` +
        `Estrictamente restringido a: ${allowedHosts.join(", ")}.`,
    );
  }

  // 3. Validación de Base de Datos (Strict Allowlist)
  const rawDbName = parsed.pathname.replace(/^\//, "");
  const allowedDatabases = ["abogados_test"];

  if (!allowedDatabases.includes(rawDbName)) {
    throw new Error(
      `FATAL [DB-GUARD]: Base de datos '${rawDbName}' no autorizada para pruebas. ` +
        `Estrictamente restringida a: ${allowedDatabases.join(", ")}. ` +
        `Se rechaza explícitamente cualquier base de desarrollo o producción.`,
    );
  }
}
