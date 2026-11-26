# FRONTEND-LEGALPIXEL-CONNECTION-REMEDIATION-001 — INFORME DE DIAGNÓSTICO Y CORRECCIÓN FOCALIZADA DE LEGALPIXEL

**Expediente:** `FRONTEND-LEGALPIXEL-CONNECTION-REMEDIATION-001`  
**Proyecto:** Abogados-Law  
**Repositorio:** `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law\`  
**Rama:** `master`  
**Git Baseline Inicial:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`  
**Git Baseline Final:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` (Sin commits ni pushes)  
**Fecha:** 24/11/2026  
**Estado:** **RESUELTO Y VERIFICADO**

---

## 1. CAUSA RAÍZ COMPROBADA (FASE 0 — DIAGNÓSTICO READ-ONLY)

La inspección directa del código fuente y de los puertos locales comprobó una combinación de **disponibilidad del backend** e **incompatibilidad del cliente `LegalPixel` con la arquitectura AUTH-01..AUTH-04**:

1. **Backend NestJS detenido en puerto `3000` (causa directa de `net::ERR_CONNECTION_REFUSED`):**
   - `backend/src/main.ts:42` configura `await app.listen(3000)` con CORS habilitado para `http://localhost:5173..5176` (`credentials: true`).
   - `netstat -ano` confirmó que únicamente Vite escuchaba en `:5173` (`LISTENING`), mientras el puerto `:3000` **no tenía ningún proceso escuchando**.
   - El endpoint `POST /events/collect` existe realmente en `backend/src/analytics/analytics.controller.ts:17-40`.
2. **Incompatibilidades confirmadas en `frontend/src/core/analytics/LegalPixel.ts` y `frontend/src/App.tsx`:**
   - **URL duplicada y hardcodeada:** `LegalPixel.ts:97` tenía hardcodeado `'http://localhost:3000/events/collect'` y `client.ts:2` tenía `'http://localhost:3000'` sin configuración centralizada (`VITE_API_URL`).
   - **Disparo sin sesión BFF (incluyendo modo Demo Partner / `/login`):** `App.tsx:50-53` invocaba `LegalPixel.track('VIEW_PAGE', ...)` en cada cambio de ruta sin verificar autenticación; y `LegalPixel.ts` leía `localStorage.getItem('auth-storage')` en lugar de validar la presencia de sesión BFF (`csrf_token` emitida por `BffController.callback` junto a la cookie `HttpOnly` `app_session`).
   - **Violación del contrato real de seguridad de `POST /events/collect`:** El controlador protege el endpoint con `@UseGuards(BffSessionGuard, ActiveOrgContextGuard, CsrfGuard, PixelGuard)`. El cliente anterior:
     - Omitía `credentials: 'include'` (requerido para `app_session` / `BffSessionGuard`).
     - Omitía `X-CSRF-Token` (requerido por `CsrfGuard`).
     - Enviaba `organizationId` en el body y `X-Org-Id` en headers (rechazado con `403 ORGANIZATION_CONTEXT_MISMATCH` por `ActiveOrgContextGuard` cuando no coincide con `req.session.activeOrganizationId`).
     - Usaba un fallback inseguro `'default-insecure-key-REPLACE-ME'` cuando `VITE_PIXEL_KEY` no estaba definido.
   - **Contaminación de consola y envíos duplicados:**
     - `frontend/src/main.tsx:7` ejecuta `<StrictMode>`, duplicando el `useEffect` de `App.tsx` en cada montaje y generando 2 peticiones idénticas consecutivas.
     - `LegalPixel.ts:111` ejecutaba `console.error('Legal Pixel Drop:', error)` en cada fallo de red pese a declararse telemetría auxiliar *silent fail*.

---

## 2. ARCHIVOS CREADOS Y MODIFICADOS

### Creados
- `frontend/src/core/config/api.ts` — Configuración unificada de `API_URL` (`import.meta.env.VITE_API_URL || 'http://localhost:3000'`).
- `frontend/tests/legal-pixel.test.ts` — Suite TDS focalizada de `LegalPixel` (8 casos: `TDS-LP-001` a `TDS-LP-007` y `TDS-LP-009`).
- `backend/test/integration/analytics-legal-pixel.spec.ts` — Suite TDS de integración real sobre PostgreSQL 18 (`TDS-LP-008a..d`) contra `AnalyticsController` y sus 4 guards intactos.
- `FRONTEND-LEGALPIXEL-CONNECTION-REMEDIATION-001-REPORT.md` — Este informe.

