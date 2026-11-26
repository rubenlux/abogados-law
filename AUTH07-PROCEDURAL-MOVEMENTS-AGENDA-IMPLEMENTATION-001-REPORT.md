# AUTH07-PROCEDURAL-MOVEMENTS-AGENDA-IMPLEMENTATION-001 — INFORME DE IMPLEMENTACIÓN FUNCIONAL DE MOVIMIENTOS PROCESALES Y AGENDA JUDICIAL

**Proyecto:** Abogados-Law  
**Repositorio:** `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law\`  
**Rama:** `master`  
**Git Baseline Inicial:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`  
**Git Baseline Final:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` (Sin commits ni pushes)  
**Arquitectura Normativa:** AUTH-01 a AUTH-06 (`SPEC-AUTH-004.md v0.2.0 — APPROVED`) + AUTH-07  
**Expediente:** `AUTH07-PROCEDURAL-MOVEMENTS-AGENDA-IMPLEMENTATION-001`  
**Bases de Datos Verificadas:** PostgreSQL 18.4 local — `abogados_test` (exclusiva Jest) y `abogados_db` (desarrollo local), ambas bajo rol runtime `abogados_app_user` (`NOBYPASSRLS`)  
**Fecha:** 24/11/2026  
**Estado:** **APROBADO — IMPLEMENTACIÓN Y VERIFICACIÓN COMPLETA**

---

## 1. DIAGNÓSTICO INICIAL FOCALIZADO Y MATRIZ DE REUTILIZACIÓN (FASE 0)

La inspección read-only inicial sobre `schema.prisma`, `backend/src/agenda/`, `backend/src/authz/permissions.ts` y `frontend/src/modules/agenda/` determinó:

- El modelo existente `EventoAgenda` acoplaba vencimientos (`fechaVencimiento`, `tipoPlazo: FATAL | ORDINARIO | MERO_TRAMITE`) con eventos de agenda, exigía `expedienteId` obligatorio y está referenciado directamente por la suite de regresión AUTH-04 (`auth04-rls-and-isolation.spec.ts` y `auth04-primitives-and-containment.spec.ts`).
- No existía entidad alguna para **Movimientos Procesales** ni separación explícita entre hechos ocurridos, actividades programadas y vencimientos manuales sin cálculo automático.
- Los permisos canónicos existentes (`cases:read`, `cases:write`, `cases:delete`, `agenda:read`, `agenda:write`) cubren completamente la matriz de roles sin alterar el modelo de autorización AUTH-04.

### Matriz de Reutilización

| Concepto | Entidad / Servicio existente | Acción | Justificación |
| :--- | :--- | :--- | :--- |
| **Movimiento procesal** | No existía | **Crear `MovimientoProcesal`** | Registra actuaciones pasadas diferenciando `fechaActuacion` y `fechaRegistro`, con anulación lógica trazable (`anuladoAt`, `anuladoPorId`, `anuladoMotivo`). |
| **Evento de agenda** | `EventoAgenda` *(acoplado a `PlazoTipo` y `expedienteId` obligatorio de AUTH-04)* | **Crear `AgendaEvent`** *(preservando `EventoAgenda` para AUTH-04)* | Permite actividades programadas con `fechaInicio`/`fechaFin?`, `ubicacion?`, `expedienteId?` opcional, `responsableId?`, `tipo`, `estado` y advertencia no bloqueante de superposición. |
| **Vencimiento** | `EventoAgenda` *(parcial, acoplado a `DeadlineCalculatorService`)* | **Crear `Vencimiento`** | Separa obligaciones con `fechaLimite` ingresada manualmente (`origenFechaLimite = MANUAL`), prioridad, cumplimiento trazable (`cumplidoAt`/`cumplidoPorId`) e identificación de vencido en lectura (`estaVencido`) sin mutar el estado persistido. |
| **Responsable** | `User` + `OrganizationMembership` | **Reutilizar** | Validación estricta de membresía `ACTIVE` en `ctx.organizationId`. |
| **Expediente** | `Expediente` | **Reutilizar** | Obligatorio en `MovimientoProcesal`, opcional en `AgendaEvent` y `Vencimiento`, siempre validado dentro de `ctx.organizationId`. |
| **Auditoría y Scoping** | `ScopedPrismaService` + `OrgAuditService` + `AuditLog` | **Reutilizar** | Todas las mutaciones auditan atómicamente dentro de la misma transacción `tx`. |

---

## 2. DECISIONES DE DOMINIO Y POLÍTICA DE ZONA HORARIA

1. **Separación estricta de los 3 dominios:**
   - **Movimientos procesales (`/movimientos`):** actuaciones pasadas o registradas en un expediente (`fechaActuacion` vs `fechaRegistro`), baja lógica mediante anulación trazable (`anuladoAt`, `anuladoPorId`, `anuladoMotivo`).
   - **Agenda judicial (`/agenda/actividades`):** actividades futuras/programadas con o sin expediente; valida `fechaFin >= fechaInicio` y advierte superposiciones del mismo responsable (`overlapWarning`) sin bloquear el registro.
   - **Vencimientos (`/vencimientos`):** obligaciones con `fechaLimite` ingresada manualmente (`origenFechaLimite = MANUAL`). **Restricción jurídica cumplida:** no ejecuta ningún cálculo automático de días hábiles, feriados ni plazos procesales; la UI previa de "Calculadora de Plazos" fue retirada de `AgendaPage.tsx`. Los vencimientos vencidos se calculan en lectura (`estaVencido = estado IN (PENDIENTE, EN_CURSO) && fechaLimite < now`) sin alterar automáticamente su `estado` persistido.
2. **Política de zona horaria:**
   - Todas las fechas se persisten como instantes UTC (`TIMESTAMP(3)` / ISO 8601).
   - Todos los DTOs validan fechas mediante `@IsISO8601({ strict: true })`.
   - El frontend convierte explícitamente `datetime-local` e intervalos de vista (`day`/`week`/`month`/`upcoming`) a límites UTC explícitos (`from`/`to`) desde la zona horaria local del navegador antes de consultar la API, evitando interpretar fechas locales ingenuas como UTC.

---

## 3. MODELO DE DATOS, MIGRACIÓN SQL Y RLS

### 3.1. Esquema Prisma y Migración Incremental

- **Esquema actualizado:** `backend/prisma/schema.prisma`
- **Migración SQL incremental:** `backend/prisma/migrations/20261124070000_auth07_movements_agenda_deadlines/migration.sql`
  - **Enums creados (8):** `TipoMovimientoProcesal`, `OrigenMovimiento`, `TipoEventoAgenda`, `EstadoEventoAgenda`, `TipoVencimiento`, `PrioridadVencimiento`, `EstadoVencimiento`, `OrigenFechaLimite`.
  - **Tablas creadas (3):** `"MovimientoProcesal"`, `"AgendaEvent"`, `"Vencimiento"`, todas con `"organizationId" TEXT NOT NULL`, claves foráneas e índices compuestos por tenant, expediente, fecha, estado, prioridad y responsable.

### 3.2. PostgreSQL RLS y Privilegios Mínimos (`abogados_app_user`)

- Sobre las 3 tablas nuevas se aplicó:
  - `ENABLE ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY`.
  - 4 políticas por tabla (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) para `abogados_app_user` basadas en `current_setting('app.current_organization_id', true)` (**12 políticas nuevas**).
  - `GRANT SELECT, INSERT, UPDATE, DELETE` únicamente (actualizado también en `backend/prisma/scripts/provision-rls-roles.sql`).
- **Verificación en ambas bases de datos:**
  - `abogados_test`: **`21` tablas con `ENABLE + FORCE RLS`**, **`84` políticas activas**.
  - `abogados_db`: **`21` tablas con `ENABLE + FORCE RLS`**, **`84` políticas activas**.

---

## 4. ENDPOINTS IMPLEMENTADOS Y PERMISOS

Todos los controladores utilizan los 4 guards canónicos sin excepciones:  
`@UseGuards(BffSessionGuard, ActiveOrgContextGuard, CsrfGuard, OrgPermissionGuard)`

### 4.1. Movimientos Procesales (`backend/src/movimientos/`)
| Método | Ruta | Permiso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/movimientos` | `cases:read` | Cronología paginada filtrable por `expedienteId`, `tipo`, `search`, `includeAnulados` y `order=asc\|desc` con orden secundario estable `(fechaActuacion, fechaRegistro, id)`. |
| `POST` | `/movimientos` | `cases:write` | Alta de movimiento validando pertenencia del expediente (`404` si ajeno/inexistente). Audita `MOVIMIENTO_CREATED`. |
| `GET` | `/movimientos/:id` | `cases:read` | Detalle con proyección por rol y anti-enumeración (`404`). |
| `PATCH` | `/movimientos/:id` | `cases:write` | Edición de movimiento activo (rechaza editar anulados). Audita `MOVIMIENTO_UPDATED`. |
| `DELETE` | `/movimientos/:id` | `cases:delete` | Anulación lógica trazable (`anuladoAt`, `anuladoPorId`, `anuladoMotivo`). Audita `MOVIMIENTO_ANNULLED`. |

