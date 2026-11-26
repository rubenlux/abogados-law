# LEGAL-KNOWLEDGE-LIBRARIES-ADR-001
## DECISIÓN ARQUITECTÓNICA (ADR) — BIBLIOTECAS JURÍDICAS COMPARTIDAS, PERSISTENCIA Y FRONTERAS DE SEGURIDAD

| Campo | Valor |
| :--- | :--- |
| **Expediente origen** | `LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001` |
| **Expediente de reconciliación** | `LEGAL-P0-START-001` *(Fase P0-A)* |
| **Expediente de enmienda** | `LEGAL-P0-DOCUMENTARY-AMENDMENT-001` *(Micro-enmienda `v1.2.1`)* |
| **Versión** | `v1.2.1` |
| **Estado** | `DOCUMENTACIÓN ENMENDADA v1.2.1 — PENDIENTE DE APROBACIÓN FORMAL DEL PROPIETARIO` |
| **Aprobación del propietario** | `PENDIENTE` |
| **Fecha** | `2026-11-25` |
| **Autorización de implementación** | `NO AUTORIZADA` *(La decisión arquitectónica cerrada NO autoriza crear roles PostgreSQL, migraciones ni workers todavía)* |
| **Documentos relacionados (`v1.2.1`)** | [LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001.md](./LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001.md) · [LEGAL-AI-JURISPRUDENCE-SPEC-001.md](./LEGAL-AI-JURISPRUDENCE-SPEC-001.md) · [LEGAL-AI-NORMATIVE-SPEC-001.md](./LEGAL-AI-NORMATIVE-SPEC-001.md) · [LEGAL-AI-CREDITS-SPEC-001.md](./LEGAL-AI-CREDITS-SPEC-001.md) *(`v1.2.0`, sin cambios)* · [LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md](./LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md) · [SPEC-AUTH-004.md](./SPEC-AUTH-004.md) |

### Historial de versiones
| Versión | Fecha | Expediente | Resumen de cambios |
| :--- | :--- | :--- | :--- |
| `v1.0.0` | `2026-11-25` | `LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001` | ADR inicial de bibliotecas compartidas, canal de ingesta separado, persistencia acumulativa y motor FTS base. |
| `v1.1.0` | `2026-11-25` | `LEGAL-AI-DOCUMENT-RECONCILIATION-001` | Endurecimiento normativo de `abogados_catalog_ingestor`, prohibición de rutas HTTP públicas de escritura, 6 conceptos de integridad documental, regla `SHA-256 ≠ autoridad jurídica`, no contaminación de investigaciones privadas y taxonomía PTN/TFN. |
| `v1.2.0` | `2026-11-25` | `LEGAL-P0-START-001` *(P0-A)* | Reconciliación de `DEC-ADR-01` en 3 planos inequívocos (A. diseño arquitectónico cerrado; B. autorización ejecutiva pendiente `DEC-ADR-01-EXEC`; C. implementación física posterior en `P0-B`), incorporación de Core Jurídico Nacional + adaptadores (Bloque A+B prioritarios, Bloque C y Bloque H posteriores), inclusión explícita de `PROSECUTORIAL_OPINION` (PGN), separación de 6 capas documentales (original inmutable, texto normalizado, sumario oficial, sumario IA, embeddings opcionales, índice FTS) y prohibición de acceso directo MCP a PostgreSQL. |
| `v1.2.1` | `2026-11-25` | `LEGAL-P0-DOCUMENTARY-AMENDMENT-001` | Resolución de `P0-FBA-003` y alineación con `P0-FBA-001`, `P0-FBA-004` y `P0-FBA-005`: fijación del enum canónico `JurisprudenceContentKind` de 7 valores exactos idénticos a `LEGAL-AI-JURISPRUDENCE-SPEC-001.md`, registro de cuarentena técnica fail-closed de `ingest-legal-norms.ts` como primer paso técnico de `P0-B` y aclaración de almacenamiento local sin costo adicional bajo `DEC-ADR-02` / `DEC-P0-BUDGET-01`. |

---

## 1. Contexto y problema

