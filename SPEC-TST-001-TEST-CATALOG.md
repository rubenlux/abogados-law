# CATÁLOGO DE PRUEBAS DE INFRAESTRUCTURA: SPEC-TST-001 (VERSIÓN DEFINITIVA RECONCILIADA)
## Matriz de Verificación y Procedimientos del Arnés de Testing (Test Harness)

**Expediente:** `SPEC-TST-001-FINAL-RECONCILIATION-001`  
**Referencia:** `SPEC-TST-001` (Versión Definitiva) / `ABOGADOS-LAW-GIT-BASELINE-VERIFICATION-002`  
**Proyecto:** Abogado Virtual (`Abogados_law`)  
**Módulo Destino:** `backend/`  
**Estado:** DOCUMENTO CONSOLIDADO — LISTO PARA APROBACIÓN EXPRESA  
**Modalidad:** READ-ONLY (Sin implementación de archivos de test ni ejecución de pruebas en esta fase)  

---

## 1. PRINCIPIOS Y ALCANCE DEL CATÁLOGO

Este catálogo establece con precisión técnica y verificabilidad las pruebas requeridas para certificar el **arnés de testing (Test Harness)** del backend NestJS.

### Principios Rectores:
1. **Exclusividad del Harness:** Las pruebas validan el runner (`jest`), el transpilador (`ts-jest`), el contenedor de inyección de NestJS (`@nestjs/testing`), el cliente HTTP (`supertest`), los mocks tipados de Prisma, el aislamiento fail-closed de entorno y el control de calidad estática (`eslint`).
2. **Separación Estricta de Fases (OBS-001):** **NO** se incluyen pruebas de vulnerabilidades de negocio, autenticación real, tokens manipulados ni multi-tenancy. Esas pruebas pertenecen a las fases `SPEC-SEC-001` a `SPEC-SEC-007`.
3. **Cero Falsos Positivos:** Se prohíbe `--passWithNoTests`. Una ejecución que no descubra pruebas planificadas produce código de salida `1`.
4. **Clasificación Explícita:** Cada prueba se clasifica formalmente como **OBLIGATORIA**, **INFORMATIVA** o **DIFERIDA**.

---

## 2. MATRIZ CONSOLIDADA DE PRUEBAS DEL HARNESS

| ID | Nombre de la Prueba | Tipo | Nivel | Clasificación | Dependencias | Criterio de Aprobación |
|---|---|---|---|---|---|---|
| **TST-HARNESS-001** | Invocación del Runner Jest | Ejecución CLI | Harness CLI | **OBLIGATORIA** | `jest`, `package.json` | Ejecuta `src/smoke.spec.ts`, código 0, al menos 1 test pasado. |
| **TST-HARNESS-002** | Transpilación TypeScript de Pruebas | Compilación | Transpilador | **OBLIGATORIA** | `ts-jest`, `typescript` | Transpila decoradores e interfaces sin errores TS. |
| **TST-HARNESS-003** | Inmunidad a Falsos Positivos | Determinismo | Control Runner | **OBLIGATORIA** | Node.js / PowerShell | Script aislado verifica que una aserción rota produce exit code 1. |
| **TST-HARNESS-004** | Inyección de Dependencias NestJS | Integración DI | NestJS Core | **OBLIGATORIA** | `@nestjs/testing` | Módulo de testing compila y resuelve provider en memoria. |
| **TST-HARNESS-005** | Mocking Tipado de PrismaService | Mock Unitario | Persistencia Mock | **OBLIGATORIA** | `@prisma/client`, `jest` | Mock fuertemente tipado de modelo `User` sin `as any`. |
| **TST-HARNESS-006** | Aislamiento Fail-Closed de Base de Datos | Seguridad/Env | Setup Hook | **OBLIGATORIA** | `setup-env.ts`, `db-guard.ts` | Bloquea hosts ajenos a localhost y BD ajena a `abogados_test`. |
| **TST-HARNESS-007** | Sonda HTTP Local con Supertest | Integración HTTP | Controlador | **OBLIGATORIA** | `supertest`, Express | Sonda GET responde 200 sin puerto público; cierre limpio. |
| **TST-HARNESS-008** | Composición Completa de AppModule | Composición DI | Módulo Global | **DIFERIDA** | `AppModule`, NestJS | **Diferida por efectos secundarios de schedulers y timers.** |
| **TST-HARNESS-009** | Descubrimiento Exclusivo E2E | Configuración | E2E Runner | **OBLIGATORIA** | `test/jest-e2e.json` | `npm run test:e2e` ejecuta solo `*.e2e-spec.ts`. |
| **TST-HARNESS-010** | Generación de Cobertura LCOV | Métricas | Cobertura | **OBLIGATORIA** | Jest coverage | Directorio `coverage/` creado con LCOV y HTML válidos. |
| **TST-HARNESS-011** | Validación Estática con ESLint | Calidad Código | Tooling | **OBLIGATORIA** | `eslint`, TS parser | `npm run lint` analiza archivo sin error fatal de configuración. |
| **TST-HARNESS-012** | Benchmark de Rendimiento del Arnés | Performance | Informativo | **INFORMATIVA** | Jest timer | Tiempos medidos y reportados (Unit < 5s, E2E < 15s). |

