# AUTH06-EXPEDIENTES-IMPLEMENTATION-001 — INFORME DE IMPLEMENTACIÓN FUNCIONAL DEL MÓDULO DE EXPEDIENTES

**Proyecto:** Abogados-Law  
**Repositorio:** `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law\`  
**Rama:** `master`  
**Git Baseline Inicial:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`  
**Git Baseline Final:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` (Sin commits ni pushes en esta etapa)  
**Especificación Normativa:** `SPEC-AUTH-004.md v0.2.0 — APPROVED` + `AUTH-06`  
**Expediente:** `AUTH06-EXPEDIENTES-IMPLEMENTATION-001`  
**Base de Datos Verificada:** PostgreSQL 18.4 (`abogados_test` en `localhost:5432`, rol runtime `abogados_app_user` `NOBYPASSRLS`)  
**Fecha:** 24/11/2026  
**Estado:** **APROBADO — IMPLEMENTACIÓN Y VERIFICACIÓN EXITOSA**

---

## 1. RESUMEN EJECUTIVO

En cumplimiento de la autorización expresa del usuario bajo el expediente `AUTH06-EXPEDIENTES-IMPLEMENTATION-001`, se implementó de forma integral el módulo funcional de **Expedientes Judiciales** de Abogados-Law, integrado con el módulo de **Clientes (AUTH-05)** y construido estrictamente sobre la infraestructura aprobada de **AUTH-01 a AUTH-04** (Auth0 BFF, sesiones persistidas en PostgreSQL, organizaciones/membresías, autorización contextual organizacional, `ScopedPrismaService`, PostgreSQL Row-Level Security y `OrgAuditService`).

Resultados verificados:

1. **Modelo de Dominio Judicial Extensible:** Se amplió `Expediente` con campos judiciales completos (`provincia`, `fuero`, `secretaria`, `tipoProceso`, `materia`, `fechaInicio`, `descripcion`, `responsableId`), se amplió el enum `ExpedienteEstado` (`INICIO`, `EN_TRAMITE`, `PRUEBA`, `ALEGATOS`, `SENTENCIA`, `APELACION`, `PENDIENTE`, `SUSPENDIDO`, `FINALIZADO`, `ARCHIVADO`), y se incorporó la entidad `ExpedienteParte` con el enum `RolParteProcesal` para vincular tanto clientes del estudio (`Client`) como contrapartes y terceros externos.
2. **Aislamiento Multi-Tenant y Doble Barrera (App + RLS):** La nueva tabla `ExpedienteParte` cuenta con `ENABLE ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY`, cuatro políticas estrictas (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) para `abogados_app_user` filtradas por `app.current_organization_id`, y privilegios mínimos (`GRANT SELECT, INSERT, UPDATE, DELETE`). Todas las operaciones de servicio ejecutan dentro de `ScopedPrismaService.runInOrgContext()`.
3. **Validación Relacional Cross-Tenant y Anti-Enumeración:**
   - Al vincular un cliente (`clientId`) o asignar un responsable/profesional (`responsableId`, `userIds`, `POST /expedientes/:id/users`), se verifica explícitamente que el cliente pertenezca a `ctx.organizationId` y que el profesional tenga membresía `ACTIVE` en `ctx.organizationId`.
   - Toda consulta, edición o archivado sobre un expediente o parte perteneciente a otra organización retorna `404 Not Found` (anti-enumeración e inmunidad IDOR).
4. **Proyecciones por Rol y Permisos:** `EXPEDIENTE_SELECT_BY_ROLE` restringe los campos devueltos a `STAFF` (omite `descripcion`, `partes`, `users` y `responsable`), impide escritura a `STAFF` (`403`), impide archivado (`cases:delete`) a `ASSISTANT` y `LAWYER` (`403`), y habilita archivado a `ORG_ADMIN` y `ORG_OWNER`.
5. **Metodología TDS (RED → GREEN) y Regresión Total:**
   - Se redactó la suite `backend/test/integration/auth06-expedientes.spec.ts` con **25 pruebas reales sobre PostgreSQL 18** (12 funcionales + 13 de seguridad).
   - Fase RED capturada: 16 fallos funcionales esperados / 9 aprobados (guards previos).
   - Fase GREEN certificada: **25/25 PASS**.
   - Regresión integral del backend: **15/15 suites, 198/198 pruebas PASS** (0 regresiones sobre AUTH-01..AUTH-05).
6. **Frontend Integrado Sin Mocks:** Se actualizaron `apiClient.expedientes`, `ExpedienteList.tsx`, `NewCasePage.tsx`, `CaseDetail.tsx` y se incorporaron `types.ts` y `EditCasePage.tsx` (ruta `/expedientes/:id/edit`), reemplazando las vistas estáticas/mock previas por persistencia real contra el backend. Build de producción (`tsc -b && vite build`) y `eslint` finalizados con **0 errores**.

---

## 2. BASELINE GIT Y CONTROL DE ALCANCE

- **HEAD Inicial:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`
- **HEAD Final:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`
- **Commits / Pushes:** Ninguno realizado; todos los cambios permanecen en el árbol de trabajo local.
- **Base de datos intervenida:** Exclusivamente `abogados_test` en PostgreSQL local.
- **Límites respetados:** No se implementaron almacenamiento/carga de documentos, escritos jurídicos, agenda/vencimientos, notificaciones, scraping judicial ni flujos de IA/RAG.

---

## 3. MODELO DE DATOS, MIGRACIÓN SQL Y SEGURIDAD RLS

### 3.1. Cambios en `backend/prisma/schema.prisma`

- **Enum `ExpedienteEstado`:** Se agregaron los valores `EN_TRAMITE`, `PENDIENTE`, `SUSPENDIDO` y `FINALIZADO`.
- **Enum `RolParteProcesal`:** `ACTOR`, `DEMANDADO`, `DENUNCIANTE`, `DENUNCIADO`, `QUERELLANTE`, `IMPUTADO`, `SOLICITANTE`, `BENEFICIARIO`, `TERCERO`, `OTRO`.
- **Modelo `Expediente`:** Se agregaron `provincia`, `fuero`, `secretaria`, `tipoProceso`, `materia`, `fechaInicio`, `descripcion`, `responsableId`, relación `responsable` (`User?`) y relación `partes` (`ExpedienteParte[]`), además de índices compuestos `(organizationId, estado)` y `(organizationId, numeroExpediente)`.
- **Modelo `ExpedienteParte`:** Vincula `expedienteId`, `organizationId`, `clientId?` (`Client?`), `tipoParte` (`ClientPersonType`), `nombre`, `cuitDni`, `rol` (`RolParteProcesal`), `caracter`, `esCliente`, `observaciones`, `createdAt`, `updatedAt`.
- **Relaciones inversas:** Agregadas en `User` (`responsableDeExpedientes`), `Organization` (`expedientesPartes`) y `Client` (`partesEnExpedientes`).

### 3.2. Migración Incremental y Aprovisionamiento RLS

- **Archivo de migración:** `backend/prisma/migrations/20261124060000_auth06_expedientes_module/migration.sql`
- **Políticas RLS aplicadas sobre `"ExpedienteParte"`:**
  - `ALTER TABLE "ExpedienteParte" ENABLE ROW LEVEL SECURITY;`
  - `ALTER TABLE "ExpedienteParte" FORCE ROW LEVEL SECURITY;`
  - Políticas `expedienteparte_tenant_select`, `expedienteparte_tenant_insert`, `expedienteparte_tenant_update`, `expedienteparte_tenant_delete` para el rol `abogados_app_user`.
- **Privilegios mínimos:** `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ExpedienteParte" TO abogados_app_user;` (incorporado también en `backend/prisma/scripts/provision-rls-roles.sql`).
- **Cliente Prisma:** Regenerado satisfactoriamente con `npx prisma generate`.

