# SPEC-AUTH-004 — Autorización Efectiva y Aislamiento Multi-Organización de Datos Jurídicos

- **Identificador:** `SPEC-AUTH-004`
- **Versión:** `0.2.0`
- **Estado Documental:** `APPROVED` *(Aprobada formalmente mediante `AUTH04-FORMAL-APPROVAL-001`)*
- **Estado de Implementación:** `AUTH-04 IMPLEMENTATION — NOT AUTHORIZED` *(Requiere autorización posterior, específica y expresa)*
- **Expedientes:** `AUTH04-DISCOVERY-AND-SPECIFICATION-001`, `AUTH04-SPEC-RECONCILIATION-002`, `AUTH04-FORMAL-APPROVAL-001`
- **Fecha:** 24/11/2026
- **Baseline de Referencia:** `SPEC-AUTH-001 v1.0.8`, `AUTH0-IMPLEMENTATION-001` (AUTH-01), `AUTH0-AUTH02-FINAL-VERIFICATION-006` (AUTH-02), `AUTH03-FINAL-CONSISTENCY-VERIFICATION-001` (AUTH-03)
- **Baseline Git verificado:** Rama `master` | `HEAD`: `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`

---

## Historial de Versiones

| Versión | Fecha | Expediente | Estado | Resumen de Cambios |
|---|---|---|---|---|
| `0.1.0-DRAFT` | 24/11/2026 | `AUTH04-DISCOVERY-AND-SPECIFICATION-001` | `DRAFT` | Discovery técnico READ-ONLY sobre 29 modelos Prisma y servicios existentes; propuesta inicial de aislamiento, RLS, matriz de roles y catálogo TDS de 21 pruebas. |
| `0.2.0-DRAFT` | 24/11/2026 | `AUTH04-SPEC-RECONCILIATION-002` | `DRAFT` | Reconciliación documental D-01..D-06: modelo de amenazas RLS, backfill Expand/Contract + `EmployeeMetric` tenant-scoped, proyecciones por columnas, políticas completas `_ExpedienteToUser`, privilegios `abogados_app_user` + 3 credenciales y matriz TDS ampliada a 33 pruebas + 4 bloques de regresión. |
| `0.2.0` | 24/11/2026 | `AUTH04-FORMAL-APPROVAL-001` | **`APPROVED`** | Registro formal de aprobación de `DEC-04-01` a `DEC-04-06` con condiciones obligatorias integradas en secciones normativas. Implementación aún no autorizada. |

---

## Registro Formal de Decisiones Aprobadas (`AUTH04-FORMAL-APPROVAL-001`)

| ID | Decisión | Estado | Condiciones Obligatorias Registradas |
|---|---|---|---|
| **`DEC-04-01`** | Arquitectura de doble barrera (Aplicación + PostgreSQL RLS + `abogados_app_user`) | **APROBADA** | RLS es segunda barrera y no sustituye autorización en aplicación; `abogados_app_user` es `NOSUPERUSER`, `NOBYPASSRLS`, no propietario de tablas y sin asunción de roles privilegiados; parametrización SQL obligatoria y prohibición de raw SQL inseguro; separación estricta de credenciales runtime, migraciones y backup (§9, §10.1, §10.4). |
| **`DEC-04-02`** | Migración Expand/Contract y backfill verificable | **APROBADA** | Prohibido usar `User.organizationId` o `User.role` para inferir pertenencia; prohibido asignar arbitrariamente huérfanos/ambiguos o borrar registros; mantener `organizationId` nullable durante resolución; `NOT NULL` solo con `0` pendientes demostrados o resolución explícita aprobada; Fail-Closed para filas `NULL`; `EmployeeMetric` clasificada como `TENANT-SCOPED` (§16). |
| **`DEC-04-03`** | Matriz de permisos (§8.1) y proyecciones por columnas (§8.2) | **APROBADA** | `STAFF` solo metadatos autorizados (sin documentos ni estrategia jurídica); `ASSISTANT` solo operaciones permitidas; `LAWYER` sin `documents:sensitive` ni `cases:delete` salvo nueva especificación formal; segregación en `ORG_ADMIN`/`ORG_OWNER`; proyecciones explícitas obligatorias en toda respuesta HTTP; RLS controla filas y aplicación controla columnas/DTOs; cero exposición de secretos, hashes, tokens, verificadores ni rutas internas de almacenamiento (§8.1, §8.2). |
| **`DEC-04-04`** | Contención Fail-Closed de endpoints prototipales | **APROBADA** | Bloquear en Fail-Closed (`403`/`404`) durante AUTH-04: `admin/*`, `admin-api/*`, `GET /events/logs`, `POST /client-portal/login` y escrituras no autorizadas en `LegalNorm` y `Jurisprudence`; no eliminar módulos ni datos; no implementar portal de clientes ni módulos admin definitivos; lectura global de normativa/jurisprudencia estrictamente read-only para el runtime (§7, §10.4, §14). |
| **`DEC-04-05`** | Seguridad legacy (`SecurityContextGuard` y `POST /auth/refresh`) | **APROBADA CON CONDICIÓN OBLIGATORIA** | Prohibido usar `User.role` o `User.organizationId` como fuente de autorización organizacional; módulos organizacionales dependen exclusivamente de `UserSession.activeOrganizationId`, membresía activa y permisos org; `SecurityContextGuard` conservado únicamente para compatibilidad AUTH-01/02 y **nunca** como sustituto de `ActiveOrgContextGuard` + `OrgPermissionGuard`; deprecar `POST /auth/refresh` legacy HS256 asegurando que no intervenga en el flujo BFF/Auth0; no eliminar todavía campos legacy (§14). |
| **`DEC-04-06`** | Eventos de plataforma sin organización (`organizationId IS NULL`) | **APROBADA CON CONDICIÓN OBLIGATORIA** | Separación estricta entre auditoría de plataforma y auditoría organizacional; eventos `NULL` jamás visibles para ningún tenant ni con excepciones generales de lectura en RLS; escritura de eventos de plataforma mediante mecanismo/servicio de plataforma separado con privilegios mínimos que no habilite lectura/modificación/eliminación por usuarios de organizaciones; prohibido un rol genérico que eluda RLS desde el runtime ordinario; si el mecanismo concreto de escritura requiere sub-decisión de privilegios, se documenta como pendiente sin inventar implementación (§10.2 Cat B). |

---

## 1. Propósito y Alcance

Esta especificación define la arquitectura, reglas de autorización por fila y por columna, controles de aislamiento multi-organización en aplicación y base de datos (PostgreSQL Row-Level Security), estrategia de manejo de transacciones/conexiones, privilegios de roles PostgreSQL, tratamiento de archivos, migración segura con backfill verificable, migración de dependencias legacy y matriz completa de trazabilidad TDS para **AUTH-04** en Abogados-Law.

**Objetivo central:** Garantizar mediante defensa en profundidad que ningún usuario pueda leer, enumerar, crear, modificar, eliminar ni inferir datos jurídicos o administrativos pertenecientes a otra organización, aun manipulando identificadores UUID, rutas, parámetros query, payloads HTTP, encabezados o campos legacy.

AUTH-04 constituye el cierre de la seguridad fundacional del SaaS multi-tenant, paso previo obligatorio al desarrollo de los módulos funcionales de **Clientes** y **Expedientes**.

---

## 2. Referencias y Decisiones Previas (Inmutables)

Decisiones arquitectónicas cerradas en AUTH-01, AUTH-02 y AUTH-03 que AUTH-04 preserva íntegramente:

1. **Identidad humana global (AUTH-01/02):** Auth0 es el proveedor único de identidad humana; la clave primaria externa es `(issuer, subject)` persistida en `UserIdentity` con restricción única compuesta.
2. **Sesiones BFF en PostgreSQL (AUTH-02):** Las sesiones de navegador operan mediante cookie opaca `app_session` (hash SHA-256 en `UserSession`), expiración por inactividad (30 min) y absoluta (8 h), y protección Anti-CSRF (`CsrfGuard`) con Origin canónico exacto + HMAC.
3. **Organizaciones, membresías y roles contextuales (AUTH-03):**
   - Organización activa persistida en servidor: `UserSession.activeOrganizationId`.
   - Roles contextuales asignados exclusivamente en `OrganizationMembership.role` (`ORG_OWNER`, `ORG_ADMIN`, `LAWYER`, `ASSISTANT`, `STAFF`).
   - Membresía obligatoria: `OrganizationMembership.status = ACTIVE` y `Organization.status = ACTIVE`.
   - Prohibición absoluta de utilizar `User.role` o `User.organizationId` como fuente de autorización organizacional o de backfill de pertenencia.
4. **Sin Redis ni proveedores adicionales:** Todo el aislamiento y estado transaccional se sostiene sobre NestJS + Prisma + PostgreSQL.

---

## 3. Estado Real del Repositorio

El discovery READ-ONLY sobre `backend/prisma/schema.prisma` (961 líneas, 29 modelos + tabla puente implícita `_ExpedienteToUser`) y el árbol completo `backend/src/` verificó:

- **AUTH-01, AUTH-02 y AUTH-03:** Operativos y verificados (82/82 pruebas aprobadas en 10 suites, incluidas pruebas reales sobre PostgreSQL 18 en `abogados_test`).
- **Módulos funcionales prototipales existentes (`expedientes`, `documents`, `agenda`, `templates`, `client-portal`, `judicial-engine`, `ia/*`, `admin/*`, `analytics`):**
  - Controladores completamente sin guards (`DocumentsController`, `TemplatesController`, `JudicialController`, `DraftingController`, `LegalRiskController`, `AdminApiController`, `AdminMasterController`, `GET /events/logs`).
  - Controladores con `JwtAuthGuard` legacy HS256 en lugar de `BffSessionGuard` + contexto organizacional (`ExpedientesController`, `AgendaController`, `ClientPortalController`, `IAController`, `AIChatController`, `JurisprudenceController`, `LegalController`).
  - Consultas globales sin filtro de organización (`ExpedientesService.findAll()`, `DocumentsService.*`, `TemplatesService.findOne`, `JudicialSyncService.syncCase`, `ChatContextService.buildContext`, `LegalRiskService.*`, `DraftingService.getDraft`, `AdminMasterController.getAllTenants`, `AdminDataService.getLiveLogs`).
  - Endpoints que confían en `organizationId`, `userId` o `path` enviados en el body HTTP (`ExpedientesService.create`, `TemplatesController.create`, `DocumentsController.uploadVersion`, `DraftingController.generate`, `LegalRiskController.analyzeRisk`, `AnalyticsController.collectEvent`).
  - PostgreSQL 18 local (`postgresql-x64-18`) solo tiene hoy `postgres` (`rolsuper=t, rolbypassrls=t`) e `inspyra_app` (ajeno al proyecto); aún **no existe un rol `NOBYPASSRLS` dedicado** para Abogados-Law.

---

## 4. Inventario Real de Entidades (`backend/prisma/schema.prisma`)

Se inventariaron los **29 modelos reales** más `_ExpedienteToUser`. **No existen actualmente en el esquema:** Tareas (`Task`), Honorarios/Liquidaciones (`Fee`/`Billing`), Comunicaciones de estudio (`Communication`) ni `ExpedienteClientAccess`.

