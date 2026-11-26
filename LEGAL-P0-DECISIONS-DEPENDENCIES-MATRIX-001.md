# LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001
## MATRIZ DE DECISIONES, AUTORIZACIONES EJECUTIVAS, DEPENDENCIAS Y TRAZABILIDAD TDS — PROGRAMA P0

| Campo | Valor |
| :--- | :--- |
| **Expediente origen** | `LEGAL-P0-START-001` *(Fase P0-A)* |
| **Expediente de enmienda** | `LEGAL-P0-DOCUMENTARY-AMENDMENT-001` *(Micro-enmienda `v1.2.1`)* |
| **Versión** | `v1.0.1` *(alineada con baseline documental `v1.2.1`)* |
| **Baseline documental vinculado** | Especificaciones Legal AI **`v1.2.1`** *(y `LEGAL-AI-CREDITS-SPEC-001` `v1.2.0`, sin cambios en esta enmienda)* |
| **Fecha** | `2026-11-25` |
| **Estado** | `PENDIENTE DE APROBACIÓN FORMAL DEL PROPIETARIO` |
| **Autorización de implementación (`P0-B` y posteriores)** | `NO AUTORIZADA` |

### Historial de versiones
| Versión | Fecha | Modificación | Motivo | Hallazgos relacionados |
| :--- | :--- | :--- | :--- | :--- |
| `v1.0.0` | `2026-11-25` | Primer estado verificable emitido durante la Fase P0-A *(el historial anterior no está reconstruido por no existir versiones previas verificables)*. | Registro de decisiones, dependencias y trazabilidad TDS en `LEGAL-P0-START-001`. | N/A *(emisión inicial P0-A)* |
| `v1.0.1` | `2026-11-25` | Incorporación de control de versión e historial documental; separación `robots.txt` vs. prohibición legal en `DEC-P0-LEGAL-01`; cuarentena técnica fail-closed de `ingest-legal-norms.ts` como primer paso técnico de `P0-B`; tabla de 7 campos de gobernanza y aclaración de `DEC-P0-BUDGET-01`; desacoplamiento técnico de `F1` respecto de `P0-B` (predecesor técnico AUTH-04) y pre-gate del `ZIP` de InfoLEG previo a `P0-E`; definición explícita del Exit Gate TDS 100% offline de `P0-B`. | Ejecución de la micro-enmienda documental `LEGAL-P0-DOCUMENTARY-AMENDMENT-001` (alineación `v1.2.1`). | `P0-FBA-001`, `P0-FBA-004`, `P0-FBA-005`, `P0-FBA-006`, `P0-FBA-007`, `P0-FBA-008` |

---

## 1. Separación estricta: Decisiones arquitectónicas cerradas vs. Autorizaciones ejecutivas y decisiones pendientes

En cumplimiento de §4 y §9 de `LEGAL-P0-START-001`, ninguna decisión arquitectónica cerrada autoriza ejecución física, y ninguna decisión reservada al propietario se resuelve automáticamente.