### 4.2. Agenda Judicial (`backend/src/agenda/agenda-events.*`)
| Método | Ruta | Permiso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/agenda/actividades` | `agenda:read` | Listado paginado por rango explícito `from`/`to` (valida `from <= to`), `responsableId`, `expedienteId`, `tipo`, `estado`, `search`. |
| `POST` | `/agenda/actividades` | `agenda:write` | Crea evento con o sin expediente; valida `fechaFin >= fechaInicio`, pertenencia del expediente (`404`) y membresía `ACTIVE` del responsable (`403`). Retorna `{ event, overlapWarning }`. Audita `AGENDA_EVENT_CREATED`. |
| `GET` | `/agenda/actividades/:id` | `agenda:read` | Detalle con proyección por rol (`404` anti-enumeración). |
| `PATCH` | `/agenda/actividades/:id` | `agenda:write` | Edición con revalidación de fechas, expediente, responsable y `overlapWarning`. Audita `AGENDA_EVENT_UPDATED`. |
| `POST` | `/agenda/actividades/:id/completar` | `agenda:write` | Marca `COMPLETADO` (`HTTP 200`). Audita `AGENDA_EVENT_COMPLETED`. |
| `POST` | `/agenda/actividades/:id/cancelar` | `agenda:write` | Marca `CANCELADO` (`HTTP 200`). Audita `AGENDA_EVENT_CANCELLED`. |

*(Se mantienen intactos `GET /agenda` y `POST /agenda/eventos` sobre `EventoAgenda` para retrocompatibilidad con AUTH-04).*

### 4.3. Vencimientos (`backend/src/vencimientos/`)
| Método | Ruta | Permiso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/vencimientos` | `agenda:read` | Listado paginado con `scope=all\|pendientes\|proximos\|vencidos\|cumplidos`, `upcomingDays`, `expedienteId`, `responsableId`, `prioridad`, `estado`, `tipo`, `from`/`to`, `search`. Calcula `estaVencido` en lectura sin alterar `estado`. |
| `POST` | `/vencimientos` | `agenda:write` | Registra vencimiento con `fechaLimite` manual (`origenFechaLimite = MANUAL`). Valida expediente (`404`) y responsable (`403`). Audita `VENCIMIENTO_CREATED`. |
| `GET` | `/vencimientos/:id` | `agenda:read` | Detalle con proyección por rol y `estaVencido` (`404` anti-enumeración). |
| `PATCH` | `/vencimientos/:id` | `agenda:write` | Edición de vencimiento. Audita `VENCIMIENTO_UPDATED`. |
| `POST` | `/vencimientos/:id/cumplir` | `agenda:write` | Marca `CUMPLIDO` registrando `cumplidoAt` y `cumplidoPorId` (`HTTP 200`). Audita `VENCIMIENTO_COMPLETED`. |
| `POST` | `/vencimientos/:id/cancelar` | `agenda:write` | Marca `CANCELADO` (`HTTP 200`). Audita `VENCIMIENTO_CANCELLED`. |