### 4.1. Entidades Organizacionales (Tenant-Scoped Directas)

| Modelo | Tabla Física | PK | Organización (FK / Relación) | Relaciones | Servicios que Consultan/Modifican | Riesgo | Estado Actual |
|---|---|---|---|---|---|---|---|
| `Organization` | `"Organization"` | `id` | Raíz de tenant | `users`, `memberships`, `invitations`, `activeSessions`, `auditLogs`, `expedientes`, `clients`, `templates`, `judicialAccounts`, `usage` | `OrganizationsService`, `AdminMasterController`, `AdminDataService`, `ExpedientesService` | Enumeración global vía `AdminMasterController` / `findFirst` | **Parcial** |
| `OrganizationMembership` | `"OrganizationMembership"` | `id` | `organizationId` (FK `CASCADE`) | `user`, `organization` | `MembershipsService`, `OrganizationsService`, `ActiveOrganizationService`, `OrgRolesGuard`, `InvitationsService` | Bajo en AUTH-03 | **Protegido** (AUTH-03) |
| `OrganizationInvitation` | `"OrganizationInvitation"` | `id` | `organizationId` (FK `CASCADE`) | `organization`, `targetUser`, `invitedBy` | `InvitationsService` | Bajo en AUTH-03; `tokenHash` único | **Protegido** (AUTH-03) |
| `Expediente` | `"Expediente"` | `id` | `organizationId` (FK `RESTRICT`) | `organization`, `users` (`_ExpedienteToUser`), `documentos`, `eventos`, `drafts`, `riskAnalyses` | `ExpedientesService`, `ClientPortalService`, `JudicialSyncService`, `ChatContextService`, `LegalRiskService` | **CRÍTICO:** `findMany()` sin filtro, `findUnique(id)` sin org, `create` acepta `organizationId` del body | **Sin protección** |
| `Client` | `"Client"` | `id` | `organizationId` (FK `RESTRICT`) | `organization` | `ClientPortalService` (`findFirst({ where: { email } })`) | **CRÍTICO:** consulta por email sin filtro de organización | **Sin protección** |
| `LegalTemplate` | `"LegalTemplate"` | `id` | `organizationId` (FK `RESTRICT`) | `organization` | `TemplatesService`, `TemplatesController` | **CRÍTICO:** sin guard, `"default-org-id"` / `body.organizationId`, `findOne(id)` sin org | **Sin protección** |
| `JudicialAccount` | `"JudicialAccount"` | `id` | `organizationId` (FK `RESTRICT`) | `organization` | Sin servicio activo hoy en `src/` | **ALTO:** almacena `encryptedPassword` judicial por estudio | **Sin protección** |
| `TenantUsage` | `"TenantUsage"` | `id` | `organizationId` (`@unique`, FK `RESTRICT`) | `organization` | `UsageControlService`, `AdminMasterController` | **ALTO:** consulta/upsert por `organizationId` sin validar contexto | **Sin protección** |
| `AIInteraction` | `"AIInteraction"` | `id` | `organizationId` (escalar sin FK hoy) | Ninguna FK explícita | `UsageControlService` | **ALTO:** sin FK a `Organization` ni RLS | **Sin protección** |

### 4.2. Entidades Organizacionales Indirectas (Sin Columna `organizationId` Directa Hoy)

| Modelo | Tabla Física | PK | Relación de Organización Real | Relaciones | Servicios que Consultan/Modifican | Riesgo | Estado Actual |
|---|---|---|---|---|---|---|---|
| `Documento` | `"Documento"` | `id` | Indirecta (1 salto): `expedienteId -> Expediente.organizationId` | `expediente`, `versions` | `DocumentsService`, `AdminMasterController` | **CRÍTICO:** IDOR directo por `id`, sin guard | **Sin protección** |
| `DocumentVersion` | `"DocumentVersion"` | `id` | Indirecta (2 saltos): `documentId -> Documento -> Expediente.organizationId` | `document` | `DocumentsService` (`uploadVersion`, `triggerOCR`, `compareVersions`) | **CRÍTICO:** IDOR en `compare/:v1/:v2`, OCR sin contexto | **Sin protección** |
| `EventoAgenda` | `"EventoAgenda"` | `id` | Indirecta (1 salto): `expedienteId -> Expediente.organizationId` | `expediente` | `AgendaService`, `JudicialSyncService`, `ClientPortalService` | **CRÍTICO:** `createEvent` acepta cualquier `expedienteId`; `findAll` usa legacy `User.organizationId`; cron global | **Sin protección** |
| `AIChatSession` | `"AIChatSession"` | `id` | Indirecta sin FK: `expedienteId` (permite `"general-workspace-user"`) | `user`, `messages` | `AIChatService` | **CRÍTICO:** sin FK a `Expediente` ni `organizationId`; chat sobre expediente ajeno | **Sin protección** |
| `AIChatMessage` | `"AIChatMessage"` | `id` | Indirecta (2 saltos): `sessionId -> AIChatSession` | `session` | `AIChatService` | **CRÍTICO:** mensajes confidenciales sin aislamiento organizacional | **Sin protección** |
| `LegalDraft` | `"LegalDraft"` | `id` | Indirecta opcional: `expedienteId? -> Expediente` (`NULL` sin org) | `user`, `expediente` | `DraftingService`, `DraftingController` | **CRÍTICO:** sin guard, `getDraft(id)` sin org, `userId`/`expedienteId` del body/ruta | **Sin protección** |
| `LegalRiskAnalysis` | `"LegalRiskAnalysis"` | `id` | Indirecta (1 salto): `expedienteId -> Expediente.organizationId` | `expediente` | `LegalRiskService`, `LegalRiskController` | **CRÍTICO:** sin guard, consulta/persiste por `expedienteId` sin org | **Sin protección** |
| `EmployeeMetric` | `"EmployeeMetric"` | `id` | **Ninguna hoy** (`@@unique([userId, date])`) — **Clasificada como TENANT-SCOPED** (§16.2) | Ninguna FK | `AnalyticsService.updateEmployeeMetrics` | **MEDIO:** mezcla métricas productivas de un usuario entre distintos estudios | **Sin protección** |
| `_ExpedienteToUser` | `"_ExpedienteToUser"` | `(A, B)` implícita | Indirecta vía `"A" -> Expediente.organizationId` y `"B" -> User.id` | `Expediente`, `User` | `ClientPortalService` (`users: { some: { id } }`) | **ALTO:** asignaciones cruzadas o acceso residual tras baja de membresía | **Sin protección** |

### 4.3. Entidades Híbridas (Tenant + Plataforma)

| Modelo | Tabla Física | PK | Organización | Relaciones | Servicios | Riesgo | Estado Actual |
|---|---|---|---|---|---|---|---|
| `AuditLog` | `"AuditLog"` | `id` | `organizationId?` (FK `SET NULL`) | `user`, `organization` | `OrgAuditService` | **MEDIO:** protegido en AUTH-03; requiere RLS append-only y ocultamiento de filas `NULL` | **Parcial** |
| `EventLog` | `"EventLog"` | `id` | `organizationId?` (escalar sin FK) | Ninguna | `AnalyticsService`, `AnalyticsController`, `AdminDataService` | **CRÍTICO:** `GET /events/logs` y `GET /admin-api/logs` abiertos; `POST /events/collect` acepta `body.organizationId` | **Sin protección** |

### 4.4. Entidades de Identidad Global y Sesiones (Pre-Tenant / Cross-Tenant)

| Modelo | Tabla Física | PK | Organización | Servicios | Estado Actual |
|---|---|---|---|---|---|
| `User` | `"User"` | `id` | Legacy `organizationId` (NO usar para autorización) | `AuthService`, `BffSessionService`, `SecurityContextGuard`, `ClientPortalService`, `AgendaService`, `AdminDataService` | **Protegido en AUTH-01/02/03** (desacople legacy pendiente) |
| `UserIdentity` | `"UserIdentity"` | `id` | No aplicable (identidad global Auth0) | `BffController`, `SecurityContextGuard`, `OrganizationsService`, `InvitationsService` | **Protegido** (AUTH-02/03) |
| `UserSession` | `"UserSession"` | `id` | `activeOrganizationId?` (FK `SET NULL`) | `BffSessionService`, `ActiveOrganizationService`, `MembershipsService` | **Protegido** (AUTH-02/03) |
| `OidcTransaction` | `"OidcTransaction"` | `transactionId` | No aplicable (pre-autenticación) | `OidcClientService` | **Protegido** (AUTH-02) |

### 4.5. Entidades Globales / Compartidas de Referencia (No Tenant-Scoped)

| Modelo | Tabla Física | PK | Servicios | Estado Actual |
|---|---|---|---|---|
| `CalendarioJudicial` | `"CalendarioJudicial"` | `id` | `AgendaService`, `DeadlineCalculatorService` | **No aplicable** (lectura global) |
| `LegalNorm` | `"LegalNorm"` | `id` | `IAService`, `LegalSearchService`, `LegalIngestionService` | **Parcial** (escritura sin rol en `legal.controller.ts` e `ia.controller.ts`) |
| `Jurisprudence` | `"Jurisprudence"` | `id` | `JurisprudenceSearchService`, `JurisprudenceIngestionService`, `JurisprudenceCrawlerService` | **Parcial** (escritura sin rol en `jurisprudence.controller.ts`) |
| `JurisprudenceChunk` | `"JurisprudenceChunk"` | `id` | `JurisprudenceChunkingService`, `JurisprudenceSearchService` | **No aplicable** (lectura global) |
| `JurisprudenceCitation` | `"JurisprudenceCitation"` | `id` | `JurisprudenceRankingService`, `JurisprudenceIngestionService` | **No aplicable** (lectura global) |
| `SubscriptionPlan` | `"SubscriptionPlan"` | `id` | Sin servicio activo hoy | **No aplicable** (lectura global) |

---

## 5. Inventario de Puntos de Acceso y Hallazgos Concretos

### 5.1. Controladores HTTP y Servicios

