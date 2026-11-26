# INFORME TÉCNICO DE IMPLEMENTACIÓN — AUTH-03
## Expediente: `AUTH0-IMPLEMENTATION-007`
## Organizaciones, Membresías y Roles Multi-Organización
**Repositorio:** `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law\`  
**Rama:** `master` | **Baseline Git:** `1d3dc01` | **Baseline Técnico:** `SPEC-AUTH-001 v1.0.8`  
**Fecha:** 24/11/2026 | **Dictamen:** **AUTH-03 IMPLEMENTADO Y VERIFICADO SOBRE POSTGRESQL REAL**

---

## 1. DIAGNÓSTICO INICIAL (FASE 0 — READ-ONLY)

- **`Organization` existente:** Poseía `id`, `name`, `cuit`, `plan`, `settings`, `createdAt`, `updatedAt`. Se reutilizó sin duplicar entidades, extendiéndolo de forma no destructiva con `tradeName` y `status` (`OrganizationStatus`, default `ACTIVE`).
- **Reconciliación de roles sin romper AUTH-01/AUTH-02:** El modelo `User` mantiene `role` (`UserRole` legacy) y `organizationId` (FK legacy) para no romper AUTH-01/AUTH-02 ni módulos existentes. Los roles multi-tenant contextuales se implementaron mediante el enum dedicado `OrganizationRole` (`ORG_OWNER`, `ORG_ADMIN`, `LAWYER`, `ASSISTANT`, `STAFF`) exclusivamente en `OrganizationMembership` (sin `SUPER_ADMIN`, sin confundir `ADMIN` global con `ORG_ADMIN`).
- **Integración con sesión BFF:** Se extendió `UserSession` con `activeOrganizationId String?` (FK nullable `ON DELETE SET NULL` hacia `Organization`), permitiendo persistir y resolver la organización activa en el servidor sin confiar en datos del navegador.
- **Auditoría reutilizada:** Se extendió `AuditLog` de forma compatible con `organizationId`, `targetUserId`, `result` y `correlationId`, sanitizando automáticamente cualquier clave sensible (`token`, `secret`, `password`, `hash`, `verifier`).

---

## 2. MODELOS, TRANSICIONES Y RELACIONES INCORPORADOS

### Enums
- `OrganizationStatus`: `ACTIVE`, `SUSPENDED`, `INACTIVE`
  - Transiciones válidas: `ACTIVE -> SUSPENDED | INACTIVE`; `SUSPENDED -> ACTIVE | INACTIVE`; `INACTIVE` es terminal.
- `MembershipStatus`: `INVITED`, `ACTIVE`, `SUSPENDED`, `REVOKED`
  - Transiciones válidas: `INVITED -> ACTIVE | REVOKED`; `ACTIVE -> SUSPENDED | REVOKED`; `SUSPENDED -> ACTIVE | REVOKED`; `REVOKED` es terminal (preserva identidad global e historial; requiere nueva invitación).
- `OrganizationRole`: `ORG_OWNER`, `ORG_ADMIN`, `LAWYER`, `ASSISTANT`, `STAFF`.
- `InvitationStatus`: `PENDING`, `ACCEPTED`, `EXPIRED`, `REVOKED`.

### Modelos / Extensiones
- `Organization`: + `tradeName String?`, `status OrganizationStatus @default(ACTIVE)`, índice `[status]`, relaciones a `OrganizationMembership`, `OrganizationInvitation`, `UserSession`, `AuditLog`.
- `OrganizationMembership`: `@@unique([userId, organizationId])`, índices `[organizationId, status]` y `[userId, status]`, FKs `ON DELETE CASCADE` a `User` y `Organization`.
- `OrganizationInvitation`: `tokenHash String @unique` (SHA-256 de 32 bytes CSPRNG, nunca plaintext), `invitedEmail`, `role`, `targetUserId?`, `invitedById`, `status`, `expiresAt`, `acceptedAt`, `acceptedByUserId`, `revokedAt`, `revokedById`, índices `[organizationId, status]` y `[expiresAt]`.
- `UserSession`: + `activeOrganizationId String?`, índice `[activeOrganizationId]`, FK `ON DELETE SET NULL` a `Organization`.
- `AuditLog`: + `organizationId String?`, `targetUserId String?`, `result String?`, `correlationId String?`, índices `[organizationId]` y `[correlationId]`.

---

## 3. ENDPOINTS IMPLEMENTADOS Y MATRIZ DE PERMISOS

Todas las rutas exigen sesión BFF válida (`BffSessionGuard`) y todas las mutaciones exigen Anti-CSRF (`CsrfGuard`). Las rutas con `:organizationId` validan membresía `ACTIVE`, organización `ACTIVE` y rol contextual mediante `OrgRolesGuard`.

| Método y Ruta | Operación | Autorización Mínima y Restricciones |
|---|---|---|
| `POST /api/organizations` | Crear organización | Usuario autenticado con `UserIdentity` Auth0 (queda como `ORG_OWNER ACTIVE`) |
| `GET /api/organizations` | Consultar organizaciones propias | Usuario autenticado (solo membresías `ACTIVE`) |
| `POST /api/organizations/active` | Seleccionar organización activa | Usuario con membresía `ACTIVE` en organización `ACTIVE` (persiste en `UserSession`) |
| `GET /api/organizations/active` | Resolver contexto de organización activa | Sesión BFF + revalidación en vivo de membresía `ACTIVE` y organización `ACTIVE` |
| `PATCH /api/organizations/:organizationId/status` | Suspender / reactivar / desactivar organización | Solo `ORG_OWNER` (`@AllowSuspendedOrg`) + validación de transición |
| `GET /api/organizations/:organizationId/members` | Consultar miembros | `ORG_OWNER` / `ORG_ADMIN` |
| `POST /api/organizations/:organizationId/members/:membershipId/suspend` | Suspender miembro | `ORG_OWNER` / `ORG_ADMIN`; `ORG_ADMIN` no puede suspender `ORG_OWNER`; protege último `ORG_OWNER` (`409`) |
| `POST /api/organizations/:organizationId/members/:membershipId/reactivate` | Reactivar miembro suspendido | `ORG_OWNER` / `ORG_ADMIN`; solo `SUSPENDED -> ACTIVE` |
| `POST /api/organizations/:organizationId/members/:membershipId/revoke` | Revocar membresía | `ORG_OWNER` / `ORG_ADMIN`; protege último `ORG_OWNER` (`409`); preserva `User`, `UserIdentity` e historial |
| `PATCH /api/organizations/:organizationId/members/:membershipId/role` | Cambiar rol de miembro | Solo `ORG_OWNER`; prohíbe autoelevación (`403`) y asignación directa de `ORG_OWNER` (`403`) |
| `POST /api/organizations/:organizationId/transfer-ownership` | Transferir propiedad | Solo `ORG_OWNER`; transaccional (target -> `ORG_OWNER`, actor -> `ORG_ADMIN`) y auditada |
| `POST /api/organizations/:organizationId/invitations` | Emitir invitación | `ORG_OWNER` / `ORG_ADMIN`; prohíbe invitar como `ORG_OWNER` (`403`); persiste solo SHA-256 `tokenHash` |
| `POST /api/organizations/:organizationId/invitations/:invitationId/revoke` | Revocar invitación pendiente | `ORG_OWNER` / `ORG_ADMIN` |
| `POST /api/invitations/accept` | Aceptar invitación | Destinatario autenticado con `UserIdentity` Auth0 elegible (sin auto-link por email); atómico vía `UPDATE ... RETURNING` + `$transaction` |
| `GET /api/organizations/:organizationId/audit` | Consultar auditoría de la organización | `ORG_OWNER` / `ORG_ADMIN`; estrictamente filtrado por `:organizationId` |

### Resolución del Contexto de Organización Activa
1. Al invocar `POST /api/organizations/active`, el backend valida que `(req.session.userId, organizationId)` posea `OrganizationMembership.status = ACTIVE` y `Organization.status = ACTIVE`, persiste `UserSession.activeOrganizationId` en PostgreSQL y audita `ACTIVE_ORGANIZATION_CHANGED`.
2. Al invocar `GET /api/organizations/active`, el backend lee `req.session.activeOrganizationId` (nunca parámetros del cliente) y revalida en vivo contra PostgreSQL que la membresía y la organización sigan `ACTIVE`. Ante suspensión o revocación, la petición se rechaza inmediatamente con `403 Forbidden`.

---

## 4. ARCHIVOS CREADOS Y MODIFICADOS

- **Esquema y Migración:**
  - `backend/prisma/schema.prisma`
  - `backend/prisma/migrations/20261124010000_add_auth03_organizations_memberships_invitations_audit/migration.sql`
- **Módulo AUTH-03 (`backend/src/organizations/`):**
  - `organizations.module.ts`, `organizations.controller.ts`, `invitations.controller.ts`
  - `organizations.service.ts`, `memberships.service.ts`, `invitations.service.ts`, `active-organization.service.ts`, `org-audit.service.ts`
  - `guards/org-roles.guard.ts`, `decorators/org-roles.decorator.ts`, `dto/organizations.dto.ts`
  - `backend/src/app.module.ts` (registro de `OrganizationsModule`)
- **Pruebas TDS:**
  - `backend/test/organizations/organizations-auth03.spec.ts`
  - `backend/test/integration/auth03-db.spec.ts`
  - `backend/test/fixtures/user.fixture.ts` (`activeOrganizationId: null` en fixture de `UserSession`)

---

## 5. MIGRACIÓN Y EVIDENCIA POSTGRESQL REAL

- **Base aislada exclusiva:** `postgresql://postgres:postgres@localhost:5432/abogados_test?schema=public` (PostgreSQL 18 local, validada por `db-guard.ts`). No se ejecutó `prisma db push` ni se tocaron bases compartidas o productivas.
- **Aplicación:** `npx prisma migrate deploy` aplicó `20261124010000_add_auth03_organizations_memberships_invitations_audit` limpiamente (`10 migrations found — Database schema is up to date!`).
- **Verificación física (`psql \d`):** Confirmadas tablas, enums, unicidad `OrganizationMembership_userId_organizationId_key`, `OrganizationInvitation_tokenHash_key`, FKs e índices sobre `Organization`, `OrganizationMembership`, `OrganizationInvitation`, `UserSession` y `AuditLog`.