---

## 4. BACKEND IMPLEMENTADO (`backend/src/expedientes/` y `backend/src/authz/`)

### 4.1. Proyecciones de Autorización (`backend/src/authz/permissions.ts`)

- `EXPEDIENTE_STAFF_SELECT`: expone `id`, `caratula`, `numeroExpediente`, `juzgado`, `jurisdiccion`, `provincia`, `fuero`, `secretaria`, `tipoProceso`, `materia`, `fechaInicio`, `estado`, `updatedAt`. Omite estrictamente `descripcion`, `tags`, `responsable`, `users` y `partes`.
- `EXPEDIENTE_ASSISTANT_SELECT`: hereda `STAFF` y añade `descripcion`, `tags`, `createdAt`, `responsableId`, `responsable`, `users` y `partes` (con proyección segura del `client` vinculado).
- `EXPEDIENTE_LAWYER_SELECT` (`LAWYER`, `ORG_ADMIN`, `ORG_OWNER`): hereda `ASSISTANT` y añade `organizationId`.

### 4.2. DTOs con Validación Estricta (`class-validator`)

- `backend/src/expedientes/dto/create-expediente.dto.ts`: soporta `numeroExpediente` y mantiene retrocompatibilidad con `numero` (requerido por pruebas AUTH-04), más campos judiciales, `responsableId`, `userIds`, `tags` y array anidado `partes: CreateParteDto[]`.
- `backend/src/expedientes/dto/update-expediente.dto.ts`: actualización parcial segura de datos generales, radicación, estado y responsable.
- `backend/src/expedientes/dto/query-expediente.dto.ts`: filtros `search`, `estado`, `fuero`, `jurisdiccion`, `provincia`, `responsableId`, `clientId`, y paginación opcional `page`/`limit`.
- `backend/src/expedientes/dto/parte.dto.ts`: `CreateParteDto` y `UpdateParteDto` validando `RolParteProcesal`, `ClientPersonType`, `clientId` (UUID), `esCliente`, `caracter` y `observaciones`.
- `backend/src/expedientes/dto/assign-user.dto.ts`: `userId` (UUID obligatorio).