---

## 3. PROCEDIMIENTOS DETALLADOS DE VERIFICACIÓN

---

### TST-HARNESS-001: Invocación del Runner Jest
- **Objetivo:** Asegurar que el comando `npm test` ejecuta Jest, descubre pruebas unitarias en `src/` y retorna exit code 0 cuando las pruebas pasan, rechazando ejecuciones vacías.
- **Tipo:** Ejecución CLI.
- **Nivel:** Harness CLI.
- **Clasificación:** **OBLIGATORIA**.
- **Archivos Involucrados:** `backend/package.json`, `backend/src/smoke.spec.ts`.
- **Precondiciones:**
  - Script `"test": "jest"` configurado en `backend/package.json`.
  - Archivo `src/smoke.spec.ts` creado conteniendo al menos una prueba válida.
  - Prohibido el uso de `--passWithNoTests`.
- **Procedimiento:**
  1. Ejecutar en terminal: `cd backend && npm test`.
  2. Inspeccionar la salida estándar y el código de retorno.
- **Resultado Esperado:** Jest reporta al menos 1 suite aprobada y 1 test aprobado. Código de retorno `0`.
- **Criterio de Aprobación:** Código de salida `0` con al menos 1 aserción ejecutada. Si no hubiera pruebas, el comando debe fallar con código `1`.
- **Dependencias Externas:** Ninguna (Node.js local).
- **Condición de Aislamiento:** Ejecución pura en memoria.
- **Evidencia:** Registro de salida de Jest en consola (`Test Suites: 1 passed, Tests: 1 passed`).

---

### TST-HARNESS-002: Transpilación TypeScript de Pruebas Unitarias
- **Objetivo:** Validar que `ts-jest` transpila código TypeScript moderno con imports e interfaces tipadas respetando la configuración existente del proyecto (`strict: false` en `tsconfig.json`).
- **Tipo:** Compilación y ejecución.
- **Nivel:** Transpilador.
- **Clasificación:** **OBLIGATORIA**.
- **Archivos Involucrados:** `backend/tsconfig.json`, `backend/src/smoke.spec.ts`.
- **Precondiciones:** `ts-jest` 29.4.6 instalado en `node_modules`.
- **Procedimiento:**
  1. En `src/smoke.spec.ts`, declarar una interfaz tipada y una aserción:
     ```typescript
     interface ProbePayload {
       status: 'ok' | 'fail';
       code: number;
     }
     const payload: ProbePayload = { status: 'ok', code: 200 };
     expect(payload.status).toBe('ok');
     ```
  2. Ejecutar `npx jest src/smoke.spec.ts`.
- **Resultado Esperado:** Compilación al vuelo transparente sin warnings de tipos incompatibles ni fallos de sintaxis.
- **Criterio de Aprobación:** Transpilación y ejecución completadas con código `0`.
- **Dependencias Externas:** Ninguna.
- **Condición de Aislamiento:** Ejecución pura en memoria.
- **Evidencia:** Consola de Jest limpia sin errores `TS...`.

---