| ID | Archivo y Líneas | Hallazgo Verificado | Severidad |
|---|---|---|---|
| `F-01` | `backend/src/expedientes/expedientes.controller.ts:9-24`, `expedientes.service.ts:9-35` | `JwtAuthGuard` legacy; `findAll()` (`L10`) retorna expedientes de todas las orgs; `create()` (`L18-24`) confía en `body.organizationId` o `tx.organization.findFirst()`. | **CRÍTICA** |
| `F-02` | `backend/src/expedientes/documents.controller.ts:14-44`, `documents.service.ts:31-139` | Sin guard; `uploadVersion` (`L31`), `setLegalHold` (`L101`) y `compareVersions` (`L114-118`) sin filtro de org; acepta `body.path` y `body.userId` (`L23,28`). | **CRÍTICA** |
| `F-03` | `backend/src/agenda/agenda.controller.ts:18-42`, `agenda.service.ts:35-70` | `JwtAuthGuard` legacy; `createEvent()` (`L35-46`) no valida pertenencia de `expedienteId`; `findAll()` (`L50-56`) usa `user.organizationId` legacy. | **CRÍTICA** |
| `F-04` | `backend/src/templates/templates.controller.ts:4-28`, `templates.service.ts:9-43` | Sin guard; `body.organizationId || "default-org-id"` (`L12`); `findAll("default-org-id")` (`L18`); `findOne(id)` (`L34`) sin org. | **CRÍTICA** |
| `F-05` | `backend/src/judicial-engine/judicial.controller.ts:4-17`, `judicial-sync.service.ts:17-58` | Sin guard; `syncCase` (`L18`) opera sobre cualquier `expedienteId` y crea `EventoAgenda`; `syncSystem` (`L13`) expuesto sin auth. | **CRÍTICA** |
| `F-06` | `backend/src/ia/chat/ai-chat.controller.ts:17-50`, `ai-chat.service.ts:29-175`, `chat-context.service.ts:33-51` | `JwtAuthGuard` legacy; `buildContext()` (`L33`) lee cualquier `Expediente` por UUID sin org y lo inyecta en el prompt LLM. | **CRÍTICA** |
| `F-07` | `backend/src/ia/drafting/drafting.controller.ts:4-35`, `drafting.service.ts:151-186` | Sin guard; `userId`/`expedienteId` desde body/params; `getDraft(id)` (`L183`) sin filtro de org. | **CRÍTICA** |
| `F-08` | `backend/src/ia/risk/legal-risk.controller.ts:4-22`, `legal-risk.service.ts:35-180` | Sin guard; `analyzeRisk` (`L39`) y `getHistory` (`L176`) operan sobre cualquier `expedienteId` sin filtro de org; acepta `body.userId`. | **CRÍTICA** |
| `F-09` | `backend/src/admin/admin-master.controller.ts:5-35`, `admin-api.controller.ts:5-23`, `admin-data.service.ts:11-42` | Sin guard (`// TODO`); expone `Organization`, conteos y `EventLog` globales de todos los tenants. | **CRÍTICA** |
| `F-10` | `backend/src/analytics/analytics.controller.ts:16-47`, `analytics.service.ts:37-131`, `pixel.guard.ts:18-69` | `GET /events/logs` (`L42-46`) sin guard; `POST /events/collect` (`L34`) confía en `body.organizationId`; `PixelGuard` (`L19-20`) tiene secreto fallback inseguro. | **CRÍTICA** |
| `F-11` | `backend/src/client-portal/client-portal.controller.ts:13-34`, `client-portal.service.ts:13-111` | `POST /client-portal/login` omite verificación de contraseña/CUIT (`L37-38`), usa `user.role === "CLIENT"` (`L30`), consulta `client.findFirst({ where: { email } })` (`L18`) sin org y emite JWT HS256 con `user.organizationId`. | **CRÍTICA** |
| `F-12` | `backend/src/ia/ia.controller.ts:33-50`, `legal.controller.ts:32-62,121-136`, `jurisprudence.controller.ts:71-111` | Ingesta/mutación de tablas globales de conocimiento solo con `JwtAuthGuard` (`// TODO: Check if user is ADMIN`). | **ALTA** |

### 5.2. Jobs, Cron, Procesos Internos y Archivos Externos

| Proceso | Archivo y Líneas | Comportamiento Actual | Requisito AUTH-04 |
|---|---|---|---|
| Cron de vencimientos | `backend/src/agenda/agenda.service.ts:72-97` | Consulta global `eventoAgenda.findMany` sin contexto de tenant. | Iterar explícitamente sobre organizaciones `ACTIVE` y ejecutar cada consulta dentro de `ScopedPrismaService.runInOrgContext({ organizationId, ... })`; nunca mezclar alertas entre estudios. |
| OCR asíncrono | `backend/src/expedientes/documents.service.ts:86-95` | `setTimeout` actualiza `documentVersion` solo por `id` sin contexto de org. | Propagar `{ organizationId, documentId, versionId }` y ejecutar el `update` dentro de `ScopedPrismaService.runInOrgContext` filtrando por `{ id: versionId, organizationId }`. |
| Sincronización judicial | `backend/src/judicial-engine/judicial-sync.service.ts:17-72` | `syncCase(expedienteId)` sin org; `syncSystem()` sin auth ni iteración por tenant. | `syncCase` requiere `req.orgContext` + `ScopedPrismaService` (verificando pertenencia de `expedienteId` y propagando `organizationId` al crear `EventoAgenda`). `syncSystem` bloqueado para usuarios tenant (reservado a plataforma/cron iterado por org). |
| Backup diario | `backend/src/core/backup/backup.service.ts:27-74` | `pg_dump "${dbUrl}"` hacia `./backups/`. | Separar `BACKUP_DATABASE_URL` con rol dedicado `abogados_backup_user` (solo lectura, nunca `abogados_app_user`). |
| Archivos externos | `backend/src/expedientes/documents.controller.ts:23`, `documents.service.ts:56` | Persiste `body.path` arbitrario en `storagePath`. | Prohibir rutas enviadas por el cliente; usar claves prefijadas `orgs/{organizationId}/...` (§13). |

---

## 6. Modelo de Contexto Organizacional (Fuente Única de Verdad)

### 6.1. Cadena Obligatoria de Resolución

```
Cookie HttpOnly `app_session`
  ──► BffSessionGuard (valida hash SHA-256 en UserSession, no revocada, idle 30m, abs 8h)
  ──► ActiveOrgContextGuard (AUTH-04)
        1. Lee `req.session.activeOrganizationId` (exclusivamente desde PostgreSQL).
        2. Si es NULL -> 403 Forbidden (`NO_ACTIVE_ORGANIZATION`).
        3. Revalida en vivo `OrganizationMembership(userId, activeOrganizationId)` + `Organization`.
        4. Exige `membership.status === ACTIVE` y `organization.status === ACTIVE` -> si no, 403 Forbidden.
        5. Si la solicitud intenta pasar otro `organizationId` en ruta/query/body -> 403 Forbidden / 400 Bad Request (`forbidNonWhitelisted`).
        6. Inyecta `req.orgContext` inmutable:
           `{ userId, organizationId, membershipId, orgRole, correlationId }`.
  ──► CsrfGuard (obligatorio en POST/PUT/PATCH/DELETE)
  ──► OrgPermissionGuard (AUTH-04; valida `orgRole` contra `@RequireOrgPermissions(...)`)
  ──► ScopedPrismaService.runInOrgContext(req.orgContext, tx => ...)
```

### 6.2. Fuentes Prohibidas

Se prohíbe derivar el tenant de: `req.body.organizationId`, `req.query.organizationId`, headers arbitrarios (`X-Org-Id`), `User.organizationId`, `User.role`, claims de JWT sin revalidación local, estado del frontend, `organization.findFirst()` o constantes como `"default-org-id"`.

---

## 7. Política de Autorización

1. **Deny by default (Fail-Closed):** Todo endpoint organizacional exige `BffSessionGuard` + `ActiveOrgContextGuard` + `OrgPermissionGuard`.
2. **Separación Identidad vs. Autorización:** Auth0 autentica identidad humana (`UserIdentity`); PostgreSQL autoriza permisos contextuales (`OrganizationMembership`).
3. **Anti-Enumeración (Aislamiento de Existencia):** Todo acceso por UUID a un registro inexistente o perteneciente a otra organización retorna `404 Not Found`.
4. **Invariante Relacional:** Toda escritura que referencie otra entidad (`expedienteId`, `documentId`, `sessionId`, asignación en `_ExpedienteToUser`) valida dentro de `ScopedPrismaService` que ambas entidades y el usuario asignado pertenezcan a `req.orgContext.organizationId`.
5. **Autorización en Dos Dimensiones (Filas y Columnas):** PostgreSQL RLS + filtros de servicio controlan **filas**; la capa de aplicación controla **columnas** mediante proyecciones explícitas por rol (§8.2).
6. **Contención Fail-Closed de Endpoints Prototipales (`DEC-04-04`):** `admin/*`, `admin-api/*`, `GET /events/logs`, `POST /client-portal/login` y escrituras no autorizadas en `LegalNorm`/`Jurisprudence` quedan bloqueados en Fail-Closed (`403`/`404`) durante AUTH-04 sin eliminar módulos ni datos y sin implementar aún el portal de clientes ni módulos administrativos definitivos. Las consultas de lectura global sobre normativa y jurisprudencia respetan el carácter estrictamente `SELECT`-only del rol runtime.

---

## 8. Matriz de Roles, Permisos y Proyecciones de Columnas

### 8.1. Matriz de Permisos por Rol (`OrganizationMembership.role`)

| Dominio / Capacidad | Permiso Declarativo | `ORG_OWNER` | `ORG_ADMIN` | `LAWYER` | `ASSISTANT` | `STAFF` |
|---|---|:-:|:-:|:-:|:-:|:-:|
| **Organización** — Ver org propia y org activa | `org:read` | Sí | Sí | Sí | Sí | Sí |
| **Organización** — Cambiar estado org | `org:manage_status` | **Sí** | No | No | No | No |
| **Organización** — Transferir propiedad | `org:transfer_ownership` | **Sí** | No | No | No | No |
| **Miembros** — Listar miembros y auditoría org | `members:read` / `audit:read` | Sí | Sí | No | No | No |
| **Miembros** — Invitar, suspender/reactivar/revocar (reglas AUTH-03) | `members:manage` | Sí | Sí* | No | No | No |
| **Miembros** — Cambiar roles | `members:change_role` | **Sí** | No | No | No | No |
| **Clientes** — Lectura (`Client`) | `clients:read` | Sí | Sí | Sí | Sí | Sí |
| **Clientes** — Creación / modificación | `clients:write` | Sí | Sí | Sí | Sí | No |
| **Clientes** — Eliminación | `clients:delete` | Sí | Sí | No | No | No |
| **Expedientes** — Lectura (`Expediente`) | `cases:read` | Sí | Sí | Sí | Sí | Sí (solo metadatos §8.2) |
| **Expedientes** — Creación / modificación / asignación (`_ExpedienteToUser`) | `cases:write` | Sí | Sí | Sí | No | No |
| **Expedientes** — Eliminación / archivado definitivo | `cases:delete` | Sí | Sí | No | No | No |
| **Documentos** — Lectura / descarga (`Documento`, `DocumentVersion`) | `documents:read` | Sí | Sí | Sí | Sí | No |
| **Documentos** — Subida / versionado | `documents:write` | Sí | Sí | Sí | Sí | No |
| **Documentos** — Legal Hold / WORM / eliminación | `documents:sensitive` | Sí | Sí | No | No | No |
| **Agenda** — Lectura (`EventoAgenda`) | `agenda:read` | Sí | Sí | Sí | Sí | Sí (solo metadatos §8.2) |
| **Agenda** — Creación / modificación | `agenda:write` | Sí | Sí | Sí | Sí | No |
| **Plantillas** — Lectura y generación (`LegalTemplate`) | `templates:read` | Sí | Sí | Sí | Sí | No |
| **Plantillas** — Creación y administración | `templates:write` | Sí | Sí | No | No | No |
| **IA Jurídica** — Chat, Drafting, Risk Analysis (`AIChatSession`, `LegalDraft`, `LegalRiskAnalysis`) | `ai:use` | Sí | Sí | Sí | No | No |
| **Motor Judicial** — Sincronización de expedientes (`syncCase`) | `judicial:sync` | Sí | Sí | Sí | No | No |
| **Cuentas Judiciales** — Gestión de `JudicialAccount` | `judicial:manage_accounts` | Sí | Sí | No | No | No |
| **Uso del Tenant** — Consulta de `TenantUsage` / `AIInteraction` | `usage:read` | Sí | Sí | No | No | No |
| **Base Global** — Consulta `LegalNorm`, `Jurisprudence`, `CalendarioJudicial` | `knowledge:read` | Sí | Sí | Sí | Sí | Sí |