### Modificados
- `frontend/src/core/api/client.ts` — Reutiliza `API_URL` desde `../config/api` (elimina duplicación hardcodeada).
- `frontend/src/core/analytics/LegalPixel.ts` — Remediación completa de telemetría auxiliar compatible con AUTH-01..AUTH-04.
- `frontend/src/App.tsx` — Evita invocar `LegalPixel.track('VIEW_PAGE', ...)` cuando `!isAuthenticated` y depende de `location.pathname`.

> **Confirmación de alcance:** No se modificaron módulos de Clientes ni Expedientes, ni se debilitaron guards, CSRF, permisos ni políticas RLS en el backend.

---

## 3. CORRECCIONES APLICADAS

1. **Centralización de `API_URL` (`frontend/src/core/config/api.ts`):** Soporta `VITE_API_URL` con fallback compatible a `http://localhost:3000`, consumido por `client.ts` y `LegalPixel.ts`.
2. **Eliminación de `localStorage` en `LegalPixel.ts`:** Se removió completamente la lectura de `auth-storage` en `localStorage`. Nunca lee, almacena ni expone tokens de sesión en `localStorage`.
3. **Verificación de sesión BFF y CSRF (`csrf_token`):** Antes de enviar cualquier evento protegido, `LegalPixel` lee la cookie no-HttpOnly `csrf_token` emitida por `BffController.callback`. Si no existe (usuario no autenticado o sesión Demo local), **omite el envío silenciosamente** sin invocar `fetch`.
4. **Cumplimiento estricto del contrato `POST /events/collect`:**
   - Envía `credentials: 'include'` (adjunta `app_session` `HttpOnly`).
   - Envía cabecera `X-CSRF-Token` con el valor de `csrf_token`.
   - **No envía `organizationId` en el body ni `X-Org-Id`/`X-Organization-Id` en cabeceras**; el servidor deriva `organizationId` y `actorId` exclusivamente de `req.orgContext`.
   - Firma HMAC-SHA256 (`X-Timestamp`, `X-Nonce`, `X-Signature`) compatible con `PixelGuard` (`"" + timestamp + nonce + bodyString`) únicamente cuando `VITE_PIXEL_KEY` está configurado explícitamente (sin clave insegura por defecto).
5. **Deduplicación ante React `StrictMode`:** Deduplica eventos consecutivos idénticos `(eventType, entityId, payload)` dentro de una ventana de `1000ms`.
6. **Falla silenciosa y no bloqueante:** Sin `console.error`, sin `console.log` ruidosos, sin excepciones no controladas y sin reintentos infinitos ante fallos de red (`ERR_CONNECTION_REFUSED`) o respuestas `4xx`/`5xx`.

---

## 4. EVIDENCIA TDS (RED → GREEN)

### 4.1. Fase RED (antes de modificar `LegalPixel.ts`)

Comando: `cd frontend && node --experimental-strip-types --test tests/legal-pixel.test.ts`

```text
# Pixel init warning: ReferenceError: localStorage is not defined
# tests 8 | pass 2 | fail 6
- FAIL TDS-LP-002: Expected 0 console.error calls on network failure, got 1
- FAIL TDS-LP-004, TDS-LP-005, TDS-LP-006, TDS-LP-007, TDS-LP-009: contrato/headers/CSRF/deduplicación/env fallidos
```

### 4.2. Fase GREEN (posterior a la remediación)

1. **Frontend TDS (`frontend/tests/legal-pixel.test.ts`):**
   ```text
   # tests 8 | suites 1 | pass 8 | fail 0
   - PASS TDS-LP-001: No bloquea renderizado/navegación si backend está detenido
   - PASS TDS-LP-002: Falla de fetch no produce errores no controlados ni contamina console.error
   - PASS TDS-LP-003: No envía eventos protegidos sin sesión BFF válida (sin cookie csrf_token)
   - PASS TDS-LP-004: Payload y firma HMAC cumplen contrato de POST /events/collect
   - PASS TDS-LP-005: No envía organizationId manipulable en body ni X-Org-Id
   - PASS TDS-LP-006: Incluye X-CSRF-Token de cookie BFF y credentials: include
   - PASS TDS-LP-007: Evita envíos duplicados consecutivos (React StrictMode)
   - PASS TDS-LP-009: Continúa operando sin errores ni reintentos infinitos ante HTTP 503
   ```

