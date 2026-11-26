# AUTH09-READONLY-DIAGNOSTIC-001 — DIAGNÓSTICO INICIAL READ-ONLY

**Expediente:** `AUTH09-LEGAL-DRAFTING-IMPLEMENTATION-001`  
**Módulo:** AUTH-09 — Escritos y Redacción Jurídica  
**Proyecto:** Abogados-Law (`C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law\`)  
**Rama:** `master`  
**Git HEAD verificado:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`  
**Fecha:** 24/11/2026  
**Confirmación de modalidad:** **READ-ONLY — No se modificó ningún archivo de código fuente, dependencia, esquema Prisma ni base de datos durante esta fase.**

---

## 1. INVENTARIO REAL DE INFRAESTRUCTURA REUTILIZABLE

### Backend
- **Framework y Seguridad Canónica (AUTH-01 a AUTH-04):**
  - NestJS 10 (`@nestjs/common`, `@nestjs/platform-express`), `class-validator`, `class-transformer`.
  - Guards canónicos: `BffSessionGuard`, `ActiveOrgContextGuard`, `CsrfGuard`, `OrgPermissionGuard` y decorador `@RequireOrgPermissions`.
  - Aislamiento DB: `ScopedPrismaService.runInOrgContext()` con `SET LOCAL app.current_organization_id`.
  - Auditoría inmutable: `OrgAuditService` (`AuditLog` con cadena de hashes y RLS).
- **Gestión Documental y Almacenamiento Privado (AUTH-08):**
  - `DocumentsManagementModule` exporta `DocumentsManagementService` y `DocumentStorageService` (`DOCUMENT_STORAGE_ROOT`, staging `.tmp`, escritura exclusiva `wx`, validación por magic bytes para `.docx` y `.pdf`, cálculo/verificación `SHA-256` y compensación automática).
  - **Decisión de reutilización:** cada exportación DOCX/PDF de AUTH-09 se escribirá a un temporal en `DocumentStorageService.getTempDir()` y se persistirá directamente vía `DocumentsManagementService.createWithFile(...)` (sin duplicar storage), vinculando `LegalDraftExport.storageDocumentId` al `Document.id` resultante de AUTH-08 y sirviendo descargas mediante `DocumentsManagementService.prepareDownload(...)`.
- **Entidades integrables:** `Organization`, `User`, `OrganizationMembership`, `Client`, `Expediente`, `MovimientoProcesal`, `Document`, `DocumentFileVersion`, `AuditLog`.

### Hallazgo Crítico del Dominio Existente (Prevención de Regresión AUTH-04)
En `backend/prisma/schema.prisma` existen dos modelos previos utilizados activamente por suites de regresión de AUTH-04:
1. **`LegalDraft` (líneas 1078–1112):** modelo del prototipo IA (`/ai/draft` en `backend/src/ia/drafting/`), con columnas acopladas a IA (`userId`, `draftType: DraftType`, `fuero`, `facts`, `header`, `bodyFacts`, `bodyLaw`, `petitorio`, `fullText`) y `organizationId String?` probado explícitamente con registros `NULL` en `TST-A04-016`, `TST-A04-028` y `auth04-reconciliation-001.spec.ts`.
2. **`LegalTemplate` (líneas 1186–1203):** modelo legado (`/templates` en `backend/src/templates/`), con `organizationId String` obligatorio y probado en `TST-A04-016` exigiendo que **todas** las filas visibles en `tx.legalTemplate.findMany()` tengan `r.organizationId === orgAId` (lo cual fallaría si se insertaran plantillas de sistema con `organizationId = NULL` en esa tabla).
3. En `frontend/src/modules/templates/pages/TemplatesPage.tsx` y `frontend/src/modules/drafting/pages/SmartDraftingPage.tsx` existen únicamente vistas prototipo con simulaciones locales (`setTimeout`/mock) montadas en `/templates` y `/drafting`.

**Decisión arquitectónica (análoga a AUTH-08 `Documento` vs `Document`):**
- **Preservar 100% intactos** los modelos legados `LegalDraft`, `LegalTemplate` y los controladores `/ai/draft` y `/templates` para garantizar **cero degradación en AUTH-01 a AUTH-08**.
- Crear los **5 modelos dedicados de AUTH-09** con RLS `ENABLE + FORCE` y rutas limpias sin colisión (`/legal-drafts` y `/legal-templates`):
  1. `LegalWriting` (entidad lógica del escrito jurídico en `/legal-drafts`)
  2. `LegalDraftVersion` (versiones inmutables con `@@unique([legalDraftId, versionNumber])`)
  3. `LegalDraftTemplate` (plantillas de organización + plantillas orientativas de sistema `isSystemTemplate = true` en `/legal-templates`)
  4. `LegalDraftReview` (revisiones vinculadas a versión concreta `versionId`)
  5. `LegalDraftExport` (exportaciones DOCX/PDF vinculadas a `versionId` + `storageDocumentId` de AUTH-08 + clave de idempotencia)

---

## 2. EVALUACIÓN DE DEPENDENCIAS Y LICENCIAS

### Bibliotecas ya instaladas
- **Backend:** No tiene generador de DOCX ni generador de PDF liviano (`playwright` existe para el crawler pero no es adecuado para generación determinista de PDF en API).
- **Frontend:** React `19.2.0`, Vite `7.2.4`, `lucide-react`, `react-router-dom 7`, `zustand`, `zod`. No posee editor de texto enriquecido.

### Dependencias Open-Source Propuestas (0 costo, 0 servicios externos)
| Capa | Paquete | Licencia | Justificación |
| :--- | :--- | :---: | :--- |
| Backend (DOCX) | `docx` | MIT | Generación pura en Node.js/TS de archivos OOXML `.docx` válidos (márgenes, fuente, tamaño, interlineado, alineación, sangrías, títulos, listas numeradas/viñetas, encabezados, pies y numeración de páginas). |
| Backend (PDF) | `pdfkit` + `@types/pdfkit` | MIT | Generación PDF directa desde el mismo AST estructurado (`ProseMirror/TipTap JSON`), sin LibreOffice ni procesos externos pesados. Soporta márgenes, fuentes estándar legibles, tamaño, interlineado, alineación, sangrías, encabezados, pies y numeración de páginas. *(Se documentará explícitamente que DOCX y PDF usan motores distintos sobre el mismo modelo de contenido).* |
| Frontend (Editor) | `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-text-align` | MIT | Editor basado en ProseMirror compatible con React 19, serializa a **JSON estructurado tipado** (sin HTML arbitrario ni scripts/iframes/objetos embebidos), soporta negrita, cursiva, subrayado, alineación, listas numeradas/viñetas, sangrías, títulos, separadores, undo/redo y pegado de texto plano. |

No se requiere ningún servicio pago, API externa ni cambio de fronteras de seguridad aprobadas.

---

## 3. ESTADO DE POSTGRESQL Y GIT VERIFICADO

- **Git `HEAD`:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` (rama `master`).
- **Árbol de trabajo:** conserva los cambios no commiteados de AUTH-01..AUTH-08. `git diff --check` únicamente muestra 2 advertencias preexistentes fuera de alcance (`backend/src/ia/ia.service.ts:101`, `docs/audits/ABOGADOS-LAW-GIT-BASELINE-CLEANUP-001.md:317`).
- **PostgreSQL 18.4 nativo (`localhost:5432`):**
  - `abogados_test`: **23 tablas** con `ENABLE + FORCE RLS`, **92 políticas activas**, `abogados_app_user` con `rolbypassrls = f`.
  - `abogados_db`: **23 tablas** con `ENABLE + FORCE RLS`, **92 políticas activas**.

---

## 4. PERMISOS Y POLÍTICA DE SEGREGACIÓN DE FUNCIONES

Se extienden permisos específicos en `backend/src/authz/permissions.ts` sin modificar permisos AUTH-04 existentes:

| Permiso | STAFF | ASSISTANT | LAWYER | ORG_ADMIN | ORG_OWNER |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `legal_drafts:read` | No | Sí | Sí | Sí | Sí |
| `legal_drafts:write` | No | Sí | Sí | Sí | Sí |
| `legal_drafts:review` | No | No | Sí | Sí | Sí |
| `legal_drafts:approve` | No | No | Sí | Sí | Sí |
| `legal_drafts:export` | No | Sí | Sí | Sí | Sí |
| `legal_templates:manage` | No | No | Sí | Sí | Sí |

**Política conservadora de segregación de funciones (§7 y §11):**
- **Prohibición de autoaprobación por defecto:** ningún usuario —incluso con rol `ORG_ADMIN` u `ORG_OWNER`— puede aprobar una versión creada por él mismo (`version.createdById === ctx.userId` ni `draft.createdById === ctx.userId` para la revisión de su propia autoría). La aprobación exige un revisor distinto con membresía `ACTIVE` en la organización y permiso `legal_drafts:approve` (403 Forbidden en intento de autoaprobación).
- **Invalidación por nueva versión:** crear una nueva versión sobre un escrito `APPROVED` o `FINALIZED` (o tras `CHANGES_REQUESTED`) conserva intactas las revisiones históricas vinculadas a `versionId` anteriores, devuelve el estado del escrito a `DRAFT` (o exige nueva revisión), e impide que una aprobación de `v1` apruebe automáticamente `v2`.
- **Bloqueo de mutación de estado por PATCH genérico:** `PATCH /legal-drafts/:id` rechaza explícitamente el campo `status` (`forbidNonWhitelisted` + validación en servicio); el estado solo cambia mediante los endpoints de transición (`/submit-review`, `/request-changes`, `/approve`, `/finalize`, `DELETE`).

---

## 5. MATRIZ DE CAMBIOS PLANIFICADA

### Crear
- `AUTH09-READONLY-DIAGNOSTIC-001.md`
- `backend/prisma/migrations/20261124120000_auth09_legal_drafting/migration.sql`
- `backend/src/legal-drafts/content-ast.util.ts` *(esquema AST ProseMirror/TipTap, sanitización estricta anti-XSS/scripts/iframes, extracción de `plainText`, plantillas orientativas de sistema y estructura jurídica editable)*
- `backend/src/legal-drafts/export-generator.service.ts` *(generación real DOCX con `docx` y PDF con `pdfkit` desde el mismo AST)*
- `backend/src/legal-drafts/dto/legal-draft.dto.ts`
- `backend/src/legal-drafts/dto/legal-template.dto.ts`
- `backend/src/legal-drafts/legal-templates.service.ts`
- `backend/src/legal-drafts/legal-templates.controller.ts`
- `backend/src/legal-drafts/legal-drafts.service.ts`
- `backend/src/legal-drafts/legal-drafts.controller.ts`
- `backend/src/legal-drafts/legal-drafts.module.ts`
- `backend/test/integration/auth09-legal-drafting.spec.ts` *(TDS funcional, seguridad, concurrencia, exportación DOCX/PDF, AUTH-08 y RLS real)*
- `frontend/src/modules/legal-drafts/types.ts`
- `frontend/src/modules/legal-drafts/components/LegalRichEditor.tsx` *(editor TipTap/ProseMirror con toolbar completo, sangría, pegado plano, undo/redo, estado sucio y recuperación)*
- `frontend/src/modules/legal-drafts/pages/LegalDraftsListPage.tsx` (`/escritos`)
- `frontend/src/modules/legal-drafts/pages/LegalDraftWorkspacePage.tsx` (`/escritos/:id`)
- `frontend/src/modules/legal-drafts/pages/LegalTemplatesPage.tsx` (`/plantillas`)
- `frontend/src/modules/expedientes/components/ExpedienteDraftsSection.tsx`
- `AUTH09-LEGAL-DRAFTING-IMPLEMENTATION-001-REPORT.md`

### Modificar
- `backend/package.json` (`docx`, `pdfkit`, `@types/pdfkit`)
- `frontend/package.json` (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-text-align`)
- `backend/prisma/schema.prisma`
- `backend/prisma/scripts/provision-rls-roles.sql`
- `backend/src/authz/permissions.ts`
- `backend/src/app.module.ts`
- `frontend/src/core/api/client.ts`
- `frontend/src/components/layout/MainLayout.tsx`
- `frontend/src/App.tsx`
- `frontend/src/modules/expedientes/pages/CaseDetail.tsx`

---

## 6. CONFIRMACIÓN DE DIAGNÓSTICO READ-ONLY

Se confirma expresamente que durante la Fase 0 **no se modificó ningún archivo del código fuente, dependencias, esquema ni base de datos**. Se procede con la implementación autorizada siguiendo TDS (tests RED antes de controladores/servicios).

