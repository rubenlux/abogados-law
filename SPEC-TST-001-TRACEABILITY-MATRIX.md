# MATRIZ DE TRAZABILIDAD: SPEC-TST-001
## Correspondencia Integral entre Requisitos, Pruebas y Criterios de Aceptación

**Expediente:** `SPEC-TST-001-FINAL-RECONCILIATION-001`  
**Referencia:** `SPEC-TST-001` (Versión Definitiva) / `SPEC-TST-001-TEST-CATALOG`  
**Proyecto:** Abogado Virtual (`Abogados_law`)  
**Módulo Destino:** `backend/`  
**Estado:** DOCUMENTO CONSOLIDADO — LISTO PARA APROBACIÓN EXPRESA  
**Modalidad:** READ-ONLY (Sin implementación de archivos en esta fase)  

---

## 1. PRINCIPIO DE TRAZABILIDAD BIDIRECCIONAL

Esta matriz garantiza que:
1. **Todo requisito** estipulado en la especificación técnica `SPEC-TST-001` cuenta con al menos una prueba asociada en `SPEC-TST-001-TEST-CATALOG` (o una justificación formal y documentada de diferimiento).
2. **Toda prueba** del catálogo responde a un requisito técnico específico del arnés de testing.
3. Se identifican de forma unívoca los archivos que se crearán o modificarán en la futura fase de implementación autorizada.
4. Se separa con total claridad lo perteneciente a `SPEC-TST-001` de los requisitos de seguridad diferidos a `SPEC-SEC-001` a `SPEC-SEC-007`.

---

## 2. MATRIZ DE TRAZABILIDAD GENERAL

| ID Requisito SPEC-TST-001 | Descripción del Requisito | ID Prueba Catálogo | Archivo a Crear/Modificar | Criterio de Aceptación | Evidencia Esperada | Estado Documental |
|---|---|---|---|---|---|---|
| **REQ-TST-01** | Invocación de pruebas unitarias mediante script estándar npm | `TST-HARNESS-001` | `backend/package.json`<br>`backend/src/smoke.spec.ts` | `npm test` ejecuta Jest, descubre `smoke.spec.ts` y finaliza con código 0 | Consola de Jest: al menos 1 suite y 1 test pasados | **CONSOLIDADO (OBLIGATORIA)** |
| **REQ-TST-02** | Transpilación al vuelo de TypeScript en pruebas | `TST-HARNESS-002` | `backend/tsconfig.json`<br>`backend/src/smoke.spec.ts` | `ts-jest` compila decoradores e interfaces tipadas sin errores | Cero errores de sintaxis o tipos emitidos por `ts-jest` | **CONSOLIDADO (OBLIGATORIA)** |
| **REQ-TST-03** | Inmunidad a falsos positivos ante fallos de aserción | `TST-HARNESS-003` | `backend/test/helpers/verify-failure.js` | El runner detecta aserción rota (`expect(1).toBe(2)`) y devuelve exit code 1 | Proceso aborta con error 1; archivo temporal eliminado en finally | **CONSOLIDADO (OBLIGATORIA)** |
| **REQ-TST-04** | Inyección de dependencias en módulo de pruebas NestJS | `TST-HARNESS-004` | `backend/test/harness/nestjs-di.spec.ts` | `Test.createTestingModule` compila en memoria y resuelve providers tipados | Instancia resuelta mediante `moduleRef.get<T>()` en memoria | **CONSOLIDADO (OBLIGATORIA)** |
| **REQ-TST-05** | Simulación tipada de PrismaService sin `as any` | `TST-HARNESS-005` | `backend/test/mocks/prisma.mock.ts`<br>`backend/test/fixtures/user.fixture.ts`<br>`backend/test/harness/prisma-mock.spec.ts` | Mock tipado responde a consultas CRUD conforme al modelo `User` real de Prisma | `expect(result.role).toBe(UserRole.ASSOCIATE)` aprobado sin `as any` | **CONSOLIDADO (OBLIGATORIA)** |
| **REQ-TST-06** | Aislamiento fail-closed de variables y base de datos | `TST-HARNESS-006` | `backend/test/setup-env.ts`<br>`backend/test/helpers/db-guard.ts`<br>`backend/test/harness/env-isolation.spec.ts` | Carga `.env.test` sin fallback a `.env`. Bloquea hosts != localhost y BD != `abogados_test` | Excepciones arrojadas ante URLs no autorizadas; variables de test activas | **CONSOLIDADO (OBLIGATORIA)** |
| **REQ-TST-07** | Integración HTTP local con Supertest y cierre limpio | `TST-HARNESS-007` | `backend/test/e2e/http-probe.e2e-spec.ts` | Servidor NestJS local efímero responde GET con 200; `app.close()` sin open handles | Respuesta HTTP validada y salida limpia de Jest sin warnings | **CONSOLIDADO (OBLIGATORIA)** |
| **REQ-TST-08** | Composición controlada de módulos NestJS | `TST-HARNESS-008` | N/A (Diferida) | Verificación de cableado modular global de la aplicación | **DIFERIDA: Justificado por efectos secundarios de schedulers/cron en runtime** | **DIFERIDA (JUSTIFICADA)** |
| **REQ-TST-09** | Configuración y descubrimiento exclusivo de pruebas E2E | `TST-HARNESS-009` | `backend/test/jest-e2e.json` | `npm run test:e2e` ejecuta exclusivamente suites `*.e2e-spec.ts` en `test/` | Resumen de Jest listando únicamente suites E2E; unitarios de `src/` excluidos | **CONSOLIDADO (OBLIGATORIA)** |
| **REQ-TST-10** | Recolección y reporte de cobertura de código (LCOV) | `TST-HARNESS-010` | `backend/package.json`<br>`backend/coverage/` | `npm run test:cov` genera reportes LCOV y HTML excluyendo boilerplate | Existencia física de `coverage/lcov.info` e informe HTML válido | **CONSOLIDADO (OBLIGATORIA)** |
| **REQ-TST-11** | Control de calidad estática mediante ESLint restaurado | `TST-HARNESS-011` | `backend/.eslintrc.js` | `npm run lint` procesa archivos TS sin error fatal de configuración | Salida de ESLint exitosa sobre archivo de test sin reglas obsoletas | **CONSOLIDADO (OBLIGATORIA)** |
| **REQ-TST-12** | Monitoreo de tiempos de ejecución del arnés | `TST-HARNESS-012` | N/A (Métrica Informativa) | Tiempos medidos y reportados (Unit < 5s, E2E < 15s, Cobertura < 30s) | Tiempos registrados en consola para control de regresiones de performance | **CONSOLIDADO (INFORMATIVA)** |

