# LEGAL-AI-JURISPRUDENCE-SPEC-001
## ESPECIFICACIÓN FUNCIONAL Y TÉCNICA — JURISPRUDENCIA Y JURISPRUDENCIA CON IA

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
| `v1.0.0` | `2026-11-25` | `LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001` | Especificación inicial de Jurisprudencia con IA y auditoría de fuentes. |
| `v1.1.0` | `2026-11-25` | `LEGAL-AI-DOCUMENT-RECONCILIATION-001` | Incorporación de triple nivel de verificación jurídica, clasificación diferenciada para PTN y TFN, regla de cero scraping previo en Plan de Investigación y desacoplamiento de Fase F2 respecto de Normativa/JUBA. |
| `v1.2.0` | `2026-11-25` | `LEGAL-P0-START-001` *(P0-A)* | Reconciliación P0-A: prioridad nacional actualizada a **Bloque A (Nación/Federal CABA + PGN + TFN) + Bloque B (CABA autónoma: TSJ + JURISTECA)** antes que Bloque C (PBA/JUBA) y Bloque H (otras provincias, incl. Formosa); separación inequívoca de códigos `AR-NACION`, `AR-FEDERAL`, `AR-CABA`, `AR-PBA`; incorporación de **PGN** (dictamen fiscal ante CSJN) y diferenciación de **CSJN Colección Fallos (Tomos PDF)** vs. sumarios vs. sentencias individuales vs. acordadas; remisión de evidencia viva a `LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md` y regla de no inventar denominadores de cobertura. |
| `v1.2.1` | `2026-11-25` | `LEGAL-P0-DOCUMENTARY-AMENDMENT-001` | Resolución de `P0-FBA-003` y alineación con `P0-FBA-001`: fijación del enum canónico `JurisprudenceContentKind` de 7 valores exactos con definiciones funcionales explícitas (eliminando notaciones duales con barra) y alineación terminológica entre restricciones técnicas (`robots.txt`) y planos jurídicos. |

---

## 1. Propósito

Especificar la cobertura jurisprudencial nacional (Programa P0) y el servicio premium **Jurisprudencia con IA** (Fase F2, ruta `/ia-legal/jurisprudencia`, actualmente placeholder pendiente), construidos sobre el **Core Jurídico Nacional** y la biblioteca jurisprudencial acumulativa del Explorador existente, sin crear buscadores ni bibliotecas paralelas.

---

## 2. Experiencia funcional en lenguaje natural

### 2.1. Entrada del profesional
El abogado describe el caso en lenguaje natural, como se lo explicaría a un colega.

> *Ejemplo:* «Mi cliente fue despedido por una sola inasistencia injustificada. Busco fallos que establezcan que ese hecho, por sí solo, no alcanza para justificar un despido con causa.»

Modalidades de alcance disponibles:
1. **Automático (selección inteligente y explicable)** — *por defecto*.
2. **Jurisdicción específica independiente:** separación inequívoca por código territorial (`AR-NACION`, `AR-FEDERAL`, `AR-CABA`, `AR-PBA` y futuras jurisdicciones provinciales como Formosa, Santa Fe, Río Negro, Córdoba, etc.). **Nunca mezclar la Justicia Nacional ordinaria con asiento en CABA (`AR-NACION`) con la Justicia autónoma de CABA (`AR-CABA`).**
3. **Búsqueda amplia — Todas las fuentes disponibles** — *modalidad independiente y explícita*.

### 2.2. Plan de Investigación previo a la ejecución
Antes de lanzar consultas externas o consumir créditos definitivos, la IA interpreta la consulta y presenta al abogado un **Plan de Investigación** editable:
- **Materia jurídica** y **problema jurídico central**.
- **Hechos jurídicamente relevantes** y **cuestiones controvertidas**.
- **Jurisdicciones, fueros, tribunales y salas pertinentes**.
- **Términos, voces jurídicas y criterios de búsqueda**.
- **Posibles normas relacionadas** (etiquetadas como referencia orientativa si no fueron verificadas en la biblioteca normativa).
- **Fuentes propuestas y breve justificación de pertinencia de cada una**.

**Reglas obligatorias del Plan de Investigación (decisiones cerradas de diseño):**
- **Cero scraping y cero descargas antes de la confirmación:** el Plan de Investigación nunca consulta portales externos ni descarga documentos hasta que el profesional confirma la selección.
- **Incluido en la operación:** el Plan de Investigación forma parte de la operación lógica de investigación y **no genera un segundo cargo de créditos** (ver [LEGAL-AI-CREDITS-SPEC-001.md](./LEGAL-AI-CREDITS-SPEC-001.md)).

