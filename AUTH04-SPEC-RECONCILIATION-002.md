# INFORME DE RECONCILIACIÓN DOCUMENTAL FINAL — SPEC-AUTH-004
## Expediente: `AUTH04-SPEC-RECONCILIATION-002`
**Repositorio:** `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law`  
**Documento consolidado:** `SPEC-AUTH-004.md` (`0.1.0-DRAFT` → `0.2.0-DRAFT`)  
**Modalidad:** READ-ONLY sobre código productivo, esquema Prisma, base de datos y Git  
**Estado:** `DRAFT — PENDIENTE DE APROBACIÓN FORMAL (IMPLEMENTACIÓN NO AUTORIZADA)`  
**Fecha:** 24/11/2026

---

## 1. Registro de Observaciones y Correcciones Aplicadas

| ID | Observación | Análisis Técnico | Corrección Incorporada | Secciones Modificadas en `SPEC-AUTH-004.md` | Estado |
|---|---|---|---|---|---|
| **D-01** | **Límites de seguridad de PostgreSQL RLS** | En v0.1.0-DRAFT se describió RLS con `set_config(..., true)` sin explicitar el modelo de amenazas de un custom GUC: un atacante con capacidad de SQL arbitrario o con credenciales runtime comprometidas puede invocar `set_config('app.current_organization_id', ...)` dentro de su transacción. | Se incorporó §10.1 explicando explícitamente qué mitiga RLS (errores de consulta y omisiones de filtro en aplicación) y qué NO mitiga (SQL injection ni compromiso total de credenciales runtime); se reforzó la prohibición de `$queryRawUnsafe`/`$executeRawUnsafe`, la parametrización obligatoria y la prohibición de ownership/asunción de roles privilegiados, manteniendo `set_config(..., true)` sin Redis. | §10.1, §9, §17 | **RESUELTA** |
| **D-02** | **Backfill de entidades hijas y clasificación de `EmployeeMetric`** | En v0.1.0-DRAFT el backfill era genérico y no especificaba tabla por tabla cómo resolver huérfanos/ambiguos (`AIChatSession` sin expediente, `LegalDraft` sin expediente, `AIInteraction` sin FK) ni justificaba el alcance de `EmployeeMetric`. | Se definió estrategia Expand/Contract en dos fases (§16.1–16.3) con reglas explícitas por entidad (`Documento`, `DocumentVersion`, `EventoAgenda`, `AIChatSession`, `AIChatMessage`, `LegalDraft`, `LegalRiskAnalysis`, `AIInteraction`, `EmployeeMetric`): prohibido usar `User.organizationId`/`User.role`, prohibido asignar arbitrariamente o borrar registros, reporte pre-flight de huérfanos, `NOT NULL` diferido a Fase B tras resolución explícita y confinamiento Fail-Closed de filas `NULL` bajo RLS. Se clasificó expresamente `EmployeeMetric` como **TENANT-SCOPED** con justificación multi-tenant. | §4.2, §10.2, §16.1, §16.2, §16.3, §17 | **RESUELTA** |
| **D-03** | **Permisos de lectura por columnas (proyecciones explícitas)** | En v0.1.0-DRAFT §8 indicaba permisos de lectura a nivel de recurso sin definir las proyecciones mínimas de columnas por rol ni separar responsabilidad de filas (RLS) vs columnas (aplicación). | Se añadió §8.2 con la regla normativa de proyecciones explícitas (`select`/DTO mappers), lista de columnas prohibidas en toda respuesta HTTP (`passwordHash`, `refreshTokenHash`, `sessionToken`, `codeVerifier`, `tokenHash`, `encryptedPassword`, `storagePath`) y tabla detallada de proyecciones mínimas para `STAFF`, `ASSISTANT`, `LAWYER`, `ORG_ADMIN` y `ORG_OWNER`. | §7, §8.1, §8.2, §9, §15.1 (`TST-A04-012`), §17 | **RESUELTA** |
| **D-04** | **Políticas RLS completas y pruebas para `_ExpedienteToUser`** | En v0.1.0-DRAFT solo se esbozaba un `EXISTS` genérico para `_ExpedienteToUser` sin separar `SELECT`, `INSERT` y `DELETE`, sin validar la membresía `ACTIVE` del usuario asignado (`"B"`) y sin pruebas específicas de compatibilidad Prisma M:N. | Se añadió §10.3 con las políticas SQL completas `SELECT`, `INSERT` (doble `EXISTS`: expediente en org activa + `OrganizationMembership(status='ACTIVE')` del usuario `"B"` en la misma org) y `DELETE` (sin `UPDATE`), análisis de compatibilidad con `connect`/`disconnect`/`include` de Prisma y 4 pruebas reales en PostgreSQL (`TST-A04-022` a `TST-A04-025`). | §10.2, §10.3, §12, §15.1, §15.2, §17 | **RESUELTA** |
| **D-05** | **Privilegios del rol runtime `abogados_app_user` y separación de credenciales** | En v0.1.0-DRAFT faltaba la especificación completa de atributos del rol, tabla de privilegios por categoría, denegación explícita de `TRUNCATE`/DDL/ownership/asunción de roles, separación de 3 credenciales y provisión idempotente sin contraseñas hardcodeadas. | Se añadió §10.4 detallando atributos (`LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`), matriz de `GRANT`/`REVOKE` (sin DDL, sin `TRUNCATE`, sin ownership, sin acceso a `_prisma_migrations`, solo `SELECT` en tablas globales, solo `SELECT/INSERT` en `AuditLog`/`EventLog`), separación en 3 perfiles (`DATABASE_URL`, `MIGRATION_DATABASE_URL`, `BACKUP_DATABASE_URL`) y provisión idempotente parametrizada sin contraseñas literales. | §10.4, §15.1 (`TST-A04-015`, `020`, `021`), §16.3, §18 | **RESUELTA** |
| **D-06** | **Matriz completa de trazabilidad TDS (`Modelo → Servicio → Endpoint/Job → Permiso → Scoping → RLS → Test`)** | En v0.1.0-DRAFT el catálogo cubría 21 tests sin matriz integral de trazabilidad ni tests dedicados para `AIInteraction`, `AIChatSession`/`AIChatMessage`, `LegalDraft` sin expediente, `LegalRiskAnalysis`, `JudicialAccount`, `TenantUsage`, `EventLog`, `EmployeeMetric`, `_ExpedienteToUser`, OCR asíncrono, cron de vencimientos y sincronización judicial. | Se amplió §15.1 a **33 pruebas TDS** (`TST-A04-001` a `TST-A04-033`) más 4 bloques de regresión (`TST-A04-REG-01..04`) y se incorporó §15.2 con la **Matriz Completa de Trazabilidad TDS** cubriendo cada modelo y proceso background con evidencia dual (capa de aplicación + PostgreSQL 18 real). | §15.1, §15.2, §18 | **RESUELTA** |