### 4.4. Proyecciones por Rol (`backend/src/authz/permissions.ts`)
- **`STAFF`:** acceso de solo lectura (`cases:read` / `agenda:read`) con proyecciones mínimas: omite `descripcion`/`metadatos`/`anuladoMotivo` en `MovimientoProcesal`, `descripcion`/`ubicacion` en `AgendaEvent` y `descripcion`/`observaciones` en `Vencimiento`. Toda escritura retorna `403`.
- **`ASSISTANT`:** lee con proyección completa y gestiona Agenda y Vencimientos (`agenda:write`); recibe `403` en creación/edición/anulación de Movimientos (`cases:write` / `cases:delete`).
- **`LAWYER`:** gestiona Movimientos (`cases:write`), Agenda y Vencimientos (`agenda:write`); recibe `403` al anular Movimientos (`cases:delete`).
- **`ORG_ADMIN` / `ORG_OWNER`:** todos los permisos anteriores más anulación trazable de Movimientos (`cases:delete`).

---

## 5. FRONTEND IMPLEMENTADO

- **`frontend/src/core/api/client.ts`:** namespaces `apiClient.movimientos`, `apiClient.agendaActividades` y `apiClient.vencimientos` + lectura de cookie `csrf_token` en `X-CSRF-Token` para peticiones autenticadas BFF.
- **`frontend/src/modules/agenda/types.ts`:** tipos estrictos y etiquetas en español para los 3 dominios.
- **`frontend/src/modules/agenda/pages/AgendaPage.tsx` (`/agenda`):** vistas Día, Semana, Mes y Próximos, filtros por tipo, estado, expediente y texto, creación/edición con validación y prevención de doble envío, acciones Completar/Cancelar y banner no bloqueante `overlapWarning`. Sin calculadora automática de plazos.
- **`frontend/src/modules/vencimientos/pages/VencimientosPage.tsx` (`/vencimientos`):** vistas Todos, Pendientes, Próximos (7 días), Vencidos y Cumplidos, filtros por prioridad/expediente/texto, etiqueta explícita de fecha límite manual, distinción visual `VENCIDO` sin mutar el estado persistido, acciones Cumplir/Editar/Cancelar.
- **`frontend/src/modules/expedientes/components/ProceduralTimelineSection.tsx` + `CaseDetail.tsx` (`/expedientes/:id`):** sección cronológica integrada al detalle del expediente (orden desc/asc, diferenciación visual Actuación vs Registro, alta/edición/anulación de movimientos) y accesos contextuales directos a crear Evento (`/agenda?expedienteId=...&new=1`) y Vencimiento (`/vencimientos?expedienteId=...&new=1`).
- **`frontend/src/components/layout/MainLayout.tsx` y `frontend/src/App.tsx`:** enlace lateral `Vencimientos` y ruta protegida `/vencimientos`.

