# LEGAL-AI-NORMATIVE-SPEC-001
## ESPECIFICACIÓN FUNCIONAL Y TÉCNICA — BIBLIOTECA NORMATIVA Y NORMATIVA CON IA

| Campo | Valor |
| :--- | :--- |
| **Expediente origen** | `LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001` |
| **Expediente de reconciliación** | `LEGAL-P0-START-001` *(Fase P0-A)* |
| **Expediente de enmienda** | `LEGAL-P0-DOCUMENTARY-AMENDMENT-001` *(Micro-enmienda `v1.2.1`)* |
| **Versión** | `v1.2.1` |
| **Estado** | `DOCUMENTACIÓN ENMENDADA v1.2.1 — PENDIENTE DE APROBACIÓN FORMAL DEL PROPIETARIO` |
| **Aprobación del propietario** | `PENDIENTE` |
| **Fecha** | `2026-11-25` |
| **Autorización de implementación** | `NO AUTORIZADA` |
| **Documentos relacionados (`v1.2.1`)** | [LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001.md](./LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001.md) · [LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md](./LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md) · [LEGAL-AI-CREDITS-SPEC-001.md](./LEGAL-AI-CREDITS-SPEC-001.md) *(`v1.2.0`, sin cambios)* · [LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md](./LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md) · [LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md](./LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md) *(`v1.0.1`)* |

### Historial de versiones
| Versión | Fecha | Expediente | Resumen de cambios |
| :--- | :--- | :--- | :--- |
| `v1.0.0` | `2026-11-25` | `LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001` | Auditoría READ-ONLY de `LegalNorm` y especificación inicial de Normativa con IA. |
| `v1.1.0` | `2026-11-25` | `LEGAL-AI-DOCUMENT-RECONCILIATION-001` | Refuerzo de trazabilidad temporal (9 hitos), separación estricta en 4 planos, regla de que sincronización reciente con InfoLEG no acredita vigencia por sí sola y desacoplamiento de Fase F3 respecto de SCBA/JUBA. |
| `v1.2.0` | `2026-11-25` | `LEGAL-P0-START-001` *(P0-A)* | Reconciliación P0-A: alcance multi-jurisdiccional (`AR-NACION`, `AR-CABA`, `AR-PBA` y demás provincias sin mezclar jurisdicciones), incorporación de **Normativa CABA** (BOCABA API REST + Digesto/CEDOM) en primer bloque `P0-E`, incorporación de `JurisprudenceNormCitation`, registro de validación real de `datos.jus.gob.ar` (InfoLEG CC-BY-4.0) y `servicios.infoleg.gob.ar` (HTTP 403 ante UA automatizado), y preservación de cuarentena obligatoria de `backend/scripts/ingest-legal-norms.ts`. |
| `v1.2.1` | `2026-11-25` | `LEGAL-P0-DOCUMENTARY-AMENDMENT-001` | Resolución de `P0-FBA-002`, `P0-FBA-004` y `P0-FBA-006`: ampliación y precisión de `NormativeTextVersion.variant` a 3 valores (`ORIGINAL`, `UPDATED`, `CONSOLIDATED`) con prohibición de etiquetar como `CONSOLIDATED` formal un texto meramente actualizado por el sistema; traslado de la deshabilitación técnica y cuarentena fail-closed de `backend/scripts/ingest-legal-norms.ts` al **primer paso técnico de `P0-B`** (manteniendo el retiro definitivo de `LegalNorm` en `P0-E`); adición del pre-gate de inspección técnica y jurídica del `ZIP` oficial de InfoLEG previo a `P0-E`. |

---

## 1. Propósito