---

## 3. Reglas normativas de selección de fuentes

### 3.1. `Fuente: Automático (todas las fuentes)` — Regla obligatoria
`Automático` significa **selección inteligente y explicable**, nunca consulta indiscriminada de todas las fuentes.

Flujo obligatorio:
1. Interpretar jurídicamente la consulta.
2. Identificar materia y cuestión jurídica central.
3. Identificar jurisdicciones (`AR-NACION`, `AR-FEDERAL`, `AR-CABA`, `AR-PBA`, etc.), fueros y tribunales pertinentes.
4. Proponer únicamente las fuentes activas y legalmente habilitadas que corresponden a esas jurisdicciones y tribunales.
5. Explicar brevemente por qué cada fuente es pertinente y qué tipo de contenido aporta (sentencia íntegra vs. sumario vs. dictamen).
6. Permitir al abogado agregar o quitar fuentes libremente.
7. Ejecutar la investigación **únicamente sobre la selección confirmada**.

**Regla de no-exclusión nacional:** la selección automática nunca debe excluir un precedente nacional relevante (ej. CSJN o SAIJ) por el solo hecho de que el expediente tramite en CABA o en una provincia.

### 3.2. `Búsqueda amplia — Todas las fuentes disponibles`
- Modalidad independiente y explícita solicitada expresamente por el abogado.
- Posee código tarifario independiente (`JURISPRUDENCE_AI_WIDE_RESEARCH`), cuyo precio numérico permanece pendiente hasta medir costos reales (`DEC-CRED-03`).
- Conserva en todo momento la identificación de jurisdicción, tribunal, sala, jerarquía institucional y tipo de fuente, sin mezclar resultados como si tuvieran idéntica autoridad jurídica.

### 3.3. Búsquedas independientes por jurisdicción
- Cada jurisdicción (`AR-NACION`, `AR-FEDERAL`, `AR-CABA`, `AR-PBA` y provincias del Bloque H) opera con su propio adaptador de jurisdicción, catálogo canónico de tribunales/salas y adaptadores de proveedor independientes.
- No se dispara una búsqueda nacional general por defecto cuando el usuario seleccionó una jurisdicción local o provincial específica.

---

## 4. Prioridad de cobertura nacional, taxonomía institucional y fuentes validadas

### 4.1. Clasificación institucional obligatoria (`sourceAuthorityKind`)
El modelo documental común y la interfaz deben distinguir expresamente la autoridad emisora:

| Categoría institucional (`sourceAuthorityKind`) | Alcance y naturaleza | Organismos aplicables |
| :--- | :--- | :--- |
| **`SUPREME_COURT_JUDICIAL`** | Sentencia judicial del máximo tribunal nacional, autónomo CABA o provincial | CSJN (`AR-NACION`/`AR-FEDERAL`), TSJ CABA (`AR-CABA`), SCBA (`AR-PBA`), STJ/CSJ provinciales |
| **`APPELLATE_OR_TRIAL_JUDICIAL`** | Sentencia judicial de Cámaras (incl. plenarios), Tribunales Orales o Juzgados | Cámaras Nacionales y Federales en CABA (CNACivil, CNCom, CNAT, CCC, CNCC, CFCP, CNPE, CNACAF, CNCivComFed, CFSS, CCCF, CNE, TO), Cámaras CABA (CAyTyRC, PPJCyF), Cámaras Provinciales |
| **`PROSECUTORIAL_OPINION`** | **Dictamen del Ministerio Público Fiscal (NO sentencia judicial):** dictámenes de la Procuración General de la Nación ante la CSJN | **PGN (Procuración General de la Nación — `mpf.gob.ar`)** |
| **`ADMINISTRATIVE_OPINION`** | **Dictamen administrativo (NO sentencia judicial):** doctrina administrativa obligatoria para la APN | **PTN (Procuración del Tesoro de la Nación)** |
| **`ADMINISTRATIVE_TAX_COURT`** | **Clasificación jurisdiccional propia (NO Poder Judicial):** tribunal administrativo especializado con función jurisdiccional en materia impositiva y aduanera | **TFN (Tribunal Fiscal de la Nación — Salas A–D impositivas, E–G aduaneras)** |
| **`AGGREGATOR_OFFICIAL`** | Portal oficial agregador que publica sumarios/fallos preservando el tribunal emisor original | **SAIJ** |

