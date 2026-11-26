# AUTH09-LEGAL-DRAFTING-IMPLEMENTATION-001 — REPORTE FINAL DE IMPLEMENTACIÓN

**Expediente:** `AUTH09-LEGAL-DRAFTING-IMPLEMENTATION-001`  
**Módulo:** AUTH-09 — Escritos y Redacción Jurídica  
**Proyecto:** Abogados-Law (`C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law\`)  
**Rama:** `master`  
**Git Baseline (`HEAD`) inicial y final:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`  
**Fecha de cierre:** 24/11/2026  
**Confirmación Git:** **Cero commits y cero pushes realizados.** Todos los cambios preexistentes de AUTH-01 a AUTH-08 se preservaron íntegramente.

---

## 1. DIAGNÓSTICO READ-ONLY (FASE 0)

Documentado previo a cualquier edición en [`AUTH09-READONLY-DIAGNOSTIC-001.md`](AUTH09-READONLY-DIAGNOSTIC-001.md):
- Se detectó que en `backend/prisma/schema.prisma` ya existían `LegalDraft` (prototipo IA `/ai/draft`, probado en `TST-A04-016`, `TST-A04-028` y `auth04-reconciliation-001.spec.ts` incluso con registros `organizationId = NULL`) y `LegalTemplate` (prototipo `/templates`, probado en `TST-A04-016` exigiendo `r.organizationId === orgAId` para todas las filas retornadas).
- Para cumplir **Regla 1 (no degradar AUTH-01..08)**, se preservaron 100% intactos `LegalDraft`, `LegalTemplate`, `/ai/draft` y `/templates`, y se crearon los 5 modelos dedicados de AUTH-09 servidos bajo `/legal-drafts` y `/legal-templates`.
- Se confirmó reutilización integral de AUTH-08 (`DocumentsManagementModule`, `DocumentsManagementService`, `DocumentStorageService`) para almacenamiento privado de exportaciones DOCX/PDF sin duplicar infraestructura.

---

## 2. ARQUITECTURA Y DECISIONES CLAVE

- **Separación estricta de entidades de dominio:**
  1. `LegalWriting`: entidad lógica de trabajo del escrito (vinculada obligatoriamente a `Expediente` y opcionalmente a `Client` y `sourceTemplate`).
  2. `LegalDraftVersion`: snapshot inmutable del contenido JSON estructurado (`TIPTAP_JSON`) y `plainText` por versión secuencial.
  3. `LegalDraftTemplate`: plantillas reutilizables del estudio + plantillas orientativas de sistema de solo lectura (`isSystemTemplate = true`).
  4. `LegalDraftReview`: instancias de revisión y aprobación vinculadas a una `versionId` específica.
  5. `LegalDraftExport`: registro inmutable e idempotente de archivos DOCX/PDF generados, enlazados a `versionId` y al documento privado AUTH-08 (`storageDocumentId`).
- **Principio profesional:** el sistema no inventa legislación, jurisprudencia ni datos procesales (los datos desconocidos se representan como marcadores `[COMPLETAR ...]`), no usa IA generativa en esta fase, no firma digitalmente y no genera `MovimientoProcesal` automático al exportar.

---

## 3. MODELOS Y MIGRACIONES

- **Esquema Prisma:** [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma) — 6 enums (`LegalDraftDocumentType` con 13 tipos extensibles, `LegalDraftStatus`, `LegalContentFormat`, `LegalDraftReviewStatus`, `LegalDraftExportFormat`, `LegalDraftExportStatus`) y 5 modelos (`LegalWriting`, `LegalDraftVersion`, `LegalDraftTemplate`, `LegalDraftReview`, `LegalDraftExport`).
- **Migración incremental idempotente (sin reset):** [`backend/prisma/migrations/20261124120000_auth09_legal_drafting/migration.sql`](backend/prisma/migrations/20261124120000_auth09_legal_drafting/migration.sql) aplicada en **ambas** bases PostgreSQL 18.4:
  - `abogados_test`: **28 tablas** con `ENABLE + FORCE ROW LEVEL SECURITY`, **112 políticas activas**.
  - `abogados_db`: **28 tablas** con `ENABLE + FORCE ROW LEVEL SECURITY`, **112 políticas activas**.
- **Script de privilegios actualizado:** [`backend/prisma/scripts/provision-rls-roles.sql`](backend/prisma/scripts/provision-rls-roles.sql).

---

## 4. EDITOR ELEGIDO Y JUSTIFICACIÓN

- **Elección:** **TipTap v3 (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-text-align`)** — Licencia **MIT**, compatible con **React 19.2.0**, basado en ProseMirror, cero servicios externos, cero costos.
- **Implementación:** [`frontend/src/modules/legal-drafts/components/LegalRichEditor.tsx`](frontend/src/modules/legal-drafts/components/LegalRichEditor.tsx) + sanitizador estricto server-side [`backend/src/legal-drafts/content-ast.util.ts`](backend/src/legal-drafts/content-ast.util.ts).
- **Capacidades cubiertas:** párrafos, títulos (`H2`/`H3`), negrita, cursiva, subrayado, alineación (izquierda/centro/derecha/justificado), listas numeradas y con viñetas, sangría configurable (`ParagraphIndent` niveles 0..6), separador horizontal, deshacer/rehacer, pegado de texto sin formato activo por defecto, guardado explícito por versión, indicador de cambios sin guardar y conservación del contenido en memoria ante fallos de guardado.
- **Seguridad del contenido:** almacena únicamente JSON estructurado validado contra lista blanca de nodos/marcas/atributos; rechaza `script`, `iframe`, `object`, `svg`, atributos `on*`, `src`, `href` y `style` (verificado en `TDS-DRF-SEC-003`).

---

## 5. VERSIONADO

- Cada guardado explícito (`POST /legal-drafts/:id/versions`) adquiere lock de fila (`SELECT id FROM "LegalWriting" WHERE id = $1 FOR UPDATE`), crea una fila inmutable en `LegalDraftVersion` con `@@unique([legalDraftId, versionNumber])` y actualiza `currentVersionNumber`.
- Inmutabilidad reforzada en **doble capa**: la API no ofrece edición de versiones históricas y PostgreSQL otorga a `abogados_app_user` únicamente `SELECT, INSERT` sobre `"LegalDraftVersion"` (un `UPDATE` o `DELETE` falla con `42501 permission denied`).
- El espacio de trabajo `/escritos/:id` permite navegar cualquier versión histórica en modo solo lectura y realizar comparación de texto plano lado a lado entre versiones.

---

## 6. PLANTILLAS

- Endpoints `/legal-templates` (`GET`, `POST`, `GET /:id`, `PATCH /:id`, `POST /:id/duplicate`, `DELETE /:id`) en [`legal-templates.service.ts`](backend/src/legal-drafts/legal-templates.service.ts) y [`legal-templates.controller.ts`](backend/src/legal-drafts/legal-templates.controller.ts).
- Se siembran 2 plantillas orientativas editables de sistema (`isSystemTemplate = true`, `organizationId = NULL`), identificadas explícitamente como modelos orientativos que requieren verificación profesional.
- Las plantillas de sistema son de solo lectura (`PATCH` y `DELETE` devuelven `403 Forbidden`), pero pueden duplicarse a la organización (`POST /:id/duplicate`).
- Al crear un escrito desde plantilla (`sourceTemplateId`), se realiza una copia profunda independiente del contenido para `v1`, registrando `sourceTemplateId` como metadato de origen sin acoplamiento mutable posterior (verificado en `TDS-DRF-003`).

---

## 7. FLUJO DE REVISIÓN Y SEGREGACIÓN DE FUNCIONES

- Estados implementados: `DRAFT`, `IN_REVIEW`, `CHANGES_REQUESTED`, `APPROVED`, `FINALIZED`, `ARCHIVED`.
- Transiciones validadas estrictamente mediante endpoints dedicados (`/submit-review`, `/request-changes`, `/approve`, `/finalize`, `DELETE`). El `PATCH /legal-drafts/:id` genérico rechaza el campo `status` (`400 Bad Request`).
- **Política conservadora de segregación de funciones (§7 y §11):** ningún usuario —incluidos `ORG_ADMIN` y `ORG_OWNER`— puede aprobar un escrito o versión creado por él mismo (`403 Forbidden`). La aprobación exige otro usuario con membresía `ACTIVE` y permiso `legal_drafts:approve`.
- **Invalidación de aprobaciones por nueva versión:** si se crea una nueva versión sobre un escrito `APPROVED` o `FINALIZED`, el escrito regresa a `DRAFT`, las aprobaciones históricas quedan preservadas en `LegalDraftReview` vinculadas a su `versionId` anterior y no aprueban automáticamente la nueva versión.
- Todas las transiciones quedan registradas en `AuditLog` (`LEGAL_DRAFT_CREATED`, `LEGAL_DRAFT_METADATA_UPDATED`, `LEGAL_DRAFT_VERSION_CREATED`, `LEGAL_DRAFT_SUBMITTED_FOR_REVIEW`, `LEGAL_DRAFT_CHANGES_REQUESTED`, `LEGAL_DRAFT_APPROVED`, `LEGAL_DRAFT_FINALIZED`, `LEGAL_DRAFT_ARCHIVED`, `LEGAL_DRAFT_EXPORTED`).

---

## 8. GENERACIÓN REAL DOCX Y PDF

- Implementada en [`backend/src/legal-drafts/export-generator.service.ts`](backend/src/legal-drafts/export-generator.service.ts):
  - **DOCX:** librería `docx` (`^9.16.0`, MIT) generando OOXML real (márgenes en cm, fuente, tamaño, interlineado, alineación, sangrías, títulos, listas numeradas/viñetas, separadores, encabezado, pie y numeración de páginas `Página X de Y`).
  - **PDF:** librería `pdfkit` (`^0.15.2`, MIT) generando PDF real directamente desde el mismo AST estructurado (`TipTap JSON`) con soporte de márgenes, fuente, tamaño, interlineado, alineación, sangrías, encabezados, pies y numeración de páginas (`bufferPages: true`).
- **Transparencia técnica (§8):** DOCX y PDF se generan desde dos motores distintos sobre el mismo modelo de contenido estructurado; no se utiliza LibreOffice ni conversión DOCX→PDF, por lo que los saltos de línea/página pueden variar levemente entre ambos formatos conservando el 100% del texto y jerarquía de la versión exportada.

---

## 9. INTEGRACIÓN AUTH-08 (GESTIÓN DOCUMENTAL Y STORAGE PRIVADO)

- `LegalDraftsService.exportDraft()` escribe el binario generado a un temporal en `DocumentStorageService.getTempDir()` y lo persiste mediante `DocumentsManagementService.createWithFile(...)`, reutilizando validación de magic bytes (`.docx`/`.pdf`), almacenamiento privado fuera de directorios públicos, escritura exclusiva `wx`, cálculo/verificación `SHA-256` y auditoría `DOCUMENT_CREATED`.
- `LegalDraftExport.storageDocumentId` apunta al `Document.id` de AUTH-08 vinculado al mismo `expedienteId` (y `clientId` opcional).
- La descarga (`GET /legal-drafts/:id/exports/:exportId/download`) delega a `DocumentsManagementService.prepareDownload(...)`, verificando `SHA-256` en disco y enviando `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` y `Cache-Control: private, no-store`.
- La exportación **no** crea un `MovimientoProcesal` automático (verificado en `TDS-DRF-005`).

---

## 10. PERMISOS Y RLS

### Permisos agregados en [`backend/src/authz/permissions.ts`](backend/src/authz/permissions.ts)
- `legal_drafts:read`, `legal_drafts:write`, `legal_drafts:export`: `ASSISTANT`, `LAWYER`, `ORG_ADMIN`, `ORG_OWNER` (`STAFF`: denegado).
- `legal_drafts:review`, `legal_drafts:approve`, `legal_templates:manage`: `LAWYER`, `ORG_ADMIN`, `ORG_OWNER` (`STAFF` y `ASSISTANT`: denegados).

### RLS PostgreSQL 18 (`abogados_app_user`, `rolbypassrls = f`)
- `ENABLE + FORCE ROW LEVEL SECURITY` y 4 políticas por tabla en `LegalWriting`, `LegalDraftVersion`, `LegalDraftTemplate`, `LegalDraftReview` y `LegalDraftExport`.
- `LegalDraftTemplate` exige contexto `app.current_organization_id` no vacío incluso para `SELECT` (fail-closed), permite leer plantillas propias + de sistema, y bloquea `INSERT`/`UPDATE`/`DELETE` sobre plantillas ajenas o de sistema.
- Grants mínimos: `LegalDraftVersion` y `LegalDraftExport` son append-only (`SELECT, INSERT`); `LegalWriting`, `LegalDraftTemplate` y `LegalDraftReview` no tienen `DELETE` físico (`SELECT, INSERT, UPDATE`).

---

## 11. EVIDENCIA TDS (RED → GREEN)

Suite real [`backend/test/integration/auth09-legal-drafting.spec.ts`](backend/test/integration/auth09-legal-drafting.spec.ts) ejecutada sobre PostgreSQL 18 real (`abogados_test`, `abogados_app_user` `NOBYPASSRLS`) + disco privado temporal:
- **Fase RED (previa a controladores y servicios):** `13 failed, 1 passed, 14 total` (los 13 endpoints devolviendo `404` y únicamente `TDS-DRF-RLS-001` pasando por el fail-closed de PostgreSQL).
- **Fase GREEN final:** **`15 passed, 15 total`** (100% VERDE):
  - Funcionales (`TDS-DRF-001` a `TDS-DRF-006`): `6/6 PASS`.
  - Seguridad (`TDS-DRF-SEC-001` a `TDS-DRF-SEC-003`): `3/3 PASS`.
  - Concurrencia e integridad (`TDS-DRF-CONC-001` a `TDS-DRF-CONC-004`): `4/4 PASS`.
  - RLS real PostgreSQL (`TDS-DRF-RLS-001` a `TDS-DRF-RLS-002`): `2/2 PASS`.

---

## 12. RESULTADOS DE CONCURRENCIA E INTEGRIDAD

- `TDS-DRF-CONC-001`: 2 llamadas concurrentes a `POST /legal-drafts/:id/versions` se serializan por `FOR UPDATE` generando `v2` y `v3` sin error 500 ni colisión de unicidad.
- `TDS-DRF-CONC-002`: 2 aprobaciones concurrentes por dos revisores válidos: exactamente 1 triunfa (`200`) y la segunda recibe conflicto controlado (`409`).
- `TDS-DRF-CONC-003`: 2 exportaciones concurrentes + 1 reintento posterior con igual `idempotencyKey` retornan el mismo `exportId` y `storageDocumentId`, creando **exactamente 1 documento AUTH-08** (cero duplicaciones).
- `TDS-DRF-CONC-004`: fallo simulado en almacenamiento AUTH-08 revierte limpiamente sin crear `LegalDraftExport` huérfano ni dejar archivos en `.tmp`.

---

## 13. REGRESIÓN COMPLETA

- **Backend Jest (`npx jest --runInBand --forceExit` sobre `abogados_test`):**
  - **Test Suites: `20 passed, 20 total`**
  - **Tests: `260 passed, 260 total`** (0 fallos, 0 saltados, 29.08s)
  - Cubre AUTH-01, AUTH-02, AUTH-03, AUTH-04 (RLS, reconciliación, contención), AUTH-05 (Clientes), AUTH-06 (Expedientes), AUTH-07 (Movimientos/Agenda/Vencimientos), AUTH-08 (Documentos), AUTH-09 (Escritos y Redacción) y LegalPixel.
- **Frontend tests (`node --experimental-strip-types --test tests/legal-pixel.test.ts`):** **`8/8 PASS`**.

---

## 14. BUILDS Y LINT

- **Backend:**
  - `npx eslint` sobre todos los archivos AUTH-09: **0 errores**.
  - `npx tsc --noEmit`: **0 errores**.
  - `npm run build` (`nest build`): **OK**.
- **Frontend:**
  - `npm run build` (`tsc -b && vite build`): **OK** (`3196 modules transformed`, 0 errores).
  - `npx eslint` sobre todos los archivos frontend AUTH-09: **0 errores**.
- **Almacenamiento privado:** `backend/.private-storage/documents` y `.tmp` verificados limpios (0 archivos huérfanos).

---

## 15. ARCHIVOS CREADOS Y MODIFICADOS

### Creados
- `AUTH09-READONLY-DIAGNOSTIC-001.md`
- `AUTH09-LEGAL-DRAFTING-IMPLEMENTATION-001-REPORT.md`
- `backend/prisma/migrations/20261124120000_auth09_legal_drafting/migration.sql`
- `backend/src/legal-drafts/content-ast.util.ts`
- `backend/src/legal-drafts/export-generator.service.ts`
- `backend/src/legal-drafts/dto/legal-template.dto.ts`
- `backend/src/legal-drafts/dto/legal-draft.dto.ts`
- `backend/src/legal-drafts/legal-templates.service.ts`
- `backend/src/legal-drafts/legal-templates.controller.ts`
- `backend/src/legal-drafts/legal-drafts.service.ts`
- `backend/src/legal-drafts/legal-drafts.controller.ts`
- `backend/src/legal-drafts/legal-drafts.module.ts`
- `backend/test/integration/auth09-legal-drafting.spec.ts`
- `frontend/src/modules/legal-drafts/types.ts`
- `frontend/src/modules/legal-drafts/components/LegalRichEditor.tsx`
- `frontend/src/modules/legal-drafts/pages/LegalDraftsListPage.tsx`
- `frontend/src/modules/legal-drafts/pages/LegalDraftWorkspacePage.tsx`
- `frontend/src/modules/legal-drafts/pages/LegalTemplatesPage.tsx`
- `frontend/src/modules/expedientes/components/ExpedienteDraftsSection.tsx`

### Modificados
- `backend/package.json` y `backend/package-lock.json`
- `backend/prisma/schema.prisma`
- `backend/prisma/scripts/provision-rls-roles.sql`
- `backend/src/authz/permissions.ts`
- `backend/src/app.module.ts`
- `frontend/package.json` y `frontend/package-lock.json`
- `frontend/src/core/api/client.ts`
- `frontend/src/components/layout/MainLayout.tsx`
- `frontend/src/App.tsx`
- `frontend/src/modules/expedientes/pages/CaseDetail.tsx`

---

## 16. DEPENDENCIAS NUEVAS Y LICENCIAS

| Paquete | Capa | Versión | Licencia | Propósito |
| :--- | :--- | :--- | :---: | :--- |
| `docx` | Backend | `^9.16.0` | MIT | Generación OOXML `.docx` local sin servicios externos |
| `pdfkit` | Backend | `^0.15.2` | MIT | Generación `.pdf` directa CJS-compatible desde el AST |
| `@types/pdfkit` | Backend | `^0.17.7` | MIT | Tipado TypeScript para `pdfkit` |
| `@tiptap/react` | Frontend | `^3.35.0` | MIT | Editor ProseMirror para React 19 |
| `@tiptap/pm` | Frontend | `^3.35.0` | MIT | Core ProseMirror de TipTap |
| `@tiptap/starter-kit` | Frontend | `^3.35.0` | MIT | Nodos/marcas estándar (párrafos, títulos, listas, undo/redo, HR) |
| `@tiptap/extension-underline` | Frontend | `^3.35.0` | MIT | Soporte de subrayado |
| `@tiptap/extension-text-align` | Frontend | `^3.35.0` | MIT | Alineación izquierda/centro/derecha/justificado |

*(Nota: se fijó `pdfkit@0.15.2` porque `pdfkit@0.21.0` depende de `fontkit@3` puro ESM incompatible con el cargador CommonJS de Jest del repositorio).*

---

## 17. VARIABLES DE ENTORNO

No se introdujeron variables de entorno ni secretos nuevos. Reutiliza `DATABASE_URL` (`abogados_app_user`) y `DOCUMENT_STORAGE_ROOT` (`./.private-storage/documents`) ya configurados en AUTH-08.

---

## 18. SEPARACIÓN EXPLÍCITA: IMPLEMENTADO Y PROBADO VS PENDIENTE / LIMITACIONES

### Implementado y Probado (Automatizado Real)
- Modelos Prisma, migración y RLS real en `abogados_test` y `abogados_db` (28 tablas, 112 políticas).
- Sanitización AST anti-XSS/scripts/iframes, versionado inmutable, plantillas (sistema + estudio + duplicación + copia independiente), flujo completo de revisión con segregación de funciones, exportación DOCX y PDF real + `SHA-256` + integración AUTH-08 sin duplicaciones ni `MovimientoProcesal` automático, concurrencia, RBAC y RLS (`15/15 PASS`, regresión `20/20 suites, 260/260 tests PASS`).
- Compilación de producción y ESLint del frontend (`LegalRichEditor`, `/escritos`, `/escritos/:id`, `/plantillas`, `ExpedienteDraftsSection`).

### Implementado sin Prueba E2E de Navegador (Verificación Visual Manual Recomendada)
- Interacción visual en navegador real con TipTap en `/escritos/:id`, `/plantillas` y `/expedientes/:id` (el build de TypeScript/Vite y ESLint pasaron con 0 errores, pero no se ejecutó una suite Playwright de UI en navegador para AUTH-09).

### Pendiente / Fuera de Alcance (Según Restricciones del Expediente)
- Firma digital/electrónica, presentación automática en portales judiciales, asistencia de IA generativa sobre este flujo, conversión fiel DOCX→PDF vía LibreOffice y diff enriquecido a nivel de palabras (actualmente se ofrece comparación lado a lado en texto plano).

---

## 19. ESTADO GIT INICIAL Y FINAL

- **`git rev-parse HEAD` inicial y final:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` (rama `master`).
- **`git diff --check` en archivos AUTH-09 y Addendum:** 0 errores.
- **Árbol de trabajo:** cambios acumulados de AUTH-01 a AUTH-09 (+ Addendum IA Legal) preservados íntegramente, sin secretos ni archivos temporales.

---

## 20. CONFIRMACIÓN EXPRESA DE AUSENCIA DE COMMITS Y PUSHES

Se confirma expresamente que **no se ejecutó ningún `git commit` ni `git push`** durante todo el expediente `AUTH09-LEGAL-DRAFTING-IMPLEMENTATION-001` ni durante su Addendum de IA Legal.

---

# ADDENDUM AUTH-09 — GENERADOR DE ESCRITOS CON ASISTENTE IA, PLANTILLAS Y SIDEBAR IA LEGAL

## A1. CATÁLOGO DOCUMENTAL (16 TIPOS — 10 JUDICIALES + 6 CONTRATOS)

Implementado y expuesto en `GET /legal-drafts/catalog` ([`legal-draft-catalog.ts`](backend/src/legal-drafts/legal-draft-catalog.ts)) y enum aditivo `LegalDraftCategory` (`ESCRITO_JUDICIAL`, `CONTRATO`) + `LegalDraftDocumentType` ([migración `20261124160000_auth09_addendum_ai_drafting`](backend/prisma/migrations/20261124160000_auth09_addendum_ai_drafting/migration.sql), aplicada a **`abogados_test` y `abogados_db`**):
- **Escritos judiciales (10):** `DEMANDA`, `CONTESTACION_DEMANDA`, `EXCEPCION`, `APERTURA_PRUEBA`, `ALEGATO`, `APELACION`, `CONTESTACION_TRASLADO`, `PRONTO_DESPACHO`, `MEDIDA_CAUTELAR`, `ESCRITO_LIBRE` (además de mantener retrocompatibilidad con `RECURSO`, `EXPRESION_AGRAVIOS`, `CONTESTACION_AGRAVIOS`, `SOLICITUD`, `OFICIO`, `PRESENTACION_SIMPLE`, `INCIDENTE`, `OTRO`).
- **Contratos (6):** `CONTRATO_LOCACION`, `CONTRATO_SERVICIOS`, `CONTRATO_NDA`, `CONTRATO_COMPRAVENTA`, `CONTRATO_MUTUO`, `OTRO_CONTRATO`.
- `LegalWriting.expedienteId` se evolucionó a opcional (`DROP NOT NULL`) manteniendo `organizationId NOT NULL` y RLS estricto, permitiendo redactar contratos y escritos sin causa asociada.

## A2. FLUJO VISUAL DE CINCO PASOS

Implementado en [`LegalDraftGeneratorPage.tsx`](frontend/src/modules/legal-drafts/pages/LegalDraftGeneratorPage.tsx) (`/ia-legal/generador-escritos`) + Paso 5 integrado en [`LegalDraftWorkspacePage.tsx`](frontend/src/modules/legal-drafts/pages/LegalDraftWorkspacePage.tsx) (`/escritos/:id`):
1. **Paso 1 — Tipo de escrito (`¿Qué documento querés generar?`):** selector de categorías (*Escritos judiciales* / *Contratos*) y tipos con sus instrucciones base.
2. **Paso 2 — Causa (`¿Para qué causa?`):** búsqueda por carátula, n° expediente, fuero y tribunal; sección *"Últimas que abriste"* desde `GET /legal-drafts/recent-cases` (conteo real de movimientos no anulados, sin datos ficticios); mensaje exacto *"Todavía no hay causas con movimientos: buscá una por carátula o número, o seguí sin causa."* cuando aplica; opción explícita de continuar sin causa.
3. **Paso 3 — Plantilla (`Elegí una plantilla`):** listado filtrado por `documentType`, versión `vN`, fecha de actualización, autor, jurisdicción/fuero, vista previa, modelos orientativos de sistema vs plantillas del estudio, acceso a crear plantilla y opción de continuar sin plantilla.
4. **Paso 4 — Instrucciones (`¿Qué necesitás que redacte?`):** instrucciones del profesional con ejemplos orientativos, selector de documentos autorizados AUTH-08, estado real del proveedor IA (con fallback manual directo si no hay API key) y resumen completo previo a confirmar.
5. **Paso 5 — Escrito (`Documento generado`):** espacio de trabajo editable con insignia **"Borrador asistido por IA"**, panel de **"Información pendiente de confirmar"** (`missingData` / `[DATO PENDIENTE DE CONFIRMAR]`), 6 acciones de asistencia IA (*Regenerar*, *Mejorar redacción*, *Ampliar fundamentos*, *Resumir*, *Corregir estructura*, *Consultar info faltante*) con **aceptación explícita de propuestas** (nunca sobrescribe silenciosamente versiones guardadas), guardado de versiones inmutables, revisión y exportación DOCX/PDF.

## A3. SUBSISTEMA DE PLANTILLAS ENRIQUECIDO (§5)

- `LegalDraftTemplate` extendido con `category`, `versionNumber` (auto-incrementado en cada `PATCH`), `baseInstructions`, `variables` (`{{caratula}}`, `{{numero_expediente}}`, `{{tribunal}}`, `{{actor}}`, `{{demandado}}`, etc.), `requiredInfo`, `jurisdiction` y `fuero`.
- 4 plantillas orientativas de sistema sembradas (Demanda, Contestación de Traslado, Contrato de Locación, Acuerdo NDA), claramente identificadas como editables/orientativas y protegidas contra modificación directa (`403 Forbidden`).
- Resolución determinista `resolveTemplateVariablesInAst()`: completa únicamente variables con datos verificados del expediente y marca toda variable no resuelta como `[DATO PENDIENTE DE CONFIRMAR: <variable>]`.

## A4. ARQUITECTURA IA, PROVEEDOR, CONFIGURACIÓN Y TRATAMIENTO DE DATOS

- **Abstracción:** token `LEGAL_AI_PROVIDER` + [`OpenAiLegalDraftingProvider`](backend/src/legal-drafts/legal-ai.provider.ts) + [`LegalDraftAiService`](backend/src/legal-drafts/legal-draft-ai.service.ts).
- **Configuración (`backend/.env.example`):**
  - `OPENAI_API_KEY` (reutiliza variable ya existente; si falta o es placeholder, `GET /legal-drafts/ai/status` informa `available: false` y `POST /legal-drafts/ai/generate` devuelve `503`, permaneciendo 100% operativo el editor manual).
  - `LEGAL_AI_MODEL` (por defecto `gpt-4o-mini`), `LEGAL_AI_TIMEOUT_MS` (por defecto `45000`), `LEGAL_AI_MAX_CONTEXT_CHARS` (por defecto `24000`).
- **Qué información sale del entorno local cuando `OPENAI_API_KEY` está configurada:**
  - Destino: OpenAI Chat Completions API (`https://api.openai.com/v1/chat/completions`), invocada exclusivamente desde backend con `AbortController` y `response_format: json_object`.
  - Datos enviados (acotados a `LEGAL_AI_MAX_CONTEXT_CHARS`): tipo documental, instrucciones del profesional, metadatos estructurados del expediente seleccionado (carátula, número, juzgado, jurisdicción, fuero, partes, últimos 25 movimientos activos no anulados, nota interna acotada), configuración de plantilla seleccionada y **solo metadatos/títulos** de documentos AUTH-08 autorizados (nunca se envían binarios completos innecesariamente ni datos de otras causas/organizaciones).
  - No se activa entrenamiento del proveedor ni se asumen garantías contractuales no verificadas; el cliente/estudio debe validar sus términos de procesamiento de datos antes de habilitar `OPENAI_API_KEY` en producción.
- **Seguridad y privacidad:**
  - Permisos requeridos: `legal_drafts:write` + `ai:use` (`LAWYER`, `ORG_ADMIN`, `ORG_OWNER`; `STAFF` y `ASSISTANT` bloqueados con `403`).
  - Todas las respuestas del modelo pasan por `validateAndSanitizeLegalContent()` (bloqueando scripts/iframes/XSS con `502`).
  - Sin efectos colaterales sobre expedientes ni movimientos procesales; los logs técnicos solo registran `correlationId`, `orgId`, `type` y `promptHash` (nunca API keys ni texto jurídico sensible); auditoría atómica en `AuditLog` (`LEGAL_DRAFT_AI_GENERATED`, `LEGAL_DRAFT_AI_ASSISTED`).

## A5. SIDEBAR — IA LEGAL (§7)

Actualizado en [`MainLayout.tsx`](frontend/src/components/layout/MainLayout.tsx) y [`App.tsx`](frontend/src/App.tsx) con la sección principal **IA Legal**:
1. **Generador de Escritos** (`/ia-legal/generador-escritos`): **Funcional** (asistente de 5 pasos).
2. **Asistente IA** (`/ia-legal/asistente`): **Pendiente de implementación** ([`IaLegalPendingModulePage.tsx`](frontend/src/modules/ia-legal/pages/IaLegalPendingModulePage.tsx)).
3. **Análisis IA** (`/ia-legal/analisis`): **Pendiente de implementación**.
4. **Jurisprudencia IA** (`/ia-legal/jurisprudencia`): **Pendiente de implementación**.
5. **Asistentes externos** (`/ia-legal/asistentes-externos`): **Pendiente de implementación** (sin integraciones ni enlaces externos ficticios).

## A6. EVIDENCIA TDS DE IA (RED → GREEN) Y REGRESIÓN TOTAL ACTUALIZADA

- **Suite TDS IA:** [`backend/test/integration/auth09-ai-drafting.spec.ts`](backend/test/integration/auth09-ai-drafting.spec.ts) (ejecutada contra PostgreSQL 18 real + AUTH-08 real + doble controlado de `LEGAL_AI_PROVIDER`):
  - **Fase RED:** `6 failed, 6 total`.
  - **Fase GREEN:** **`7 passed, 7 total`** (`TDS-AI-001` a `TDS-AI-007`: catálogo 16 tipos, contexto real partes/movimientos/notas/docs AUTH-08, exclusión de movimientos anulados y Org B, variables resueltas/pendientes, RBAC `403`, IDOR `404`, regeneración sin sobrescritura, timeout `504`, fallo upstream `502`, respuesta XSS `502`, proveedor no configurado `503` + fallback manual sin causa, no filtración en logs y ausencia de API keys en `frontend/src`).
- **Regresión completa backend (`npx jest --runInBand --forceExit`):** **`21 passed, 21 total` | `267 passed, 267 total`** (0 fallos, 34.09s).
- **Frontend:** `npm run build` (`tsc -b && vite build`: `3198 modules transformed`, 0 errores), `eslint` (0 errores), LegalPixel TDS (`8/8 PASS`).
- **Limitación real documentada:** las pruebas automatizadas validan la integración IA mediante doble controlado de `LEGAL_AI_PROVIDER` (no se consumió cuota paga de OpenAI durante los tests); la prueba con un modelo OpenAI vivo requiere configurar una `OPENAI_API_KEY` válida en `backend/.env`.