### TST-HARNESS-003: Inmunidad a Falsos Positivos (Procedimiento Multiplataforma)
- **Objetivo:** Verificar que el arnés detecta fallos de aserción y devuelve código de retorno `1`, utilizando un runner aislado compatible con Windows PowerShell y Linux sin dejar archivos residuales en la suite habitual.
- **Tipo:** Control de Determinismo.
- **Nivel:** Control Runner.
- **Clasificación:** **OBLIGATORIA**.
- **Archivos Involucrados:** `backend/test/helpers/verify-failure.js`.
- **Precondiciones:**
  - El archivo de aserción rota **NO** debe residir permanentemente en el repositorio.
- **Procedimiento:**
  1. Implementar el script `backend/test/helpers/verify-failure.js`:
     ```javascript
     const fs = require('fs');
     const path = require('path');
     const { spawnSync } = require('child_process');

     const tempSpec = path.resolve(__dirname, '../../src/__temp_fail__.spec.ts');
     try {
       fs.writeFileSync(tempSpec, "describe('Fail Probe', () => { it('fails', () => { expect(1).toBe(2); }); });");
       const res = spawnSync('npx', ['jest', 'src/__temp_fail__.spec.ts', '--no-cache'], {
         shell: true,
         stdio: 'pipe',
         cwd: path.resolve(__dirname, '../..')
       });
       if (res.status === 0) {
         console.error('FAIL: Jest retorno 0 ante aserción fallida!');
         process.exit(1);
       }
       console.log('PASS: Jest retorno correctamente codigo no-cero:', res.status);
     } finally {
       if (fs.existsSync(tempSpec)) {
         fs.unlinkSync(tempSpec);
       }
     }
     ```
  2. Ejecutar: `node test/helpers/verify-failure.js`.
- **Resultado Esperado:** El script confirma que Jest aborta con código distinto de cero ante aserción fallida y elimina el archivo temporal en el bloque `finally`.
- **Criterio de Aprobación:** El script imprime `PASS` y finaliza con código 0. El archivo temporal queda eliminado del disco.
- **Dependencias Externas:** Node.js runtime.
- **Condición de Aislamiento:** El archivo temporal se crea y elimina dentro del mismo proceso; no contamina Git.
- **Evidencia:** Salida de consola confirmando código no-cero y ausencia de `src/__temp_fail__.spec.ts` tras la ejecución.

---

### TST-HARNESS-004: Inyección de Dependencias NestJS en Módulo Aislado
- **Objetivo:** Validar que `@nestjs/testing` compila módulos de prueba en memoria e inyecta providers de forma tipada sin requerir el arranque de la aplicación completa.
- **Tipo:** Integración de Framework.
- **Nivel:** NestJS Core DI.
- **Clasificación:** **OBLIGATORIA**.
- **Archivos Involucrados:** `backend/test/harness/nestjs-di.spec.ts`.
- **Precondiciones:** `@nestjs/testing` 10.4.22 disponible.
- **Procedimiento:**
  1. Definir un servicio simple `@Injectable() class ProbeService { ping() { return 'pong'; } }`.
  2. Crear módulo de prueba con `Test.createTestingModule({ providers: [ProbeService] }).compile()`.
  3. Obtener el servicio con `moduleRef.get<ProbeService>(ProbeService)`.
  4. Ejecutar aserción: `expect(service.ping()).toBe('pong')`.
- **Resultado Esperado:** El contenedor resuelve la instancia y la aserción pasa en memoria.
- **Criterio de Aprobación:** Suite ejecutada con código `0` en menos de 500 ms.
- **Dependencias Externas:** Ninguna.
- **Condición de Aislamiento:** Estrictamente en memoria.
- **Evidencia:** Reporte de Jest aprobando `test/harness/nestjs-di.spec.ts`.

---

### TST-HARNESS-005: Mocking Tipado de PrismaService (Sin `as any`)
- **Objetivo:** Demostrar la capacidad de simular consultas de Prisma de forma 100% tipada, utilizando el modelo real `User` del esquema Prisma existente y eliminando cualquier uso de `as any`.
- **Tipo:** Mock Unitario.
- **Nivel:** Capa de Persistencia Simulada.
- **Clasificación:** **OBLIGATORIA**.
- **Archivos Involucrados:** `backend/test/mocks/prisma.mock.ts`, `backend/test/fixtures/user.fixture.ts`, `backend/test/harness/prisma-mock.spec.ts`.
- **Precondiciones:**
  - Tipos generados en `node_modules/.prisma/client`.
  - Fixture conforme al modelo `User` real (`id`, `email`, `passwordHash`, `fullName`, `role: UserRole.ASSOCIATE`, `organizationId`, etc.).
