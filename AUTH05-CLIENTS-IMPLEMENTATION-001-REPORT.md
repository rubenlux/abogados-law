# AUTH05-CLIENTS-IMPLEMENTATION-001 — INFORME DE IMPLEMENTACIÓN FUNCIONAL DEL MÓDULO DE CLIENTES

**Proyecto:** Abogados-Law  
**Repositorio:** `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law\`  
**Rama:** `master`  
**Git Baseline Inicial:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`  
**Git Baseline Final:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` (Sin commits en esta etapa)  
**Especificación Normativa:** `SPEC-AUTH-004.md v0.2.0 — APPROVED`  
**Expediente:** `AUTH05-CLIENTS-IMPLEMENTATION-001`  
**Base de Datos Verificada:** PostgreSQL 18.4 (`abogados_test` en `localhost:5432`)  
**Fecha:** 24/11/2026  
**Estado:** **APROBADO — IMPLEMENTACIÓN Y VERIFICACIÓN EXITOSA**

---

## 1. RESUMEN EJECUTIVO

En cumplimiento de la autorización expresa del usuario bajo el expediente `AUTH05-CLIENTS-IMPLEMENTATION-001`, se implementó de forma completa, funcional y verificable el módulo de **Clientes** para Abogados-Law, abarcando tanto el backend NestJS como el frontend React 19 / Vite 7.

El módulo reutiliza de manera estricta la infraestructura aprobada de AUTH-01 (Auth0/BFF), AUTH-02 (Sesiones persistidas en PostgreSQL), AUTH-03 (Organizaciones y Membresías) y AUTH-04 (Autorización organizacional efectiva, `ActiveOrgContextGuard`, `OrgPermissionGuard`, `ScopedPrismaService` y PostgreSQL Row-Level Security).

Aspectos clave verificados:
1. **Modelo de Dominio Profesional:** Se extendió la entidad `Client` contemplando tanto Personas Humanas como Personas Jurídicas, incorporando DNI/CUIT con unicidad aislada por organización (`@@unique([organizationId, dniCuit])`), contacto, domicilio, localidad, provincia, observaciones internas y estado (`ACTIVO`, `INACTIVO`, `ARCHIVADO`).
2. **Seguridad y Aislamiento Multi-Tenant:** Toda consulta y mutación opera bajo `ScopedPrismaService.runInOrgContext()` con `SET LOCAL app.current_organization_id`, respaldado por las políticas RLS activas en PostgreSQL (`client_tenant_*`). Las peticiones hacia clientes inexistentes o pertenecientes a otras organizaciones devuelven `404 Not Found` (anti-enumeración e inmunidad IDOR).
3. **Metodología TDS (RED → GREEN):** Se implementó una suite completa de 24 pruebas de integración en `test/integration/auth05-clients.spec.ts` ejecutadas contra PostgreSQL 18 real bajo el rol runtime `abogados_app_user` (`NOBYPASSRLS`). Se capturó la fase RED inicial y posteriormente se certificó el 100% de aprobación (24/24 PASS).
4. **Regresión Integral:** La suite completa del repositorio aprobó **173/173 pruebas en 14 suites** sin regresión alguna sobre AUTH-01 a AUTH-04.
5. **Integración Frontend:** Se implementaron las pantallas de listado paginado con búsqueda y filtros por tipo/estado, vista de detalle, formulario reutilizable de alta y edición, integrado fluidamente en la navegación principal (`MainLayout`) y rutas (`App.tsx`). Se verificó que el build de producción (`tsc -b && vite build`) y `eslint` finalicen con 0 errores.

---

## 2. BASELINE GIT Y CONTROL DE CAMBIOS

- **HEAD Inicial:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`
- **HEAD Final:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`
- **Confirmación:** No se realizaron commits ni pushes en esta etapa. Todas las modificaciones residen exclusivamente en el árbol de trabajo local.
- **Entorno de Datos:** Todos los cambios DDL y pruebas se ejecutaron exclusivamente sobre la base de datos local `abogados_test`. Ninguna base de datos de producción fue afectada.

---

## 3. MODELO DE DATOS Y MIGRACIÓN INCREMENTAL

### 3.1. Enums y Esquema Prisma (`schema.prisma`)
Se agregaron los enums `ClientPersonType` y `ClientStatus`, y se enriqueció el modelo `Client`:

```prisma
enum ClientPersonType {
  HUMANA
  JURIDICA
}

enum ClientStatus {
  ACTIVO
  INACTIVO
  ARCHIVADO
}