### 1.1. Decisiones arquitectónicas cerradas en `v1.2.1` *(NO constituyen autorización de ejecución)*
| ID | Decisión arquitectónica cerrada | Documentos alineados (`v1.2.1`) |
| :--- | :--- | :--- |
| **DEC-ADR-01 (Parte A)** | Diseño endurecido de `abogados_catalog_ingestor` (worker interno exclusivo, mínimo privilegio sobre catálogos + auditoría, **prohibido** `SUPERUSER`, `BYPASSRLS`, `CREATEROLE`, `CREATEDB`, DDL y acceso a tablas privadas multi-tenant; sin rutas HTTP públicas) y `abogados_app_user` estrictamente `SELECT`-only sobre Categoría C. | Arch, ADR, Roadmap |
| **DEC-CRED-04A** | El desarrollo y pruebas técnicas de Fase F1 pueden ejecutarse utilizando fixtures y cuotas no comerciales explícitas; **las decisiones comerciales de créditos no bloquean P0 ni la reparación gratuita de bibliotecas jurídicas**. | Arch, Credits, Roadmap |
| **DEC-P0-PRIO-01** | Prioridad jurisdiccional nacional: **Primer bloque = Bloque A (`AR-NACION`, `AR-FEDERAL` con asiento en CABA + PGN + TFN) + Bloque B (`AR-CABA`: TSJ CABA, JURISTECA y Normativa CABA)**; expansión posterior **Bloque C (`AR-PBA`: SCBA/JUBA — `P0-G`)** y **Bloque H (demás provincias, incl. Formosa — `P0-H`)**. | Arch, Jur, Norm, ADR, Roadmap |
| **DEC-P0-CORE-01** | Arquitectura **Core Jurídico Nacional + adaptadores** (jurisdicción y proveedor) + catálogo canónico de organismos, tribunales, salas, fueros y tipos documentales + clasificación explícita de autoridad judicial vs. dictamen PGN/PTN vs. tribunal administrativo-jurisdiccional TFN. | Arch, Jur, ADR, Roadmap |
| **DEC-P0-NORM-QUAR** | Cuarentena y deshabilitación técnica fail-closed de `backend/scripts/ingest-legal-norms.ts` establecida como **primer paso técnico obligatorio de `P0-B`** (impidiendo ejecución accidental, carga de los 5 registros inválidos, corrección para incorporarlos al corpus o reutilización como fixtures válidos, con evidencia documentada); retiro definitivo del modelo `LegalNorm` legacy/esquema planificado en `P0-E`. | Arch, Norm, ADR, Roadmap |
| **DEC-P0-SEARCH-01** | PostgreSQL FTS español (`tsvector` + `unaccent` + GIN) + filtros exactos como motor obligatorio sin dependencia de `pgvector` ni OpenAI; prohibición de vectores `Math.random()` y de fallback silencioso a `listAll()`. | Arch, ADR, Roadmap |

### 1.2. Autorizaciones ejecutivas y decisiones abiertas reservadas al propietario (`P0-FBA-005`)

> **Regla de gobernanza:** Cada decisión incluye los **7 campos obligatorios**: identificador, decisión requerida, estado actual, responsable de decidir o ejecutar (sin inventar personas: `Propietario del proyecto` cuando corresponde a decisión ejecutiva documentada o `PENDIENTE_DE_ASIGNACIÓN` cuando el ejecutor/asesor no está asignado), dependencias, consecuencias de no aprobar y evidencia necesaria para cerrarla.