---

## 6. EVIDENCIA TDS (RED → GREEN) Y REGRESIÓN COMPLETA

### Fase RED
Antes de crear `backend/src/organizations/`, la ejecución de `test/organizations/organizations-auth03.spec.ts` y `test/integration/auth03-db.spec.ts` falló (2/2 suites fallidas por ausencia de `OrganizationsModule`).

### Fase GREEN + Regresión Completa AUTH-01 / AUTH-02 / AUTH-03

| Suite | Ejecutados | Aprobados | Fallidos | Omitidos | Alcance |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `test/organizations/organizations-auth03.spec.ts` | 8 | 8 | 0 | 0 | AUTH-03 contrato completo (orgs, membresías, roles, invitaciones, org activa, CSRF, auditoría) |
| `test/integration/auth03-db.spec.ts` (**PostgreSQL 18 Real**) | 4 | 4 | 0 | 0 | `P2002`/`P2003`, 5 aceptaciones concurrentes (1 OK / 4 409-400 / 0 500), transferencia atómica, `UserSession.activeOrganizationId`, revocación en vivo, preservación de identidad, aislamiento `AuditLog` |
| `test/auth/auth0-jwt.spec.ts` | 14 | 14 | 0 | 0 | Regresión AUTH-01 (RS256/JWKS/SecurityContext/404 legacy) |
| `test/bff/bff-flow.spec.ts` | 20 | 20 | 0 | 0 | Regresión AUTH-02 (BFF, OIDC PKCE, D-01, D-02, CSRF, sesiones) |
| `test/bff/oidc-transaction.spec.ts` | 13 | 13 | 0 | 0 | Regresión AUTH-02 D-03 (clave independiente AES-256-GCM, `$queryRaw`) |
| `test/integration/auth0-db.spec.ts` (**PostgreSQL 18 Real**) | 8 | 8 | 0 | 0 | Regresión AUTH-02 PG real (concurrencia `DELETE ... RETURNING`, reinicio) |
| Suites harness (`env-isolation`, `prisma-mock`, `nestjs-di`, `smoke`) | 10 | 10 | 0 | 0 | Aislamiento y arnés |
| **TOTAL** | **77** | **77** | **0** | **0** | **10/10 suites aprobadas (100%)** |

---

## 7. BUILD, ESLINT, GIT Y DEFECTOS PENDIENTES

- **ESLint** (`src/auth`, `src/organizations`, `src/app.module.ts`, `test/bff`, `test/organizations`, `test/integration`, `test/mocks`, `test/fixtures`): **Exit Code 0 (0 errores, 0 advertencias)**.
- **Build (`npm run build` / `nest build`):** **Exit Code 0**.
- **Estado Git:** `HEAD` sin cambios en `1d3dc01` (**0 commits, 0 pushes**). AUTH-01 y AUTH-02 sin modificaciones funcionales ni regresiones.
- **Defectos pendientes:** **Ninguno en AUTH-03.** (AUTH-04 / RLS / segregación de expedientes no iniciado, conforme a límites de alcance.)