*\*Restricciones ya aplicadas en AUTH-03: `ORG_ADMIN` no puede invitar `ORG_OWNER`, suspender/revocar `ORG_OWNER` ni cambiar roles.*

### 8.2. Proyecciones Mínimas de Lectura por Columnas (Capa de Aplicación)

**Regla normativa:** Ningún servicio puede devolver entidades Prisma completas (`findMany()` sin `select` o `include` irrestricto). RLS filtra **filas**; la capa de aplicación aplica **proyecciones explícitas (`select` / DTO mappers)** según el rol activo.

**Columnas estrictamente prohibidas en toda respuesta HTTP para cualquier rol (incluido `ORG_OWNER`):** `User.passwordHash`, `User.refreshTokenHash`, `UserSession.sessionToken`, `OidcTransaction.codeVerifier`, `OrganizationInvitation.tokenHash`, `JudicialAccount.encryptedPassword`, `Documento.storagePath` y `DocumentVersion.storagePath` (rutas físicas internas de almacenamiento).

| Rol | `Expediente` | `Client` | `Documento` / `DocumentVersion` | `EventoAgenda` | `LegalDraft` / `LegalRiskAnalysis` / `AIChat*` | `LegalTemplate` / `JudicialAccount` / `AuditLog` / `TenantUsage` |
|---|---|---|---|---|---|---|
| **`STAFF`** | **Solo metadatos administrativos:** `id`, `caratula`, `numeroExpediente`, `juzgado`, `jurisdiccion`, `estado`, `updatedAt`. *(Prohibido: `tags` sensibles, `documentos`, `drafts`, `riskAnalyses`, `aiChatSessions`, `users`)* | `id`, `firstName`, `lastName`, `email`, `phone`, `createdAt`. | **Sin acceso (`403`)**. | **Solo metadatos de calendario:** `id`, `expedienteId`, `titulo`, `fechaVencimiento`, `tipoPlazo`, `estado`, `isCritical`. *(Excluye `descripcion` estratégica detallada)* | **Sin acceso (`403`)**. | **Sin acceso (`403`)**. |
| **`ASSISTANT`** | Metadatos de `STAFF` + `tags`, `createdAt`, resumen de abogados asignados (`user.id`, `user.fullName`). | Campos de `STAFF` + `updatedAt`. | **Metadatos documentales:** `id`, `expedienteId`, `tipo`, `fileName`, `fileSize`, `mimeType`, `hashSha256`, `isLocked`, `legalHold`, `versionNumber`, `uploadedBy`, `createdAt`, `updatedAt`. *(Excluye `storagePath` y `ocrContent` salvo autorización explícita)* | Todos los campos operativos (`id`, `expedienteId`, `titulo`, `descripcion`, `fechaVencimiento`, `tipoPlazo`, `estado`, `isCritical`, `alertConfig`). | **Sin acceso (`403`)**. | `LegalTemplate`: `id`, `name`, `description`, `variables`, `category`, `isActive` (sin administración). `JudicialAccount`, `AuditLog`, `TenantUsage`: **Sin acceso (`403`)**. |
| **`LAWYER`** | Proyección completa de expediente (`id`, `caratula`, `numeroExpediente`, `juzgado`, `jurisdiccion`, `estado`, `tags`, `createdAt`, `updatedAt`, `users` sanitizados). | Proyección completa de cliente. | Proyección de `ASSISTANT` + `ocrContent`, `legalHoldReason`, `lockExpiresAt`, `changesSummary`. *(Excluye `storagePath`)* | Proyección completa de agenda. | Proyección completa de trabajo jurídico (`AIChatSession`, `AIChatMessage`, `LegalDraft`, `LegalRiskAnalysis`) estrictamente dentro de la org activa. | `LegalTemplate`: incluye `content` para redacción/generación. `JudicialAccount`, `AuditLog`, `TenantUsage`: **Sin acceso (`403`)**. |
| **`ORG_ADMIN`** | Igual que `LAWYER`. | Igual que `LAWYER`. | Igual que `LAWYER`. | Igual que `LAWYER`. | Igual que `LAWYER`. | Todas las proyecciones de `LAWYER` + `LegalTemplate` gestión completa + `JudicialAccount` metadatos no secretos (`id`, `jurisdiction`, `username`, `status`, `lastSyncAt`; **sin `encryptedPassword`**) + `AuditLog` sanitizado (sin tokens/hashes) + `TenantUsage` + `AIInteraction` (metadatos de consumo sin prompts sensibles ajenos). |
| **`ORG_OWNER`** | Igual que `ORG_ADMIN`. | Igual que `ORG_ADMIN`. | Igual que `ORG_ADMIN`. | Igual que `ORG_ADMIN`. | Igual que `ORG_ADMIN`. | Igual que `ORG_ADMIN` + gestión de estado organizacional y transferencia de propiedad. |

---

## 9. Estrategia de Aislamiento en Aplicación (Capa 1 — Obligatoria)

1. **`ActiveOrgContextGuard`:** Resuelve `req.orgContext` exclusivamente desde `UserSession.activeOrganizationId` + validación en vivo de `OrganizationMembership (ACTIVE)` y `Organization (ACTIVE)`.
2. **`OrgPermissionGuard` + `@RequireOrgPermissions(...)`:** Aplica la matriz de §8.1 antes del handler.
3. **`ScopedPrismaService`:**
   - Método oficial: `runInOrgContext<T>(ctx: OrgContext, callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>`.
   - Valida `ctx.organizationId` no vacío (Fail-Closed).
   - Abre transacción interactiva Prisma (`$transaction`) y ejecuta como primera sentencia:
     `SELECT set_config('app.current_organization_id', ${ctx.organizationId}, true);`
   - Toda consulta en el callback incluye además filtro explícito `organizationId: ctx.organizationId` y `select` explícito por rol (§8.2).
4. **Reglas obligatorias en servicios:**
   - Prohibido `findUnique({ where: { id } })` sobre tablas de tenant -> usar `findFirst({ where: { id, organizationId: ctx.organizationId }, select: ... })`.
   - Prohibido `update`/`delete` solo por `id` -> usar `updateMany`/`deleteMany` con `{ id, organizationId: ctx.organizationId }` (o verificación previa dentro de la misma transacción) retornando `404` si `count === 0`.
   - Prohibido aceptar `organizationId` del body (`ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`).
   - Prohibido SQL dinámico sin parametrizar; toda consulta raw debe usar tagged templates parametrizados (`$queryRaw` / `$executeRaw`).

---

## 10. Estrategia de PostgreSQL Row-Level Security y Modelo de Amenazas (Capa 2)

### 10.1. Modelo de Amenazas y Límites de Seguridad de `app.current_organization_id`

PostgreSQL RLS basado en el custom GUC `app.current_organization_id` (`SET LOCAL` vía `set_config(..., true)`) se adopta bajo los siguientes **límites explícitos de seguridad**:

1. **Qué SÍ mitiga RLS:** Actúa como **segunda barrera independiente** frente a errores de programación en la capa de aplicación (omisión accidental de `WHERE organizationId = ...`, consultas Prisma defectuosas, joins que cruzan relaciones entre estudios o bugs de paginación/listado). Si un servicio olvida filtrar o falla en configurar el GUC, PostgreSQL responde **Fail-Closed** (`0` filas visibles y rechazo de escrituras con error `42501`).
2. **Qué NO mitiga RLS por sí solo:**
   - Cualquier sesión PostgreSQL que pueda ejecutar **SQL arbitrario** puede invocar `SELECT set_config('app.current_organization_id', '<otro_tenant>', true)` y cambiar el GUC dentro de su transacción.
   - En consecuencia, **RLS NO sustituye la prevención de SQL Injection** ni ofrece protección suficiente frente a un **compromiso total de las credenciales runtime (`abogados_app_user`)** o ejecución remota de código en el servidor backend.
3. **Controles complementarios obligatorios:**
   - **Parametrización estricta:** El 100% de las consultas (ORM Prisma y `$queryRaw`/`$executeRaw`) deben ser parametrizadas; prohibido `$queryRawUnsafe` y `$executeRawUnsafe` en código productivo.
   - **Principio de mínimo privilegio en BD (§10.4):** El rol runtime `abogados_app_user` no es propietario de ninguna tabla, no puede ejecutar DDL (`CREATE`/`ALTER`/`DROP`), no posee `TRUNCATE`, no posee `BYPASSRLS` y no puede asumir (`SET ROLE`) el rol migrador ni `postgres`.
   - **Aislamiento transaccional estricto:** Se mantiene exclusivamente `SET LOCAL` mediante `set_config('app.current_organization_id', $1, true)` dentro de transacciones interactivas de `ScopedPrismaService`, sin introducir Redis ni dependencias externas.

### 10.2. Clasificación de Tablas y Políticas RLS

| Categoría | Tablas | Política RLS (`ENABLE` + `FORCE ROW LEVEL SECURITY`) |
|---|---|---|
| **A. Tenant-Scoped Directas y Denormalizadas** | `Expediente`, `Client`, `Documento`, `DocumentVersion`, `EventoAgenda`, `LegalTemplate`, `JudicialAccount`, `TenantUsage`, `AIInteraction`, `AIChatSession`, `AIChatMessage`, `LegalDraft`, `LegalRiskAnalysis`, `EmployeeMetric` | `SELECT`, `UPDATE`, `DELETE`: `USING ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting('app.current_organization_id', true), ''))`. `INSERT`, `UPDATE`: `WITH CHECK ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting('app.current_organization_id', true), ''))`. Fail-Closed: filas con `organizationId IS NULL` (históricos ambiguos pendientes) son invisibles para todo tenant. |
| **B. Auditoría / Telemetría Append-Only (`DEC-04-06`)** | `AuditLog`, `EventLog` | **Separación estricta plataforma vs. organización:** `SELECT`: `USING ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting('app.current_organization_id', true), ''))` — **cero excepciones generales de lectura en RLS para `organizationId IS NULL`** (ningún tenant puede leer eventos de plataforma). `INSERT` (contexto tenant): `WITH CHECK ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting('app.current_organization_id', true), ''))`. **Escritura de eventos de plataforma (`organizationId IS NULL`):** debe ejecutarse mediante un servicio/mecanismo de plataforma separado con privilegios mínimos que no habilite lectura/modificación/eliminación por usuarios de organizaciones ni introduzca un rol genérico que eluda RLS desde el runtime ordinario *(el detalle concreto de privilegio SQL para escritura de plataforma sin `organizationId` queda registrado como sub-decisión arquitectónica pendiente previa a su codificación, sin inventar implementación)*. `UPDATE` y `DELETE`: prohibidos por privilegio SQL y `USING (false)`. |
| **C. Identidad, Sesiones y Membresías (Pre-Auth / Cross-Tenant)** | `Organization`, `User`, `UserIdentity`, `UserSession`, `OrganizationMembership`, `OrganizationInvitation`, `OidcTransaction` | **Sin RLS por `app.current_organization_id`.** Motivo: se consultan antes de resolver el tenant activo (login OIDC, validación `app_session`, listado de orgs propias, aceptación de invitaciones). Protegidas por AUTH-01/02/03 (`BffSessionGuard`, `OrgRolesGuard`, `FOR UPDATE`, `DELETE ... RETURNING`, unicidad PG). |
| **D. Tabla Puente M:N** | `_ExpedienteToUser` | Ver políticas completas `SELECT`, `INSERT`, `DELETE` en §10.3. |
| **E. Datos Globales / Conocimiento** | `CalendarioJudicial`, `LegalNorm`, `Jurisprudence`, `JurisprudenceChunk`, `JurisprudenceCitation`, `SubscriptionPlan` | **Sin RLS de tenant.** `abogados_app_user` tiene exclusivamente `GRANT SELECT` (cero escritura a nivel PostgreSQL). |