- **Procedimiento:**
  1. Instanciar `const prismaMock = createPrismaMock()`.
  2. Configurar retorno tipado:
     ```typescript
     const fixtureUser: User = createFixtureUser();
     prismaMock.user.findUnique.mockResolvedValue(fixtureUser);
     ```
  3. Invocar `const result = await prismaMock.user.findUnique({ where: { id: fixtureUser.id } })`.
  4. Verificar que `result.email` y `result.role` conservan el tipado estricto.
- **Resultado Esperado:** La llamada resuelve la entidad tipada y Jest verifica la llamada sin emitir errores de TypeScript ni usar `as any`.
- **Criterio de Aprobación:** Cero errores de compilador TypeScript y aserción aprobada.
- **Dependencias Externas:** `@prisma/client`.
- **Condición de Aislamiento:** Cero conexiones de red a PostgreSQL.
- **Evidencia:** Salida de Jest aprobando la suite.

---

### TST-HARNESS-006: Aislamiento Fail-Closed de Base de Datos y Variables de Entorno
- **Objetivo:** Comprobar que el guard estructural bloquea de forma fail-closed cualquier URL que no apunte estrictamente a `abogados_test` en `localhost` o `127.0.0.1`, y que se prohíbe el fallback hacia `.env`.
- **Tipo:** Seguridad y Aislamiento de Entorno.
- **Nivel:** Setup Hook / Configuración.
- **Clasificación:** **OBLIGATORIA**.
- **Archivos Involucrados:** `backend/test/setup-env.ts`, `backend/test/helpers/db-guard.ts`, `backend/test/harness/env-isolation.spec.ts`.
- **Precondiciones:**
  - `setupFiles: ["<rootDir>/../test/setup-env.ts"]` configurado en Jest.
  - Helper `assertSafeTestDatabaseUrl()` implementado.
- **Procedimiento:**
  1. Comprobar que `process.env.NODE_ENV === 'test'`.
  2. Ejecutar prueba unitaria del guard con URLs no autorizadas:
     - Host remoto: `postgresql://usr:pwd@cloud.db.com:5432/abogados_test` -> Debe lanzar excepción.
     - BD de desarrollo: `postgresql://postgres:postgres@localhost:5432/abogados_db` -> Debe lanzar excepción.
     - Host Docker no allowlisteado: `postgresql://postgres:postgres@test-postgres:5432/abogados_test` -> Debe lanzar excepción.
     - URL autorizada: `postgresql://postgres:postgres@localhost:5432/abogados_test` -> Pasa la validación.
- **Resultado Esperado:** El guard rechaza cualquier configuración ajena a la allowlist unificada (`localhost`/`127.0.0.1` + `abogados_test`).
- **Criterio de Aprobación:** Todas las aserciones `toThrow()` aprueban satisfactoriamente.
- **Dependencias Externas:** Ninguna.
- **Condición de Aislamiento:** Protege la base de datos de desarrollo y producción contra conexiones accidentales.
- **Evidencia:** Salida de Jest en `test/harness/env-isolation.spec.ts`.

---

### TST-HARNESS-007: Sonda HTTP Local con Supertest
- **Objetivo:** Verificar que Supertest interactúa correctamente con una aplicación NestJS montada localmente sin puerto fijo ni listener público, y que la aplicación se cierra de forma determinista mediante `app.close()` sin dejar sockets abiertos.
- **Tipo:** Integración HTTP.
- **Nivel:** Controlador / Sonda Express.
- **Clasificación:** **OBLIGATORIA**.
- **Archivos Involucrados:** `backend/test/e2e/http-probe.e2e-spec.ts`.
- **Precondiciones:**
  - `supertest` disponible.
  - Aplicación montada con módulo de sonda aislado (`HarnessProbeModule` con `@Get('ping')` retornando `{ status: 'ok' }`).
  - Prohibido el uso de puertos fijos (`app.listen(3000)`).
  - Prohibidas pruebas de seguridad o autenticación en este test.