Especificar la **Biblioteca Normativa propia de Abogados-Law** (`P0-E`, lectura gratuita `0` créditos) y el servicio premium **Normativa con IA** (Fase F3) para responder consultas en lenguaje natural sobre legislación argentina verificada —iniciando por **legislación nacional (`AR-NACION`) y normativa autónoma de CABA (`AR-CABA`)** con arquitectura extensible a **`AR-PBA` y todas las jurisdicciones provinciales** sin mezclar jurisdicciones—, apoyado exclusivamente en fuentes oficiales verificadas y nunca en texto reconstruido de memoria por el modelo de IA.

**Independencia de habilitación:**
- La Biblioteca Normativa gratuita (`P0-E`) depende únicamente de `P0-B` (patrón de ingesta controlada y modelo base) y **no está bloqueada por decisiones comerciales de créditos ni por fuentes jurisprudenciales**.
- Normativa con IA (Fase F3) depende únicamente de `P0-E` y Fase F1 (motor de créditos y servicios comunes); **no requiere** que SCBA/JUBA (`P0-G`) ni Jurisprudencia con IA (Fase F2) estén implementados.

---

## 2. Auditoría del estado real de la base normativa y cuarentena obligatoria

### 2.1. Hechos comprobados en código y PostgreSQL 18 (`abogados_db`)
1. **`LegalNorm` vacía:** `0` registros en `abogados_db`, sin columna `embedding`, sin `pgvector` y sin índices GIN/FTS.
2. **Endpoints rotos en PG18 real:** `GET /legal/search` y `GET /legal/stats` en [legal-search.service.ts](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/backend/src/ia/legal/legal-search.service.ts) fallan con `column "embedding" does not exist`.
3. **Endpoints mutantes bloqueados por diseño AUTH-04:** `POST /legal/ingest`, `/legal/ingest/batch` y `/legal/version/:normId` están bloqueados por `PlatformBlockedGuard`; `abogados_app_user` solo tiene `SELECT` sobre `LegalNorm`.
4. **Bug de versionado en `LegalIngestionService.createNewVersion`:** `ingestNorm()` hardcodea `versionNorma: 1` ignorando el incremento `original.versionNorma + 1`.
5. **Enum jurisdiccional insuficiente:** `LegalNormJurisdiccion` solo admite 5 valores (`NACION, CABA, PBA, CBA, SFE`), excluyendo 20 provincias argentinas.

### 2.2. Cuarentena obligatoria de `backend/scripts/ingest-legal-norms.ts` (`P0-FBA-004`)
> [!CAUTION]
> **PRIMER PASO TÉCNICO OBLIGATORIO DE `P0-B`:** El script [backend/scripts/ingest-legal-norms.ts](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/backend/scripts/ingest-legal-norms.ts) contiene 5 registros con errores jurídicos graves o texto fabricado (Art. 1109 del Código Civil derogado atribuido a Ley 26.994; Art. 245 LCT con texto de vacaciones Art. 150 y jurisdicción `CABA`; Arts. 356 CPCCN y 192 CPCC PBA fabricados). Su **deshabilitación técnica y cuarentena fail-closed** debe ejecutarse como el **primer paso técnico de `P0-B`** (no diferido a `P0-E`), bajo estas **6 condiciones obligatorias**:
> 1. El script no puede ejecutarse accidentalmente.
> 2. No se permite cargar ninguno de los 5 registros incorrectos detectados.
> 3. No se permite corregir esos registros para incorporarlos al corpus.
> 4. No se permite reutilizar esos datos como fixtures jurídicos válidos.
> 5. Debe quedar documentada la evidencia de su cuarentena.
> 6. La retirada definitiva del modelo `LegalNorm`, sus migraciones o su esquema puede continuar en `P0-E`, según el roadmap.

---

## 3. Trazabilidad temporal y separación estricta en 4 planos