### 10.3. Políticas RLS Completas y Validación para la Tabla Puente `_ExpedienteToUser`

En PostgreSQL (`20260122034018_init/migration.sql:187-190`), la tabla puente implícita de Prisma posee columnas `"A" TEXT NOT NULL` (`Expediente.id`) y `"B" TEXT NOT NULL` (`User.id`), con índice único `("A", "B")`.

**Políticas RLS (`ENABLE` + `FORCE ROW LEVEL SECURITY`):**

1. **`SELECT`:** Solo permite ver asignaciones cuyos expedientes pertenecen a la organización activa:
   ```sql
   CREATE POLICY expediente_to_user_select_policy ON "_ExpedienteToUser"
     FOR SELECT TO abogados_app_user
     USING (
       EXISTS (
         SELECT 1 FROM "Expediente" e
         WHERE e."id" = "A"
           AND e."organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
       )
     );
   ```
2. **`INSERT`:** Exige simultáneamente que el expediente `"A"` pertenezca a la organización activa **Y** que el usuario `"B"` posea una membresía `ACTIVE` en esa misma organización (impide asignar abogados ajenos al estudio aun conociendo su `userId`):
   ```sql
   CREATE POLICY expediente_to_user_insert_policy ON "_ExpedienteToUser"
     FOR INSERT TO abogados_app_user
     WITH CHECK (
       EXISTS (
         SELECT 1 FROM "Expediente" e
         WHERE e."id" = "A"
           AND e."organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
       )
       AND EXISTS (
         SELECT 1 FROM "OrganizationMembership" m
         WHERE m."userId" = "B"
           AND m."organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
           AND m."status" = 'ACTIVE'
       )
     );
   ```
3. **`DELETE`:** Solo permite desasignar relaciones cuyo expediente `"A"` pertenece a la organización activa:
   ```sql
   CREATE POLICY expediente_to_user_delete_policy ON "_ExpedienteToUser"
     FOR DELETE TO abogados_app_user
     USING (
       EXISTS (
         SELECT 1 FROM "Expediente" e
         WHERE e."id" = "A"
           AND e."organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
       )
     );
   ```
4. **`UPDATE`:** No habilitado (no se otorga `GRANT UPDATE` sobre `_ExpedienteToUser`; las asignaciones son inmutables y solo se crean/eliminan).

**Validación en capa de aplicación y compatibilidad con Prisma M:N:**
- Prisma traduce `expediente.update({ where: { id }, data: { users: { connect: { id: userId } } } })` a `INSERT INTO "_ExpedienteToUser" ("A", "B")`, `disconnect` a `DELETE FROM "_ExpedienteToUser" WHERE "A" = $1 AND "B" = $2`, e `include: { users: ... }` a `SELECT "A", "B" FROM "_ExpedienteToUser"`.
- Antes de ejecutar `connect`/`disconnect` dentro de `ScopedPrismaService.runInOrgContext`, el servicio DEBE verificar explícitamente que `expediente.organizationId === ctx.organizationId` y que `targetUser` posee `OrganizationMembership(status: ACTIVE)` en `ctx.organizationId` (devolviendo `404`/`403` limpio; RLS actúa como barrera secundaria infranqueable ante cualquier bypass).

### 10.4. Privilegios del Rol Runtime `abogados_app_user` y Separación de Credenciales

#### Atributos Obligatorios del Rol `abogados_app_user`
- `LOGIN`
- `NOSUPERUSER`
- `NOCREATEDB`
- `NOCREATEROLE`
- `NOINHERIT`
- `NOREPLICATION`
- `NOBYPASSRLS`
- **No propietario** de la base de datos, del esquema `public` ni de ninguna tabla, vista, secuencia o enum.
- **Sin membresía** en el rol migrador (`abogados_migrator`) ni en `postgres` (incapaz de ejecutar `SET ROLE` a un rol privilegiado).

#### Matriz de Privilegios SQL de `abogados_app_user`

