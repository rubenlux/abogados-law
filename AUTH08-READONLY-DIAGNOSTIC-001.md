# AUTH08-READONLY-DIAGNOSTIC-001 — DIAGNÓSTICO INICIAL READ-ONLY

**Expediente:** `AUTH08-DOCUMENT-MANAGEMENT-IMPLEMENTATION-001`  
**Proyecto:** Abogados-Law  
**Repositorio:** `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law\`  
**Rama:** `master`  
**Git HEAD verificado:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`  
**Fecha:** 24/11/2026  
**Confirmación de modalidad:** **READ-ONLY — No se modificó ningún archivo del código fuente ni de la base de datos durante esta fase.**

---

## 1. INVENTARIO REAL DE INFRAESTRUCTURA REUTILIZABLE

### Backend
- **Framework y carga multipart:** NestJS 10 (`@nestjs/platform-express ^10.0.0`), con `multer` ya instalado en `backend/node_modules/multer` (sin necesidad de instalar paquetes SaaS ni dependencias nuevas).
- **Seguridad y autorización canónica (AUTH-01 a AUTH-04):**
  - `BffSessionGuard`, `ActiveOrgContextGuard`, `CsrfGuard`, `OrgPermissionGuard` y decorador `@RequireOrgPermissions`.
  - `ScopedPrismaService.runInOrgContext()` con `SET LOCAL app.current_organization_id`.
  - `OrgAuditService` + tabla `AuditLog` (append-only con cadena de hashes y RLS).
- **Entidades integrables (AUTH-05 a AUTH-07):** `Organization`, `User`, `OrganizationMembership`, `Client`, `Expediente`, `MovimientoProcesal`.
- **Existencia de artefactos documentales previos (AUTH-04):**
  - En `schema.prisma` existen `Documento` (acoplado obligatoriamente a `expedienteId`, `ocrContent`, `isLocked`, `legalHold`) y `DocumentVersion` (sin `@@unique([documentId, versionNumber])`, sin `changeNote`, acoplado a `Documento`).
  - `backend/src/expedientes/documents.controller.ts` y `documents.service.ts` implementan únicamente 3 endpoints usados por la regresión AUTH-04 (`POST /documents/:id/versions` en JSON, `PATCH /documents/:id/legal-hold`, `GET /documents/compare/:v1/:v2`).

### Frontend
- **Cliente HTTP:** `frontend/src/core/api/client.ts` con `API_URL` centralizado (`frontend/src/core/config/api.ts`), `credentials: 'include'` y cabecera automática `X-CSRF-Token` leída de cookie `csrf_token`.
- **Layout y Rutas:** `frontend/src/components/layout/MainLayout.tsx` y `frontend/src/App.tsx`.
- **Integraciones listas:** `CaseDetail.tsx` (`/expedientes/:id`), `ClientsList.tsx`, `ProceduralTimelineSection.tsx`.

### Infraestructura y Git
- **PostgreSQL 18.4 nativo local (`localhost:5432`):**
  - `abogados_test`: `abogados_app_user` con `rolbypassrls = false`, `21` tablas con `ENABLE + FORCE RLS`, `84` políticas activas.
  - `abogados_db`: `abogados_app_user` con `rolbypassrls = false`, `21` tablas con `ENABLE + FORCE RLS`, `84` políticas activas.
- **Almacenamiento actual:** No existe almacenamiento privado local implementado ni S3/MinIO corriendo localmente (Docker Desktop no tiene contenedores activos).
- **Git Baseline:** `HEAD = 1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`. El árbol de trabajo contiene los cambios acumulados no commiteados de AUTH-01..AUTH-07 que deben preservarse íntegramente. `git diff --check` detectó 2 advertencias menores preexistentes fuera de alcance (`backend/src/ia/ia.service.ts:101` y `docs/audits/ABOGADOS-LAW-GIT-BASELINE-CLEANUP-001.md:317`).

---

## 2. DECISIÓN DE ALMACENAMIENTO RECOMENDADA