Abogados-Law necesita construir dos **bibliotecas jurídicas acumulativas, verificables y reutilizables** de alcance nacional (iniciando por **Bloque A — Nación/Federal con asiento en CABA + PGN + TFN** y **Bloque B — CABA autónoma**, con expansión posterior a **Bloque C — PBA/SCBA** y **Bloque H — demás provincias**):
1. **Biblioteca Jurisprudencial Global** (evolución del Explorador existente sobre el Core Jurídico Nacional).
2. **Biblioteca Normativa Global** (evolución multi-jurisdiccional hacia `NormativeDocument` + versiones + artículos + relaciones + `JurisprudenceNormCitation`, alimentada inicialmente desde InfoLEG para `AR-NACION` y BOCABA/Digesto/CEDOM para `AR-CABA`).

Cuatro restricciones estructurales verificadas condicionan todo el diseño:
1. **Catálogos globales Categoría C (AUTH-04):** `Jurisprudence*` y `LegalNorm`/`Normative*` son catálogos compartidos sin `organizationId` ni RLS, y `abogados_app_user` posee **exclusivamente `SELECT`** sobre ellos.
2. **Prohibición de duplicar bibliotecas ni mezclar jurisdicciones:** una única biblioteca jurisprudencial global y una única normativa global, separando inequívocamente `AR-NACION`, `AR-FEDERAL`, `AR-CABA`, `AR-PBA` y cada provincia.
3. **Ausencia de `pgvector` en PostgreSQL 18.4 local:** el motor de búsqueda textual nativo PostgreSQL (`tsvector` español + `unaccent` + GIN) debe operar sin `pgvector` ni cuota de OpenAI.
4. **Falta de trazabilidad documental actual y cuarentena normativa:** hoy no existen originales inmutables, hashes activos ni versionado, y `backend/scripts/ingest-legal-norms.ts` contiene datos jurídicamente falsos (su deshabilitación técnica y cuarentena fail-closed es el **primer paso técnico obligatorio de `P0-B`**; el retiro definitivo del modelo `LegalNorm` legacy/migraciones continúa en `P0-E`).

---

## 2. Decisiones arquitectónicas (`v1.2.1`)

### ADR-01 — Bibliotecas globales compartidas únicas + aislamiento absoluto de investigaciones privadas
- **Decisión:**
  - Existe **una única biblioteca jurisprudencial global** y **una única biblioteca normativa global** (Categoría C, sin `organizationId`), sin duplicación por organización.
  - Todos los datos privados del estudio —**investigaciones (`LegalAiResearchRun`), planes, estrategias, notas privadas, favoritos, historial, vínculos con expedientes y ledger de créditos**— residen en tablas multi-tenant con **`organizationId NOT NULL` + `userId` + RLS `ENABLE + FORCE`**.
  - **Regla de no contaminación:** las investigaciones privadas **nunca** se incorporan automáticamente al catálogo global ni se exponen a otras organizaciones.
  - **Frontera con Asistentes Externos (MCP):** cualquier futuro conector MCP accede a bibliotecas o datos privados **exclusivamente a través de servicios de dominio**, con prohibición absoluta de acceso directo a Prisma o PostgreSQL.

### ADR-02 — Preservación estricta de AUTH-04 y canal controlado de ingesta (`abogados_catalog_ingestor`)
- **Decisión invariante:** **`abogados_app_user` permanece estrictamente `SELECT`-only sobre todas las tablas de catálogos globales Categoría C.** Nunca se alterarán sus privilegios para facilitar ni simplificar la ingesta.
- **Diseño arquitectónico cerrado del futuro rol `abogados_catalog_ingestor` (`DEC-ADR-01` — Parte A):**
  - Credenciales independientes segregadas del runtime HTTP de NestJS (`CATALOG_INGESTION_DATABASE_URL`).
  - Mínimo privilegio estricto: `SELECT, INSERT, UPDATE` **exclusivamente** sobre las tablas y secuencias de los catálogos globales jurisprudencial/normativo y auditoría de ingesta (`CatalogIngestionRun`, `CatalogIngestionAudit`).
  - **Prohibiciones absolutas:**
    - **PROHIBIDO `SUPERUSER`.**
    - **PROHIBIDO `BYPASSRLS`.**
    - **PROHIBIDO `CREATEROLE` y `CREATEDB`.**
    - **PROHIBIDO modificar esquema (DDL: `CREATE`, `ALTER`, `DROP`, `TRUNCATE`).**
    - **PROHIBIDO cualquier acceso** (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) a tablas privadas multi-tenant (clientes, expedientes, documentos AUTH-08, sesiones, credenciales, usuarios, créditos o investigaciones privadas).