- **Procedimiento:**
  1. Compilar módulo de prueba y crear aplicación: `app = moduleRef.createNestApplication(); await app.init();`.
  2. Despachar petición: `const res = await request(app.getHttpServer()).get('/harness-probe/ping');`.
  3. En `afterAll`: `await app.close();`.
- **Resultado Esperado:** Respuesta HTTP con código `200 OK` y cuerpo `{ status: 'ok' }`. Cierre limpio sin *open handles*.
- **Criterio de Aprobación:** Estado `200` verificado y proceso finalizado sin warnings de handles abiertos.
- **Dependencias Externas:** `supertest`, Express.
- **Condición de Aislamiento:** Servidor local efímero; no expone puertos públicos.
- **Evidencia:** Resumen de Jest E2E aprobando la suite en menos de 1 segundo.

---

### TST-HARNESS-008: Composición Completa de AppModule
- **Objetivo:** Verificar el cableado completo de todos los módulos de la aplicación.
- **Tipo:** Integración de Arquitectura Global.
- **Nivel:** Módulo Global.
- **Clasificación:** **DIFERIDA (DEFERRED)**.
- **Justificación Documental del Diferimiento (OBS-002):**
  La inspección exhaustiva del código fuente de `backend/src/app.module.ts` reveló la existencia de múltiples componentes con efectos secundarios activos en runtime:
  1. **Schedulers y Cron Jobs:** `ScheduleModule.forRoot()` inicializa timers en background. Los servicios `AgendaService`, `BackupService` y `ForensicService` tienen métodos decorados con `@Cron()`. En particular, `BackupService` ejecuta comandos `pg_dump`/`mysqldump` mediante `child_process.exec`.
  2. **Rate Limiting:** `ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])` aplica contadores de peticiones globales.
  3. **Persistencia Física:** `PrismaService` implementa `OnModuleDestroy` y abre sockets de base de datos en su ciclo de vida.
  4. **Crawlers:** Módulos que importan Playwright.
  *Decisión Técnica:* Importar el `AppModule` completo en esta fase inicial violaría el aislamiento determinista del arnés de pruebas. **Esta prueba queda expresamente diferida** para una fase posterior de integración arquitectónica, donde se implementará una estrategia dedicada para deshabilitar schedulers y cron jobs en testing.

---

### TST-HARNESS-009: Descubrimiento Exclusivo de Pruebas E2E
- **Objetivo:** Confirmar que `npm run test:e2e` ejecuta exclusivamente suites de integración con extensión `*.e2e-spec.ts`, sin procesar pruebas unitarias de `src/`.
- **Tipo:** Configuración y Descubrimiento.
- **Nivel:** E2E Runner.
- **Clasificación:** **OBLIGATORIA**.
- **Archivos Involucrados:** `backend/test/jest-e2e.json`.
- **Precondiciones:**
  - Script `"test:e2e": "jest --config ./test/jest-e2e.json --runInBand"` en `package.json`.
  - Configuración con `rootDir: "."` y `testRegex: ".e2e-spec.ts$"`.
- **Procedimiento:**
  1. Ejecutar: `cd backend && npm run test:e2e`.
  2. Comprobar la lista de archivos ejecutados por Jest.
- **Resultado Esperado:** Únicamente se ejecutan los archivos en `test/e2e/` (ej. `http-probe.e2e-spec.ts`). Ningún `*.spec.ts` de `src/` es ejecutado.
- **Criterio de Aprobación:** Coincidencia exacta de patrones y código de salida 0.
- **Dependencias Externas:** Jest runner.
- **Condición de Aislamiento:** `--runInBand` para ejecución serial segura.
- **Evidencia:** Consola de Jest listando únicamente suites E2E.

---

### TST-HARNESS-010: Generación de Cobertura LCOV y Mapeo TypeScript
- **Objetivo:** Verificar que `npm run test:cov` genera reportes de cobertura en formato LCOV y HTML, excluyendo adecuadamente archivos de test y boilerplate.
- **Tipo:** Recolección de Métricas.
- **Nivel:** Cobertura.
- **Clasificación:** **OBLIGATORIA**.
- **Archivos Involucrados:** Directorio `backend/coverage/`.
- **Precondiciones:**
  - Script `"test:cov": "jest --coverage"` en `package.json`.
  - Exclusiones configuradas: `!main.ts`, `!**/*.module.ts`, `!**/*.dto.ts`, `!**/*.interface.ts`, `!**/*.spec.ts`.