### 3.1. Los 9 hitos de trazabilidad temporal obligatorios
El modelo normativo debe registrar de manera estructurada y auditable:
1. **Fecha de sanción** (`sanctionDate`).
2. **Fecha de publicación** en Boletín Oficial (`publicationDate`).
3. **Fecha de entrada en vigencia** (`effectiveDate`).
4. **Fecha y norma de modificación** (`modifiedByNormId`, `modificationDate`).
5. **Fecha y norma de derogación** (`derogatedByNormId`, `derogationDate`).
6. **Fecha, norma o medida de suspensión** (`suspendedByReference`, `suspensionDate` — incluyendo suspensiones legislativas o cautelares verificadas).
7. **Artículos afectados** (`affectedArticles` — detalle explícito por artículo/inciso).
8. **Fuente de respaldo** (`backingSourceRef` + URL oficial InfoLEG / BORA / BOCABA / Digesto).
9. **Fecha de verificación** (`verifiedAt` — distinta de `lastSyncedAt`).

### 3.2. Separación expresa en 4 planos y variantes textuales (`NormativeTextVersion.variant`) (`P0-FBA-002`)
| Plano | Definición | Regla de veracidad |
| :--- | :--- | :--- |
| **1. Texto original (`ORIGINAL`)** | Texto publicado originalmente por la fuente oficial | Preservado intacto como versión histórica inmutable (`variant = ORIGINAL`) |
| **2. Texto actualizado (`UPDATED`) vs. Texto consolidado formal (`CONSOLIDATED`)** | **`UPDATED`**: texto con modificaciones incorporadas para reflejar cambios normativos, conservando identificación de versión y trazabilidad. **`CONSOLIDATED`**: texto ordenado o consolidado formalmente por la autoridad competente, cuando exista una fuente oficial que respalde esa condición (ej. Digesto Jurídico CABA o textos ordenados nacionales). | **Regla obligatoria:** **Nunca etiquetar como `CONSOLIDATED` formal un texto meramente actualizado por el sistema.** Toda actualización conserva versión y referencia a las normas modificatorias. |
| **3. Vigencia normativa registrada** | Estado formal capturado en el registro de origen (vigente, modificada, derogada, suspendida) | Refleja únicamente lo registrado en la fuente consultada |
| **4. Situación jurídica y aplicabilidad verificadas** | Evaluación verificable de vigencia y aplicabilidad real al caso | **Solo se marca verificada si existe respaldo comprobado; ante cualquier duda, registrar `UNKNOWN_UNVERIFIED`** |

> **Principio normativo explícito:** *una fecha reciente de sincronización (`lastSyncedAt`) NO acredita por sí sola vigencia ni aplicabilidad jurídica.* Nunca se presentará como plenamente vigente una disposición cuya situación no pueda verificarse; debe registrarse y mostrarse **`UNKNOWN_UNVERIFIED`** por defecto.

---

## 4. Arquitectura de la biblioteca normativa (Nación, CABA y expansión provincial)

### 4.1. Fuentes oficiales y resultados de validación P0-A
*(Detalle completo de evidencia HTTP, licencias y restricciones en [LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md](./LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md).)*
- **Legislación Nacional (`AR-NACION`) — Fuente primaria recomendada: InfoLEG:**
  - **Dataset abierto verificado (`datos.jus.gob.ar` → `base-de-datos-legislativos-infoleg`):** verificado `HTTP 200 JSON` el `2026-11-25`, licencia explícita **`CC-BY-4.0`**, 7 recursos (`CSV`/`ZIP`), última actualización `11/02/2026`. Preferente frente a scraping HTML.
  - **Portal web `servicios.infoleg.gob.ar` y Pre-gate obligatorio previo a `P0-E` (`P0-FBA-006`):** `servicios.infoleg.gob.ar` devolvió `HTTP 403` ante User-Agent automatizado en `P0-A`. Antes de iniciar la ingesta de `P0-E`, es obligatorio ejecutar un **pre-gate de inspección técnica y jurídica del paquete `ZIP` oficial de InfoLEG (`datos.jus.gob.ar`)** verificando estructura, contenido textual, integridad, metadatos, frecuencia de actualización y condiciones de reutilización (sin evadir controles perimetrales web).
  - **SAIJ (`datos.jus.gob.ar` → `base-saij-de-normativa-provincial` y `tesauro-saij-de-derecho-argentino`):** licencia `CC-BY-4.0`, fuente complementaria para tesauro y expansión normativa provincial (nunca asumir identidad automática con InfoLEG).