- **Frontera de ejecución del worker:**
  - Las escrituras al catálogo se ejecutan **exclusivamente desde un worker interno autorizado**.
  - **Ninguna ruta HTTP pública** puede ejecutar escrituras directas sobre tablas de catálogo Categoría C ni acceder a credenciales de `abogados_catalog_ingestor`.
- **Controles obligatorios antes de persistir cualquier documento:**
  1. Allowlist estricta de dominios oficiales y protección **anti-SSRF**.
  2. Respeto estricto de `robots.txt` (restricción técnica de acceso) y de las condiciones jurídicas verificadas en los planos de licencia, condiciones de uso, Ley 11.723, Ley 25.326, restricciones contractuales y autorización institucional; prohibición absoluta de evadir CAPTCHA, autenticación o protecciones anti-bot.
  3. Validación de MIME, tope máximo de tamaño, sanitización de contenido y envío a **cuarentena** de documentos corruptos o sin metadatos mínimos.
  4. Deduplicación multi-clave, cálculo de `SHA-256` y auditoría en `CatalogIngestionAudit`.
- **Separación de planos de `DEC-ADR-01`:**
  - **A. Decisión arquitectónica:** **CERRADA** en este documento.
  - **B. Autorización ejecutiva (`DEC-ADR-01-EXEC`):** **PENDIENTE** — se requiere autorización explícita del propietario antes de crear el rol PostgreSQL y otorgar privilegios. **NO autorizada en `P0-A`.**
  - **C. Implementación física:** se ejecutará únicamente durante `P0-B` tras obtener autorización expresa, validada mediante pruebas TDS de privilegios (`TDS-P0-019`).

### ADR-03 — Integridad documental, procedencia, 6 capas separadas y versionado
La arquitectura distingue obligatoriamente **seis conceptos de identidad/integridad**:
1. **Identidad jurídica del documento** (`legalIdentityKey`: código de tribunal/norma + expediente/número + fecha).
2. **Identidad del registro en la fuente** (`(sourceProvider, externalSourceId)`).
3. **URL canónica oficial** (`canonicalSourceUrl`).
4. **Hash del contenido textual normalizado** (`contentSha256`).
5. **Hash del archivo binario/HTML original inmutable** (`rawFileSha256`).
6. **Versiones históricas inmutables** (`JurisprudenceVersion` / `NormativeTextVersion`).

Y separa físicamente **seis capas documentales** (sin sobrescribir originales jamás):
1. **Documento original** (PDF/HTML inmutable en storage privado — `KNOWLEDGE_STORAGE_ROOT` o S3 según `DEC-ADR-02`).
2. **Texto normalizado extraído** (con anclas de página/considerando/chunk).
3. **Sumario oficial** (redactado exclusivamente por el organismo emisor).
4. **Sumario generado por IA** (separado e identificado con modelo y fecha; nunca mezclado con el fallo ni con el sumario oficial).
5. **Embeddings** (tabla separada, estrictamente opcional y desacoplada).
6. **Índice de búsqueda textual** (`tsvector` español + `unaccent` + GIN).

> [!IMPORTANT]
> **Regla jurídica y criptográfica invariante:**
> **`SHA-256` acredita igualdad e integridad del contenido recuperado respecto de lo almacenado, NO autenticidad ni autoridad jurídica.**