model Client {
  id             String           @id @default(uuid())
  personType     ClientPersonType @default(HUMANA)
  firstName      String
  lastName       String?
  dniCuit        String?
  email          String?
  phone          String?
  address        String?
  city           String?
  province       String?
  notes          String?
  status         ClientStatus     @default(ACTIVO)
  
  organizationId String
  organization   Organization     @relation(fields: [organizationId], references: [id])
  
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  @@index([organizationId])
  @@index([organizationId, status])
  @@unique([organizationId, dniCuit])
}
```

### 3.2. Migración SQL Incremental
Archivo: `backend/prisma/migrations/20261124050000_auth05_clients_module/migration.sql`

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClientPersonType') THEN
    CREATE TYPE "ClientPersonType" AS ENUM ('HUMANA', 'JURIDICA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClientStatus') THEN
    CREATE TYPE "ClientStatus" AS ENUM ('ACTIVO', 'INACTIVO', 'ARCHIVADO');
  END IF;
END $$;

ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "personType" "ClientPersonType" NOT NULL DEFAULT 'HUMANA',
  ADD COLUMN IF NOT EXISTS "dniCuit" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "province" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVO';

ALTER TABLE "Client" ALTER COLUMN "lastName" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "Client_organizationId_idx" ON "Client"("organizationId");
CREATE INDEX IF NOT EXISTS "Client_organizationId_status_idx" ON "Client"("organizationId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "Client_organizationId_dniCuit_key" ON "Client"("organizationId", "dniCuit");
```

---

## 4. ENDPOINTS BACKEND Y SERVICIOS IMPLEMENTADOS

### 4.1. Módulo NestJS (`backend/src/clients/`)
- **`ClientsController` (`src/clients/clients.controller.ts`):**  
  Protegido con los 4 guards canónicos de AUTH-04:
  `@UseGuards(BffSessionGuard, ActiveOrgContextGuard, CsrfGuard, OrgPermissionGuard)`
- **`ClientsService` (`src/clients/clients.service.ts`):**  
  Encapsula toda la lógica de negocio ejecutando transacciones interactivas a través de `ScopedPrismaService.runInOrgContext()`.
- **DTOs con Validación Estricta (`src/clients/dto/`):**
  - `CreateClientDto`: Valida `firstName`, `personType`, `email`, longitudes máximas y prohíbe inyección de `organizationId`.
  - `UpdateClientDto`: Extensión parcial de `CreateClientDto`.
  - `QueryClientDto`: Paginación (`page`, `limit`), búsqueda y filtros por `status` y `personType`.

### 4.2. Matriz de Endpoints y Permisos

| Método | Endpoint | Permiso Requerido | Roles Autorizados | Descripción Funcional |
| :--- | :--- | :--- | :--- | :--- |
| **`GET`** | `/clients` | `clients:read` | `STAFF`, `ASSISTANT`, `LAWYER`, `ORG_ADMIN`, `ORG_OWNER` | Listado paginado con búsqueda por nombre/CUIT y filtros. Oculta archivados por defecto. |
| **`POST`** | `/clients` | `clients:write` | `ASSISTANT`, `LAWYER`, `ORG_ADMIN`, `ORG_OWNER` | Alta de clientes. Valida unicidad de CUIT/DNI por organización. Emite auditoría `CLIENT_CREATED`. |
| **`GET`** | `/clients/:id` | `clients:read` | `STAFF`, `ASSISTANT`, `LAWYER`, `ORG_ADMIN`, `ORG_OWNER` | Consulta de detalle. Aplica proyección de rol (oculta `notes` a `STAFF`). Devuelve 404 si es de otra org. |
| **`PATCH`** | `/clients/:id` | `clients:write` | `ASSISTANT`, `LAWYER`, `ORG_ADMIN`, `ORG_OWNER` | Edición de cliente. Valida colisión de DNI/CUIT. Emite auditoría `CLIENT_UPDATED`. |
| **`DELETE`** | `/clients/:id` | `clients:delete` | `ORG_ADMIN`, `ORG_OWNER` | Archivado lógico (`status = ARCHIVADO`). Preserva datos históricos. Emite auditoría `CLIENT_ARCHIVED`. |

---

## 5. INTEGRACIÓN FRONTEND

### 5.1. Componentes y Vistas (`frontend/src/modules/clients/`)
- **`ClientsList.tsx` (`/clientes`):**
  - Vista en tabla con diseño profesional compatible con el tema oscuro de la plataforma.
  - Barra de búsqueda con debouncing en tiempo real por nombre, razón social o DNI/CUIT.
  - Filtros desplegables por tipo (`Persona Humana`, `Persona Jurídica`) y estado (`Activos`, `Inactivos`, `Archivados`).
  - Badges distintivos de tipo y estado.
  - Paginación dinámica con control de avance/retroceso y metadatos de total.
  - Acciones rápidas: ver detalle, editar y archivar con diálogo de confirmación.
- **`ClientDetail.tsx` (`/clientes/:id`):**
  - Vista 360° del cliente con tarjetas de Identificación, Contacto/Domicilio y Observaciones Internas.
  - Acciones de edición y archivado. Manejo de estados de carga y cliente no encontrado (404).