- **Legislación Autónoma CABA (`AR-CABA`) — Fuentes primarias primer bloque `P0-E`:**
  - **BOCABA API REST (`https://api-restboletinoficial.buenosaires.gob.ar`):** verificado `HTTP 200 JSON` en HTTPS el `2026-11-25` (boletín del día N° 7501), `robots.txt` sin restricciones.
  - **Digesto Jurídico CABA (`digesto.buenosaires.gob.ar`) + CEDOM (`cedom.gob.ar`):** verificados `HTTP 200` para textos ordenados/consolidados y archivo legislativo, manteniendo separación entre norma publicada en BOCABA y consolidación periódica del Digesto.
- **Expansión provincial futura (`AR-PBA` y demás provincias):** soportada sobre el mismo modelo mediante `jurisdictionCode` estándar, sin mezclar normas nacionales con locales ni provinciales.
- **Regla operativa invariante:** **nunca** descargar legislación en tiempo real durante la pregunta de un usuario; toda ingesta ocurre en sincronización controlada vía worker `abogados_catalog_ingestor`.

### 4.2. Modelo de dominio propuesto (Estado: PROPUESTO — NO EXISTENTE)
- **`NormativeDocument`:** `jurisdictionCode` (`AR-NACION`, `AR-CABA`, `AR-PBA`, ..., 24 jurisdicciones), `issuingBody`, `tipoNorma`, `numero`, `anio`, `tituloOficial`, `aliasComunes[]`, `sourceProvider` (`INFOLEG` | `BOCABA` | `DIGESTO_CABA` | `CEDOM` | `SAIJ_PROV`), `externalSourceId`, `canonicalSourceUrl`, `sanctionDate`, `publicationDate`, `effectiveDate`, `registeredValidityStatus`, `verifiedApplicabilityStatus` (default **`UNKNOWN_UNVERIFIED`**), `lastSyncedAt`, `verifiedAt`, `contentSha256`, `rawFileSha256`, `quarantineStatus`.
- **`NormativeTextVersion`:** `normId`, `variant` (`ORIGINAL` | `UPDATED` | `CONSOLIDATED` — donde `ORIGINAL` = texto publicado originalmente por la fuente oficial; `UPDATED` = texto con modificaciones incorporadas conservando identificación de versión y trazabilidad; `CONSOLIDATED` = texto ordenado o consolidado formalmente por la autoridad competente con respaldo de fuente oficial; **nunca etiquetar como `CONSOLIDATED` formal un texto meramente actualizado por el sistema**), `versionNumber`, `effectiveFrom`, `effectiveTo`, `normalizedText`, `contentSha256`, `rawStorageKey`, `capturedAt`, `sourceUrl`.
- **`NormativeArticle` y `NormativeArticleVersion`:** `articulo`, `bisTer`, `inciso`, `tituloCapitulo`, `orden`, texto literal original y actualizado, `validityStatus`, `tsvector` español (`unaccent`) + índice GIN para búsqueda textual nativa PostgreSQL sin `pgvector`.
- **`NormativeRelation`:** `sourceNormId`, `targetNormId`, `relationType` (`MODIFICA`, `DEROGA`, `SUSTITUYE`, `INCORPORA`, `REGLAMENTA`, `COMPLEMENTA`, `PRORROGA`, `SUSPENDE`), `affectedArticles`, `effectiveDate`, `backingSourceRef`, `verifiedAt`.
- **`JurisprudenceNormCitation`:** tabla de enlace verificable entre `Jurisprudence` y `NormativeDocument` / `NormativeArticle` (normas citadas en fallos, con referencia de fragmento/considerando).

---

## 5. Capacidades funcionales de Normativa con IA (Fase F3)