### 4.3. Endpoints REST (`ExpedientesController`)

Protegidos integralmente con `@UseGuards(BffSessionGuard, ActiveOrgContextGuard, CsrfGuard, OrgPermissionGuard)`:

| Método | Ruta | Permiso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/expedientes` | `cases:read` | Lista expedientes con búsqueda y filtros. Retorna `{ data, total, page, limit, totalPages }` si se envía `page` o `limit`, o `Expediente[]` sin ellos (retrocompatibilidad AUTH-04). Excluye `ARCHIVADO` por omisión salvo filtro explícito. |
| `POST` | `/expedientes` | `cases:write` | Crea expediente con datos judiciales, responsable, equipo y partes iniciales. Valida pertenencia de clientes y membresía `ACTIVE` de profesionales. |
| `GET` | `/expedientes/:id` | `cases:read` | Obtiene detalle con proyección por rol. Retorna `404` si no existe o pertenece a otra organización. |
| `PATCH` | `/expedientes/:id` | `cases:write` | Edita datos generales, radicación, estado y responsable. |
| `DELETE` | `/expedientes/:id` | `cases:delete` | Archiva el expediente (soft delete a estado `ARCHIVADO`). |
| `POST` | `/expedientes/:id/partes` | `cases:write` | Agrega una parte procesal (cliente vinculado o parte externa). |
| `PATCH` | `/expedientes/:id/partes/:parteId` | `cases:write` | Modifica una parte procesal del expediente. |
| `DELETE` | `/expedientes/:id/partes/:parteId` | `cases:write` | Elimina una parte procesal del expediente. |
| `POST` | `/expedientes/:id/users` | `cases:write` | Asigna un profesional miembro `ACTIVE` al equipo del expediente (`HTTP 200`). |
| `DELETE` | `/expedientes/:id/users/:userId` | `cases:write` | Desasigna un profesional del equipo del expediente. |

### 4.4. Auditoría (`OrgAuditService`)

Cada mutación registra eventos estructurados en `AuditLog` dentro de la misma transacción `tx`:
`EXPEDIENTE_CREATED`, `EXPEDIENTE_UPDATED`, `EXPEDIENTE_ARCHIVED`, `EXPEDIENTE_PARTE_ADDED`, `EXPEDIENTE_PARTE_UPDATED`, `EXPEDIENTE_PARTE_REMOVED`, `EXPEDIENTE_USER_ASSIGNED`, `EXPEDIENTE_USER_UNASSIGNED`.

---

## 5. FRONTEND IMPLEMENTADO (`frontend/src/`)

- **`frontend/src/core/api/client.ts`:** Se amplió `apiClient.expedientes` con `findAll(query)`, `findById(id)`, `create(data)`, `update(id, data)`, `archive(id)`, `addParte(id, data)`, `updateParte(id, parteId, data)`, `removeParte(id, parteId)`, `assignUser(id, userId)` y `unassignUser(id, userId)`.
- **`frontend/src/modules/expedientes/types.ts`:** Definición de tipos estrictos (`Expediente`, `ExpedienteParte`, `ExpedienteEstado`, `RolParteProcesal`, `PaginatedExpedientesResponse`), etiquetas en español, opciones de fuero/jurisdicción y estilos por estado.
- **`frontend/src/modules/expedientes/pages/ExpedienteList.tsx`:** Listado paginado con barra de búsqueda (carátula, número, juzgado o cliente), filtros por `estado` y `fuero`, badges de estado, acciones rápidas (ver detalle, editar, archivar con confirmación) y controles de paginación.
- **`frontend/src/modules/expedientes/pages/NewCasePage.tsx`:** Formulario dividido en 4 secciones (Identificación, Datos Judiciales y Radicación, Clientes y Partes Procesales con selector real de clientes de `apiClient.clients.findAll()` y alta de partes externas, y Descripción/Observaciones). Eliminada la simulación previa de subida de archivos.
- **`frontend/src/modules/expedientes/pages/CaseDetail.tsx`:** Reemplazó la vista mock anterior por lectura real de `apiClient.expedientes.findById(id)`. Presenta datos judiciales, listado interactivo de clientes y partes procesales con enlaces a `/clientes/:clientId`, alta y baja inline de partes, equipo profesional (responsable y asignados), observaciones y metadatos, respetando la proyección de rol (`STAFF` no renderiza secciones confidenciales omitidas).
- **`frontend/src/modules/expedientes/pages/EditCasePage.tsx`:** Formulario completo de edición de datos generales, radicación y estado procesal.
- **`frontend/src/App.tsx`:** Registrada la ruta protegida `/expedientes/:id/edit`.

---

## 6. VERIFICACIÓN TDS, REGRESIÓN Y CALIDAD DE CÓDIGO

### 6.1. Suite TDS AUTH-06 (`backend/test/integration/auth06-expedientes.spec.ts`)

Ejecutada contra PostgreSQL 18 real (`abogados_test`) con `APP_RUNTIME_DATABASE_URL` (`abogados_app_user`):

- **Fase RED (previa a la implementación):** `16 failed, 9 passed, 25 total` (confirmando la ausencia de DTOs ampliados, endpoints de detalle/edición/archivado/partes, paginación y auditoría).
- **Fase GREEN (posterior a la implementación):** **`25 passed, 25 total` (100% PASS)**:
  - **8.1 Funcionales (12/12):** `TDS-EXP-001` a `TDS-EXP-012` (alta completa, vinculación de clientes, partes externas, responsable y equipo, paginación, detalle con relaciones, edición, CRUD de partes, búsqueda, filtros por estado/fuero/jurisdicción, archivado soft delete y auditoría).
  - **8.2 Seguridad y Aislamiento (13/13):** `TDS-SEC-001` a `TDS-SEC-013` (401 sin sesión, 403 sin org activa/membresía revocada/org suspendida, aislamiento Org A vs Org B en listado, 404 anti-enumeración en lectura/edición/archivado cruzado, rechazo de cliente o profesional de otra org, 403 ante tampering de `organizationId` en query/headers, matriz de roles y proyecciones `STAFF`/`ASSISTANT`/`LAWYER`/`ADMIN`/`OWNER`, e inmunidad frente a manipulación de campos legacy `User.role` y `User.organizationId`).

### 6.2. Regresión Integral del Backend (`npx jest --runInBand --forceExit`)

```text
Test Suites: 15 passed, 15 total
Tests:       198 passed, 198 total
Snapshots:   0 total
```

Incluye las suites previas de AUTH-01, AUTH-02, AUTH-03, AUTH-04 (RLS + Reconciliación), AUTH-05 (Clientes) y AUTH-06 (Expedientes) sin ninguna regresión.

### 6.3. Validación de Tipos, Lint y Build

| Verificación | Comando | Resultado |
| :--- | :--- | :--- |
| Backend TypeScript | `cd backend && npx tsc --noEmit` | **PASS (0 errores)** |
| Backend ESLint (AUTH-06) | `cd backend && npx eslint "src/expedientes/**/*.ts" "src/authz/permissions.ts" "test/integration/auth06-expedientes.spec.ts"` | **PASS (0 errores, 0 warnings)** |
| Frontend Build Producción | `cd frontend && npm run build` (`tsc -b && vite build`) | **PASS (0 errores, bundle generado)** |
| Frontend ESLint (AUTH-06) | `cd frontend && npx eslint src/modules/expedientes/types.ts src/modules/expedientes/pages/*.tsx src/App.tsx` | **PASS (0 errores, 0 warnings)** |

---

## 7. ARCHIVOS CREADOS Y MODIFICADOS EN AUTH-06

### Creados
- `backend/prisma/migrations/20261124060000_auth06_expedientes_module/migration.sql`
- `backend/src/expedientes/dto/update-expediente.dto.ts`
- `backend/src/expedientes/dto/query-expediente.dto.ts`
- `backend/src/expedientes/dto/parte.dto.ts`
- `backend/src/expedientes/dto/assign-user.dto.ts`
- `backend/test/integration/auth06-expedientes.spec.ts`
- `frontend/src/modules/expedientes/types.ts`
- `frontend/src/modules/expedientes/pages/EditCasePage.tsx`
- `AUTH06-EXPEDIENTES-IMPLEMENTATION-001-REPORT.md`

### Modificados
- `backend/prisma/schema.prisma`
- `backend/prisma/scripts/provision-rls-roles.sql`
- `backend/src/authz/permissions.ts`
- `backend/src/expedientes/dto/create-expediente.dto.ts`
- `backend/src/expedientes/expedientes.service.ts`
- `backend/src/expedientes/expedientes.controller.ts`
- `backend/src/expedientes/expedientes.module.ts`
- `frontend/src/core/api/client.ts`
- `frontend/src/modules/expedientes/pages/ExpedienteList.tsx`
- `frontend/src/modules/expedientes/pages/NewCasePage.tsx`
- `frontend/src/modules/expedientes/pages/CaseDetail.tsx`
- `frontend/src/App.tsx`

---

## 8. CONCLUSIÓN

El módulo de **Expedientes Judiciales (AUTH-06)** queda completamente implementado, integrado con **Clientes (AUTH-05)** y protegido bajo el modelo de doble barrera multi-organización de **AUTH-04**. El diseño del modelo central (`Expediente` + `ExpedienteParte`) permite incorporar en etapas siguientes agenda judicial, vencimientos, documentos, escritos, movimientos e IA sin reconstruir las entidades nucleares.

