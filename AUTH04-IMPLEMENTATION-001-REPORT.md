# AUTH04-IMPLEMENTATION-001-REPORT

**Expediente:** `AUTH04-IMPLEMENTATION-001`  
**Proyecto:** Abogados-Law (`C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law`)  
**Rama:** `master` | **HEAD intacto:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` (cero commits, cero pushes)  
**Especificación Normativa:** `SPEC-AUTH-004 v0.2.0 — APPROVED` (`AUTH04-FORMAL-APPROVAL-001`)  
**Metodología:** TDS Test-First (RED → GREEN sobre PostgreSQL 18 real bajo `abogados_app_user` `NOBYPASSRLS`)  
**Fecha:** 24/11/2026  
**Estado Final:** **IMPLEMENTADO Y VERIFICADO EN `abogados_test` — LISTO PARA REVISIÓN Y CIERRE DE AUTH-04**

---

## 1. Resumen Ejecutivo

Se ejecutó la implementación controlada de **AUTH-04 (Autorización Efectiva y Aislamiento Multi-Organización de Datos Jurídicos)** cumpliendo estrictamente las seis decisiones formalmente aprobadas (`DEC-04-01` a `DEC-04-06`) y el catálogo completo de pruebas `TST-A04-001` a `TST-A04-033` más la regresión total de AUTH-01/02/03 y el harness.

- **Doble barrera activa:** Capa 1 en aplicación (`ActiveOrgContextGuard`, `OrgPermissionGuard`, `PlatformBlockedGuard`, `ScopedPrismaService`, proyecciones explícitas por rol §8.2) + Capa 2 en PostgreSQL 18 real (`ENABLE` + `FORCE ROW LEVEL SECURITY` en las 17 tablas tenant/híbridas/puente bajo el rol `abogados_app_user` con `NOSUPERUSER` y `NOBYPASSRLS`).
- **Resultados de verificación:** **12/12 suites**, **139/139 pruebas PASS** (**0 fallos**, **0 skips**):
  - AUTH-04: **57/57 PASS** (24 pruebas unitarias/contención + 33 pruebas de integración real en PostgreSQL 18 bajo `abogados_app_user`).
  - Regresión obligatoria: **82/82 PASS** (AUTH-01: 14, AUTH-02: 41, AUTH-03: 17, Harness: 10).
- **Calidad estática y build:** ESLint (`0` errores en todos los archivos implementados/modificados), `npx tsc --noEmit` (`0` errores), `npm run build` (`nest build` exitoso), `git diff --check` limpio en archivos AUTH-04.
- **Seguridad operativa:** Cero cambios sobre bases de producción, cero `prisma db push`, cero contraseñas hardcodeadas en archivos versionados, cero commits/pushes.

---

## 2. Verificación del Baseline Inicial

- **Git:** Rama `master`, HEAD `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` (preservado sin nuevos commits ni staging destructivo).
- **PostgreSQL 18.4 (`localhost:5432`):** Servicio `postgresql-x64-18` operativo sobre base aislada `abogados_test`.
- **Nota ambiental `pgvector`:** Como se documentó en `SPEC-AUTH-004` §12, PostgreSQL 18 local en Windows no posee el binario `pgvector`. Para ejercitar las 17 tablas con RLS real en `abogados_test` sin alterar ninguna migración histórica versionada en Git, se inicializaron únicamente en `abogados_test` las 12 tablas históricas no-vectoriales de `20260123024057` / `20260124155621` (omitiendo las columnas `vector(1536)`), preservando intactas todas las migraciones históricas del repositorio.

---

## 3. Evidencia TDS — Fase RED (Pre-Implementación)

Antes de crear `backend/src/authz/`, las migraciones AUTH-04 o endurecer controladores, se escribieron ambas suites cubriendo `TST-A04-001` a `TST-A04-033`:

- `backend/test/auth04/auth04-primitives-and-containment.spec.ts`
- `backend/test/integration/auth04-rls-and-isolation.spec.ts`

Ejecución RED (`npx jest test/auth04/auth04-primitives-and-containment.spec.ts test/integration/auth04-rls-and-isolation.spec.ts --verbose`):
- **Resultado:** `Test Suites: 2 failed, 2 total` (código de salida `1`).
- **Causas verificadas:** Ausencia de módulos `src/authz/*` (`ActiveOrgContextGuard`, `OrgPermissionGuard`, `PlatformBlockedGuard`, `ScopedPrismaService`, `permissions.ts`), ausencia de columnas `organizationId` en las 8 entidades tenant (`Documento`, `DocumentVersion`, `EventoAgenda`, `AIChatSession`, `AIChatMessage`, `LegalDraft`, `LegalRiskAnalysis`, `EmployeeMetric`), ausencia de `DocumentsService.processOCR`, retorno `void` en `AgendaService.handleCron` y firma sin `organizationId` en `AnalyticsService.updateEmployeeMetrics`.

---

## 4. Primitivas de Autorización Implementadas (`backend/src/authz/`)

| Archivo | Responsabilidad |
|---|---|
| `backend/src/authz/permissions.ts` | Matriz declarativa exacta `ROLE_PERMISSIONS` (§8.1) para `STAFF`, `ASSISTANT`, `LAWYER`, `ORG_ADMIN`, `ORG_OWNER`; `hasOrgPermissions()`; `FORBIDDEN_RESPONSE_FIELDS`; `buildCanonicalStoragePath()` (§13); proyecciones explícitas `select` por rol (§8.2) para `Expediente`, `Client`, `EventoAgenda`, `Documento`, `DocumentVersion`, `LegalTemplate`, `JudicialAccount`. |
| `backend/src/authz/decorators/require-org-permissions.decorator.ts` | Decorador `@RequireOrgPermissions(...perms)` con clave `ORG_PERMISSIONS_KEY`. |
| `backend/src/authz/guards/active-org-context.guard.ts` | Resuelve `req.orgContext` inmutable (`Object.freeze`) **exclusivamente** desde `UserSession.activeOrganizationId` + revalidación en vivo de `OrganizationMembership (ACTIVE)` y `Organization (ACTIVE)`. Rechaza `NULL` con `403 NO_ACTIVE_ORGANIZATION` y cualquier `organizationId` discrepante en `body`/`query`/`params`/`x-org-id` con `403`. Jamás lee `User.organizationId` ni `User.role`. |
| `backend/src/authz/guards/org-permission.guard.ts` | Fail-Closed: exige `req.orgContext`, declaración explícita `@RequireOrgPermissions(...)` y cumplimiento íntegro de los permisos requeridos para `orgRole`. |
| `backend/src/authz/guards/platform-blocked.guard.ts` | Contención Fail-Closed (`403 PLATFORM_ENDPOINT_CONTAINED`) para endpoints prototipales de plataforma, portal legacy, refresh legacy e ingesta global (`DEC-04-04`, `DEC-04-05`). |
| `backend/src/authz/scoped-prisma.service.ts` | Ejecuta `runInOrgContext(ctx, tx => ...)` abriendo transacción interactiva Prisma y ejecutando como primera sentencia `SELECT set_config('app.current_organization_id', ${orgId}, true)` (`SET LOCAL`). Usa `AsyncLocalStorage` para rechazar cambios anidados de tenant (`403`) y falla cerrado ante `organizationId` vacío (`400`). |
| `backend/src/authz/authz.module.ts` | Módulo `@Global()` registrado en `AppModule` exportando todas las primitivas AUTH-04. |

---

## 5. Esquema Prisma, Migraciones Expand/Contract y Backfill Verificable

1. **`backend/prisma/schema.prisma` (Fase A — Expand):**
   - Columnas `organizationId String?`, relaciones a `Organization` e índices `@@index([organizationId])` agregados en `Documento`, `DocumentVersion`, `EventoAgenda`, `AIChatSession`, `AIChatMessage`, `LegalDraft`, `LegalRiskAnalysis` y `EmployeeMetric`.
   - Relaciones a `Organization` agregadas en `AIInteraction` y `EventLog`, más colecciones inversas en `Organization`.
   - `npx prisma validate` y `npx prisma generate` ejecutados con éxito.
2. **Migración A (`backend/prisma/migrations/20261124020000_auth04_phase_a_expand_organization_id_and_backfill/migration.sql`):**
   - Expande columnas nullable, crea índices y ejecuta backfill determinista exclusivamente mediante relaciones verificables (§16.2): `Documento`, `DocumentVersion`, `EventoAgenda`, `LegalRiskAnalysis` desde `Expediente`; `AIChatSession` y `LegalDraft` desde `Expediente` o evidencia unívoca en `AuditLog`/`EventLog`; `AIChatMessage` desde `AIChatSession` verificada.
   - **Cero** uso de `User.organizationId`/`User.role`, **cero** eliminaciones, **cero** asignaciones arbitrarias. `EmployeeMetric` históricos permanecen `NULL`. FK condicional en `AIInteraction` y `EventLog` solo si existen `0` huérfanos.
3. **Migración B (`backend/prisma/migrations/20261124030000_auth04_phase_b_enable_rls_and_policies/migration.sql`):**
   - Aplica `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` y políticas Fail-Closed sobre las **17 tablas** requeridas:
     - **Categoría A (14 tablas):** `Expediente`, `Client`, `Documento`, `DocumentVersion`, `EventoAgenda`, `LegalTemplate`, `JudicialAccount`, `TenantUsage`, `AIInteraction`, `AIChatSession`, `AIChatMessage`, `LegalDraft`, `LegalRiskAnalysis`, `EmployeeMetric` (`SELECT`/`INSERT`/`UPDATE`/`DELETE`).
     - **Categoría B (2 tablas append-only, `DEC-04-06`):** `AuditLog`, `EventLog` (`SELECT`/`INSERT` exigiendo `"organizationId" IS NOT NULL` igual al GUC activo; `UPDATE`/`DELETE` `USING (false)`; eventos `NULL` de plataforma completamente invisibles para tenants).
     - **Categoría D (1 tabla puente M:N):** `_ExpedienteToUser` (`SELECT` y `DELETE` validando `Expediente.organizationId`; `INSERT` con doble `EXISTS` verificando `Expediente.organizationId` Y `OrganizationMembership.status = 'ACTIVE'::"MembershipStatus"`; `UPDATE` denegado).
4. **Reporte Pre-Flight (`backend/prisma/scripts/auth04-preflight-audit.sql`) ejecutado sobre `abogados_test`:**
   - `0` filas nulas y `0` huérfanos en las 10 verificaciones (`Documento`, `DocumentVersion`, `EventoAgenda`, `LegalRiskAnalysis`, `AIChatSession`, `AIChatMessage`, `LegalDraft`, `EmployeeMetric`, `AIInteraction_orphans`, `EventLog_orphans`).
   - La Fase B (`NOT NULL` contract / Migración C) queda correctamente diferida conforme `DEC-04-03`.

---

## 6. Provisión del Rol Runtime `abogados_app_user` y Separación de Credenciales

- **Script idempotente parametrizado:** `backend/prisma/scripts/provision-rls-roles.sql` (sin contraseñas literales en Git; recibe `-v app_password=...` y `-v backup_password=...` sin imprimir contraseñas en `stdout` mediante `\gset` y limpieza inmediata del GUC temporal).
- **Atributos verificados en PostgreSQL 18 (`abogados_test`):**
  - `current_user = 'abogados_app_user'`
  - `rolsuper = false`, `rolbypassrls = false`, `rolcreatedb = false`, `rolcreaterole = false`, `rolinherit = false`, `rolreplication = false`
  - Propietario de `0` tablas en `public`; sin `CREATE` sobre `public`; sin `TRUNCATE`; sin acceso a `_prisma_migrations`.
  - Privilegios exactos de §10.4: Cat A (`SELECT/INSERT/UPDATE/DELETE`), Cat D `_ExpedienteToUser` (`SELECT/INSERT/DELETE`), Cat B `AuditLog`/`EventLog` (`SELECT/INSERT` únicamente), Cat C (`SELECT/INSERT/UPDATE` + `DELETE` estrictamente en `OidcTransaction` y `UserSession`), Cat E globales (`SELECT` únicamente).
- **Separación de perfiles de entorno:** Documentada en `backend/.env.example` y `backend/.env.test.example` (`DATABASE_URL` / `APP_RUNTIME_DATABASE_URL`, `MIGRATION_DATABASE_URL`, `BACKUP_DATABASE_URL`), preservando `DATABASE_URL` en `backend/.env.test` para compatibilidad estricta con `test/harness/env-isolation.spec.ts`. `BackupService` actualizado para consumir exclusivamente `BACKUP_DATABASE_URL`.

---

## 7. Módulos, Endpoints, Jobs y Contención Fail-Closed

| Dominio / Módulo | Archivos Modificados | Cambios Aplicados |
|---|---|---|
| **Expedientes** | `expedientes.module.ts`, `expedientes.controller.ts`, `expedientes.service.ts`, `create-expediente.dto.ts` | Guards BFF + `ActiveOrgContextGuard` + `CsrfGuard` + `OrgPermissionGuard`; eliminado `organizationId` del DTO y fallback `organization.findFirst()`; `ScopedPrismaService` + `EXPEDIENTE_SELECT_BY_ROLE`; método `assignUser()` validando pertenencia del expediente y membresía `ACTIVE` antes de Prisma M:N `connect`. |
| **Documentos y OCR** | `documents.controller.ts`, `documents.service.ts` | Rechazo `400` de `body.path`/`storagePath`; generación canónica `orgs/{orgId}/expedientes/{expId}/documents/{docId}/v{n}/{uuid}`; `storagePath` nunca retornado; `compare/:v1/:v2` y `legal-hold` scoped (`404` anti-IDOR); `processOCR(orgId, versionId)` bajo `ScopedPrismaService` + `triggerOCR` con `.unref()`. |
| **Agenda y Cron** | `agenda.module.ts`, `agenda.controller.ts`, `agenda.service.ts` | Eliminado `user.organizationId` legacy; validación de `expedienteId` en org activa (`404`); `EVENTO_AGENDA_SELECT_BY_ROLE`; `handleCron()` itera organizaciones `ACTIVE` aislando cada consulta en `ScopedPrismaService.runInOrgContext`. |
| **Plantillas** | `templates.module.ts`, `templates.controller.ts`, `templates.service.ts` | Eliminados `"default-org-id"` y `body.organizationId`; `LEGAL_TEMPLATE_SELECT_BY_ROLE`; anti-IDOR `404` en `generate`; reemplazado `@ts-ignore` por chequeo seguro `Array.isArray`. |
| **Motor Judicial** | `judicial-engine.module.ts`, `judicial.controller.ts`, `judicial-sync.service.ts` | `POST /judicial/sync/:expedienteId` exige `judicial:sync`, valida `expedienteId` en org activa (`404`) y propaga `organizationId` a `EventoAgenda`; `POST /judicial/sync-system` bloqueado con `PlatformBlockedGuard` (`403`). |
| **IA (Chat, Drafting, Risk, Conocimiento)** | `ia.module.ts`, `ai-chat.*`, `chat-context.service.ts`, `drafting.*`, `legal-risk.*`, `ia.controller.ts`, `legal.controller.ts`, `jurisprudence.controller.ts` | Todos los endpoints de trabajo IA exigen `ai:use`, validan pertenencia de `expedienteId` (`404`, eliminado demo leak en `LegalRiskService`), fijan `userId` y `organizationId` desde `req.orgContext` (ignorando `body.userId`), y operan en modo offline seguro cuando `NODE_ENV=test` / `sk-test-*`. Lecturas globales exigen `knowledge:read`; escrituras/ingestas globales (`/ia/ingest`, `/legal/ingest*`, `/legal/version/*`, `/jurisprudence/import`, `/jurisprudence/ingest`) contenidas Fail-Closed (`PlatformBlockedGuard`). |
| **Admin y Uso/Cuotas** | `admin-master.controller.ts`, `admin-api.controller.ts`, `usage-control.service.ts` | `admin/*` y `admin-api/*` bloqueados Fail-Closed (`PlatformBlockedGuard`, `DEC-04-04`). `UsageControlService` (`TenantUsage` + `AIInteraction`) scoped bajo `ScopedPrismaService`. |
| **Analytics y Pixel** | `analytics.module.ts`, `analytics.controller.ts`, `analytics.service.ts`, `pixel.guard.ts` | `GET /events/logs` bloqueado Fail-Closed; `POST /events/collect` exige BFF + `ActiveOrgContextGuard` + `CsrfGuard` + `PixelGuard` usando exclusivamente `req.orgContext.organizationId`; `PixelGuard` sin secreto fallback inseguro y con comparación en tiempo constante (`timingSafeEqual`); `updateEmployeeMetrics()` scoped con `organizationId` bajo `ScopedPrismaService`. |
| **Portal Clientes Legacy** | `client-portal.controller.ts` | Contenido Fail-Closed con `PlatformBlockedGuard` (`DEC-04-04`) sin eliminar módulo ni datos. |
| **Auth / BFF / OrgAudit** | `auth.controller.ts`, `bff.controller.ts`, `org-audit.service.ts` | `POST /auth/refresh` legacy contenido Fail-Closed (`DEC-04-05`); `GET /api/auth/session` enriquecido con `activeOrganizationId`; `OrgAuditService` configura `set_config('app.current_organization_id', orgId, true)` para operar nativamente bajo `abogados_app_user` sin afectar pruebas unitarias de AUTH-03. |

---

## 8. Matriz de Resultados TDS (Fase GREEN — 33/33 Casos + Regresión 82/82)

| ID | Alcance Verificado | Entorno | Resultado |
|---|---|---|---|
| `TST-A04-001` | Listado scoped (`Expediente`, `Client`, `EventoAgenda`, `LegalTemplate`) | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-002` | Anti-IDOR `GET` por UUID ajeno → `404` | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-003` | Anti-IDOR `PATCH`/`POST`/`DELETE` ajeno → `404`, filas intactas | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-004` | Creación indirecta sobre `expedienteId` de Org B → `404`, `0` filas | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-005` | `GET /documents/compare/:v1/:v2` cross-org → `404` | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-006` | Rechazo `body.path` (`400`), clave `orgs/{orgA}/...`, `storagePath` oculto | Unidad + PG 18 Real | **PASS** |
| `TST-A04-007` | Manipulación `organizationId: orgB` en body/query → `400`/`403` | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-008` | Sesión con `activeOrganizationId = NULL` → `403 NO_ACTIVE_ORGANIZATION` | Unidad + PG 18 Real | **PASS** |
| `TST-A04-009` | Mutación legacy `User.role=ADMIN`, `User.organizationId=orgB` sin efecto | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-010` | Membresía suspendida mid-session bloquea inmediatamente (`403`) | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-011` | Organización `SUSPENDED` bloquea acceso a datos (`403`) | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-012` | Matriz §8.1 + proyecciones de columnas §8.2 (5 roles, 0 secretos/rutas) | Unidad + PG 18 Real | **PASS** |
| `TST-A04-013` | Cambio de org activa A (`ORG_ADMIN`) → B (`STAFF`) con cambio inmediato | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-014` | Contención Fail-Closed en `/admin/*`, `/admin-api/*`, `/events/logs`, `/client-portal/login`, `/auth/refresh`, ingesta global | HTTP + PG 18 Real | **PASS** |
| `TST-A04-015` | `abogados_app_user` (`rolsuper=f`, `rolbypassrls=f`, 0 tablas propias, sin DDL/`TRUNCATE`, sin GUC → `0` filas) | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-016` | RLS `SELECT` en las 16 tablas Cat A + Cat B y ocultamiento de `organizationId IS NULL` | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-017` | RLS `INSERT` cross-org → `42501`; `UPDATE`/`DELETE` cross-org → `0` filas | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-018` | Pool `connection_limit=1` (mismo `pg_backend_pid()`): `COMMIT` Org A → sin GUC (`0` filas) → Org B | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-019` | Pool `connection_limit=1` (mismo `pg_backend_pid()`): `ROLLBACK` Org A → sin GUC (`0` filas) | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-020` | `AuditLog` y `EventLog` append-only (`UPDATE`/`DELETE` → `42501`) | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-021` | Tablas globales Cat E: `SELECT` OK; `INSERT`/`UPDATE`/`DELETE` → `42501` | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-022` | `_ExpedienteToUser` `include` aislado por organización | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-023` | `_ExpedienteToUser` Prisma M:N `connect` válido en Org A | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-024` | `_ExpedienteToUser` Prisma M:N `disconnect` en Org A; Org B → `0` filas | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-025` | Asignación cruzada en `_ExpedienteToUser` rechazada en aplicación (`403`/`404`) Y por RLS `WITH CHECK` (`42501`) | App + PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-026` | `AIInteraction` y `TenantUsage` en `UsageControlService` aislados + RLS | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-027` | `AIChatSession` (general y por expediente) + `AIChatMessage` aislados | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-028` | `LegalDraft` (con/sin expediente) ignora `body.userId`, oculta `NULL` | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-029` | `LegalRiskAnalysis` exige `ai:use`, `404` en expediente ajeno, RLS | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-030` | `JudicialAccount` RLS, `syncCase` propaga `organizationId`, `sync-system` `403` | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-031` | `EventLog` (`/events/collect` scoped, `/events/logs` `403`) y `AuditLog` sin `NULL` | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-032` | OCR asíncrono (`DocumentsService.processOCR`) bajo `ScopedPrismaService` | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-033` | Cron `AgendaService.handleCron` por org `ACTIVE` + `EmployeeMetric` RLS | PG 18 Real (`abogados_app_user`) | **PASS** |
| `TST-A04-REG-01..04` | Regresión completa AUTH-01 (14), AUTH-02 (41), AUTH-03 (17), Harness (10) | Unidad + PG 18 Real | **82/82 PASS** |

---

## 9. Verificaciones Finales de Calidad, Build y Git

- **Jest (`npx jest --runInBand`):** `12 passed, 12 total` | `139 passed, 139 total` (`0` failed, `0` skipped).
- **ESLint:** `0` errores en todos los módulos y suites implementados/modificados por AUTH-04. *(Se conservan sin tocar archivos legacy ajenos al alcance como `src/crawler/run.ts`.)*
- **TypeScript (`npx tsc --noEmit`):** Exit code `0` (`0` errores).
- **Build (`npm run build` / `nest build`):** Exit code `0`.
- **Git (`git diff --check` sobre archivos AUTH-04):** Limpio (`0` errores de whitespace en archivos tocados por AUTH-04); HEAD sin cambios (`1d3dc01`), cero commits y cero pushes.

---

## 10. Exclusiones Confirmadas y Puntos Pendientes para Etapas Posteriores

1. **No implementado por exclusión expresa (§19):** CRUD funcional completo de Clientes y Expedientes, driver productivo S3/GCS, Portal de Clientes definitivo, MFA, Redis, eliminación física de `User.role`/`User.organizationId`.
2. **Migración C (`NOT NULL` Contract — `DEC-04-03`):** Pendiente de ejecución posterior tras auditoría pre-flight sobre el entorno objetivo de staging/producción.
3. **Sub-decisión `DEC-04-06` (Escritura de eventos de plataforma `organizationId IS NULL`):** No se creó ninguna función `SECURITY DEFINER` ni rol con bypass de RLS desde el runtime ordinario; las filas con `organizationId IS NULL` permanecen estrictamente invisibles para todos los tenants bajo RLS.
4. **Habilitación para siguiente etapa:** Con AUTH-04 verificado y cerrado sobre PostgreSQL 18 real, el repositorio queda listo para iniciar los módulos funcionales de **Clientes** y **Expedientes** sobre la base multi-tenant endurecida.