| Objeto / Categoría | Privilegios Otorgados | Privilegios Expresamente Denegados |
|---|---|---|
| Esquema `public` | `USAGE` | `CREATE` (cero capacidad DDL: sin `CREATE`/`ALTER`/`DROP`) |
| Tablas Categoría A (Tenant-Scoped) | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `TRUNCATE`, `REFERENCES`, `TRIGGER`, ownership |
| Tabla Categoría D (`_ExpedienteToUser`) | `SELECT`, `INSERT`, `DELETE` | `UPDATE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` |
| Tablas Categoría B (`AuditLog`, `EventLog`) | `SELECT`, `INSERT` | `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` |
| Tablas Categoría C (`Organization`, `User`, `UserIdentity`, `UserSession`, `OrganizationMembership`, `OrganizationInvitation`, `OidcTransaction`) | `SELECT`, `INSERT`, `UPDATE` (y `DELETE` estrictamente en `OidcTransaction` para `DELETE ... RETURNING` y en sesiones/limpieza controlada de test) | `TRUNCATE`, `REFERENCES`, `TRIGGER`, DDL |
| Tablas Categoría E (`CalendarioJudicial`, `LegalNorm`, `Jurisprudence`, `JurisprudenceChunk`, `JurisprudenceCitation`, `SubscriptionPlan`) | **`SELECT` únicamente** | `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, DDL |
| Secuencias en `public` (futuras/existentes) | `USAGE`, `SELECT` | `UPDATE`, ownership |
| Tabla interna `_prisma_migrations` | **Ninguno** (`REVOKE ALL`) | Todo acceso |

#### Separación Estricta de Credenciales (3 Perfiles Independientes)

| Variable de Entorno | Rol PostgreSQL | Privilegios | Uso Exclusivo |
|---|---|---|---|
| `DATABASE_URL` | `abogados_app_user` | `NOSUPERUSER`, `NOBYPASSRLS`, mínimo privilegio de tabla (sin DDL ni `TRUNCATE`) | Proceso runtime NestJS y pruebas de integración RLS |
| `MIGRATION_DATABASE_URL` (o `DIRECT_URL`) | `abogados_migrator` (propietario de esquema/tablas) | DDL sobre esquema `public`, dueño de tablas, `prisma migrate deploy` | Exclusivamente CI/CD y comandos de migración; **nunca** cargada en runtime NestJS |
| `BACKUP_DATABASE_URL` | `abogados_backup_user` | Lectura consistente de respaldo (`pg_read_all_data` / solo `SELECT`), cero escritura, cero DDL | Exclusivamente `BackupService` (`pg_dump`) |

#### Provisión Idempotente Sin Contraseñas Hardcodeadas
- La creación del rol y la rotación de credenciales NO pueden incluir contraseñas literales en archivos versionados ni en `migration.sql`.
- Se proveerá un script SQL parametrizado de provisión de infraestructura (ejecutado por el operador/CI vía `psql -v app_user=abogados_app_user -v app_password="$APP_DB_PASSWORD"`) usando bloque `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ...) ... $$` idempotente, con credenciales inyectadas exclusivamente desde gestor de secretos (Doppler/Vault/variables de entorno) y nunca registradas en logs.

---

## 11. Manejo de Transacciones y Conexiones (Pool Safety)

1. **Invariante de `SET LOCAL`:** `set_config('app.current_organization_id', $1, true)` solo persiste durante la transacción activa. Tanto `COMMIT` como `ROLLBACK` descartan automáticamente el valor antes de devolver la conexión al pool.
2. **Compatibilidad con Connection Pooling (Prisma Pool / PgBouncer transaction mode):** 100% compatible al no depender de estado de sesión.
3. **Prohibición de cambio de tenant anidado:** `ScopedPrismaService` rechaza cambiar `organizationId` dentro de una transacción abierta.
4. **Verificación obligatoria en PostgreSQL real:** Las pruebas `TST-A04-018` y `TST-A04-019` utilizan un pool de tamaño `1` (`connection_limit=1`) verificando `pg_backend_pid()` idéntico para demostrar cero contaminación tras `COMMIT` y tras `ROLLBACK`.

---

## 12. Compatibilidad con Prisma

1. **Prisma `5.22.0` Interactive Transactions (`$transaction(async (tx) => ...)`):** Garantiza ejecución secuencial sobre la misma conexión física donde corre `set_config(..., true)`.
2. **Patrón oficial `ScopedPrismaService`:** Se evita Prisma `$use` middleware (deprecado y no transaccional) a favor del runner explícito `ScopedPrismaService.runInOrgContext(ctx, async (tx) => ...)`.
3. **Compatibilidad M:N (`_ExpedienteToUser`):** Las operaciones `connect`, `disconnect` e `include` sobre `Expediente.users` operan nativamente dentro de `tx` bajo las políticas de §10.3.
4. **Nota ambiental `pgvector`:** Ninguna migración de AUTH-04 utiliza tipo `vector`; son 100% compatibles con PostgreSQL 18 estándar.

---

## 13. Tratamiento de Archivos y Almacenamiento Externo

1. **Prohibición de `storagePath` provisto por el cliente:** `DocumentsController` nunca aceptará `body.path`.
2. **Claves lógicas canónicas prefijadas por tenant:**
   `orgs/{organizationId}/expedientes/{expedienteId}/documents/{documentId}/v{versionNumber}/{uuid}`
3. **Validación previa de pertenencia:** Toda lectura, descarga, URL prefirmada o comparación de versiones (`compare/:v1/:v2`) valida ambos registros bajo `ScopedPrismaService` antes de acceder al storage.
4. **Proyección segura:** `storagePath` nunca se retorna al cliente en respuestas JSON (§8.2).
5. **Jobs asíncronos (OCR):** Reciben `{ organizationId, documentId, versionId }` y operan dentro de `ScopedPrismaService.runInOrgContext`.

---

## 14. Inventario y Clasificación de Dependencias Legacy

| Archivo y Líneas | Referencia Exacta | Clasificación | ¿Concede Acceso Hoy? | Acción en AUTH-04 |
|---|---|---|---|---|
| `backend/src/auth/guards/security-context.guard.ts:41,98,106-107` | Lee `req.user.role` (`L41`), valida `user.organizationId` (`L98`), inyecta `activeOrgId: user.organizationId`, `role: user.role` (`L106-107`). | **Autorización efectiva (riesgo alto multi-org)** | **Sí** | **`DEC-04-05`:** Conservar únicamente para compatibilidad legacy AUTH-01/02; **prohibido** utilizarlo como sustituto de `ActiveOrgContextGuard` + `OrgPermissionGuard`. Todos los módulos organizacionales dependen exclusivamente de `UserSession.activeOrganizationId`, membresía activa y permisos org. No eliminar campos legacy aún. |
| `backend/src/auth/bff/bff.controller.ts:185,241-242` | Expone `role: identity.user.role` (`L185`) y `role: req.user.role, organizationId: req.user.organizationId` (`L241-242`). | **Proyección informativa** | **No** | Enriquecer `GET /api/auth/session` con `activeOrganizationId` y membresía activa sin romper tests AUTH-02. |
| `backend/src/auth/auth.service.ts:61-62,85-93` | `refreshTokens()` firma JWT HS256 legacy con `user.role` y `user.organizationId` (`POST /auth/refresh`). | **Compatibilidad temporal / Riesgo concreto** | **Sí** (emite tokens válidos para `JwtAuthGuard`) | **`DEC-04-05`:** Deprecar `POST /auth/refresh` legacy HS256 y asegurar que no intervenga en el flujo BFF/Auth0 vigente; no eliminar columnas legacy todavía. |
| `backend/src/agenda/agenda.service.ts:50-56` | `findAll()` filtra `expediente: { organizationId: user.organizationId }`. | **Autorización efectiva (riesgo alto multi-org)** | **Sí** | Reemplazar por `req.orgContext.organizationId` vía `ActiveOrgContextGuard` + `ScopedPrismaService` y validar `expedienteId` en `createEvent()`. |
| `backend/src/client-portal/client-portal.service.ts:18-45` | `login()` valida `user.role !== "CLIENT"` sin password/CUIT, busca `client` por email sin org y firma JWT HS256 con `user.organizationId`. | **Autorización efectiva / Riesgo CRÍTICO** | **Sí** | **`DEC-04-04`:** Contener/bloquear `POST /client-portal/login` legacy en Fail-Closed (`403`/`404`) sin eliminar el módulo ni datos y sin implementar aún el Portal de Clientes definitivo. |

---

## 15. Catálogo TDS y Matriz Completa de Trazabilidad

**Principio normativo TDS:** Ninguna tabla o proceso se considera cubierto por el mero hecho de poseer una política RLS. Cada entidad tenant-scoped y proceso background DEBE contar con pruebas verificables tanto en capa de aplicación como sobre PostgreSQL 18 real bajo `abogados_app_user` (`NOBYPASSRLS`).

### 15.1. Catálogo de Pruebas TDS (Pre-Implementación)

#### A. Aislamiento entre Organizaciones y Proyecciones por Rol
- **`TST-A04-001`** *(Integración PG Real)*: Listado de `Expediente`, `Client`, `EventoAgenda`, `LegalTemplate` bajo Org A retorna solo filas de Org A (0 de Org B).
- **`TST-A04-002`** *(Integración PG Real)*: Acceso por UUID válido de Org B (`Expediente`, `Documento`, `DocumentVersion`, `LegalDraft`, `LegalRiskAnalysis`) retorna `404 Not Found`.
- **`TST-A04-003`** *(Integración PG Real)*: Escritura/eliminación (`PATCH`/`DELETE`) con UUID de Org B retorna `404 Not Found` y deja intactas las filas en PostgreSQL.
- **`TST-A04-004`** *(Integración PG Real)*: Creación indirecta de `EventoAgenda`, `Documento`, `AIChatSession` o `LegalRiskAnalysis` referenciando `expedienteId` de Org B retorna `404`/`403` y crea 0 filas.
- **`TST-A04-005`** *(Integración PG Real)*: `GET /documents/compare/:v1/:v2` con `v1` (Org A) y `v2` (Org B) retorna `404 Not Found`.
- **`TST-A04-006`** *(Unidad + Integración)*: `body.path` arbitrario en subida de documento es rechazado (`400`) y `storagePath` generado sigue `orgs/{orgA}/...`, nunca expuesto en respuesta JSON.
- **`TST-A04-007`** *(Integración PG Real)*: Manipular `organizationId: orgB` en body/query estando activo en Org A se rechaza (`400`) o ignora, sin crear ni leer nada en Org B.
- **`TST-A04-008`** *(Unidad + Integración)*: Sesión BFF con `activeOrganizationId = NULL` recibe `403 Forbidden` (`NO_ACTIVE_ORGANIZATION`).
- **`TST-A04-009`** *(Integración PG Real)*: Mutar `User.role = ADMIN` y `User.organizationId = orgB` en PostgreSQL real NO otorga elevación ni acceso cruzado (`403`).
- **`TST-A04-010`** *(Integración PG Real)*: Membresía suspendida o revocada durante sesión activa bloquea inmediatamente la siguiente petición (`403`).
- **`TST-A04-011`** *(Integración PG Real)*: Organización pasada a `SUSPENDED` bloquea operaciones de datos (`403`).
- **`TST-A04-012`** *(Unidad + Integración)*: Matriz de roles + **proyecciones de columnas** (§8.2): `STAFF` recibe únicamente metadatos de `Expediente` y `EventoAgenda` (sin `documentos`, `ocrContent`, `descripcion` estratégica, `drafts`, `riskAnalyses`); `ASSISTANT` sin `storagePath`/`AuditLog`; `LAWYER` sin `JudicialAccount.encryptedPassword`; ningún rol recibe `passwordHash`, `tokenHash`, `storagePath` ni `encryptedPassword`.
- **`TST-A04-013`** *(Integración PG Real)*: Usuario multi-org (`ORG_ADMIN` en A, `STAFF` en B) cambia org activa A → B y sus permisos + datos visibles cambian de inmediato sin contaminación.
- **`TST-A04-014`** *(Integración)*: Endpoints prototipales de plataforma/legacy (`GET /admin/tenants`, `GET /admin-api/logs`, `GET /events/logs`, `POST /client-portal/login`) responden Fail-Closed (`401`/`403`/`404`).

#### B. PostgreSQL RLS, Pool Safety y Privilegios de Rol (`abogados_app_user`)
- **`TST-A04-015`** *(PostgreSQL Real)*: Verifica `abogados_app_user` (`rolsuper=f`, `rolbypassrls=f`, no owner de tablas, sin membresía en roles migrador/superuser, sin DDL/`TRUNCATE`) y consulta sin GUC retorna `0` filas.
- **`TST-A04-016`** *(PostgreSQL Real)*: RLS `SELECT` en `Expediente`, `Client`, `Documento`, `DocumentVersion`, `EventoAgenda`, `LegalTemplate`, `JudicialAccount`, `TenantUsage`, `AIInteraction`, `AIChatSession`, `AIChatMessage`, `LegalDraft`, `LegalRiskAnalysis`, `EmployeeMetric`, `AuditLog`, `EventLog` retorna únicamente filas de Org A y oculta filas con `organizationId IS NULL`.
- **`TST-A04-017`** *(PostgreSQL Real)*: RLS `INSERT` con `organizationId = orgB` bajo GUC `orgA` falla con `42501`; `UPDATE`/`DELETE` sobre IDs de Org B afectan `0` filas.
- **`TST-A04-018`** *(PostgreSQL Real)*: Pool `connection_limit=1` (verificando mismo `pg_backend_pid()`): Tx 1 (`orgA`, `COMMIT`) → Query sin GUC (`0` filas) → Tx 2 (`orgB`, solo filas de Org B).
- **`TST-A04-019`** *(PostgreSQL Real)*: Pool `connection_limit=1` (mismo `pg_backend_pid()`): Tx 1 (`orgA`, lanza error → `ROLLBACK`) → Query sin GUC (`0` filas).
- **`TST-A04-020`** *(PostgreSQL Real)*: `AuditLog` y `EventLog` son append-only para `abogados_app_user` (`UPDATE` y `DELETE` rechazados con `42501` / 0 filas).
- **`TST-A04-021`** *(PostgreSQL Real)*: Tablas globales (`LegalNorm`, `Jurisprudence`, `JurisprudenceChunk`, `JurisprudenceCitation`, `CalendarioJudicial`, `SubscriptionPlan`) permiten `SELECT` a `abogados_app_user` y rechazan `INSERT`/`UPDATE`/`DELETE` (`42501`).

#### C. Tabla Puente `_ExpedienteToUser` (Compatibilidad Prisma M:N + PostgreSQL Real)
- **`TST-A04-022`** *(PostgreSQL Real)*: Consultar asignaciones (`include: { users }`) bajo Org A retorna solo asignaciones de expedientes de Org A; Org B recibe `0` filas.
- **`TST-A04-023`** *(PostgreSQL Real)*: Crear asignación válida (`users: { connect: { id: activeMemberOrgA } }`) dentro de `ScopedPrismaService(orgA)` persiste correctamente.
- **`TST-A04-024`** *(PostgreSQL Real)*: Eliminar asignación (`users: { disconnect: { id: activeMemberOrgA } }`) dentro de `ScopedPrismaService(orgA)` elimina la relación; Org B no puede desconectar asignaciones de Org A.
- **`TST-A04-025`** *(PostgreSQL Real)*: Asignación cruzada (conectar un usuario sin membresía `ACTIVE` en Org A, o miembro solo de Org B, a un expediente de Org A; o conectar desde Org B a un expediente de Org A) rechazada en aplicación (`403`/`404`) **Y** bloqueada por RLS `WITH CHECK` (`42501`) en prueba SQL directa bajo `abogados_app_user`.

#### D. Cobertura Explícita de Entidades IA, Financiero/Uso, Auditoría y Jobs Background
- **`TST-A04-026`** *(Integración + PG Real)*: **`AIInteraction` y `TenantUsage`:** Registro y consulta de cuota/consumo en `UsageControlService` estrictamente aislados por `organizationId` activo; RLS impide leer o incrementar uso de Org B.
- **`TST-A04-027`** *(Integración + PG Real)*: **`AIChatSession` (con y sin expediente) y `AIChatMessage`:** Chat general (`expedienteId = "general-workspace-user"`) y chat por expediente persisten `organizationId` activo; usuario de Org B no puede leer historial ni borrar mensajes de Org A ni abrir chat sobre `expedienteId` de Org A.
- **`TST-A04-028`** *(Integración + PG Real)*: **`LegalDraft` (con y sin expediente):** Creación sin `expedienteId` fija `organizationId` desde `req.orgContext`; `GET /ai/draft/:id` y listado de borradores filtran por `organizationId`; usuario de Org B recibe `404` y RLS bloquea lectura directa; registros históricos con `organizationId IS NULL` son invisibles a tenants.
- **`TST-A04-029`** *(Integración + PG Real)*: **`LegalRiskAnalysis`:** `POST`/`GET /ai/risk-score/:expedienteId` exige permiso `ai:use`, valida pertenencia de `expedienteId` a Org A y persiste `organizationId`; Org B recibe `404` y RLS aísla filas.
- **`TST-A04-030`** *(Integración + PG Real)*: **`JudicialAccount` y `JudicialSyncService` (`syncCase`/`syncSystem`):** `JudicialAccount` aislado por RLS + `judicial:manage_accounts` sin exponer `encryptedPassword`; `POST /judicial/sync/:expedienteId` rechaza `expedienteId` de Org B (`404`) y propaga `organizationId` al crear `EventoAgenda`; `POST /judicial/sync-system` bloqueado para usuarios tenant (`403`).
- **`TST-A04-031`** *(Integración + PG Real)*: **`EventLog` y `AuditLog`:** `POST /events/collect` ignora/rechaza `body.organizationId` ajeno y usa contexto validado; `GET /events/logs` bloqueado Fail-Closed; `AuditLog` aislado por organización en aplicación y RLS, sin exponer filas `organizationId IS NULL`.
- **`TST-A04-032`** *(Integración + PG Real)*: **OCR Asíncrono (`DocumentsService.triggerOCR`):** Ejecuta actualización de `ocrContent` dentro de `ScopedPrismaService.runInOrgContext({ organizationId })` bajo `abogados_app_user`; un job invocado con `organizationId` erróneo no puede modificar una `DocumentVersion` de otra organización (`0` filas afectadas).
- **`TST-A04-033`** *(Integración + PG Real)*: **Cron de Vencimientos (`AgendaService.handleCron`) y `EmployeeMetric`:** El cron itera por organización `ACTIVE` dentro de `ScopedPrismaService.runInOrgContext` sin mezclar vencimientos de Org A y Org B en el mismo lote de contexto; `EmployeeMetric` persiste `organizationId` y queda aislado por RLS.

#### E. Regresión Obligatoria
- **`TST-A04-REG-01`** a **`TST-A04-REG-04`**: Suites completas AUTH-01 (14), AUTH-02 (41), AUTH-03 (17) y harness (10) = **82/82 PASS sin regresiones**.

### 15.2. Matriz Completa de Trazabilidad TDS

| Modelo / Proceso | Servicio | Endpoint / Job | Permiso | Scoping Aplicación (`ScopedPrismaService`) | Política RLS (`abogados_app_user`) | Tests Verificables (App + PG Real) |
|---|---|---|---|---|---|---|
| `Expediente` | `ExpedientesService` | `GET/POST /expedientes` | `cases:read`, `cases:write` | `organizationId` obligatorio + proyección por rol (§8.2) | Cat A (`SELECT/INSERT/UPDATE/DELETE`) | `TST-A04-001`, `002`, `003`, `007`, `012`, `016`, `017` |
| `Client` | (Futuro `ClientsService` / contención `ClientPortalService`) | Contención `client-portal/*` | `clients:read`, `clients:write` | Filtro `organizationId` + proyección §8.2 | Cat A (`SELECT/INSERT/UPDATE/DELETE`) | `TST-A04-001`, `014`, `016`, `017` |
| `Documento` | `DocumentsService` | `POST /documents/:id/versions`, `PATCH /documents/:id/legal-hold` | `documents:write`, `documents:sensitive` | `findFirst({ id, organizationId })` + prefijo `storagePath` | Cat A (`SELECT/INSERT/UPDATE/DELETE`) | `TST-A04-002`, `003`, `004`, `006`, `012`, `016`, `017` |
| `DocumentVersion` | `DocumentsService` | `POST /documents/:id/versions`, `GET /documents/compare/:v1/:v2` | `documents:write`, `documents:read` | Validar `v1` y `v2` en `organizationId` + sin `storagePath` | Cat A (`SELECT/INSERT/UPDATE/DELETE`) | `TST-A04-002`, `005`, `006`, `016`, `017` |
| **OCR Asíncrono** | `DocumentsService.triggerOCR` | Job interno asíncrono | Contexto propagado (`organizationId`) | `runInOrgContext({ organizationId })` + `updateMany({ id, organizationId })` | Cat A sobre `DocumentVersion` | `TST-A04-032` |
| `EventoAgenda` | `AgendaService`, `JudicialSyncService` | `GET /agenda`, `POST /agenda/eventos` | `agenda:read`, `agenda:write` | Validar `expedienteId` en `organizationId`; eliminar `user.organizationId` legacy | Cat A (`SELECT/INSERT/UPDATE/DELETE`) | `TST-A04-001`, `004`, `009`, `012`, `016`, `017` |
| **Cron Vencimientos** | `AgendaService.handleCron` | `@Cron(EVERY_DAY_AT_9AM)` | Contexto sistema iterado por org | Iterar orgs `ACTIVE` → `runInOrgContext(org)` | Cat A sobre `EventoAgenda` | `TST-A04-033` |
| `LegalTemplate` | `TemplatesService` | `GET/POST /templates`, `POST /templates/:id/generate` | `templates:read`, `templates:write` | Eliminar `"default-org-id"` y `body.organizationId`; `findFirst({ id, organizationId })` | Cat A (`SELECT/INSERT/UPDATE/DELETE`) | `TST-A04-001`, `003`, `007`, `016`, `017` |
| `JudicialAccount` | (Servicio judicial futuro / acceso BD) | Sin endpoint activo hoy | `judicial:manage_accounts` | Filtrado por `organizationId`; nunca retornar `encryptedPassword` | Cat A (`SELECT/INSERT/UPDATE/DELETE`) | `TST-A04-012`, `016`, `017`, `030` |
| **Sincronización Judicial** | `JudicialSyncService` | `POST /judicial/sync/:expedienteId`, `POST /judicial/sync-system` | `judicial:sync` (`sync-system` bloqueado tenant) | Verificar `expedienteId` en `organizationId`; propagar `organizationId` a `EventoAgenda` | Cat A (`Expediente`, `EventoAgenda`) | `TST-A04-030` |
| `AIInteraction` | `UsageControlService` | Tracking interno IA | `usage:read` (lectura) / `ai:use` (escritura) | `organizationId` desde `req.orgContext` + FK a `Organization` | Cat A (`SELECT/INSERT/UPDATE/DELETE`) | `TST-A04-016`, `017`, `026` |
| `TenantUsage` | `UsageControlService` | Control de cuota interno | `usage:read` | `organizationId` desde `req.orgContext` | Cat A (`SELECT/INSERT/UPDATE/DELETE`) | `TST-A04-016`, `017`, `026` |
| `AIChatSession` | `AIChatService`, `ChatContextService` | `POST/GET/DELETE /ai/chat/:expedienteId` | `ai:use` | Persistir `organizationId` (incl. chat sin expediente); validar `expedienteId` en org | Cat A (`SELECT/INSERT/UPDATE/DELETE`) | `TST-A04-004`, `016`, `017`, `027` |
| `AIChatMessage` | `AIChatService` | `POST/GET/DELETE /ai/chat/:expedienteId` | `ai:use` | Propagar `organizationId` desde sesión validada | Cat A (`SELECT/INSERT/UPDATE/DELETE`) | `TST-A04-016`, `017`, `027` |
| `LegalDraft` (con y sin expediente) | `DraftingService` | `POST /ai/draft`, `GET /ai/draft/:id`, `GET /ai/draft/user/:userId` | `ai:use` | Ignorar `body.userId`; fijar `organizationId` desde `req.orgContext`; validar `expedienteId?` si existe | Cat A (`SELECT/INSERT/UPDATE/DELETE`) | `TST-A04-002`, `016`, `017`, `028` |
| `LegalRiskAnalysis` | `LegalRiskService` | `POST/GET /ai/risk-score/:expedienteId` | `ai:use` | Validar `expedienteId` en `organizationId`; fijar `organizationId` y `userId` desde contexto | Cat A (`SELECT/INSERT/UPDATE/DELETE`) | `TST-A04-002`, `004`, `016`, `017`, `029` |
| `AuditLog` | `OrgAuditService` | `GET /api/organizations/:id/audit` | `audit:read` | Filtrar por `organizationId`; sanitizar secretos | Cat B (`SELECT/INSERT` append-only; `NULL` oculto) | `TST-A04-016`, `020`, `031` |
| `EventLog` | `AnalyticsService`, `AdminDataService` | `POST /events/collect`, `GET /events/logs`, `GET /admin-api/logs` | Contención Fail-Closed en lecturas globales; contexto validado en `collect` | No confiar en `body.organizationId`; bloquear `GET` global | Cat B (`SELECT/INSERT` append-only; `NULL` oculto) | `TST-A04-014`, `016`, `020`, `031` |
| `EmployeeMetric` | `AnalyticsService.updateEmployeeMetrics` | Actualización interna métricas | Contexto organizacional | Persistir `organizationId` desde contexto | Cat A (`SELECT/INSERT/UPDATE/DELETE`; históricos `NULL` ocultos) | `TST-A04-016`, `033` |
| `_ExpedienteToUser` | Prisma M:N (`Expediente.users`) | Asignación/desasignación en expedientes | `cases:write`, `cases:read` | Verificar `expediente` y `OrganizationMembership(ACTIVE)` en org activa | Cat D (`SELECT`, `INSERT` doble `EXISTS`, `DELETE`) | `TST-A04-022`, `023`, `024`, `025` |
| Tablas Globales (`LegalNorm`, `Jurisprudence*`, `CalendarioJudicial`, `SubscriptionPlan`) | `LegalSearchService`, `JurisprudenceSearchService`, `AgendaService` | `GET /legal/*`, `GET /jurisprudence/*`, `GET /agenda/feriados/*` | `knowledge:read` (escritura bloqueada para tenants) | Lectura compartida; contener endpoints `ingest`/`import` | Cat E (`GRANT SELECT` únicamente para `abogados_app_user`) | `TST-A04-021` |

---

## 16. Estrategia de Migraciones y Reglas de Backfill (Diseño — NO Ejecutadas)

Las migraciones se ejecutarán en **dos fases estrictamente controladas** (primero sobre `abogados_test` mediante `prisma migrate deploy`, nunca `db push`, nunca sobre producción sin aprobación):

### 16.1. Reglas Inmutables de Backfill

1. Resolver `"organizationId"` **exclusivamente** mediante relaciones verificables en base de datos.
2. **Prohibido** utilizar `User.organizationId` o `User.role` como fuente de asignación.
3. **Prohibido** asignar arbitrariamente una organización a registros ambiguos.
4. **Prohibido** eliminar registros o alterar datos jurídicos para forzar que la migración pase.
5. **No imponer `NOT NULL`** sobre una tabla mientras exista al menos un registro huérfano o ambiguo sin resolución explícita autorizada.
6. Todo registro que permanezca con `"organizationId" IS NULL` queda automáticamente invisible para todos los tenants bajo las políticas RLS Fail-Closed (`"organizationId" IS NOT NULL AND ...`) hasta su resolución humana/administrativa.

### 16.2. Reglas de Backfill por Entidad

| Entidad | Estrategia de Resolución Verificable | Tratamiento de Huérfanos / Ambiguos | Momento de `NOT NULL` y FK |
|---|---|---|---|
| `Documento` | `UPDATE "Documento" d SET "organizationId" = e."organizationId" FROM "Expediente" e WHERE d."expedienteId" = e."id"` | Reportar `COUNT(*)` e IDs donde `"organizationId" IS NULL` (solo posible ante corrupción previa). | Fase B tras confirmar `0` nulos. |
| `DocumentVersion` | `UPDATE "DocumentVersion" dv SET "organizationId" = e."organizationId" FROM "Documento" d JOIN "Expediente" e ON e."id" = d."expedienteId" WHERE dv."documentId" = d."id"` | Reportar si existen nulos; no eliminar ni inventar org. | Fase B tras confirmar `0` nulos. |
| `EventoAgenda` | `UPDATE "EventoAgenda" ev SET "organizationId" = e."organizationId" FROM "Expediente" e WHERE ev."expedienteId" = e."id"` | Reportar si existen nulos. | Fase B tras confirmar `0` nulos. |
| `LegalRiskAnalysis` | `UPDATE "LegalRiskAnalysis" r SET "organizationId" = e."organizationId" FROM "Expediente" e WHERE r."expedienteId" = e."id"` | Reportar si existen nulos. | Fase B tras confirmar `0` nulos. |
| `AIChatSession` | 1) Si `expedienteId` coincide con `"Expediente".id`: tomar `e."organizationId"`. 2) Si `expedienteId = 'general-workspace-user'` o no coincide con ningún expediente: buscar únicamente evidencia verificable en `AuditLog`/`EventLog` vinculada a ese `entityId`. Si no existe evidencia verificable → **conservar `"organizationId" = NULL`** y reportar. | No usar `User.organizationId`; filas `NULL` quedan confinadas fuera de tenants bajo RLS hasta resolución autorizada. | `NOT NULL` diferido a Fase B tras resolución explícita; nuevas sesiones siempre exigen `organizationId` desde `req.orgContext`. |
| `AIChatMessage` | `UPDATE "AIChatMessage" m SET "organizationId" = s."organizationId" FROM "AIChatSession" s WHERE m."sessionId" = s."id" AND s."organizationId" IS NOT NULL` | Hereda `NULL` si su `AIChatSession` padre no es resoluble; se reporta junto con la sesión padre. | Fase B tras resolución de `AIChatSession`. |
| `LegalDraft` | 1) Si `"expedienteId" IS NOT NULL`: resolver vía `JOIN "Expediente" e ON e."id" = ld."expedienteId"`. 2) Si `"expedienteId" IS NULL`: buscar evidencia verificable en `AuditLog`/`EventLog` vinculada a `ld."id"`. Si no existe evidencia verificable → **conservar `"organizationId" = NULL`** y reportar. | No usar `User.organizationId`; filas `NULL` invisibles a tenants bajo RLS hasta resolución autorizada. | `NOT NULL` diferido a Fase B tras resolución explícita; nuevos borradores siempre fijan `organizationId` desde `req.orgContext`. |
| `AIInteraction` | Ya posee columna `"organizationId" TEXT NOT NULL`. Ejecutar auditoría pre-flight: `SELECT id, "organizationId" FROM "AIInteraction" ai WHERE NOT EXISTS (SELECT 1 FROM "Organization" o WHERE o.id = ai."organizationId")`. | Si existen huérfanos, reportar y diferir la FK hasta resolución explícita (no borrar registros contables). | Agregar FK hacia `"Organization"(id)` solo tras confirmar `0` huérfanos. |
| `EmployeeMetric` | **Decisión expresa: entidad TENANT-SCOPED.** Justificación: mide actividad operativa del abogado dentro de un estudio específico (`ticketsResolved`, `aiPromptsUsed`, `documentsRead`, `activeTimeMinutes`); en un SaaS multi-tenant donde un abogado trabaja en 2 estudios, agregarlas globalmente filtraría volumen de trabajo de un estudio al otro. Añadir `"organizationId" TEXT NULL`; las filas históricas carecen de relación verificable con una org (y está prohibido usar `User.organizationId`) → **conservar históricos en `NULL`** y reportar. | Filas históricas `NULL` invisibles a tenants bajo RLS hasta decisión administrativa. | Mantener `"organizationId"` nullable en Fase A; nuevos registros exigen `organizationId`; migración de unicidad a `(userId, organizationId, date)` y `NOT NULL` en Fase B tras resolución histórica. |

### 16.3. Secuencia de Migraciones Versionadas

1. **Migración A (Expand + Backfill Verificable + Reporte Pre-Flight):** Añade columnas `"organizationId" TEXT NULL`, índices `"<table>_organizationId_idx"`, FKs `ON DELETE RESTRICT/SET NULL` y ejecuta el backfill SQL determinista de §16.2 sin alterar filas ambiguas.
2. **Migración B (RLS + `FORCE ROW LEVEL SECURITY` + `_ExpedienteToUser`):** Activa RLS y políticas `SELECT`/`INSERT`/`UPDATE`/`DELETE` sobre Categorías A, B y D (§10.2 y §10.3).
3. **Script de Provisión Idempotente de Roles (Infraestructura, parametrizado sin secretos en Git):** Crea/actualiza `abogados_app_user` (`NOBYPASSRLS`) y `abogados_backup_user` con privilegios exactos de §10.4.
4. **Migración C (Contract — Fase B diferida):** Aplica `NOT NULL` solo en tablas donde el reporte pre-flight certifique `0` filas nulas o tras resolución humana aprobada.

---

## 17. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| SQL Injection o compromiso de credenciales runtime permite ejecutar `set_config` arbitrario | **Crítico** | Reconocido en modelo de amenazas (§10.1): consultas 100% parametrizadas, prohibición de `$queryRawUnsafe`, `abogados_app_user` sin DDL/owner/roles privilegiados, validación de DTOs y defensa en aplicación. |
| Conexión runtime como superuser `postgres` omite RLS | **Crítico** | `TST-A04-015` verifica `rolsuper=f` y `rolbypassrls=f` + separación estricta de `DATABASE_URL` vs `MIGRATION_DATABASE_URL`. |
| Contaminación de GUC entre solicitudes en pool | **Crítico** | Exclusivamente `set_config(..., true)` (`SET LOCAL`) + pruebas `TST-A04-018/019` con `connection_limit=1` y mismo `pg_backend_pid()`. |
| Exposición de columnas sensibles a roles de menor privilegio (`STAFF`/`ASSISTANT`) | **Alto** | Proyecciones explícitas obligatorias (§8.2) + test `TST-A04-012`. |
| Asignaciones cruzadas en tabla puente `_ExpedienteToUser` | **Alto** | Política `INSERT` con doble `EXISTS` (`Expediente` + `OrganizationMembership ACTIVE`) + pruebas `TST-A04-022..025`. |
| Backfill destructivo o asignación indebida por `User.organizationId` | **Alto** | Migración Expand/Contract en dos fases (§16): cero borrados, cero uso de `User.organizationId`, filas `NULL` aisladas Fail-Closed por RLS. |
| Jobs background (`handleCron`, `triggerOCR`) fallan o mezclan tenants | **Alto** | Propagación obligatoria de `organizationId` y ejecución bajo `ScopedPrismaService` (`TST-A04-032`, `033`). |

---

## 18. Criterios de Aceptación de AUTH-04

1. `ActiveOrgContextGuard`, `OrgPermissionGuard`, `ScopedPrismaService` y proyecciones por rol implementados y cubiertos.
2. Ningún endpoint organizacional confía en `organizationId` del cliente ni en `User.organizationId`/`User.role`.
3. Ninguna consulta o mutación puede leer, modificar, eliminar ni inferir filas de otra organización.
4. `ENABLE` + `FORCE ROW LEVEL SECURITY` verificados en PostgreSQL 18 real bajo `abogados_app_user` (`NOSUPERUSER`, `NOBYPASSRLS`, no owner, sin DDL/TRUNCATE), incluyendo `_ExpedienteToUser`.
5. Aislamiento demostrado con `connection_limit=1` tras `COMMIT` y `ROLLBACK`.
6. Backfill ejecutado sin pérdida de datos ni asignación arbitraria; registros ambiguos reportados y confinados Fail-Closed.
7. Endpoints abiertos de plataforma/admin/portal legacy contenidos en Fail-Closed.
8. Todas las pruebas del catálogo (`TST-A04-001` a `TST-A04-033`) aprobadas (0 fallos, 0 skips encubiertos).
9. Regresión completa AUTH-01 (14), AUTH-02 (41), AUTH-03 (17) y harness (10) = 82/82 PASS.
10. Build y ESLint exitosos (`0` errores); sin Redis ni dependencias pagas; sin commits/pushes no autorizados.

---

## 19. Exclusiones Expresas

AUTH-04 **NO** implementará: CRUD funcional completo de Clientes ni de Expedientes, driver productivo de S3/GCS, Agenda funcional ni notificaciones por correo, Portal de Clientes funcional, IA jurídica nueva, suscripciones/facturación SaaS, MFA, Redis ni eliminación física de las columnas legacy `User.role` y `User.organizationId`.

---

## 20. Plan de Implementación por Etapas (Aprobación Documental — Implementación Aún No Autorizada)

> **Estado de Gate:** `SPEC-AUTH-004 v0.2.0 — APPROVED` | `AUTH-04 IMPLEMENTATION — NOT AUTHORIZED`. Las etapas siguientes no deben iniciarse sin una orden de implementación posterior, específica y expresa.

1. **Etapa 4.1 — Primitivas de Aislamiento y Proyecciones:** Implementar `ActiveOrgContextGuard`, `OrgPermissionGuard`, `ScopedPrismaService` y selectores/proyecciones por rol (§8.2).
2. **Etapa 4.2 — Migración A (Expand + Backfill Verificable), Migración B (RLS + `_ExpedienteToUser`) y Provisión `abogados_app_user` en `abogados_test`:** Aplicar exclusivamente sobre `abogados_test` y validar reporte pre-flight de nulos/huérfanos.
3. **Etapa 4.3 — Scoping de Endpoints/Jobs Existentes y Contención Legacy:** Proteger `expedientes`, `documents` (incl. `triggerOCR`), `agenda` (incl. `handleCron`), `templates`, `judicial`, `ia/*`, `analytics` y contener `admin/*`, `events/logs` y `client-portal/login` legacy en Fail-Closed.
4. **Etapa 4.4 — Ejecución TDS Real en PostgreSQL 18 + Regresión Total + Cierre:** Fase RED → GREEN de `TST-A04-001..033`, regresión 82/82 de AUTH-01/02/03, ESLint y `nest build`.
5. **Etapa Siguiente (Post-Cierre AUTH-04):** Inicio inmediato de los módulos funcionales de **Clientes** y **Expedientes**.