---

## 3. TRAZABILIDAD DE REQUISITOS DE AISLAMIENTO Y SEGURIDAD

| Requisito de Seguridad del Testing | Mecanismo de Implementación | Prueba que lo Valida | Impacto en Producción |
|---|---|---|---|
| **Prohibición de Fallback a `.env`** | `setup-env.ts` configurado en `setupFiles`. Si falta `.env.test`, arroja excepción fatal. | `TST-HARNESS-006` | Garantiza que nunca se lean credenciales ni variables de desarrollo en tests. |
| **Protección Fail-Closed de Base de Datos** | `db-guard.ts` analiza protocolo (`postgresql:`), host (`localhost`/`127.0.0.1`) y nombre (`abogados_test`). | `TST-HARNESS-006` | Previene de forma matemática la mutación o truncado accidental de bases de datos de producción o desarrollo. |
| **Aislamiento de Pruebas Unitarias** | Pruebas unitarias en `src/` utilizan `createPrismaMock()`; cero conexiones TCP. | `TST-HARNESS-005` | Ejecución ultrarrápida sin depender de que PostgreSQL esté corriendo. |
| **Política de PostgreSQL Ausente** | Local: Omitido explícito con advertencia (`describe.skip`). CI: Fallo bloqueante inmediato si Postgres está offline. | `TST-HARNESS-006` | Previene falsos positivos en pipelines CI y permite desarrollo local ágil. |
| **Cierre Limpio de Recursos** | Invocación de `await app.close()` en `afterAll` de pruebas Supertest; detección con `--detectOpenHandles`. | `TST-HARNESS-007` | Elimina la necesidad de `--forceExit`, detectando sockets o timers desatendidos. |

---

## 4. DELIMITACIÓN DE TRAZABILIDAD HACIA ESPECIFICACIONES FUTURAS (FASES SEC)

Para asegurar la separación estricta exigida en `OBS-001`, se documenta formalmente la asignación de responsabilidades de seguridad a sus especificaciones correspondientes:

| Área Funcional de Seguridad | ¿Aplica a SPEC-TST-001? | Asignación Definitiva | Justificación Técnica |
|---|---|---|---|
| **Verificación de contraseñas y timing attacks** | **NO** | `SPEC-SEC-001` (Autenticación) | Requiere la remediación previa de `auth.service.ts` (SEC-001). |
| **Validación de tokens JWT expirados/manipulados** | **NO** | `SPEC-SEC-001` / `SPEC-SEC-005` | Requiere implementación de guards y rotación de secretos. |
| **Aislamiento Multi-Tenant y respuestas 404** | **NO** | `SPEC-SEC-003` (Multi-Tenancy) | Requiere la inyección del contexto de tenant en servicios. |
| **Protección de controladores sin guard** | **NO** | `SPEC-SEC-004` (Guards Globales) | Requiere la auditoría y aplicación de guards en controllers. |
| **Erradicación de fallbacks criptográficos** | **NO** | `SPEC-SEC-005` (Secretos) | Requiere la validación estricta al arranque de NestJS. |
| **Rate limiting de endpoints sensibles** | **NO** | `SPEC-SEC-007` (Throttling) | Requiere ajuste de reglas de `ThrottlerGuard`. |
| **Arnés de pruebas para ejecutar lo anterior** | **SÍ** | `SPEC-TST-001` (Infraestructura) | Base sobre la cual se construirán todas las pruebas SEC. |

---

## 5. CONCLUSIÓN DE TRAZABILIDAD

- **100% de los requisitos** de la infraestructura de pruebas `SPEC-TST-001` están cubiertos por las pruebas `TST-HARNESS-001` a `TST-HARNESS-012`.
- **0 pruebas de seguridad de negocio** interfieren con el alcance de la infraestructura de pruebas.
- Se cuenta con una asignación inequívoca entre requisitos, pruebas, archivos de implementación y evidencias esperadas.