| Identificador | Decisión requerida | Estado actual | Responsable de decidir o ejecutar | Dependencias | Consecuencias de no aprobar | Evidencia necesaria para cerrar la decisión |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DEC-IMPL-P0B** | Aprobación del baseline documental `v1.2.1` y autorización expresa independiente para iniciar `P0-B`. | `PENDIENTE` | Propietario del proyecto *(ejecución técnica posterior: `PENDIENTE_DE_ASIGNACIÓN`)* | Cierre de `P0-A` y enmienda `v1.2.1` | Ninguna fase de implementación (`P0-B` y siguientes) puede iniciarse; código y DB permanecen congelados. | Acta/mensaje expreso de aprobación del baseline `v1.2.1` y orden explícita de inicio de `P0-B`. |
| **DEC-ADR-01-EXEC** | Autorización expresa para crear físicamente el rol PostgreSQL `abogados_catalog_ingestor` y otorgar privilegios mínimos sobre catálogos + auditoría en `P0-B` *(Parte B de `DEC-ADR-01`; diseño arquitectónico cerrado en Parte A)*. | `PENDIENTE` | Propietario del proyecto *(ejecución DBA/backend: `PENDIENTE_DE_ASIGNACIÓN`)* | `DEC-IMPL-P0B` | No puede construirse ni probarse el canal controlado de ingesta del worker en `P0-B` ni ejecutarse `TDS-P0-019`. | Aprobación expresa del propietario + verificación SQL de grants y `TDS-P0-019` en verde durante `P0-B`. |
| **DEC-ADR-02** | Elegir almacenamiento privado de originales: filesystem privado local sin costo adicional (`KNOWLEDGE_STORAGE_ROOT`) vs. object storage S3 compatible. | `PENDIENTE` | Propietario del proyecto *(implementación: `PENDIENTE_DE_ASIGNACIÓN`)* | `DEC-IMPL-P0B` *(y `DEC-P0-BUDGET-01` únicamente si se elige S3 pago)* | Bloquea el diseño operativo del archivado inmutable SHA-256 en `P0-B` y `P0-E`. | Decisión escrita de backend elegido (`KNOWLEDGE_STORAGE_ROOT` local o S3) registrada en expediente. |
| **DEC-ADR-03** | Definir política de retención y TTL de versiones históricas y documentos originales. | `PENDIENTE` | Propietario del proyecto *(ejecución: `PENDIENTE_DE_ASIGNACIÓN`)* | `DEC-ADR-02` | Riesgo de crecimiento no acotado del almacenamiento o políticas de refresco ambiguas en `P0-B`/`P0-E`. | Tabla de retención y TTL aprobada e incorporada en configuración de ingesta. |
| **DEC-P0-LEGAL-01** | Evaluación jurídica diferenciada en 7 planos (condiciones de uso, licencia, Ley 11.723, Ley 25.326, restricciones contractuales y eventuales autorizaciones/convenios institucionales) para fuentes `RESTRINGIDA_POR_ROBOTS_TXT` (Buscador Tribunales Nac./Fed. CSJN, JURISTECA, descarga web PDF SAIJ) y fuentes `VIABLE_CON_CONDICIONES` sin licencia abierta verificada (CSJN Tomos/SJ, PGN, TFN, TSJ CABA, BOCABA/Digesto). *AGY nunca solicita convenios ni acepta licencias.* | `PENDIENTE` | Propietario del proyecto + asesoría jurídica (`PENDIENTE_DE_ASIGNACIÓN`) | Matriz de validación `v1.0.1` (`LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md`) | Fuentes `RESTRINGIDA_POR_ROBOTS_TXT` permanecen como `SOLO_REFERENCIA_EXTERNA`; adaptadores de `P0-C`/`P0-D`/`P0-G` sin licencia clara quedan bloqueados para ingesta comercial. **No bloquea `P0-B`.** | Dictamen legal por fuente y, si aplica, licencia verificada o convenio institucional firmado. |
| **DEC-NORM-01** | Definir alcance del corpus normativo inicial Nacional (`AR-NACION` — InfoLEG) y CABA (`AR-CABA` — BOCABA/Digesto/CEDOM). | `PENDIENTE` | Propietario del proyecto *(análisis técnico-jurídico: `PENDIENTE_DE_ASIGNACIÓN`)* | Inspección pre-gate del `ZIP` oficial de InfoLEG (`datos.jus.gob.ar`) | No puede definirse el alcance de carga inicial de la Biblioteca Normativa en `P0-E`. | Lista aprobada de leyes/códigos o criterio de ingesta completa para `AR-NACION` y `AR-CABA`. |
| **DEC-NORM-02** | Definir frecuencia comercial de actualización normativa y política de alertas ante reformas. | `PENDIENTE` | Propietario del proyecto *(operación: `PENDIENTE_DE_ASIGNACIÓN`)* | `DEC-NORM-01` | Sin SLA ni cadencia definida de sincronización incremental en `P0-E`/`P0-F`. | Política de cadencia de sincronización y alertas aprobada por escrito. |
| **DEC-NORM-03** | Confirmar estrategia de retiro/reemplazo definitivo del modelo legacy `LegalNorm` y sus migraciones en `P0-E` *(independiente de la cuarentena técnica fail-closed de `ingest-legal-norms.ts`, que se ejecuta como primer paso técnico de `P0-B`)*. | `PENDIENTE` | Propietario del proyecto *(ejecución: `PENDIENTE_DE_ASIGNACIÓN`)* | Cuarentena previa en `P0-B` + `DEC-NORM-01` | Riesgo de convivencia ambigua entre esquema legacy `LegalNorm` y modelo `Normative*` en `P0-E`. | Plan aprobado de retiro/migración del modelo `LegalNorm` legacy. |
| **DEC-CRED-04B** | Definir dotación inicial de créditos por plan (`STARTER`, `PRO`, `ENTERPRISE`), precios, cuotas, facturación y condiciones comerciales. | `PENDIENTE` | Propietario del proyecto | `F1 (técnico)` completado para despliegue comercial | Impide la habilitación comercial en producción de `F1`/`F2`/`F3`. **No bloquea P0 ni `F1 (técnico)`.** | Matriz comercial aprobada con dotaciones, precios y términos de uso. |
| **DEC-CRED-04C** | Definir packs de recarga y política de facturación adicional. | `PENDIENTE` | Propietario del proyecto | `DEC-CRED-04B` | Impide habilitar recargas comerciales adicionales; no bloquea operación base con plan. | Esquema de packs y precios aprobado por escrito. |
| **DEC-CRED-04D** | Definir si AUTH-09, AUTH-10 y AUTH-11 migran en el futuro al ledger común de créditos o mantienen cupos separados. | `PENDIENTE` | Propietario del proyecto | Estabilidad operativa de `F1` | AUTH-09/10/11 conservan su régimen actual sin afectar P0 ni F1/F2/F3. | Decisión documentada de unificación o separación de cupos. |
| **DEC-CRED-03** | Definir precio numérico en `microCredits` de `JURISPRUDENCE_AI_WIDE_RESEARCH` (Búsqueda amplia) tras medir costos reales. | `PENDIENTE` | Propietario del proyecto *(medición de costos: `PENDIENTE_DE_ASIGNACIÓN`)* | Benchmark LLM (`DEC-ARCH-02`) + mediciones reales en `F2` | No puede habilitarse comercialmente la modalidad Búsqueda amplia; no bloquea modo Automático ni P0. | Informe de costos medidos y tarifa numérica aprobada. |
| **DEC-ARCH-02** | Aprobar ejecución del benchmark LLM de 6 criterios, presupuesto asociado y selección definitiva de modelo(s) por tarea. | `PENDIENTE` | Propietario del proyecto *(ejecución técnica: `PENDIENTE_DE_ASIGNACIÓN`)* | `DEC-P0-BUDGET-01` (por consumo API de benchmark) | Impide fijar modelos productivos y habilitar `F2` y `F3`. No bloquea P0 ni `F1`. | Informe comparativo de 6 criterios y resolución de selección de modelo(s) aprobada. |
| **DEC-JUR-02 / 03** | Definir orden priorizado de provincias en Bloque H (post A+B+C) y tope de precedentes por síntesis comparativa (`F2`). | `PENDIENTE` | Propietario del proyecto | Cierre de Bloques A+B (`P0-F`) y diseño de `F2` | Retrasa priorización de oleadas de `P0-H` y calibración final de profundidad/latencia de `F2`. | Lista priorizada de provincias y parámetro de tope aprobados. |
| **DEC-P0-BUDGET-01** | Aprobación expresa de presupuesto para **cualquier gasto en servicios externos pagos o infraestructura paga** (object storage cloud S3, OCR pago, APIs de pago, benchmark LLM o infraestructura adicional). **No convierte en obligación de gasto una opción de almacenamiento local sin costo adicional (`KNOWLEDGE_STORAGE_ROOT`).** | `PENDIENTE` | Propietario del proyecto | Propuesta de costos estimados (`PENDIENTE_DE_DEFINICIÓN` cuando aplique gasto) | Queda prohibido contratar o incurrir en gastos en servicios pagos; las tareas sin costo adicional (ej. `P0-B` con `KNOWLEDGE_STORAGE_ROOT` local) **no quedan bloqueadas por gasto**. | Aprobación presupuestaria explícita con tope de gasto por servicio pago a contratar. |