- **`ClientForm.tsx` & `NewClientPage.tsx` (`/clientes/new`):**
  - Formulario adaptativo: al alternar entre Persona Humana y Persona Jurídica ajusta automáticamente las etiquetas (Nombre/Apellido vs. Razón Social, DNI vs. CUIT).
  - Selector de provincias argentinas, validación visual de errores y botón con spinner de guardado.
- **`EditClientPage.tsx` (`/clientes/:id/edit`):**
  - Precarga de datos existentes y edición de estado y atributos.

### 5.2. Capa de API y Navegación
- **`apiClient.clients` (`frontend/src/core/api/client.ts`):** Incorporó los métodos `findAll`, `findById`, `create`, `update` y `archive`, configurando `credentials: 'include'` para el transporte de cookies de sesión BFF.
- **Navegación Lateral (`frontend/src/components/layout/MainLayout.tsx`):** Se integró el acceso a `Clientes` con icono `Users` en el segundo lugar del menú principal.
- **Enrutamiento (`frontend/src/App.tsx`):** Rutas `/clientes`, `/clientes/new`, `/clientes/:id` y `/clientes/:id/edit` protegidas bajo `ProtectedRoute`.

---

## 6. EVIDENCIA TEST-DRIVEN SECURITY (TDS)

### 6.1. Fase RED Inicial
Ejecución de `test/integration/auth05-clients.spec.ts` antes de la implementación:
```text
FAIL test/integration/auth05-clients.spec.ts
  ● Test suite failed to run
    Cannot find module '../../src/clients/clients.module' or its corresponding type declarations.
```

### 6.2. Fase GREEN (24/24 Aprobadas)
Comando ejecutado contra PostgreSQL 18 real (`abogados_test` bajo `abogados_app_user`):
`npx jest test/integration/auth05-clients.spec.ts --verbose --runInBand --forceExit`

```text
PASS test/integration/auth05-clients.spec.ts (9.2 s)
  AUTH-05 — Módulo de Clientes (Real PostgreSQL 18 — abogados_test)
    5.1 — Pruebas Funcionales
      √ TDS-CLI-001: Alta válida de Persona Humana con todos los campos (101 ms)
      √ TDS-CLI-002: Alta válida de Persona Jurídica (Razón Social sin apellido) (18 ms)
      √ TDS-CLI-003: Rechazo de datos inválidos (email no válido, personType corrupto) (20 ms)
      √ TDS-CLI-004: Rechazo de campos obligatorios ausentes (firstName vacío) (10 ms)
      √ TDS-CLI-005: Consulta de listado paginado con metadatos de total, page, limit, totalPages (17 ms)
      √ TDS-CLI-006: Consulta de detalle por ID (13 ms)
      √ TDS-CLI-007: Edición parcial de cliente existente (17 ms)
      √ TDS-CLI-008: Búsqueda por nombre o razón social (16 ms)
      √ TDS-CLI-009: Búsqueda por DNI/CUIT (19 ms)
      √ TDS-CLI-010: Filtrado por status y por personType (43 ms)
      √ TDS-CLI-011: Archivado (soft delete) preserva el registro con status ARCHIVADO (44 ms)
      √ TDS-CLI-012: Registro de auditoría para altas, modificaciones y archivado (4 ms)
    5.2 — Pruebas de Seguridad y Aislamiento Multi-Organización
      √ TDS-SEC-001: Petición sin cookie de sesión BFF es denegada con 401 (3 ms)
      √ TDS-SEC-002: Petición con sesión pero sin organización activa retorna 403 (NO_ACTIVE_ORGANIZATION) (6 ms)
      √ TDS-SEC-003: Usuario con membresía inactiva/revocada retorna 403 (MEMBERSHIP_INACTIVE) (6 ms)
      √ TDS-SEC-004: Usuario de organización en estado SUSPENDED retorna 403 (ORGANIZATION_INACTIVE) (13 ms)
      √ TDS-SEC-005: Aislamiento total: Org A jamás ve clientes de Org B en listado (18 ms)
      √ TDS-SEC-006: Anti-enumeración en Detalle: Org A consultando cliente de Org B retorna 404 (no 403) (9 ms)
      √ TDS-SEC-007: Anti-enumeración en Edición: Org A intentando editar cliente de Org B retorna 404 (14 ms)
      √ TDS-SEC-008: Anti-enumeración en Archivado: Org A intentando archivar cliente de Org B retorna 404 (12 ms)
      √ TDS-SEC-009: Manipulación de organizationId en body, query o header x-org-id es rechazada con 403 (ORGANIZATION_CONTEXT_MISMATCH) (23 ms)
      √ TDS-SEC-010: Matriz de Permisos por Rol (STAFF proyección sin notas, ASSISTANT/LAWYER sin delete, ADMIN/OWNER con delete) (58 ms)
      √ TDS-SEC-011: Unicidad organizacional de DNI/CUIT (Org A y Org B pueden compartir DNI/CUIT; Org A no puede duplicarlo) (36 ms)
      √ TDS-SEC-012: Inmunidad frente a campos legacy (User.organizationId / User.role) (17 ms)

Test Suites: 1 passed, 1 total
Tests:       24 passed, 24 total
Snapshots:   0 total
Time:        9.521 s
```