---

## 2. Verificación de Consistencia Interna

- **Aplicación vs. RLS:** Alineado en §6, §8.2, §9 y §10: RLS controla filas (Fail-Closed si GUC vacío o `organizationId IS NULL`), mientras `ActiveOrgContextGuard` + `OrgPermissionGuard` + `select` explícito controlan contexto activo, permisos y columnas.
- **Migraciones vs. RLS:** Alineado en §10.2 y §16: la Migración A añade `"organizationId"` nullable + backfill determinista sin borrar datos; RLS oculta automáticamente toda fila `NULL` (Fail-Closed) hasta que la Migración C (Fase B) aplique `NOT NULL` tras verificación de `0` huérfanos o resolución aprobada.
- **TDS vs. Diseño:** Los 33 tests (`TST-A04-001` a `TST-A04-033`) y la matriz de §15.2 trazan 1 a 1 cada entidad tenant-scoped, cada tabla puente/híbrida/global y cada proceso background (OCR, cron, sync judicial) con pruebas en aplicación y en PostgreSQL 18 real bajo `abogados_app_user`.
- **Conservación de AUTH-01/02/03:** Sin contradicciones; todas las decisiones cerradas de AUTH-01, AUTH-02 y AUTH-03 se preservan intactas.

---

## 3. Decisiones que Aún Requieren Aprobación Humana (Antes de Autorizar Implementación)

| ID | Decisión Pendiente de Aprobación | Opciones / Recomendación en `SPEC-AUTH-004 v0.2.0-DRAFT` |
|---|---|---|
| **DEC-04-01** | **Aprobación general de la arquitectura de doble barrera (Aplicación + PostgreSQL RLS + `abogados_app_user`)** | Recomendado: aprobar §9 y §10 completos (incluye separación de credenciales `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `BACKUP_DATABASE_URL`). |
| **DEC-04-02** | **Aprobación del plan de migración Expand/Contract y clasificación de `EmployeeMetric` como tenant-scoped (§16)** | Recomendado: Migración A (nullable + backfill verificable sin usar `User.organizationId` + reporte de huérfanos) y Migración C (`NOT NULL`) solo tras confirmar `0` nulos o resolución explícita. |
| **DEC-04-03** | **Aprobación de la Matriz de Permisos y Proyecciones de Columnas por Rol (§8.1 y §8.2)** | Recomendado: validar especialmente el alcance de `STAFF` (metadatos de expedientes/agenda sin documentos ni estrategia) y `LAWYER` (sin `documents:sensitive` ni `cases:delete`). |
| **DEC-04-04** | **Contención Fail-Closed de endpoints prototipales abiertos (`admin/*`, `admin-api/*`, `GET /events/logs`, `POST /client-portal/login`) y escrituras en `LegalNorm`/`Jurisprudence`** | Recomendado: bloquear en Fail-Closed (`403`/`404`) durante AUTH-04 hasta construir sus módulos definitivos con autorización formal. |
| **DEC-04-05** | **Alcance sobre `SecurityContextGuard` y `POST /auth/refresh` legacy (§14)** | Recomendado: mantener `SecurityContextGuard` intacto para regresión AUTH-01/02 (usando `ActiveOrgContextGuard` + `OrgPermissionGuard` en módulos organizacionales) y deprecar `POST /auth/refresh` legacy HS256. |
| **DEC-04-06** | **Registro de eventos `AuditLog`/`EventLog` de plataforma sin organización (`organizationId IS NULL`) bajo RLS (§10.2 Cat B)** | Definir si eventos pre-tenant (p. ej. fallo de login sin org) se escriben mediante política `INSERT` acotada o rol/servicio separado de plataforma (siempre invisibles en `SELECT` para todo tenant). |

---

## 4. Declaración de Integridad READ-ONLY

Se declara expresamente que en `AUTH04-SPEC-RECONCILIATION-002` **NO se modificó código productivo, NO se alteró `schema.prisma`, NO se ejecutaron migraciones ni `prisma db push`, NO se crearon roles ni se modificó PostgreSQL, NO se instalaron dependencias y NO se realizaron commits ni pushes en Git.**

**Estado:** `SPEC-AUTH-004.md v0.2.0-DRAFT` permanece en estado `DRAFT — PENDIENTE DE APROBACIÓN FORMAL`. Implementación de AUTH-04 NO iniciada.