#### Matriz resumida de impacto de bloqueo por fase
| ID | ¿Bloquea `P0-B`? | ¿Bloquea `P0-E`? | ¿Bloquea `F1` técnico? | ¿Bloquea `F1/F2/F3` comercial? |
| :--- | :---: | :---: | :---: | :---: |
| **DEC-IMPL-P0B** | **SÍ** | **SÍ** | NO *(requiere autorización propia de F1)* | **SÍ** |
| **DEC-ADR-01-EXEC** | **SÍ** | **SÍ** | **NO** | **NO** |
| **DEC-ADR-02** | **SÍ** | **SÍ** | **NO** | **NO** |
| **DEC-ADR-03** | **SÍ** | **SÍ** | **NO** | **NO** |
| **DEC-P0-LEGAL-01** | **NO** | Parcial *(cláusula comercial BOCABA/InfoLEG)* | **NO** | Parcial *(fuentes comerciales)* |
| **DEC-NORM-01 / 02 / 03** | **NO** | **SÍ** | **NO** | Para `F3` |
| **DEC-CRED-04B / C** | **NO** | **NO** | **NO** | **SÍ** |
| **DEC-CRED-04D** | **NO** | **NO** | **NO** | **NO** |
| **DEC-CRED-03** | **NO** | **NO** | **NO** | **SÍ** *(solo Búsqueda amplia)* |
| **DEC-ARCH-02** | **NO** | **NO** | **NO** | **SÍ** *(`F2`/`F3`)* |
| **DEC-JUR-02 / 03** | **NO** | **NO** | **NO** | Parcial *(`F2`)* |
| **DEC-P0-BUDGET-01** | **NO** *(con `KNOWLEDGE_STORAGE_ROOT` local)* / **SÍ** *(solo si elige S3 pago)* | **Solo si requiere gasto pago** | **NO** | **SÍ** *(servicios LLM/infra pagos)* |