---

## 7. REGRESIÓN TOTAL DEL SISTEMA

Comando de regresión total:
`npx jest --runInBand --forceExit`

```text
PASS test/integration/auth05-clients.spec.ts (5.852 s)
PASS test/integration/auth03-db.spec.ts
PASS test/integration/auth04-reconciliation-001.spec.ts (6.165 s)
PASS test/integration/auth04-rls-and-isolation.spec.ts
PASS test/bff/bff-flow.spec.ts
PASS test/auth04/auth04-primitives-and-containment.spec.ts
PASS test/organizations/organizations-auth03.spec.ts
PASS test/integration/auth0-db.spec.ts
PASS test/auth/auth0-jwt.spec.ts
PASS test/bff/oidc-transaction.spec.ts
PASS test/harness/nestjs-di.spec.ts
PASS test/harness/prisma-mock.spec.ts
PASS test/harness/env-isolation.spec.ts
PASS src/smoke.spec.ts

Test Suites: 14 passed, 14 total
Tests:       173 passed, 173 total
Snapshots:   0 total
Time:        20.684 s
```

### 7.1. Compilación y Calidad de Código
- **Backend TypeScript (`tsc --noEmit`):** Código de retorno `0` (0 errores).
- **Backend ESLint (`eslint`):** Código de retorno `0` (0 errores en los archivos del módulo).
- **Frontend TypeScript y Vite Build (`npm run build`):**  
  `dist/index.html`, `dist/assets/index-*.css`, `dist/assets/index-*.js` generados correctamente en 7.83s.
- **Frontend ESLint (`npx eslint src/modules/clients/**/*.{ts,tsx}`):** Código de retorno `0` (0 errores, 0 warnings).

---

## 8. ARCHIVOS CREADOS Y MODIFICADOS

### Creados (10 archivos):
1. `backend/prisma/migrations/20261124050000_auth05_clients_module/migration.sql`
2. `backend/src/clients/dto/create-client.dto.ts`
3. `backend/src/clients/dto/update-client.dto.ts`
4. `backend/src/clients/dto/query-client.dto.ts`
5. `backend/src/clients/clients.service.ts`
6. `backend/src/clients/clients.controller.ts`
7. `backend/src/clients/clients.module.ts`
8. `backend/test/integration/auth05-clients.spec.ts`
9. `frontend/src/modules/clients/types.ts`
10. `frontend/src/modules/clients/components/ClientForm.tsx`
11. `frontend/src/modules/clients/pages/ClientsList.tsx`
12. `frontend/src/modules/clients/pages/NewClientPage.tsx`
13. `frontend/src/modules/clients/pages/EditClientPage.tsx`
14. `frontend/src/modules/clients/pages/ClientDetail.tsx`
15. `AUTH05-CLIENTS-IMPLEMENTATION-001-REPORT.md`

### Modificados (6 archivos):
1. `backend/prisma/schema.prisma` (Ampliación del modelo `Client` y nuevos enums).
2. `backend/src/authz/permissions.ts` (Actualización de `CLIENT_STAFF_SELECT` y `CLIENT_FULL_SELECT`).
3. `backend/src/app.module.ts` (Registro de `ClientsModule`).
4. `frontend/src/core/api/client.ts` (Métodos de API de clientes y `credentials: 'include'`).
5. `frontend/src/components/layout/MainLayout.tsx` (Enlace de navegación "Clientes").
6. `frontend/src/App.tsx` (Registro de rutas del módulo clientes).
7. `frontend/src/layout/MainLayout.tsx` (Enlace de navegación para consistencia).
8. `frontend/src/components/ui/PencilLoader.tsx` (Limpieza de import no utilizado).

---

## 9. CONCLUSIÓN Y CONFORMIDAD

El módulo funcional de Clientes (AUTH-05) se encuentra completamente operativo y verificado:
- Persistencia real en PostgreSQL 18 con RLS activa bajo `abogados_app_user`.
- Autorización organizacional estricta sin fugas de tenant ni exposición de campos legacy.
- Frontend integrado y visualmente armónico con la aplicación existente.
- Aprobación completa de la suite TDS y regresión general (173/173 tests PASS).
- Código limpio, sin errores de compilación ni de linter, y sin commits ni pushes en el repositorio Git (`HEAD: 1d3dc01`).