---

## 6. EVIDENCIA TDS (RED → GREEN), REGRESIÓN Y CALIDAD

### 6.1. Suite TDS AUTH-07 (`backend/test/integration/auth07-movements-agenda-deadlines.spec.ts`)
Ejecutada contra PostgreSQL 18 real (`abogados_test` bajo `abogados_app_user` `NOBYPASSRLS`):
- **Fase RED (antes de implementar controladores/servicios):** `22 failed, 1 passed, 23 total`.
- **Fase GREEN (posterior a la implementación):** **`23 passed, 23 total` (100% PASS)** cubriendo `TDS-MOV-001..005`, `TDS-AGE-001..005`, `TDS-VEN-001..005` y `TDS-SEC07-001..008`.

### 6.2. Regresión Integral del Backend (`AUTH-01` a `AUTH-07`)
Comando: `cd backend && npx jest --runInBand --forceExit`
```text
Test Suites: 17 passed, 17 total
Tests:       225 passed, 225 total
Snapshots:   0 total
```
*(Nota técnica resuelta durante regresión: al incorporar `APP_ORIGIN=http://localhost:5173` en `backend/.env` de desarrollo, el cargador interno de `PrismaClient` lo propagaba a Jest cuando `.env.test` no definía `APP_ORIGIN`. Se blindó `backend/test/setup-env.ts` fijando `APP_ORIGIN="http://localhost:3000"` y `CORS_ALLOWED_ORIGINS=""` por defecto en entorno de test).*