---

## 2. Matriz de dependencias entre fases (`P0-A..P0-I` y `F1/F2/F3/G`)

| Fase | Predecesor técnico duro | Decisiones / autorizaciones y pre-gates requeridos | Independencia garantizada |
| :--- | :--- | :--- | :--- |
| **P0-A** | Ninguno *(ejecutada)* | Autorizada por `LEGAL-P0-START-001` (y enmienda `LEGAL-P0-DOCUMENTARY-AMENDMENT-001`) | 0 código, 0 DB, 0 paquetes |
| **P0-B** | `P0-A` | `DEC-IMPL-P0B`, `DEC-ADR-01-EXEC`, `DEC-ADR-02`, `DEC-ADR-03` *(+ `DEC-P0-BUDGET-01` solo si se opta por S3 pago)*. **Primer paso técnico obligatorio:** deshabilitación/cuarentena fail-closed de `backend/scripts/ingest-legal-norms.ts`. | **NO depende** de fuentes externas, `robots.txt`, JUBA, Internet ni créditos |
| **P0-C** | `P0-B` | `DEC-P0-LEGAL-01` (por fuente) | **NO depende** de `P0-D`, `P0-E`, `P0-G` ni créditos |
| **P0-D** | `P0-B` | `DEC-P0-LEGAL-01` (TSJ / JURISTECA) | **NO depende** de `P0-C`, `P0-E`, `P0-G` ni créditos |
| **P0-E** | `P0-B` | `DEC-NORM-01/02/03`, verificación comercial BOCABA + **Pre-gate obligatorio de inspección técnica y jurídica del paquete `ZIP` oficial de InfoLEG (`datos.jus.gob.ar`)** verificando estructura, contenido textual, integridad, metadatos, frecuencia de actualización y condiciones de reutilización. | **NO depende** de `P0-C`, `P0-D`, `P0-G` ni créditos |
| **P0-F** | `P0-C` + `P0-D` + `P0-E` *(o parcial por bloque listo)* | N/A | **NO depende** de `P0-G` (PBA), `P0-H` ni créditos |
| **P0-G** | `P0-F` *(o `P0-B` + Core)* | Validación legal/técnica `P0-G.1` (SCBA/JUBA) | Su eventual bloqueo **no frena** `F1`, `F2` ni `F3` |
| **P0-H** | `P0-F` | `DEC-JUR-02` + validación por provincia | Expansión por oleadas independientes |
| **P0-I** | `P0-F` (Bloque A+B) / `P0-H` (Nacional) | Auditoría independiente | Certificación incremental por bloque |
| **F1 (técnico)** | **AUTH-04** *(`ScopedPrismaService`, RLS habilitado y forzado donde corresponda, aislamiento por organización, permisos de lectura adecuados y verificación con rol runtime `abogados_app_user`)* | `DEC-CRED-04A` (fixtures no comerciales) + autorización expresa independiente de implementación *(**esta independencia técnica respecto de `P0-B` NO autoriza implementar `F1`**)* | **NO depende técnicamente de `P0-B`** ni de `P0-C/D/E/G` ni de `DEC-CRED-04B/C/D` |
| **F1 (comercial)** | `F1 (técnico)` | `DEC-CRED-04B` (+ `04C` para recargas) | Independiente de `DEC-CRED-04D` |
| **F2** | `F1` + `P0-C` *(y opcional `P0-D`/`P0-F`)* | `DEC-ARCH-02`, `DEC-JUR-03` (+ `DEC-CRED-03` para amplia) | **NO depende** de `P0-E` (Normativa) ni `P0-G` (JUBA) |
| **F3** | `F1` + `P0-E` | `DEC-ARCH-02` | **NO depende** de `P0-G` (JUBA) ni `F2` |
| **G** | `F2` y/o `F3` *(incremental)* | Estabilidad operativa previa | Habilitable por biblioteca sin esperar ambas |