- **Taxonomía de autoridad (`sourceAuthorityKind`):** distingue `SUPREME_COURT_JUDICIAL`, `APPELLATE_OR_TRIAL_JUDICIAL`, `PROSECUTORIAL_OPINION` (**PGN**), `ADMINISTRATIVE_OPINION` (**PTN**) y `ADMINISTRATIVE_TAX_COURT` (**TFN**).
- **Enum canónico `JurisprudenceContentKind` (7 valores exactos, idénticos a [LEGAL-AI-JURISPRUDENCE-SPEC-001.md](./LEGAL-AI-JURISPRUDENCE-SPEC-001.md)):**
  1. **`FULL_SENTENCE`** — Sentencia o resolución judicial íntegra completa verificada.
  2. **`PARTIAL_TEXT`** — Fragmento, extracto o sección parcial del texto del pronunciamiento (no sentencia íntegra).
  3. **`OFFICIAL_SUMMARY`** — Sumario oficial redactado por el organismo o secretaría de jurisprudencia (nunca presentado como texto íntegro).
  4. **`REVIEW`** — Reseña o síntesis editorial institucional de un pronunciamiento.
  5. **`METADATA_ONLY`** — Registro con únicamente metadatos estructurados (carátula, tribunal, fecha, expediente) sin texto ni sumario.
  6. **`EXTERNAL_REF_ONLY`** — Referencia externa con enlace a fuente oficial sin documento almacenado localmente (ej. por restricción técnica o ausencia de descarga).
  7. **`UNAVAILABLE`** — Documento referenciado cuyo contenido no se encuentra disponible ni accesible en la fuente oficial.

### ADR-04 — Core Jurídico Nacional + Búsqueda textual nativa PostgreSQL; `pgvector` opcional
- **Core Jurídico Nacional:** independiente de jurisdicción, con catálogos canónicos de organismos, tribunales, salas, fueros y tipos documentales, más adaptadores desacoplados por jurisdicción (`AR-NACION`, `AR-FEDERAL`, `AR-CABA`, `AR-PBA`, resto de provincias) y por proveedor.
- **Motor base obligatorio:** `tsvector` español + `unaccent` + índices **GIN** + `pg_trgm` + filtros estructurados exactos. **Cero dependencia de `pgvector` ni de APIs de IA para la búsqueda básica.**
- **Prohibición absoluta de vectores artificiales:** eliminar `Math.random()` en `EmbeddingService` durante `P0-B`.
- **Capa híbrida `pgvector`:** opcional, desacoplada y sujeta a infraestructura real + benchmark.

### ADR-05 — Política de integración con AUTH-09, AUTH-10 y AUTH-11 (Fase G) y desacoplamiento F1/F2/F3
- Lectura pasiva permitida en modo solo lectura (`abogados_app_user`, `0` créditos, **0 scraping silencioso**).
- Escalamiento explícito con confirmación y aviso de créditos cuando el profesional desee disparar una nueva investigación premium (F2 o F3).

---

## 3. Estado de decisiones ADR (`v1.2.1`)

### 3.1. Decisión arquitectónica cerrada *(no autoriza ejecución física)*
| ID | Plano A — Diseño arquitectónico | Plano B — Autorización ejecutiva | Plano C — Implementación física |
| :--- | :--- | :--- | :--- |
| **DEC-ADR-01** | **CERRADO:** diseño endurecido de `abogados_catalog_ingestor` (mínimo privilegio exclusivo sobre catálogos + auditoría, sin `SUPERUSER`/`BYPASSRLS`/`CREATEROLE`/`CREATEDB`/DDL/acceso multi-tenant) y `abogados_app_user` `SELECT`-only sobre Categoría C. | **PENDIENTE (`DEC-ADR-01-EXEC`):** autorización expresa del propietario para crear el rol en PostgreSQL y configurar privilegios. *(NO autorizada en P0-A.)* | **PENDIENTE (`P0-B`):** creación física controlada y verificación TDS (`TDS-P0-019`) tras autorización de `P0-B`. |

### 3.2. Decisiones técnicas / de infraestructura aún abiertas
| ID | Decisión pendiente del propietario | Momento requerido |
| :--- | :--- | :--- |
| **DEC-ADR-02** | Definir almacenamiento privado de archivos originales: filesystem privado configurable local sin costo adicional (`KNOWLEDGE_STORAGE_ROOT`, no activa gasto bajo `DEC-P0-BUDGET-01`) vs. object storage S3 compatible *(requiere `DEC-P0-BUDGET-01` si implica servicio pago)*. | Antes de iniciar `P0-B` |
| **DEC-ADR-03** | Definir política de retención de versiones históricas, TTL de refresco por fuente y presupuesto de almacenamiento. | Antes de iniciar `P0-B` / `P0-E` |
