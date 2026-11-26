# LEGAL-P0-DOCUMENTARY-AMENDMENT-001
## INFORME DE EJECUCIÓN — MICRO-ENMIENDA DOCUMENTAL v1.2.1

---

## 1. Identificación de la autorización

| Campo | Valor |
| :--- | :--- |
| **Expediente** | `LEGAL-P0-DOCUMENTARY-AMENDMENT-001` |
| **Proyecto** | Abogados-Law |
| **Repositorio** | `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law\` |
| **Rama y HEAD de referencia** | `master` · `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` |
| **Auditoría de origen** | `LEGAL-P0-FINAL-BASELINE-AUDIT-001` (hallazgos `P0-FBA-001` a `P0-FBA-008`) |
| **Modalidad autorizada** | Modificación documental estrictamente acotada sobre los 8 documentos autorizados en §4 y emisión de este informe (§7) |
| **Fecha de ejecución** | `2026-11-25` |
| **Alcance excluido** | Aprobación del baseline P0, autorización de `P0-B`, autorización de `F1`, código productivo, Prisma, migraciones, PostgreSQL, roles, scripts de ingesta, paquetes, `.env`, servicios externos, tests productivos, `git add`, `commit` y `push` |

---

## 2. Dictamen de ejecución

**Dictamen:** **`COMPLETADO`**

Los ocho hallazgos identificados en `LEGAL-P0-FINAL-BASELINE-AUDIT-001` (`P0-FBA-001` a `P0-FBA-008`) fueron resueltos mediante modificaciones puntuales en los ocho documentos autorizados, todas las validaciones documentales y de consistencia cruzada (§5) resultaron satisfactorias, y el control Git (§6) confirma preservación íntegra de todos los elementos preexistentes y cero modificaciones fuera de alcance.

---

## 3. Versión documental de partida y versión final

| Documento | Versión de partida | Versión final | Observación |
| :--- | :---: | :---: | :--- |
| [LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md) | `v1.0.0` *(alineada `v1.2.0`)* | **`v1.0.1`** *(alineada `v1.2.1`)* | Incorpora historial de versiones y separación de 7 planos / `RESTRINGIDA_POR_ROBOTS_TXT` |
| [LEGAL-P0-A-EXECUTION-REPORT-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-P0-A-EXECUTION-REPORT-001.md) | Sin versión explícita *(estado inicial `v1.0.0`)* | **`v1.0.1`** *(alineada `v1.2.1`)* | Incorpora versión e historial (5 columnas) sin inventar datos previos |
| [LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md) | Sin versión explícita *(estado inicial `v1.0.0`)* | **`v1.0.1`** *(alineada `v1.2.1`)* | Incorpora versión, historial (5 columnas), 7 campos de decisión, `F1` → AUTH-04, pre-gate ZIP y Exit Gate offline |
| [LEGAL-AI-JURISPRUDENCE-SPEC-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-AI-JURISPRUDENCE-SPEC-001.md) | `v1.2.0` | **`v1.2.1`** | Enum canónico `JurisprudenceContentKind` (7 valores) + alineación terminológica `robots.txt` |
| [LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md) | `v1.2.0` | **`v1.2.1`** | Enum canónico `JurisprudenceContentKind` idéntico al Spec + cuarentena `P0-B` + aclaración `DEC-ADR-02` |
| [LEGAL-AI-NORMATIVE-SPEC-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-AI-NORMATIVE-SPEC-001.md) | `v1.2.0` | **`v1.2.1`** | `NormativeTextVersion.variant` (3 valores) + cuarentena primer paso `P0-B` + pre-gate ZIP InfoLEG |
| [LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md) | `v1.2.0` | **`v1.2.1`** | Cuarentena `P0-B`, `DEC-P0-BUDGET-01`, desacoplamiento `F1` técnico, pre-gate ZIP, Exit Gate TDS offline |
| [LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001.md) | `v1.2.0` | **`v1.2.1`** | Sincronización `DEC-P0-BUDGET-01`, cuarentena primer paso `P0-B`, `DEC-P0-LEGAL-01` e independencia técnica `F1` |
| [LEGAL-AI-CREDITS-SPEC-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-AI-CREDITS-SPEC-001.md) *(NO modificado — fuera de §4)* | `v1.2.0` | `v1.2.0` *(intacto)* | Sin hallazgos asignados; preservado intacto y referenciado fielmente como `v1.2.0` |

---

## 4. Tabla de los ocho hallazgos, estado y corrección aplicada

| ID | Severidad | Estado | Documentos actualizados | Corrección aplicada |
| :--- | :---: | :---: | :--- | :--- |
| **`P0-FBA-001`** | `HIGH` | **RESUELTO** | `LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md`, `LEGAL-P0-A-EXECUTION-REPORT-001.md`, `LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md` *(y alineación terminológica en `Jurisprudence`, `ADR`, `Roadmap`, `Architecture`)* | Se eliminó toda clasificación de `robots.txt` como prohibición legal (`SRC-AR-CSJN-TFN-BUSC`, `SRC-AR-SAIJ-WEB`, `SRC-CABA-JURISTECA` reclasificadas a `RESTRINGIDA_POR_ROBOTS_TXT`, operables solo como `SOLO_REFERENCIA_EXTERNA`). Se adoptaron las 4 categorías exigidas restringiendo `BLOQUEADA_POR_RESTRICCION_LEGAL` únicamente a norma, licencia o cláusula prohibitiva concreta y verificada, y se incorporó la matriz de **7 planos técnico-jurídicos** sin inventar licencias ni inferir autorización comercial por ausencia de `robots.txt`. |
| **`P0-FBA-002`** | `MEDIUM` | **RESUELTO** | `LEGAL-AI-NORMATIVE-SPEC-001.md` | Se amplió y precisó `NormativeTextVersion.variant` a 3 valores exactos: `ORIGINAL` (texto publicado originalmente por la fuente oficial), `UPDATED` (texto con modificaciones incorporadas conservando versión y trazabilidad) y `CONSOLIDATED` (texto ordenado o consolidado formalmente por autoridad competente con respaldo de fuente oficial), incorporando la regla explícita de **nunca etiquetar como `CONSOLIDATED` formal un texto meramente actualizado por el sistema**. |
| **`P0-FBA-003`** | `MEDIUM` | **RESUELTO** | `LEGAL-AI-JURISPRUDENCE-SPEC-001.md`, `LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md` | Se fijó el enum canónico `JurisprudenceContentKind` con exactamente los **7 valores** (`FULL_SENTENCE`, `PARTIAL_TEXT`, `OFFICIAL_SUMMARY`, `REVIEW`, `METADATA_ONLY`, `EXTERNAL_REF_ONLY`, `UNAVAILABLE`), eliminando notaciones duales con barra (`PARTIAL_TEXT / EXCERPT`, `EXTERNAL_REF_ONLY / UNAVAILABLE`) y manteniendo definiciones funcionales idénticas en ambos documentos. |
| **`P0-FBA-004`** | `MEDIUM` | **RESUELTO** | `LEGAL-AI-NORMATIVE-SPEC-001.md`, `LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md`, `LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md` *(y alineación en `Architecture` y `ADR`)* | Se estableció como **primer paso técnico obligatorio de `P0-B`** la deshabilitación técnica y cuarentena fail-closed de `backend/scripts/ingest-legal-norms.ts` con las 6 condiciones obligatorias (impedir ejecución accidental, prohibir carga de los 5 registros, prohibir corrección para incorporarlos, prohibir uso como fixtures válidos, documentar evidencia de cuarentena y mantener el retiro definitivo del modelo `LegalNorm`/migraciones/esquema en `P0-E`). |
| **`P0-FBA-005`** | `MEDIUM` | **RESUELTO** | `LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md`, `LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001.md`, `LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md` | Se completaron todas las decisiones ejecutivas en la matriz con los **7 campos obligatorios** (`Identificador`, `Decisión requerida`, `Estado actual`, `Responsable de decidir o ejecutar`, `Dependencias`, `Consecuencias de no aprobar`, `Evidencia necesaria para cerrar la decisión`), utilizando `Propietario del proyecto` / `PENDIENTE_DE_ASIGNACIÓN` sin inventar personas, y se sincronizó **`DEC-P0-BUDGET-01`** en Arquitectura (§7.2) y Roadmap (§7) aclarando que aplica a servicios externos pagos o infraestructura paga y **no convierte en obligación de gasto** una opción de almacenamiento local sin costo adicional (`KNOWLEDGE_STORAGE_ROOT`). |
| **`P0-FBA-006`** | `MEDIUM` | **RESUELTO** | `LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md`, `LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md` *(y alineación en `Normative` y `Architecture`)* | Se desacopló **`F1` técnico** respecto de `P0-B` (diagrama Mermaid, tabla de dependencias y resumen), fijando como predecesor técnico **AUTH-04** (`ScopedPrismaService`, RLS habilitado/forzado donde corresponda, aislamiento por organización, permisos de lectura adecuados y verificación con rol runtime `abogados_app_user`) y aclarando que esta independencia técnica **no autoriza implementar `F1`**. Asimismo, se agregó como **pre-gate obligatorio previo a `P0-E`** la inspección técnica y jurídica del paquete `ZIP` oficial de InfoLEG (`datos.jus.gob.ar`). |
| **`P0-FBA-007`** | `MEDIUM` | **RESUELTO** | `LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md`, `LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md` | Se definió expresamente el **Exit Gate TDS de `P0-B` como 100% ejecutable offline** con fixtures locales y mocks (sin Internet, sin scraping y sin datos jurídicos reales), cubriendo `TDS-P0-001..006`, `TDS-P0-008` excluyendo `normaCitada`, `TDS-P0-009..011`, `TDS-P0-015` con mocks de anti-SSRF/MIME/tamaño, `TDS-P0-016..019` y verificación offline de cuarentena de `ingest-legal-norms.ts`; se difirieron explícitamente a `P0-C..P0-F` las pruebas inter-fuente reales, `normaCitada`, fixtures oficiales descargados y validación real de adaptadores, preservando RED → GREEN. |
| **`P0-FBA-008`** | `LOW` | **RESUELTO** | `LEGAL-P0-A-EXECUTION-REPORT-001.md`, `LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md`, `LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md` | Se incorporó versión documental explícita (`v1.0.1`, alineada con `v1.2.1`) y tabla de historial de versiones de 5 columnas (`Versión`, `Fecha`, `Modificación`, `Motivo`, `Hallazgos relacionados`), registrando `v1.0.0` (`2026-11-25`) como primer estado verificable emitido en P0-A con aclaración expresa de que el historial anterior no está reconstruido (sin inventar versiones ni fechas). |

---

## 5. Documentos modificados y creados

### 5.1. Ocho documentos autorizados modificados puntualmente (§4)
1. [LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md) (`v1.0.0` → `v1.0.1`)
2. [LEGAL-P0-A-EXECUTION-REPORT-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-P0-A-EXECUTION-REPORT-001.md) (`v1.0.0` → `v1.0.1`)
3. [LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md) (`v1.0.0` → `v1.0.1`)
4. [LEGAL-AI-JURISPRUDENCE-SPEC-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-AI-JURISPRUDENCE-SPEC-001.md) (`v1.2.0` → `v1.2.1`)
5. [LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md) (`v1.2.0` → `v1.2.1`)
6. [LEGAL-AI-NORMATIVE-SPEC-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-AI-NORMATIVE-SPEC-001.md) (`v1.2.0` → `v1.2.1`)
7. [LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md) (`v1.2.0` → `v1.2.1`)
8. [LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001.md) (`v1.2.0` → `v1.2.1`)

### 5.2. Nuevo entregable autorizado creado (§7)
1. [LEGAL-P0-DOCUMENTARY-AMENDMENT-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-P0-DOCUMENTARY-AMENDMENT-001.md) *(este informe)*

---

## 6. Resumen de cada cambio por documento

1. **`LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md` (`v1.0.1`):** actualización de cabecera e historial de versiones (5 columnas); definición explícita de `RESTRINGIDA_POR_ROBOTS_TXT`, `SOLO_REFERENCIA_EXTERNA`, `VIABLE_CON_CONDICIONES` y uso estricto de `BLOQUEADA_POR_RESTRICCION_LEGAL`; nueva subsección §1.1 con matriz de 7 planos técnico-jurídicos para las 13 fuentes evaluadas; reclasificación de `SRC-AR-CSJN-TFN-BUSC`, `SRC-AR-SAIJ-WEB` y `SRC-CABA-JURISTECA` a `RESTRINGIDA_POR_ROBOTS_TXT`; actualización de la columna de restricciones en la matriz de cobertura (§4).
2. **`LEGAL-P0-A-EXECUTION-REPORT-001.md` (`v1.0.1`):** adición de control de versión e historial de 5 columnas (`P0-FBA-008`); actualización de §4, §5, §6 y §7 para reflejar `RESTRINGIDA_POR_ROBOTS_TXT` sin equiparar `robots.txt` con prohibición legal y enlazar la enmienda `v1.2.1` sin alterar el registro histórico de ejecución P0-A.
3. **`LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md` (`v1.0.1`):** adición de versión e historial de 5 columnas; actualización de `DEC-P0-NORM-QUAR` al primer paso técnico de `P0-B`; ampliación de §1.2 a los 7 campos de gobernanza exigidos + tabla resumida de impacto + precisión de `DEC-P0-LEGAL-01` y `DEC-P0-BUDGET-01`; actualización de §2 desacoplando `F1` técnico de `P0-B` hacia **AUTH-04** e incorporando el pre-gate del `ZIP` de InfoLEG previo a `P0-E`; nueva subsección §3.1 fijando el Exit Gate TDS 100% offline de `P0-B` y actualización de filas `TDS-P0-001`, `002`, `008`, `014`, `015` y `020`.
4. **`LEGAL-AI-JURISPRUDENCE-SPEC-001.md` (`v1.2.1`):** actualización de versión e historial; precisión del recuadro §4.2 diferenciando restricciones técnicas (`RESTRINGIDA_POR_ROBOTS_TXT`) de planos jurídicos; fijación de los 7 valores exactos de `JurisprudenceContentKind` en §5.1 con sus definiciones funcionales.
5. **`LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md` (`v1.2.1`):** actualización de versión e historial; fijación idéntica de los 7 valores y definiciones de `JurisprudenceContentKind` en ADR-03; alineación de ADR-02 (respeto de `robots.txt` separado de planos jurídicos), §1 (cuarentena fail-closed como primer paso técnico de `P0-B`) y §3.2 (`KNOWLEDGE_STORAGE_ROOT` local sin activar gasto en `DEC-P0-BUDGET-01`).
6. **`LEGAL-AI-NORMATIVE-SPEC-001.md` (`v1.2.1`):** actualización de versión e historial; actualización de §2.2 y `DEC-NORM-03` trasladando la cuarentena fail-closed de `ingest-legal-norms.ts` al primer paso técnico de `P0-B` con las 6 condiciones obligatorias; precisión de `NormativeTextVersion.variant` (`ORIGINAL | UPDATED | CONSOLIDATED`) y regla de no etiquetar textos actualizados como `CONSOLIDATED` formal en §3.2, §4.2 y §5; incorporación del pre-gate del `ZIP` oficial de InfoLEG en §4.1.
7. **`LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md` (`v1.2.1`):** actualización de versión e historial; actualización del diagrama Mermaid (§2), matriz (§3) y detalle de fases (§5) para desacoplar `F1` técnico de `P0-B` hacia AUTH-04 (sin autorizar su implementación), trasladar la cuarentena fail-closed al inicio de `P0-B` y agregar el pre-gate del `ZIP` de InfoLEG a `P0-E`; adición del Exit Gate TDS 100% offline de `P0-B` en §6.1; sincronización explícita de `DEC-P0-BUDGET-01` en §7.
8. **`LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001.md` (`v1.2.1`):** actualización de versión e historial; actualización de §2.2 y §7.1 con cuarentena fail-closed al inicio de `P0-B`, variantes `ORIGINAL | UPDATED | CONSOLIDATED` e independencia técnica de `F1` (AUTH-04); sincronización explícita de `DEC-P0-BUDGET-01` y actualización de `DEC-P0-LEGAL-01` en §7.2.

---

## 7. Validaciones ejecutadas y resultados (§5)

| # | Validación obligatoria (§5) | Resultado | Evidencia verificada |
| :---: | :--- | :---: | :--- |
| **1** | Los 8 hallazgos tienen corrección documental identificable (`P0-FBA-001` a `P0-FBA-008`) | **PASS** | Todos trazados en cabeceras, historiales y secciones afectadas de los 8 documentos |
| **2** | Cero expresiones residuales que clasifiquen `robots.txt` como prohibición legal automática | **PASS** | `0` fuentes clasificadas como `BLOQUEADA_POR_RESTRICCION_LEGAL` por `robots.txt`; todas las menciones a `BLOQUEADA_POR_RESTRICCION_LEGAL` son reglas explícitas que prohíben usar esa categoría por `robots.txt` |
| **3** | Los 7 valores de `JurisprudenceContentKind` son idénticos en Spec y ADR | **PASS** | `IDENTICAL_DEFS = True`; `missing = []`, `slash_bad = []`, `7/7` definiciones textuales idénticas |
| **4** | Los 3 valores de `NormativeTextVersion.variant` (`ORIGINAL`, `UPDATED`, `CONSOLIDATED`) y regla de no confusión | **PASS** | Presentes en §3.2, §4.2 y §5 de `LEGAL-AI-NORMATIVE-SPEC-001.md` |
| **5** | `backend/scripts/ingest-legal-norms.ts` figura como primer paso técnico de cuarentena de `P0-B` | **PASS** | Verificado en `Normative`, `Roadmap`, `Decisions Matrix`, `Architecture` y `ADR` con las 6 condiciones obligatorias |
| **6** | Decisiones ejecutivas incluyen los 7 campos requeridos | **PASS** | Verificados los 7 encabezados y filas completas en §1.2 de `LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md` sin responsables inventados |
| **7** | `DEC-P0-BUDGET-01` sincronizada en Arquitectura y Roadmap con aclaración de storage local | **PASS** | Presente en `Decisions Matrix`, `Architecture` §7.2 y `Roadmap` §7 aclarando que `KNOWLEDGE_STORAGE_ROOT` local no es obligación de gasto |
| **8** | `F1` técnico desacoplado de `P0-B` y dependiente de AUTH-04 + pre-gate `ZIP` InfoLEG en `P0-E` | **PASS** | Enlace `P0B --> FF1` eliminado en Mermaid; dependencia `AUTH-04` (`ScopedPrismaService`, RLS, `abogados_app_user`) y pre-gate `ZIP` InfoLEG verificados |
| **9** | Exit Gate TDS de `P0-B` 100% offline sin exigir fuentes externas | **PASS** | Verificado en §3.1 de `Decisions Matrix` y §6.1 de `Roadmap` (`TDS-P0-001..006`, `008` sin `normaCitada`, `009..011`, `015` mocks, `016..019` + cuarentena) |
| **10** | Historial de versiones sin datos inventados | **PASS** | Todos los 8 documentos tienen versión e historial coherentes; los 3 documentos `LEGAL-P0-*` registran `v1.0.0` (`2026-11-25`) como primer estado verificable sin reconstruir historial previo |
| **11** | Revisión de consistencia cruzada entre los 8 documentos | **PASS** | Versiones (`v1.2.1` / `v1.0.1`), decisiones, enums, fases, cuarentena y dependencias 100% alineadas |
| **12** | Cero archivos modificados fuera del alcance autorizado | **PASS** | `LEGAL-AI-CREDITS-SPEC-001.md` permanece en `v1.2.0`; 5 archivos `LEGAL-EXTERNAL-ASSISTANTS-*` intactos; 0 archivos rastreados modificados (`git diff --stat` idéntico al inicial) |

---

## 8. Resultado de consistencia cruzada

La verificación automatizada y manual sobre los ocho documentos modificados confirma **consistencia cruzada completa**:
- **Taxonomía legal/técnica:** `RESTRINGIDA_POR_ROBOTS_TXT`, `SOLO_REFERENCIA_EXTERNA`, `VIABLE_CON_CONDICIONES` y `BLOQUEADA_POR_RESTRICCION_LEGAL` se usan de forma uniforme en los registros P0-A y en las especificaciones.
- **Enums de dominio:** `JurisprudenceContentKind` (7 valores) es carácter por carácter idéntico entre `LEGAL-AI-JURISPRUDENCE-SPEC-001.md` y `LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md`; `NormativeTextVersion.variant` (`ORIGINAL | UPDATED | CONSOLIDATED`) está alineado entre `Normative`, `Architecture` y `Roadmap`.
- **Gobernanza y secuenciación:** `DEC-P0-BUDGET-01`, la cuarentena de `ingest-legal-norms.ts` como primer paso técnico de `P0-B`, el retiro de `LegalNorm` en `P0-E`, el pre-gate del `ZIP` de InfoLEG en `P0-E`, el desacoplamiento de `F1` técnico hacia AUTH-04 y el Exit Gate TDS 100% offline de `P0-B` coinciden sin contradicciones entre los documentos.
- **Referencias a `LEGAL-AI-CREDITS-SPEC-001.md`:** al quedar excluido del alcance de §4, se mantuvo intacto en `v1.2.0` y las tablas de documentos relacionados lo identifican explícitamente como `v1.2.0 (sin cambios)`.

---

## 9. Estado Git inicial y final (§6)

| Métrica Git | Estado inicial (pre-enmienda) | Estado final (post-enmienda) | Diferencia |
| :--- | :---: | :---: | :--- |
| **Rama** | `master` | `master` | Sin cambios |
| **HEAD** | `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` | `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` | `0` commits / `0` pushes |
| **`git status --short` (líneas)** | `198` | `199` | **`+1`** (`?? LEGAL-P0-DOCUMENTARY-AMENDMENT-001.md`); los 8 docs modificados ya figuraban como untracked (`??`) en los 198 previos |
| **`git diff --stat` (líneas)** | `91` (`90` archivos rastreados preexistentes + línea resumen) | `91` *(idéntico)* | `0` archivos rastreados modificados |
| **`git diff --check` (líneas)** | `3` *(preexistentes en archivos rastreados previos)* | `3` *(idéntico)* | `0` problemas introducidos |
| **Archivos en staging (`git add`)** | `0` | `0` | `0` |

---

## 10. Archivos preexistentes preservados

Se preservaron íntegros todos los **198 elementos de estado Git previos**:
- Los **90 archivos rastreados con modificaciones preexistentes** de etapas anteriores (sin `git restore`, `checkout`, `reset`, `clean`, `add`, `commit` ni `push`).
- Los **108 archivos/directorios sin seguimiento previos**, manteniendo intactos:
  - `LEGAL-AI-CREDITS-SPEC-001.md` (`v1.2.0`, 0 cambios).
  - Los 5 documentos `LEGAL-EXTERNAL-ASSISTANTS-*` (`SPEC`, `MCP-ADR`, `SECURITY`, `PROMPT-CATALOG`, `ROADMAP`, 0 cambios).
  - Todo el código fuente en `backend/src/`, `frontend/src/`, `admin-platform/`, `backend/prisma/`, `backend/scripts/ingest-legal-norms.ts`, `package.json`, `.env` y tests productivos (0 cambios).

---

## 11. Limitaciones y puntos pendientes

1. **Decisiones ejecutivas y jurídicas pendientes del propietario:** permanecen `PENDIENTE` todas las autorizaciones y decisiones reservadas al propietario (`DEC-IMPL-P0B`, `DEC-ADR-01-EXEC`, `DEC-ADR-02`, `DEC-ADR-03`, `DEC-P0-LEGAL-01`, `DEC-NORM-01/02/03`, `DEC-CRED-03`, `DEC-CRED-04B/C/D`, `DEC-ARCH-02`, `DEC-JUR-02/03` y `DEC-P0-BUDGET-01`).
2. **Datos no verificados ni inventados:** los planos jurídicos de fuentes sin licencia abierta explícita, responsables técnicos/legales no asignados y estimaciones presupuestarias futuras permanecen marcados como `PENDIENTE_DE_VERIFICACION`, `PENDIENTE_DE_ASIGNACIÓN` o `PENDIENTE_DE_DEFINICIÓN`.
3. **`LEGAL-AI-CREDITS-SPEC-001.md`:** permaneció en `v1.2.0` por encontrarse fuera de los 8 documentos autorizados en §4 (no presenta contradicción con `v1.2.1`, pues las reglas de `DEC-CRED-04A/B/C/D` y `microCredits` no fueron alteradas).

---

## 12. Declaración explícita sobre código y base de datos

Se declara expresamente que durante `LEGAL-P0-DOCUMENTARY-AMENDMENT-001`:
- **NO** se modificó ni ejecutó código fuente productivo.
- **NO** se ejecutaron scripts de ingesta (incluido `backend/scripts/ingest-legal-norms.ts`) ni tests productivos.
- **NO** se modificaron esquemas Prisma, migraciones, bases de datos PostgreSQL ni roles de base de datos.
- **NO** se instalaron ni actualizaron paquetes, ni se modificaron variables de entorno, ni se contrataron o activaron servicios externos.
- **NO** se ejecutaron `git add`, `git commit` ni `git push`.

---

## 13. Declaración explícita sobre estado del baseline y P0-B

Se declara expresamente que:
- **El baseline documental P0 (`v1.2.1`) NO está aprobado**; queda sometido a revisión y aprobación formal del propietario.
- **`P0-B` NO está autorizada ni iniciada** (tampoco `F1` ni ninguna fase posterior). Ninguna actividad de implementación comenzará hasta recibir revisión y autorización expresa independiente del propietario.