---

## 3. Revisión documental y trazabilidad del contrato TDS (`TDS-P0-001` a `TDS-P0-023`) (§8)

*(Revisión estrictamente documental — 0 tests productivos escritos en P0-A ni en esta enmienda `v1.2.1`. Ningún identificador original fue alterado. Se preserva intacta la política TDS RED → GREEN.)*

### 3.1. Exit Gate TDS de `P0-B` — Ejecución 100% offline (`P0-FBA-007`)

El **Exit Gate TDS de `P0-B`** debe ser **100% ejecutable offline utilizando fixtures locales y mocks**, sin acceso a Internet, sin scraping a fuentes oficiales y sin requerir datos jurídicos reales descargados en vivo:

- **Pruebas obligatorias del Exit Gate offline de `P0-B`:**
  - **`TDS-P0-001` a `TDS-P0-006`** (integridad SHA-256 con fixtures locales, deduplicación sobre fixtures multi-fuente simulados, idempotencia, versionado histórico, `FULL_SENTENCE` vs. `OFFICIAL_SUMMARY` con `textoCompleto = NULL`, clasificación `contentKind` y `sourceAuthorityKind` con métricas separadas CSJN).
  - **`TDS-P0-008` excluyendo el filtro `normaCitada`** (los restantes filtros estructurados combinados sobre fixtures locales).
  - **`TDS-P0-009`, `TDS-P0-010`, `TDS-P0-011`** (búsqueda exacta, FTS español + `unaccent` + GIN sin `pgvector`/OpenAI ni `Math.random()` ni fallback `listAll()`, paginación real determinista).
  - **`TDS-P0-015` con mocks de controles anti-SSRF, MIME y tamaño** (sin llamadas HTTP reales a Internet).
  - **`TDS-P0-016`, `TDS-P0-017`, `TDS-P0-018`, `TDS-P0-019`** (rechazo y cuarentena de fixtures inválidos, aislamiento multi-tenant, RLS `ENABLE + FORCE`, separación de privilegios `abogados_app_user` vs. `abogados_catalog_ingestor`).
  - **Verificación offline de cuarentena técnica fail-closed de `backend/scripts/ingest-legal-norms.ts`** *(primer paso técnico de `P0-B`, garantizando que no puede ejecutarse accidentalmente ni cargar los 5 registros inválidos)*.
- **Pruebas explícitamente diferidas a `P0-C`, `P0-D`, `P0-E` y `P0-F`:**
  - Pruebas inter-fuente reales contra adaptadores oficiales (`P0-C`, `P0-D`), filtro `normaCitada` completo en `TDS-P0-008` (`P0-E`/`P0-F`), fixtures oficiales descargados de CSJN/PGN/TFN/TSJ/InfoLEG/BOCABA (`P0-C`/`P0-D`/`P0-E`), validación real de adaptadores, fuentes caídas (`TDS-P0-013`), reintentos/`robots.txt` reales (`TDS-P0-014`), normativa (`TDS-P0-020..022`) y citas/anti-alucinación (`TDS-P0-012`, `TDS-P0-023`).