Implementar un **motor de almacenamiento privado en filesystem local** (`DocumentStorageService`) sin dependencias SaaS pagas:
- Configurable mediante `DOCUMENT_STORAGE_ROOT` (valor por defecto en desarrollo: `<backend>/.private-storage/documents`, estrictamente fuera de `frontend/public`, `dist` y cualquier raíz estática).
- Staging temporal en `${DOCUMENT_STORAGE_ROOT}/.tmp` vía `multer.diskStorage` (evita carga ilimitada en RAM; límite estricto de `25 MB` por archivo).
- Validación server-side por **magic bytes** + extensión + rechazo explícito de archivos vacíos, ejecutables (`MZ`, ELF, scripts), HTML, SVG y MIME/extensión falsificados.
- Claves de almacenamiento opacas e impredecibles (`tenants/<orgId>/docs/<docId>/v<n>/<uuid>.bin`), sin usar jamás `originalFilename` en la ruta física, creación exclusiva (`wx` sin sobrescritura), protección anti-traversal y anti-symlinks (`realpath` + `lstat`).
- Cálculo de `SHA-256` por streaming en backend al cargar y verificación de integridad `SHA-256` antes de entregar cualquier descarga.
- Compensación explícita: limpieza de `.tmp` en `finally` y borrado del objeto promovido si falla PostgreSQL o el registro en `AuditLog`.
- Interfaz preparada para escaneo antivirus futuro (`DocumentMalwareScanner` con implementación `NoOpDocumentMalwareScanner` en esta fase).

---

## 3. RIESGOS DE SEGURIDAD IDENTIFICADOS

1. **Colisión con endpoints y tests de AUTH-04:** `auth04-rls-and-isolation.spec.ts` invoca `POST /documents/:id/versions` (JSON), `PATCH /documents/:id/legal-hold` y `GET /documents/compare/:v1/:v2` sobre `Documento`/`DocumentVersion`, y `auth04-primitives-and-containment.spec.ts` exige `hasOrgPermissions(STAFF, ["documents:read"]) === false`. **Mitigación:** crear modelos dedicados `Document` y `DocumentFileVersion` (sin alterar `Documento`/`DocumentVersion`), unificar `@Controller("documents")` manteniendo 100% intactos los endpoints AUTH-04 (distinguiendo `multipart/form-data` vs JSON en `POST /documents/:id/versions`), e introducir `documents:metadata_read`, `documents:download` y `documents:delete` sin otorgar `documents:read` a `STAFF`.
2. **Path traversal, symlinks y sobrescritura:** mitigado mediante `storageKey` generado por backend, `path.resolve` + verificación de prefijo estricto dentro de `DOCUMENT_STORAGE_ROOT`, `lstat` contra symlinks y apertura exclusiva (`wx`).
3. **MIME/extensión falsificada y XSS por descarga (HTML/SVG):** mitigado mediante inspección de magic bytes reales, lista blanca estricta (PDF, DOCX, DOC, XLSX, XLS, PNG, JPG/JPEG) y headers obligatorios `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`.
4. **Inconsistencia filesystem ↔ PostgreSQL (archivos huérfanos o referencias rotas):** mitigado mediante staging temporal → promoción exclusiva → transacción atómica (metadatos + `AuditLog`) → compensación en `catch` y verificación de existencia + SHA-256 al descargar.
5. **Cross-tenant IDOR y asociaciones ajenas:** mitigado con doble barrera (`ScopedPrismaService.runInOrgContext` + PostgreSQL RLS `ENABLE + FORCE` sobre `Document` y `DocumentFileVersion`) + validación explícita de pertenencia a `ctx.organizationId` para `expedienteId`, `clientId` y `movimientoProcesalId` (coherencia con `expedienteId`) devolviendo `404` anti-enumeración.

---

## 4. MODELOS Y RELACIONES EXISTENTES VS NUEVOS

- **Reutilizados:** `Organization`, `User`, `OrganizationMembership`, `Client`, `Expediente`, `MovimientoProcesal`, `AuditLog` (`OrgAuditService`, evitando duplicar una tabla redundante `DocumentAccessLog`).
- **Preservados intactos (AUTH-04):** `Documento`, `DocumentVersion`.
- **Nuevos (AUTH-08):**
  - Enums `DocumentCategory` (15 categorías iniciales) y `DocumentStatus` (`ACTIVE`, `ARCHIVED`).
  - Modelo `Document`: identidad lógica, metadatos, asociaciones opcionales (`expedienteId`, `clientId`, `movimientoProcesalId`), `currentVersionNumber`, `status`, `createdById`, `archivedAt`, `archivedById`.
  - Modelo `DocumentFileVersion`: versión física inmutable (`@@unique([documentId, versionNumber])`, `storageKey @unique`, `originalFilename`, `mimeType`, `sizeBytes`, `sha256`, `uploadedById`, `uploadedAt`, `changeNote`).

---

## 5. PERMISOS DISPONIBLES Y EXTENSIÓN MÍNIMA PROPUESTA

| Permiso | STAFF | ASSISTANT | LAWYER | ORG_ADMIN | ORG_OWNER | Origen |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `documents:metadata_read` | Sí *(proyección mínima)* | Sí | Sí | Sí | Sí | **Nuevo (AUTH-08)** |
| `documents:read` | No *(preservado AUTH-04)* | Sí | Sí | Sí | Sí | Existente (AUTH-04) |
| `documents:write` | No | Sí | Sí | Sí | Sí | Existente (AUTH-04) |
| `documents:download` | No | Sí | Sí | Sí | Sí | **Nuevo (AUTH-08)** |
| `documents:delete` | No | No | No | Sí | Sí | **Nuevo (AUTH-08)** |
| `documents:sensitive` | No | No | No | Sí | Sí | Existente (AUTH-04) |