### 4.2. Prioridad de incorporación nacional (Reconciliada en P0-A)
1. **Primer bloque prioritario:**
   - **Bloque A (`P0-C`):** Justicia Nacional y Federal con asiento en CABA (`AR-NACION`, `AR-FEDERAL`) — CSJN (con métricas separadas para **Colección Fallos / Tomos PDF**, **Sumarios**, **Sentencias completas**, **Sentencias recientes** y **Acordadas/Resoluciones**), Cámaras Nacionales y Federales con asiento en CABA, SAIJ, **PGN** (dictámenes) y **TFN** (resoluciones impositivas/aduaneras).
   - **Bloque B (`P0-D`):** Jurisdicción autónoma de CABA (`AR-CABA`) — **TSJ CABA** y **JURISTECA** (Cámaras CAyTyRC y PPJCyF), estrictamente separadas de la Justicia Nacional ordinaria.
2. **Expansión posterior:**
   - **Bloque C (`P0-G`):** Provincia de Buenos Aires (`AR-PBA`) — SCBA / JUBA y Cámaras departamentales (sujeto a validación técnica y jurídica previa; si no es viable, documentar limitación sin evadir protecciones).
   - **Bloque H (`P0-H`):** Resto de las jurisdicciones provinciales argentinas (Formosa, Santa Fe, Río Negro, Córdoba, Mendoza, etc.) reutilizando el Core Jurídico Nacional y el mismo contrato de adaptadores.

> [!IMPORTANT]
> **Registro de validación viva y restricciones técnicas/jurídicas (`P0-A` / `v1.2.1`):**
> El estado real verificado el `2026-11-25` para cada fuente oficial de los Bloques A y B —distinguiendo estrictamente restricciones técnicas de acceso (`RESTRINGIDA_POR_ROBOTS_TXT` en Buscador de Tribunales Federales/Nacionales `csjn.gov.ar/robots.txt`, JURISTECA `juristeca.jusbaires.gob.ar/robots.txt` y descarga web PDF SAIJ) de los planos jurídicos (condiciones de uso, licencia, Ley 11.723, Ley 25.326, restricciones contractuales y convenios), junto con la ficha dedicada de **CSJN Tomos Fallos (`sjservicios.csjn.gov.ar/sj/tomosFallos.do`)**— se documenta de forma autoritativa sin duplicación en **[LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md](./LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md)**.

### 4.3. Reglas de cobertura y transparencia métrica
- **Prohibido inventar denominadores:** cuando un organismo no publique el universo total de decisiones dictadas, el porcentaje de cobertura total debe informarse como **`INDETERMINADO`**.
- **Prohibido sumar sumarios como sentencias completas** o declarar `100%` por agotar las páginas visibles de un buscador selectivo.
- **Separación obligatoria en CSJN:** Colección *Fallos* (tomos/volúmenes PDF), Sumarios oficiales, Sentencias completas individuales, Sentencias recientes y Acordadas/Resoluciones se miden en métricas independientes.

---

## 5. Calidad jurídica y trazabilidad en tres niveles

Para garantizar valor jurídico real y prevenir alucinaciones sutiles, el sistema implementa **tres niveles diferenciados de control y trazabilidad**:

1. **Nivel 1 — Existencia documental:** verificación mecánica en backend de que cada identificador de fallo/dictamen citado existe efectivamente en el conjunto recuperado desde la biblioteca/fuente oficial (`validSourceIds`).
2. **Nivel 2 — Fidelidad literal de las citas:** toda cita entrecomillada o extracto atribuido a un fallo debe corresponder literalmente a un fragmento recuperado del texto almacenado, con ancla verificable (página, considerando o chunk cuando conste).
3. **Nivel 3 — Fidelidad jurídica de las conclusiones atribuidas al tribunal:** cada afirmación jurídica relevante de la síntesis (doctrina extraída, criterio de sala, analogía o divergencia) debe vincularse explícitamente con el fragmento o sumario recuperado que la sustenta, separando lo que el tribunal dijo de la inferencia del modelo.

> **Principio normativo explícito:** *la validación de un identificador de fallo (Nivel 1) no equivale a demostrar que el fallo respalda la conclusión jurídica atribuida (Nivel 3).*