Ejemplos cubiertos:
- *«¿Qué dice la Ley de Contrato de Trabajo sobre las causales de despido con justa causa?»*
- *«Necesito el texto de la Ley de Defensa del Consumidor sobre publicidad engañosa.»*
- *«¿Qué establece el Decreto 70/2023 o el Código Contencioso Administrativo y Tributario de CABA sobre medidas cautelares?»*

### Pipeline y estructura obligatoria de respuesta
1. **Resolución de jurisdicción, norma y artículos** (vía `LEGAL_AI_PROVIDER` + diccionario de alias y búsqueda textual PostgreSQL sobre `NormativeDocument` / `NormativeArticle`, sin mezclar `AR-NACION` con `AR-CABA`).
2. **Recuperación verificada** de texto `ORIGINAL`, `UPDATED` o `CONSOLIDATED` (según respaldo oficial real), hitos temporales y grafo `NormativeRelation`.
3. **Respuesta estructurada separada en 4 bloques visibles:**
   - **Texto legal literal verificado:** transcripción fiel indicando jurisdicción, variante exacta (`ORIGINAL`, `UPDATED` o `CONSOLIDATED` formal con respaldo oficial), número de norma, artículo y enlace oficial (jamás reconstruido de memoria ni resumido como texto legal, y jamás etiquetando como `CONSOLIDATED` formal un texto meramente actualizado por el sistema).
   - **Explicación generada por IA:** análisis en lenguaje claro y relación sistemática entre artículos.
   - **Reformas, derogaciones y reglamentaciones registradas:** solo las presentes en `NormativeRelation` con artículos afectados y fuente de respaldo.
   - **Vigencia, aplicabilidad y límites:** separación explícita entre fecha de sincronización, vigencia registrada y aplicabilidad verificada (`UNKNOWN_UNVERIFIED` cuando corresponda), advirtiendo vacíos de información.

---

## 6. Endpoints propuestos (Estado: PROPUESTO — NO EXISTENTE)

- **Biblioteca normativa (gratuitos, `0` créditos, permiso `knowledge:read`):**
  - `GET /normative/search` — Búsqueda textual PostgreSQL (`jurisdictionCode`, número, nombre, alias, artículo, palabras clave) y filtros estructurados.
  - `GET /normative/:normId` — Ficha normativa, los 4 planos de texto/vigencia y grafo de relaciones.
  - `GET /normative/:normId/articles/:articulo` — Texto literal e historial de versiones del artículo.
- **Normativa con IA (Fase F3, premium con créditos, permisos `ai:use` + `legal_ai_normative:read` / `legal_ai_normative:write`):**
  - `POST /legal-ai/normative/research` — Consulta en lenguaje natural con `idempotencyKey`, ciclo transaccional de créditos (Fase F1), recuperación verificada y persistencia de `LegalAiResearchRun` aislado por organización y usuario.
  - `GET /legal-ai/normative/research` y `GET /legal-ai/normative/research/:id` — Historial de consultas del profesional (`0` créditos).

---

## 7. Decisiones pendientes de aprobación

| ID | Decisión pendiente |
| :--- | :--- |
| **DEC-NORM-01** | Alcance del corpus inicial **Nacional (InfoLEG)** y **CABA (BOCABA/Digesto/CEDOM)** para `P0-E` (códigos y leyes núcleo de alta demanda vs. catálogo completo). |
| **DEC-NORM-02** | Frecuencia de sincronización incremental con InfoLEG y BOCABA/Digesto y política de alertas ante reformas de normas citadas. |
| **DEC-NORM-03** | Estrategia de migración/retiro definitivo del modelo legacy `LegalNorm`, sus migraciones o su esquema en `P0-E` *(distinta de la deshabilitación técnica y cuarentena fail-closed de `backend/scripts/ingest-legal-norms.ts`, que se ejecuta como **primer paso técnico de `P0-B`**)*. |