- **Procedimiento:**
  1. Ejecutar `cd backend && npm run test:cov`.
  2. Verificar la creación física de `coverage/lcov.info` y `coverage/lcov-report/index.html`.
- **Resultado Esperado:** Se imprimen tablas de texto en consola y se generan archivos LCOV legibles por herramientas CI. No se imponen umbrales mínimos bloqueantes en esta fase inicial.
- **Criterio de Aprobación:** Archivos de reporte presentes y válidos en disco.
- **Dependencias Externas:** Jest coverage reporter.
- **Condición de Aislamiento:** El directorio `coverage/` está ignorado por `.gitignore`.
- **Evidencia:** Comprobación de existencia de `backend/coverage/lcov.info`.

---

### TST-HARNESS-011: Validación Estática de Configuración ESLint
- **Objetivo:** Validar que la configuración `.eslintrc.js` restaurada es compatible con ESLint 8.57.1 y TypeScript 5.9.3, analizando código sin errores fatales de configuración ni advertencias de plugins obsoletos.
- **Tipo:** Control de Calidad Estática.
- **Nivel:** Tooling / Linter.
- **Clasificación:** **OBLIGATORIA**.
- **Archivos Involucrados:** `backend/.eslintrc.js`, `backend/src/smoke.spec.ts`.
- **Precondiciones:**
  - `.eslintrc.js` configurado sin `parserOptions.project` incompatible y sin `@typescript-eslint/interface-name-prefix`.
- **Procedimiento:**
  1. Ejecutar: `cd backend && npx eslint src/smoke.spec.ts`.
- **Resultado Esperado:** El linter analiza el archivo sin arrojar error fatal de configuración.
- **Criterio de Aprobación:** Código de salida `0` sobre el archivo de prueba analizado. (Se separa la validación del linter de las advertencias preexistentes del resto del repositorio).
- **Dependencias Externas:** `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`.
- **Condición de Aislamiento:** Análisis estático de solo lectura.
- **Evidencia:** Salida de ESLint procesando el archivo con éxito.

---

### TST-HARNESS-012: Benchmark de Rendimiento del Arnés (Métrica Informativa)
- **Objetivo:** Medir los tiempos de ejecución de las suites para disponer de una línea base objetiva y prevenir regresiones de rendimiento futuras.
- **Tipo:** Medición de Rendimiento.
- **Nivel:** Informativo.
- **Clasificación:** **INFORMATIVA (NO BLOQUEANTE)**.
- **Procedimiento:**
  1. Ejecutar `npm test` y registrar el tiempo reportado por Jest.
  2. Ejecutar `npm run test:e2e` y registrar el tiempo.
  3. Ejecutar `npm run test:cov` y registrar el tiempo.
- **Valores de Referencia Orientativos:**
  - Pruebas Unitarias: `< 5 segundos`.
  - Pruebas de Integración y HTTP: `< 15 segundos`.
  - Suite con Cobertura: `< 30 segundos`.
- **Criterio de Aprobación:** Los tiempos se registran con fines documentales; no constituyen condición de bloqueo para la aceptación del arnés.
- **Dependencias Externas:** Jest timer.
- **Condición de Aislamiento:** Ninguno.
- **Evidencia:** Tiempos reportados en el informe de ejecución.

---

## 4. CONDICIÓN DE CIERRE DOCUMENTAL

> [!IMPORTANT]
> **ESTADO DEL CATÁLOGO: CONSOLIDADO Y COMPLETO.**  
> - Se han detallado los 12 procedimientos de la matriz sin dejar identificadores pendientes.  
> - Se ha documentado exhaustivamente el diferimiento de `TST-HARNESS-008` (AppModule) con base en la auditoría de efectos secundarios de runtime.  
> - Se han erradicado todas las pruebas de seguridad que corresponden a fases SEC (`SPEC-SEC-001` a `SPEC-SEC-007`).  
> - **NO** se han implementado archivos de prueba ni modificado configuraciones en el repositorio.