### 5.1. Clasificación documental obligatoria (`JurisprudenceContentKind` — 7 valores canónicos)
Todo resultado debe etiquetarse y presentarse en UI utilizando exactamente uno de los **7 valores canónicos** del enum `JurisprudenceContentKind` (idénticos a [LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md](./LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md), sin sinónimos ni expresiones compuestas con barra):
1. **`FULL_SENTENCE`** — Sentencia o resolución judicial íntegra completa verificada.
2. **`PARTIAL_TEXT`** — Fragmento, extracto o sección parcial del texto del pronunciamiento (no sentencia íntegra).
3. **`OFFICIAL_SUMMARY`** — Sumario oficial redactado por el organismo o secretaría de jurisprudencia (nunca presentado como texto íntegro).
4. **`REVIEW`** — Reseña o síntesis editorial institucional de un pronunciamiento.
5. **`METADATA_ONLY`** — Registro con únicamente metadatos estructurados (carátula, tribunal, fecha, expediente) sin texto ni sumario.
6. **`EXTERNAL_REF_ONLY`** — Referencia externa con enlace a fuente oficial sin documento almacenado localmente (ej. por restricción técnica o ausencia de descarga).
7. **`UNAVAILABLE`** — Documento referenciado cuyo contenido no se encuentra disponible ni accesible en la fuente oficial.

### 5.2. Autoridad, jerarquía y verificación
Cada resultado distingue explícitamente:
- **Jerarquía institucional** (`SUPREME_COURT_JUDICIAL`, `APPELLATE_OR_TRIAL_JUDICIAL`, `ADMINISTRATIVE_TAX_COURT`, `PROSECUTORIAL_OPINION`, `ADMINISTRATIVE_OPINION`).
- **Fuerza vinculante** cuando conste (plenario / obligatorio / doctrina administrativa obligatoria APN) vs. **autoridad orientativa / persuasiva**.
- **Alcance territorial** (`AR-NACION`, `AR-FEDERAL`, `AR-CABA`, `AR-PBA`, etc.) y **estado de verificación** (`OFFICIAL_VERIFIED`, `SECONDARY_SOURCE`, `UNVERIFIED_REF`, `SOURCE_UNAVAILABLE`, `NO_DOCUMENT`).
- **Prohibición:** nunca inventar citas, precedentes, carátulas, fechas, expedientes ni afirmar que un criterio está vigente, consolidado o superado sin evidencia suficiente.

### 5.3. Advertencia profesional obligatoria (texto literal aprobado)
Debe mostrarse de forma permanente en la interfaz y en cualquier exportación:

> *"Verificá cada fallo en la fuente oficial antes de citarlo. La IA puede atribuir mal una cita o mencionar jurisprudencia que no existe. Los resultados son un punto de partida para tu búsqueda, no una fuente citable."*

---

## 6. Capacidades analíticas de la síntesis jurídica

Sobre los documentos recuperados y verificados, la síntesis producida mediante `LEGAL_AI_PROVIDER` debe:
- Explicar la relevancia práctica de cada precedente para los hechos consultados.
- Identificar **analogías y diferencias fácticas** con el caso del profesional.
- **Comparar precedentes y detectar criterios divergentes o contradicciones** entre tribunales o salas, diferenciando precedentes favorables y desfavorables.
- Identificar **líneas jurisprudenciales** cuando existan múltiples fallos verificados.
- Vincular cada conclusión relevante con la evidencia textual recuperada e indicar explícitamente los límites del análisis y las fuentes faltantes o con cobertura parcial.

---

## 7. Endpoints propuestos (Estado: PROPUESTO — NO EXISTENTE)

Protegidos por `BffSessionGuard`, `ActiveOrgContextGuard`, `CsrfGuard`, `OrgPermissionGuard` (`ai:use` + `legal_ai_jurisprudence:read` / `legal_ai_jurisprudence:write`):
- `GET /legal-ai/jurisprudence/sources` — Catálogo de fuentes, naturaleza institucional, estado de disponibilidad y limitaciones de cobertura conocidas.
- `POST /legal-ai/jurisprudence/plan` — Genera Plan de Investigación + fuentes propuestas con justificación (0 scraping externo, 0 cargo adicional, sujeto a rate-limit).
- `POST /legal-ai/jurisprudence/research` — Ejecuta la operación facturable sobre las fuentes confirmadas con `idempotencyKey`, integrándose con `CreditsLedgerService` (Fase F1) y persistiendo `LegalAiResearchRun` aislado por organización y usuario.
- `GET /legal-ai/jurisprudence/research` y `GET /legal-ai/jurisprudence/research/:id` — Historial y lectura de investigaciones previas del usuario (`0` créditos).

---

## 8. Decisiones pendientes de aprobación

| ID | Decisión pendiente |
| :--- | :--- |
| **DEC-JUR-02** | Orden priorizado de incorporación de las jurisdicciones provinciales del **Bloque H** (Formosa, Santa Fe, Río Negro, Córdoba, Mendoza, etc.) y de **PTN** una vez completados Bloque A, Bloque B y Bloque C (`P0-G`). |
| **DEC-JUR-03** | Límite máximo de documentos/precedentes analizados por cada síntesis comparativa para equilibrar profundidad jurídica, latencia y costo. |
