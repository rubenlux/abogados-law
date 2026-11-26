/**
 * Setup Hook Global de Jest para Carga de Entorno y Protección de BD.
 * Especificación: SPEC-TST-001 (OBS-003, OBS-004, OBS-005)
 *
 * Se ejecuta en `setupFiles` ANTES de que cualquier módulo NestJS o archivo
 * de prueba sea importado o evaluado en memoria.
 */
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";
import { assertSafeTestDatabaseUrl } from "./helpers/db-guard";

// 1. Forzar entorno de test
process.env.NODE_ENV = "test";

// 2. Carga explícita de .env.test (Prohibición de fallback a .env)
const envTestPath = path.resolve(__dirname, "../.env.test");

if (!fs.existsSync(envTestPath)) {
  throw new Error(
    `FATAL [SETUP-ENV]: Archivo de entorno de prueba no encontrado en: ${envTestPath}. ` +
      `Copie '.env.test.example' a '.env.test' antes de ejecutar las pruebas. ` +
      `Se prohíbe terminantemente el fallback hacia '.env' de desarrollo/producción.`,
  );
}

// Cargar variables de test sobrescribiendo cualquier variable previa
dotenv.config({ path: envTestPath, override: true });

// Bloquear fugas desde backend/.env (cargado automáticamente por PrismaClient para vars ausentes)
if (process.env.APP_ORIGIN === undefined) {
  process.env.APP_ORIGIN = "http://localhost:3000";
}
if (process.env.CORS_ALLOWED_ORIGINS === undefined) {
  process.env.CORS_ALLOWED_ORIGINS = "";
}
if (process.env.LOCAL_DEMO_AUTH_ENABLED === undefined) {
  process.env.LOCAL_DEMO_AUTH_ENABLED = "false";
}

// 3. Validación Fail-Closed Inmediata de DATABASE_URL
assertSafeTestDatabaseUrl(process.env.DATABASE_URL);