### 6.3. TypeScript, ESLint y Builds

| Verificación | Comando | Resultado |
| :--- | :--- | :--- |
| Backend TypeScript + Build | `cd backend && npx tsc --noEmit && npm run build` | **PASS (0 errores)** |
| Backend ESLint (AUTH-07) | `cd backend && npx eslint` sobre módulos AUTH-07 + specs | **PASS (0 errores, 0 warnings)** |
| Frontend Build Producción | `cd frontend && npm run build` (`tsc -b && vite build`) | **PASS (0 errores)** |
| Frontend ESLint (AUTH-07) | `cd frontend && npx eslint` sobre archivos AUTH-07 | **PASS (0 errores, 0 warnings)** |
| Frontend TDS LegalPixel | `cd frontend && node --experimental-strip-types --test tests/legal-pixel.test.ts` | **PASS (8/8)** |

---

## 7. ARCHIVOS CREADOS Y MODIFICADOS EN AUTH-07

### Creados
- `backend/prisma/migrations/20261124070000_auth07_movements_agenda_deadlines/migration.sql`
- `backend/src/movimientos/dto/movimiento.dto.ts`
- `backend/src/movimientos/movimientos.service.ts`
- `backend/src/movimientos/movimientos.controller.ts`
- `backend/src/movimientos/movimientos.module.ts`
- `backend/src/agenda/dto/agenda-event.dto.ts`
- `backend/src/agenda/agenda-events.service.ts`
- `backend/src/agenda/agenda-events.controller.ts`
- `backend/src/vencimientos/dto/vencimiento.dto.ts`
- `backend/src/vencimientos/vencimientos.service.ts`
- `backend/src/vencimientos/vencimientos.controller.ts`
- `backend/src/vencimientos/vencimientos.module.ts`
- `backend/test/integration/auth07-movements-agenda-deadlines.spec.ts`
- `frontend/src/modules/agenda/types.ts`
- `frontend/src/modules/vencimientos/pages/VencimientosPage.tsx`
- `frontend/src/modules/expedientes/components/ProceduralTimelineSection.tsx`
- `AUTH07-PROCEDURAL-MOVEMENTS-AGENDA-IMPLEMENTATION-001-REPORT.md`

### Modificados
- `backend/prisma/schema.prisma`
- `backend/prisma/scripts/provision-rls-roles.sql`
- `backend/src/authz/permissions.ts`
- `backend/src/agenda/agenda.module.ts`
- `backend/src/app.module.ts`
- `backend/test/setup-env.ts`
- `backend/test/integration/analytics-legal-pixel.spec.ts`
- `frontend/src/core/api/client.ts`
- `frontend/src/modules/agenda/pages/AgendaPage.tsx`
- `frontend/src/modules/expedientes/pages/CaseDetail.tsx`
- `frontend/src/components/layout/MainLayout.tsx`
- `frontend/src/App.tsx`

---

## 8. LIMITACIONES PENDIENTES Y CONTROL DE CAMBIOS GIT

- **Exclusiones respetadas (pendientes para etapas posteriores):** motor automático de cómputo de plazos legales, notificaciones multicanal (email/WhatsApp/SMS), carga de documentos adjuntos por movimiento, scraping judicial e IA.
- **Selector de responsable en UI:** el backend soporta asignación y filtrado por `responsableId` (verificado en TDS); en el frontend se muestra el responsable asignado y podrá añadirse un selector desplegable de miembros activos del estudio cuando el endpoint de miembros (`GET /organizations/current/members`) se conecte a una vista de selección compartida para roles no administradores.
- **Prisma DLL en Windows durante `start:dev` activo:** los tipos y el runtime de Prisma (`index.d.ts` e `index.js`) se regeneraron completamente; cuando se reinicie la terminal local de `npm run start:dev`, se recomienda detenerla brevemente y ejecutar `npx prisma generate` si se desea eliminar cualquier archivo temporal `.tmp` del binario en `node_modules/.prisma/client/`.
- **Git Baseline:**
  - `HEAD` inicial: `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`
  - `HEAD` final: `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`
  - **Sin commits ni pushes.** Ningún cambio previo fue descartado.