2. **Backend Integración Real sobre PostgreSQL 18 (`backend/test/integration/analytics-legal-pixel.spec.ts`):**
   ```text
   PASS test/integration/analytics-legal-pixel.spec.ts
   Test Suites: 1 passed, 1 total | Tests: 4 passed, 4 total
   - PASS TDS-LP-008a: Evento válido sin organizationId/X-Org-Id -> HTTP 201 y persistido en EventLog bajo orgA
   - PASS TDS-LP-008b: Sin sesión BFF -> HTTP 401 Unauthorized
   - PASS TDS-LP-008c: Sin X-CSRF-Token -> HTTP 403 Forbidden (CSRF intacto)
   - PASS TDS-LP-008d: organizationId manipulado en body -> HTTP 403 ORGANIZATION_CONTEXT_MISMATCH
   ```

---

## 5. COMANDOS EXACTOS PARA INICIAR BACKEND Y FRONTEND (TERMINALES SEPARADAS)

El backend y el frontend deben ejecutarse en **dos terminales separadas** (no se dejaron procesos ocultos corriendo):

### Terminal 1 — Backend NestJS (`http://localhost:3000`)
```powershell
cd C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law\backend
npm run start:dev
```
*(Puerto configurado en `backend/src/main.ts:42`: `http://localhost:3000`; Swagger en `http://localhost:3000/api`.)*

### Terminal 2 — Frontend Vite (`http://localhost:5173`)
```powershell
cd C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law\frontend
npm run dev
```
*(Opcional en `frontend/.env.local` si se desea habilitar el envío firmado de LegalPixel contra backend local con sesión BFF activa: `VITE_API_URL=http://localhost:3000` y `VITE_PIXEL_KEY=<mismo secreto que PIXEL_HMAC_SECRET en backend>`.)*

---

## 6. VERIFICACIÓN FINAL Y PRUEBAS MANUALES DOCUMENTADAS

| Verificación | Comando / Procedimiento | Resultado |
| :--- | :--- | :--- |
| Pruebas TDS Frontend | `cd frontend && node --experimental-strip-types --test tests/legal-pixel.test.ts` | **PASS (8/8)** |
| Pruebas TDS Backend (PG 18) | `cd backend && npx jest test/integration/analytics-legal-pixel.spec.ts --runInBand --forceExit` | **PASS (4/4)** |
| Frontend Build + TS | `cd frontend && npm run build` (`tsc -b && vite build`) | **PASS (0 errores)** |
| Frontend ESLint (modificados) | `cd frontend && npx eslint src/core/config/api.ts src/core/analytics/LegalPixel.ts src/App.tsx tests/legal-pixel.test.ts` | **PASS (0 errores, 0 warnings)** |
| Backend TypeScript + Build + ESLint | `cd backend && npx tsc --noEmit && npm run build && npx eslint test/integration/analytics-legal-pixel.spec.ts` | **PASS (0 errores, 0 warnings)** |
| **Verificación manual: backend detenido (`:3000` cerrado)** | Sonda real invocando `LegalPixel.track('VIEW_PAGE', { path: '/probe-offline' })` hacia `http://localhost:3000` cerrado | **`OFFLINE_PROBE_OK errors=0`** (falla silenciosa, sin bloqueo ni `console.error`) |
| **Verificación manual: backend activo (`:3000` abierto)** | Arranque transitorio de `dist/src/main.js` (contra `abogados_test`), sonda HTTP a `POST /events/collect` y `GET /api`, y apagado inmediato en `finally` | **`LIVE_PROBE_OK collect_status=401 swagger_status=200`** (sin `ERR_CONNECTION_REFUSED`, guards activos y sin procesos residuales) |

---

## 7. CONFIRMACIÓN DE CONTROL DE VERSIONES

- **Git HEAD verificado:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`
- **Commits realizados:** Ninguno.
- **Pushes realizados:** Ninguno.
- Todos los cambios previos de AUTH-01 a AUTH-06 en el árbol de trabajo permanecen intactos.