| ID TDS | Requisito / Eje cubierto | Fase | Cobertura positiva | Cobertura negativa / seguridad / borde | Revisión P0-A (ampliación recomendada manteniendo ID original) |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **TDS-P0-001** | Integridad de originales SHA-256 | `P0-B` *(offline)* / `P0-C` *(real)* | Archivar PDF/HTML (fixtures locales en `P0-B`) y validar `rawFileSha256` + `VERIFIED` | Alterar 1 byte detecta `HASH_MISMATCH` y bloquea lectura confiable | OK — en `P0-B` corre 100% offline con fixture local; verificación con muestra PDF real CSJN Tomo (`LibroVol347-2.pdf`) diferida a `P0-C` |
| **TDS-P0-002** | Detección de duplicados | `P0-B` *(fixtures)* / `P0-C` *(real)* | Fusión de mismo fallo desde 2 fuentes sin duplicar | Rechazo de duplicado aunque difiera puntuación de carátula | OK — en `P0-B` corre 100% offline con fixtures simulados; prueba inter-fuente real diferida a `P0-C`/`P0-D` |
| **TDS-P0-003** | Reingesta idempotente | `P0-B` | Re-ejecución sin cambios genera 0 escrituras nuevas | 0 re-descargas cuando `externalSourceId` y hash coinciden | OK |
| **TDS-P0-004** | Cambios de versiones | `P0-B` | Cambio de `contentSha256` crea nueva versión preservando anterior | Prohibido mutar/borrar versión referenciada por citas previas | OK |
| **TDS-P0-005** | Documentos íntegros vs. parciales | `P0-B` | `FULL_SENTENCE` puebla `textoCompleto`; `OFFICIAL_SUMMARY` deja `textoCompleto = NULL` | Error de validación si un sumario intenta poblar `textoCompleto` | OK |
| **TDS-P0-006** | Clasificación de tipo documental y autoridad | `P0-B`/`P0-C` | Clasifica correctamente judicial, `PROSECUTORIAL_OPINION` (PGN), `ADMINISTRATIVE_OPINION` (PTN), `ADMINISTRATIVE_TAX_COURT` (TFN) | Rechaza `contentKind` / `sourceAuthorityKind` inválido o PGN etiquetado como sentencia | **AMPLIAR en P0-B/C:** validar métricas separadas CSJN (Colección Fallos Tomos PDF vs. Sumarios vs. Sentencias indiv. vs. Acordadas) |
| **TDS-P0-007** | Identificación jurisdicción y tribunal | `P0-C`/`P0-D` | Mapeo exacto `AR-NACION`, `AR-FEDERAL`, `AR-CABA`, `AR-PBA` | Rechaza mezcla de TSJ CABA/JURISTECA en `AR-NACION` o código de tribunal fuera de catálogo canónico | OK |
| **TDS-P0-008** | Filtros combinados | `P0-B` *(sin `normaCitada`)* / `P0-F` *(completo)* | Intersección exacta de filtros estructurados (`P0-B` offline excluyendo `normaCitada`; los 12 completos en `P0-F`) | Rechazo controlado de fechas/enums inválidos; 0 errores de cast SQL | OK — filtro `normaCitada` diferido a `P0-E`/`P0-F` |
| **TDS-P0-009** | Búsqueda exacta | `P0-B`/`P0-F` | Frases exactas (`phraseto_tsquery`) y `nroExpediente` normalizado | 0 falsos positivos por coincidencia parcial no solicitada | OK |
| **TDS-P0-010** | Búsqueda textual española | `P0-B` | `tsvector` + `unaccent` + GIN sin `pgvector` ni `OPENAI_API_KEY` | Error explícito ante fallo DB (0 fallback silencioso `listAll()`; 0 `Math.random()`) | OK |
| **TDS-P0-011** | Paginación real | `P0-B` | Particiones disjuntas con `total` y `totalPages` exactos | Límite máximo acotado en servidor; página fuera de rango retorna lista vacía con `total` real | OK |
| **TDS-P0-012** | Citas y fragmentos de evidencia | `P0-F` | `VerifiedLegalCitation` con ancla de página/considerando, `contentKind` y URL oficial | Bloqueo si `literalExcerpt` no coincide literalmente con el documento almacenado | OK |
| **TDS-P0-013** | Fuentes caídas | `P0-C` | Degradación aislada marca fuente `DEGRADED`/`DOWN` en tablero | Resto de fuentes sigue operando sin pérdida ni corrupción de datos previos | OK — cubrir caso real verificado `datos.gob.ar` `HTTP 502` con fallback a `datos.jus.gob.ar` |
| **TDS-P0-014** | Reintentos, circuit-breaker y bloqueos | `P0-C`/`P0-D` | Backoff exponencial respeta `maxRetries` y abre circuit-breaker | Detención limpia ante `403`/CAPTCHA/`robots.txt` sin evasión | **AMPLIAR en P0-C/D:** incluir test explícito de respeto de `robots.txt` distinguiendo `RESTRINGIDA_POR_ROBOTS_TXT` (restricción técnica) de `BLOQUEADA_POR_RESTRICCION_LEGAL` (prohibición normativa verificada) |
| **TDS-P0-015** | Límites de extracción y anti-SSRF | `P0-B` *(mocks offline)* / `P0-C` *(real)* | Respeta rate-limit por dominio y tope de tamaño | Bloquea IPs privadas, loopback, redirecciones fuera de allowlist y esquemas no permitidos | OK — en `P0-B` corre 100% offline con mocks de anti-SSRF, MIME y tamaño; validación real de normalización HTTP→HTTPS (`api-restboletinoficial.buenosaires.gob.ar`) en `P0-E` |
| **TDS-P0-016** | Rechazo de documentos inválidos | `P0-B` | Documentos válidos pasan a estado activo | PDF corrupto, HTML vacío, MIME fraudulento o sin metadatos mínimos van a cuarentena auditable | OK |
| **TDS-P0-017** | Aislamiento multi-tenant | `P0-B`/`P0-F` | Notas/favoritos/investigaciones visibles solo para `organizationId` propietario | Consulta desde `OrgB` retorna 0 filas de `OrgA` | OK |
| **TDS-P0-018** | RLS PostgreSQL | `P0-B` | `relrowsecurity = t` y `relforcerowsecurity = t` verificados en `pg_class` | Sin `SET LOCAL app.current_organization_id`, `SELECT` devuelve 0 filas | OK |
| **TDS-P0-019** | Seguridad de ingesta | `P0-B` | Worker con `abogados_catalog_ingestor` inserta en tablas de catálogo y auditoría | `abogados_app_user` falla en `INSERT`/`UPDATE`/`DELETE` Cat. C; `abogados_catalog_ingestor` falla en DDL y en tablas privadas multi-tenant (`Client`, `Expediente`, `User`) | OK |
| **TDS-P0-020** | Actualización normativa | `P0-B` *(cuarentena script)* / `P0-E` *(normativa y retiro `LegalNorm`)* | Ingesta incremental InfoLEG/BOCABA incrementa versión conservando `ORIGINAL` | 0 colisión de `versionNorma`; bloqueo fail-closed contra ejecución accidental de `ingest-legal-norms.ts` | **AMPLIAR (`P0-FBA-004`):** verificación de deshabilitación/cuarentena fail-closed de `ingest-legal-norms.ts` como **primer paso técnico de `P0-B`**; retiro definitivo de `LegalNorm` legacy y cuarentena de normas sin procedencia oficial en `P0-E` |
| **TDS-P0-021** | Vigencia temporal | `P0-E` | Persistencia de los 9 hitos y 4 planos | Sincronización reciente (`lastSyncedAt`) sin respaldo jurídico mantiene `UNKNOWN_UNVERIFIED` | OK |
| **TDS-P0-022** | Relaciones entre normas | `P0-E` | `NormativeRelation` y `JurisprudenceNormCitation` devuelven vínculos verificados | Rechaza relaciones sin norma destino válida o sin `backingSourceRef` | OK |
| **TDS-P0-023** | Prevención de alucinaciones jurídicas | `P0-F`/`F2`/`F3` | Citas válidas superan verificación en 3 niveles y muestran advertencia literal | Rechazo mecánico de `documentId` inexistente, artículo inventado o sumario presentado como fallo completo | OK |