---

## 6. CAMBIOS DE ESQUEMA NECESARIOS

- Migración SQL incremental idempotente: `backend/prisma/migrations/20261124080000_auth08_document_management/migration.sql` (aplicada a `abogados_test` y `abogados_db`, sin `migrate reset`).
- `ENABLE ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY` + 4 políticas por tabla (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) en `"Document"` y `"DocumentFileVersion"`.
- `GRANT SELECT, INSERT, UPDATE, DELETE` para `abogados_app_user` (actualizando también `backend/prisma/scripts/provision-rls-roles.sql`).

---

## 7. MATRIZ DE ARCHIVOS A CREAR Y MODIFICAR

### Crear
- `AUTH08-READONLY-DIAGNOSTIC-001.md`
- `backend/prisma/migrations/20261124080000_auth08_document_management/migration.sql`
- `backend/src/documents/dto/document.dto.ts`
- `backend/src/documents/file-signature.util.ts`
- `backend/src/documents/document-storage.service.ts`
- `backend/src/documents/documents-management.service.ts`
- `backend/src/documents/documents-management.module.ts`
- `backend/test/integration/auth08-documents.spec.ts`
- `frontend/src/modules/documents/types.ts`
- `frontend/src/modules/documents/pages/DocumentsListPage.tsx`
- `frontend/src/modules/documents/pages/DocumentDetailPage.tsx`
- `frontend/src/modules/expedientes/components/ExpedienteDocumentsSection.tsx`
- `AUTH08-DOCUMENT-MANAGEMENT-IMPLEMENTATION-001-REPORT.md`

### Modificar
- `backend/prisma/schema.prisma`
- `backend/prisma/scripts/provision-rls-roles.sql`
- `backend/src/authz/permissions.ts`
- `backend/src/expedientes/documents.controller.ts` *(unificación de `@Controller("documents")` preservando AUTH-04)*
- `backend/src/expedientes/expedientes.module.ts`
- `backend/src/app.module.ts`
- `backend/.env.example` *(documentar `DOCUMENT_STORAGE_ROOT`)*
- `frontend/src/core/api/client.ts`
- `frontend/src/components/layout/MainLayout.tsx`
- `frontend/src/App.tsx`
- `frontend/src/modules/expedientes/pages/CaseDetail.tsx`

---

## 8. ESTRATEGIA DE PRUEBAS TDS

Suite `backend/test/integration/auth08-documents.spec.ts` ejecutada contra PostgreSQL 18 real (`abogados_test` bajo `abogados_app_user` `NOBYPASSRLS`) + almacenamiento privado temporal real en disco:
1. **Funcionales (§10.1):** alta con archivo real, consulta, listado/filtros, asociación a expediente/cliente/movimiento, v1 y v2 inmutables, descarga actual e histórica con headers seguros, SHA-256 en backend, detección de corrupción de integridad, edición de metadatos, archivado y restauración.
2. **Seguridad (§10.2):** 401 sin sesión, CSRF inválido, org suspendida, membresía revocada, `STAFF` sin permiso de descarga/escritura y proyección restringida, `ASSISTANT`/`LAWYER` sin `documents:delete`, IDOR entre Org A y Org B (`404`), spoofing de `organizationId` (`403`), asociación a expediente/cliente/movimiento ajenos, descarga por `versionId` ajeno, path traversal (`../`), nombre malicioso, MIME falso, extensión falsa, archivo vacío, >25 MB, ejecutable (`MZ`/HTML/SVG), intento de sobrescritura de `storageKey`, no exposición de `storageKey`/ruta física, comportamiento tras archivar.
3. **Almacenamiento y compensación (§10.3):** fallo de escritura/lectura/promoción, fallo de persistencia PostgreSQL, fallo de auditoría, limpieza de temporales `.tmp`, ausencia de archivos huérfanos e integridad SHA-256.
4. **RLS real (§10.4):** consultas directas como `abogados_app_user` con/sin contexto `app.current_organization_id` (fail-closed, aislamiento bidireccional Org A ↔ Org B).
5. **Regresión (§10.5):** ejecución íntegra de todas las suites AUTH-01 a AUTH-08.

---

## 9. CONFIRMACIÓN DE DIAGNÓSTICO READ-ONLY

Se confirma expresamente que durante esta Fase 0 **no se modificó ningún archivo de código fuente, esquema Prisma, migración ni base de datos**. Se procede a la implementación autorizada.

