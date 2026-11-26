# LEGAL-P0-V1.2.1-CLOSURE-AUDIT-001
## AUDITORÍA INDEPENDIENTE DE CIERRE DOCUMENTAL — BASELINE P0 v1.2.1

---

## 1. Identificación y alcance

| Campo | Valor |
| :--- | :--- |
| **Expediente de auditoría** | `LEGAL-P0-V1.2.1-CLOSURE-AUDIT-001` |
| **Proyecto** | Abogados-Law |
| **Repositorio** | `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law\` |
| **Rama / HEAD auditados** | `master` · `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` |
| **Baseline documental evaluado** | **`v1.2.1`** *(5 especificaciones `v1.2.1` + 3 registros `LEGAL-P0-*` `v1.0.1` + `LEGAL-AI-CREDITS-SPEC-001.md` `v1.2.0` intacto + informe de enmienda)* |
| **Auditoría de origen** | `LEGAL-P0-FINAL-BASELINE-AUDIT-001` (`P0-FBA-001` a `P0-FBA-008`) |
| **Enmienda evaluada** | `LEGAL-P0-DOCUMENTARY-AMENDMENT-001` |
| **Modalidad** | **READ-ONLY ESTRICTO** *(0 modificaciones a documentos auditados, código, Prisma, DB, roles, paquetes, `.env`, tests ni historial Git; único archivo creado: este informe)* |
| **Fecha de auditoría** | `2026-11-25` |
| **Aprobación del baseline / Autorización `P0-B` / `F1`** | **`NO APROBADO` / `NO AUTORIZADAS`** |

---

## 2. Dictamen ejecutivo

**Dictamen global (§7):** **`APTO_CON_OBSERVACIONES`**

**Fundamento objetivo:**
- **`0` hallazgos `CRITICAL`** y **`0` hallazgos `HIGH`**.
- **Los 8 hallazgos de origen (`P0-FBA-001` a `P0-FBA-008`) fueron verificados directamente en el texto efectivo de los documentos auditados** y se encuentran sustantivamente resueltos, sin reintroducir contradicciones arquitectónicas, de seguridad ni económicas.
- **Los 12 controles adicionales de coherencia (§6)** resultaron conformes (`12/12`).
- **Se emite `APTO_CON_OBSERVACIONES`** (y no `APTO_PARA_APROBACION` sin reservas) debido a **1 hallazgo `MEDIUM` de trazabilidad VCS** (`P0-V121-AUD-001`: los 8 documentos enmendados permanecen *untracked* en Git, por lo que su línea base `v1.2.0` completa es **`BASELINE_ANTERIOR_NO_VERIFICABLE`** desde Git) y **5 observaciones `LOW` no bloqueantes** (`P0-V121-AUD-002` a `P0-V121-AUD-006`) que el propietario debe conocer y puede aceptar expresamente al aprobar el baseline `v1.2.1` (ver §11 y §14).

---

## 3. Estado Git inicial y final

| Métrica Git | Declarado post-enmienda (`LEGAL-P0-DOCUMENTARY-AMENDMENT-001`) | Estado inicial de esta auditoría (verificado) | Estado final de esta auditoría *(tras crear únicamente este informe)* |
| :--- | :---: | :---: | :---: |
| **Rama** | `master` | `master` | `master` |
| **HEAD** | `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` | `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` | `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` |
| **`git status --short` (líneas)** | `199` *(198 previas + 1 informe enmienda)* | **`199`** (`90` rastreados modificados + `109` *untracked*) | **`200`** (`90` rastreados modificados + `110` *untracked*: **`+1` = `?? LEGAL-P0-V1.2.1-CLOSURE-AUDIT-001.md`**) |
| **`git diff --stat`** | `91` líneas (`90` archivos rastreados) | **`91` líneas** (`90 files changed, 13131 insertions(+), 5661 deletions(-)`) | **`91` líneas** *(idéntico; `0` archivos rastreados modificados)* |
| **`git diff --check`** | `3` líneas *(preexistentes)* | **`3` líneas** (`backend/src/ia/ia.service.ts:101` trailing whitespace + `docs/audits/ABOGADOS-LAW-GIT-BASELINE-CLEANUP-001.md:317` EOF) | **`3` líneas** *(idéntico; `0` incidencias nuevas)* |
| **Archivos en staging (`git add`)** | `0` | `0` | `0` |
| **Stashes (`git stash list`)** | N/A | `0` | `0` |
| **Commits / pushes ejecutados** | `0` | `0` | `0` |

**Conciliación con el estado declarado:** los números verificados al inicio de la auditoría (`199` líneas en `git status --short`, `90` archivos rastreados modificados, `109` sin seguimiento = `108` previos + `LEGAL-P0-DOCUMENTARY-AMENDMENT-001.md`, `0` staged, HEAD inalterado) coinciden exactamente con los informados en `LEGAL-P0-DOCUMENTARY-AMENDMENT-001.md` §9. *(Ver §9 de este informe respecto de la limitación probatoria específica de los archivos `untracked`.)*

---

## 4. Método de auditoría

1. **Inspección inicial READ-ONLY de Git y filesystem:** verificación directa de `branch`, `HEAD`, `git status --short`, `git diff --stat`, `git diff --check`, `git diff --cached`, `git stash list`, `git log --all --oneline -- <archivo>` para cada uno de los 10 documentos relevantes y escaneo de timestamps (`mtime`) en todo el repositorio (excluyendo `.git` y `node_modules`) para comprobar si algún archivo fuera de alcance fue escrito después de las `19:00:00` del `2026-11-25`.
2. **Lectura íntegra directa de los 9 documentos auditados + documentos de referencia:** lectura directa en disco de los 9 archivos exigidos en §3, más lectura directa de [LEGAL-AI-CREDITS-SPEC-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-AI-CREDITS-SPEC-001.md) y del artefacto de auditoría origen [LEGAL-P0-FINAL-BASELINE-AUDIT-001.md](file:///C:/Users/ruben/.gemini/antigravity/brain/a3b97937-dce7-4bbe-a892-5428f38335b8/LEGAL-P0-FINAL-BASELINE-AUDIT-001.md), sin asumir como verdaderas las afirmaciones del informe de enmienda.
3. **Contraste sistemático contra §4.2, §4.3, §5 (`P0-FBA-001..008`) y §6 (12 controles adicionales):** ejecución de verificaciones deterministas sobre texto efectivo (regex, comparación exacta de definiciones de enums, presencia de columnas, dependencias Mermaid/tablas, citas TDS y verificación de cabeceras) complementada con revisión manual línea por línea.
4. **Regla absoluta aplicada:** ante cada defecto u observación detectada se registró el hallazgo correspondiente sin modificar ningún documento auditado.

---

## 5. Documentos inspeccionados y versiones encontradas

| # | Documento | Estado Git | Versión declarada | Líneas / Bytes | Última escritura (`mtime`) | Aprobación / Implementación |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| 1 | [LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md) | `??` *(0 commits)* | `v1.0.1` *(alineada `v1.2.1`)* | `264` / `44.924 B` | `2026-11-25 22:02:43` | `PENDIENTE` / `NO AUTORIZADA` |
| 2 | [LEGAL-P0-A-EXECUTION-REPORT-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-P0-A-EXECUTION-REPORT-001.md) | `??` *(0 commits)* | `v1.0.1` *(alineada `v1.2.1`)* | `126` / `16.021 B` | `2026-11-25 22:02:43` | P0-B `NO AUTORIZADA` |
| 3 | [LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md) | `??` *(0 commits)* | `v1.0.1` *(alineada `v1.2.1`)* | `140` / `25.975 B` | `2026-11-25 22:02:43` | `PENDIENTE` / `NO AUTORIZADA` |
| 4 | [LEGAL-AI-JURISPRUDENCE-SPEC-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-AI-JURISPRUDENCE-SPEC-001.md) | `??` *(0 commits)* | `v1.2.1` | `179` / `17.531 B` | `2026-11-25 22:02:42` | `PENDIENTE` / `NO AUTORIZADA` |
| 5 | [LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md) | `??` *(0 commits)* | `v1.2.1` | `127` / `14.215 B` | `2026-11-25 22:02:43` | `PENDIENTE` / `NO AUTORIZADA` |
| 6 | [LEGAL-AI-NORMATIVE-SPEC-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-AI-NORMATIVE-SPEC-001.md) | `??` *(0 commits)* | `v1.2.1` | `142` / `16.894 B` | `2026-11-25 22:02:42` | `PENDIENTE` / `NO AUTORIZADA` |
| 7 | [LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md) | `??` *(0 commits)* | `v1.2.1` | `182` / `25.312 B` | `2026-11-25 22:02:43` | `PENDIENTE` / `NO AUTORIZADA` |
| 8 | [LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001.md) | `??` *(0 commits)* | `v1.2.1` | `196` / `23.998 B` | `2026-11-25 22:02:42` | `PENDIENTE` / `NO AUTORIZADA` |
| 9 | [LEGAL-P0-DOCUMENTARY-AMENDMENT-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-P0-DOCUMENTARY-AMENDMENT-001.md) | `??` *(0 commits)* | Informe enmienda `v1.2.1` | `167` / `23.372 B` | `2026-11-25 22:02:36` | Declara NO aprobado / NO autorizada |
| Ref. | [LEGAL-AI-CREDITS-SPEC-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/LEGAL-AI-CREDITS-SPEC-001.md) *(fuera de alcance §4)* | `??` *(0 commits)* | **`v1.2.0`** *(intacto)* | `163` / `16.665 B` | `2026-11-25 18:28:32` | `PENDIENTE` / `NO AUTORIZADA` |

**Verificación de versiones (§4.3):**
- Los 5 documentos de arquitectura, jurisprudencia, normativa, ADR y roadmap están en **`v1.2.1`**.
- Los 3 documentos `LEGAL-P0-*` están en **`v1.0.1`**, alineados con `v1.2.1`.
- `LEGAL-AI-CREDITS-SPEC-001.md` permanece intacto en **`v1.2.0`** (mismas `163` líneas, `16.665 B` y `mtime = 18:28:32` registrados en `LEGAL-P0-FINAL-BASELINE-AUDIT-001.md` §2). Ver observación `P0-V121-AUD-005` sobre su etiqueta saliente de relacionados.
- Los 5 documentos `LEGAL-EXTERNAL-ASSISTANTS-*` permanecen intactos (`mtime = 18:03:35–18:03:36`).

---

## 6. Tabla de verificación de los ocho hallazgos (`P0-FBA-001` a `P0-FBA-008`)

| Hallazgo | Severidad original | Resultado de auditoría | Evidencia verificada en disco | Observaciones residuales |
| :--- | :---: | :---: | :--- | :--- |
| **`P0-FBA-001`** | `HIGH` | **VERIFICADO / RESUELTO** | 7 planos separados en tabla dedicada (§1.1 de `Source Matrix` L40–58); 4 categorías adoptadas (§1 L30–38); `BLOQUEADA_POR_RESTRICCION_LEGAL` restringida a prohibición concreta y verificada (L37); `0` fuentes clasificadas como legalmente prohibidas por `robots.txt`; CSJN Buscador (`L120`), SAIJ web (`L155`) y JURISTECA (`L206`) en `RESTRINGIDA_POR_ROBOTS_TXT` / `SOLO_REFERENCIA_EXTERNA`; principio de que ausencia de `robots.txt` no implica licencia comercial (L27); coherente en `P0-A Report` (§4 L71–76, §6 L98) y `Decisions Matrix` (§1.2 L46). | Ninguna bloqueante. |
| **`P0-FBA-002`** | `MEDIUM` | **VERIFICADO / RESUELTO** | `LEGAL-AI-NORMATIVE-SPEC-001.md` establece exactamente `ORIGINAL`, `UPDATED` y `CONSOLIDATED` (§3.2 L74–75, §4.2 L99, §5 L115–117) con definiciones inequívocas y regla expresa de **nunca etiquetar como `CONSOLIDATED` formal un texto meramente actualizado por el sistema** (L75, L99, L117). | Ninguna. |
| **`P0-FBA-003`** | `MEDIUM` | **VERIFICADO / RESUELTO** | Exactamente los 7 valores (`FULL_SENTENCE`, `PARTIAL_TEXT`, `OFFICIAL_SUMMARY`, `REVIEW`, `METADATA_ONLY`, `EXTERNAL_REF_ONLY`, `UNAVAILABLE`) con nombres y definiciones funcionales **100% idénticas carácter por carácter** en `LEGAL-AI-JURISPRUDENCE-SPEC-001.md` (§5.1 L129–137) y `LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md` (§2 ADR-03 L95–102); `0` expresiones con barras ni sinónimos `EXCERPT` en los 8 documentos. | Ver observación menor `P0-V121-AUD-006` (`contentKind` vs `JurisprudenceContentKind` en tabla TDS de `Decisions Matrix`). |
| **`P0-FBA-004`** | `MEDIUM` | **VERIFICADO / RESUELTO** | Cuarentena técnica fail-closed de `backend/scripts/ingest-legal-norms.ts` fijada como **primer paso técnico obligatorio de `P0-B`** con las 6 condiciones completas en `Normative` (§2.2 L45–53, `DEC-NORM-03` L142) y `Roadmap` (§5 L119), y alineada en `Decisions Matrix` (§1.1 L33, §1.2 L49, §2 L81, §3.1 L111, `TDS-P0-020` L136), `Architecture` (§2.2 L65, §7.1 L180) y `ADR` (§1 L36). | Ver observación menor `P0-V121-AUD-002` (mención histórica «hasta `P0-E`» en `P0-A Report` §2.3 L52). |
| **`P0-FBA-005`** | `MEDIUM` | **VERIFICADO / RESUELTO** | Todas las decisiones ejecutivas en `Decisions Matrix` (§1.2 L40–56) contienen los 7 campos obligatorios sin inventar responsables (`Propietario del proyecto` / `PENDIENTE_DE_ASIGNACIÓN`); `DEC-P0-BUDGET-01` sincronizada en `Decisions Matrix` (L56, L72), `Architecture` (§7.2 L196) y `Roadmap` (§7 L182), aclarando explícitamente que aplica a servicios/infraestructura pagos y **no convierte en obligación de gasto** el almacenamiento local sin costo adicional (`KNOWLEDGE_STORAGE_ROOT`). | Ninguna. |
| **`P0-FBA-006`** | `MEDIUM` | **VERIFICADO / RESUELTO** | `F1` técnico desacoplado de `P0-B` en `Roadmap` (§2 Mermaid L48/L65–66, §3 L86/L94, §5 L128), `Decisions Matrix` (§2 L89) y `Architecture` (§7.1 L182); predecesor técnico fijado en **AUTH-04** mencionando los 5 elementos (`ScopedPrismaService`, RLS habilitado/forzado, aislamiento por organización, permisos de lectura y `abogados_app_user`); aclarado explícitamente que la independencia técnica **no autoriza implementar `F1`**. Pre-gate técnico y jurídico del `ZIP` oficial de InfoLEG incorporado en `Decisions Matrix` (§2 L84), `Roadmap` (§2 L53, §3 L89, §5 L123) y `Normative` (§4.1 L89). | Ver observación menor `P0-V121-AUD-003` (redacción residual «en `P0-E`» en `Source Matrix` L140 y `P0-A Report` L81). |
| **`P0-FBA-007`** | `MEDIUM` | **VERIFICADO / RESUELTO** | Exit Gate TDS de `P0-B` definido como **100% offline con fixtures locales y mocks** (sin Internet, sin scraping y sin fuentes reales) en `Decisions Matrix` (§3.1 L101–113) y `Roadmap` (§6.1 L139–148), cubriendo exactamente `TDS-P0-001..006`, `TDS-P0-008` excluyendo `normaCitada`, `TDS-P0-009..011`, `TDS-P0-015` con mocks anti-SSRF/MIME/tamaño, `TDS-P0-016..019` + cuarentena offline del script; pruebas reales e inter-fuente diferidas a `P0-C..P0-F`; política RED → GREEN preservada (`Decisions Matrix` L99, `Roadmap` L135/L140). | Ver observación menor `P0-V121-AUD-006` (formato de celda `Fase` en filas `TDS-P0-006`, `009`, `017`). |
| **`P0-FBA-008`** | `LOW` | **VERIFICADO / RESUELTO** | Versión explícita (`v1.0.1`) e historial de 5 columnas (`Versión`, `Fecha`, `Modificación`, `Motivo`, `Hallazgos relacionados`) incorporados en `P0-A Report` (L8, L15–19), `Decisions Matrix` (L8, L14–18) y `Source Matrix` (L9, L14–18), registrando `v1.0.0` (`2026-11-25`) como primer estado verificable con aclaración de historial previo no reconstruido y 0 fechas/versiones inventadas. | Ver observación menor `P0-V121-AUD-004` (4 columnas preexistentes en las 5 especificaciones `LEGAL-AI-*`/`ADR`). |

---

## 7. Evidencias por documento y sección

1. **`LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md`:** Cabecera L6–12 (`v1.0.1`), Historial L14–19 (5 columnas), §1 principios y estados L25–38, §1.1 matriz de 7 planos L40–58, fichas reclasificadas §3.2 L119–120 (`SRC-AR-CSJN-TFN-BUSC`), §3.5 L155 (`SRC-AR-SAIJ-WEB`), §3.9 L205–206 (`SRC-CABA-JURISTECA`), matriz cobertura §4 L250–263. *(Punto menor detectado: §3.4 L140 mantiene «en `P0-E`» para el `ZIP` de InfoLEG → `P0-V121-AUD-003`.)*
2. **`LEGAL-P0-A-EXECUTION-REPORT-001.md`:** Cabecera L6–13 (`v1.0.1`), Historial L15–19 (5 columnas), §4 L71–76 (`RESTRINGIDA_POR_ROBOTS_TXT`), §5 L88–92, §6 L98, §7 L109–111. *(Puntos menores detectados: §2.3 L52 dice «hasta `P0-E`» para `ingest-legal-norms.ts` → `P0-V121-AUD-002`; §4 L81 dice «en `P0-E`» para el `ZIP` → `P0-V121-AUD-003`.)*
3. **`LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md`:** Cabecera L6–12 (`v1.0.1`), Historial L14–18 (5 columnas), §1.1 L26–34 (`DEC-P0-NORM-QUAR` en `P0-B`), §1.2 L36–72 (7 columnas completas + matriz de impacto + `DEC-P0-BUDGET-01`), §2 L78–93 (`P0-E` pre-gate ZIP InfoLEG; `F1 técnico` → `AUTH-04`), §3.1 L101–113 (Exit Gate offline `P0-B`), tabla TDS L115–139. *(Punto menor detectado: uso de `contentKind` y etiquetas `Fase` en `TDS-P0-006/009/017` → `P0-V121-AUD-006`.)*
4. **`LEGAL-AI-JURISPRUDENCE-SPEC-001.md`:** Cabecera L6–14 (`v1.2.1`), Historial L16–22, §4.2 recuadro L108–110, §5.1 L129–137 (7 valores canónicos `JurisprudenceContentKind`).
5. **`LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md`:** Cabecera L6–14 (`v1.2.1`), Historial L16–22, §1 L36 (cuarentena primer paso `P0-B`), §2 ADR-02 L65 (`robots.txt` vs planos jurídicos), §2 ADR-03 L95–102 (7 valores canónicos idénticos al Spec), §3.2 L126 (`KNOWLEDGE_STORAGE_ROOT` local sin gasto bajo `DEC-P0-BUDGET-01`).
6. **`LEGAL-AI-NORMATIVE-SPEC-001.md`:** Cabecera L6–14 (`v1.2.1`), Historial L16–22, §2.2 L45–53 (cuarentena primer paso `P0-B` con 6 condiciones), §3.2 L71–77 (`ORIGINAL | UPDATED | CONSOLIDATED` + regla de no confusión), §4.1 L89 (pre-gate `ZIP` InfoLEG), §4.2 L99, §5 L115–117, §7 L142 (`DEC-NORM-03`).
7. **`LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md`:** Cabecera L6–15 (`v1.2.1`), Historial L17–23, §2 Mermaid L48–66 (`AUTH04 --> FF1`, sin `P0B --> FF1`), §3 L83–94, §5 L118–128, §6.1 L137–157 (Exit Gate offline `P0-B`), §7 L171–182 (`DEC-P0-BUDGET-01`).
8. **`LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001.md`:** Cabecera L6–16 (`v1.2.1`), Historial L18–24, §2.2 L65 (cuarentena `P0-B`), §7.1 L174–182, §7.2 L184–196 (`DEC-P0-BUDGET-01`, `DEC-P0-LEGAL-01`).
9. **`LEGAL-P0-DOCUMENTARY-AMENDMENT-001.md`:** Secciones §1–§13 verificadas contra el contenido real de los 8 archivos. Las afirmaciones de contenido en §3–§8 y §11–§13 coinciden con los documentos en disco; en §9–§10 se observa que no explicita la limitación probatoria de archivos *untracked* (`P0-V121-AUD-001`).

---

## 8. Comparación con versiones anteriores (evidencia disponible)

- **Disponibilidad dentro del repositorio Git:** **NO EXISTE versión anterior recuperable en Git** (`0` commits, `0` stashes, todos *untracked* `??`).
- **Evidencia parcial externa verificable (`LEGAL-P0-FINAL-BASELINE-AUDIT-001.md`):** el informe de auditoría previo conservado fuera del repositorio en `<appDataDir>/brain/a3b97937-dce7-4bbe-a892-5428f38335b8/LEGAL-P0-FINAL-BASELINE-AUDIT-001.md` (§2 L34–44 y §5 L73–158) registró las métricas cuantitativas exactas de `v1.2.0` (`2026-11-25 18:26–18:28`) y citas textuales literales de los defectos originales, permitiendo verificar la siguiente evolución cuantitativa y puntual:

| Documento | `v1.2.0` / `v1.0.0` *(registrado en auditoría previa)* | `v1.2.1` / `v1.0.1` *(actual en disco)* | Delta líneas / bytes | Estado probatorio VCS |
| :--- | :---: | :---: | :---: | :--- |
| `LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md` | `225` L / `33.959 B` (`18:26:57`) | `264` L / `44.924 B` (`22:02:43`) | `+39` L / `+10.965 B` | `BASELINE_ANTERIOR_NO_VERIFICABLE` *(en Git)* |
| `LEGAL-P0-A-EXECUTION-REPORT-001.md` | `118` L / `13.698 B` (`18:26:57`) | `126` L / `16.021 B` (`22:02:43`) | `+8` L / `+2.323 B` | `BASELINE_ANTERIOR_NO_VERIFICABLE` *(en Git)* |
| `LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md` | `99` L / `15.007 B` (`18:26:57`) | `140` L / `25.975 B` (`22:02:43`) | `+41` L / `+10.968 B` | `BASELINE_ANTERIOR_NO_VERIFICABLE` *(en Git)* |
| `LEGAL-AI-JURISPRUDENCE-SPEC-001.md` | `176` L / `16.074 B` (`18:28:32`) | `179` L / `17.531 B` (`22:02:42`) | `+3` L / `+1.457 B` | `BASELINE_ANTERIOR_NO_VERIFICABLE` *(en Git)* |
| `LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md` | `117` L / `12.216 B` (`18:28:33`) | `127` L / `14.215 B` (`22:02:43`) | `+10` L / `+1.999 B` | `BASELINE_ANTERIOR_NO_VERIFICABLE` *(en Git)* |
| `LEGAL-AI-NORMATIVE-SPEC-001.md` | `134` L / `14.090 B` (`18:28:32`) | `142` L / `16.894 B` (`22:02:42`) | `+8` L / `+2.804 B` | `BASELINE_ANTERIOR_NO_VERIFICABLE` *(en Git)* |
| `LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md` | `162` L / `19.126 B` (`18:28:33`) | `182` L / `25.312 B` (`22:02:43`) | `+20` L / `+6.186 B` | `BASELINE_ANTERIOR_NO_VERIFICABLE` *(en Git)* |
| `LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001.md` | `193` L / `22.045 B` (`18:28:33`) | `196` L / `23.998 B` (`22:02:42`) | `+3` L / `+1.953 B` | `BASELINE_ANTERIOR_NO_VERIFICABLE` *(en Git)* |
| `LEGAL-AI-CREDITS-SPEC-001.md` *(fuera de alcance)* | `163` L / `16.665 B` (`18:28:32`) | `163` L / `16.665 B` (`18:28:32`) | **`0` L / `0 B`** | Intacto por tamaño y `mtime` *(untracked en Git)* |

---

## 9. Resultado específico de la auditoría de archivos *untracked* (§4.2)

1. **Estado verificado:** los 8 documentos enmendados, `LEGAL-P0-DOCUMENTARY-AMENDMENT-001.md`, `LEGAL-AI-CREDITS-SPEC-001.md` y los 5 `LEGAL-EXTERNAL-ASSISTANTS-*` figuran todos como `??` (*untracked*) con `0` commits en Git.
2. **Clasificación obligatoria:** para los 8 documentos modificados se registra **`BASELINE_ANTERIOR_NO_VERIFICABLE`** a nivel del repositorio Git. Un `git diff --stat` idéntico (`91` líneas sobre `90` archivos rastreados) demuestra únicamente que no se modificaron archivos rastreados, pero **no puede demostrar por sí solo** qué contenido cambió dentro de los 8 archivos *untracked* ni garantizar criptográficamente desde Git la preservación íntegra de sus secciones no tocadas.
3. **Verificación complementaria de alcance en filesystem:** el barrido completo de `mtime` en el árbol de trabajo (excluyendo `.git` y `node_modules`) muestra que **exactamente 9 archivos** fueron escritos después de `2026-11-25 19:00:00`: los 8 documentos autorizados (`22:02:42–22:02:43`) y el entregable adicional `LEGAL-P0-DOCUMENTARY-AMENDMENT-001.md` (`22:02:36`). Ningún otro archivo rastreado ni *untracked* (incluyendo `LEGAL-AI-CREDITS-SPEC-001.md`, los 5 `LEGAL-EXTERNAL-ASSISTANTS-*`, código fuente, `schema.prisma`, `ingest-legal-norms.ts`, `.env`, `package.json` ni tests) presenta escritura posterior a `19:00:00`.
4. **Conclusión §4.2:** el informe de enmienda `LEGAL-P0-DOCUMENTARY-AMENDMENT-001.md` es un entregable adicional que no alteró otros archivos preexistentes, pero la falta de control de versiones Git sobre los 8 documentos *untracked* queda registrada como hallazgo `P0-V121-AUD-001` (`MEDIUM`).

---

## 10. Consistencia cruzada y controles adicionales (§6)

| # | Control de coherencia (§6) | Estado | Evidencia verificada |
| :---: | :--- | :---: | :--- |
| **1** | `P0-B` sigue dependiendo de `P0-A` y decisiones ejecutivas | **CONFORME** | `Roadmap` §3 L86, `Decisions Matrix` §2 L81 |
| **2** | `DEC-IMPL-P0B`, `DEC-ADR-01-EXEC`, `DEC-ADR-02`, `DEC-ADR-03` siguen `PENDIENTE` | **CONFORME** | `Decisions Matrix` §1.2 L42–45 (todas marcadas `` `PENDIENTE` ``) |
| **3** | Creación física del rol worker no se confunde con diseño ya cerrado | **CONFORME** | `ADR` §2 ADR-02 L68–71 y §3.1 L121 (Planos A cerrado / B `DEC-ADR-01-EXEC` pendiente / C `P0-B`) |
| **4** | El worker conserva mínimo privilegio | **CONFORME** | `ADR` §2 ADR-02 L53–62 (`PROHIBIDO SUPERUSER/BYPASSRLS/CREATEROLE/CREATEDB/DDL/acceso multi-tenant`, 0 rutas HTTP públicas) |
| **5** | Runtime `abogados_app_user` conserva restricciones (`SELECT`-only Cat. C) | **CONFORME** | `ADR` §2 ADR-02 L50, `Architecture` §3 L90 y §7.1 L177 |
| **6** | Bibliotecas globales (Cat. C) y datos privados (RLS `FORCE`) mantienen separación | **CONFORME** | `ADR` §2 ADR-01 L44–47, `Architecture` §4 L138–140 |
| **7** | FTS español obligatorio y `pgvector` opcional | **CONFORME** | `ADR` §2 ADR-04 L106–108, `Architecture` §6 L163–165 |
| **8** | Sin fallback `listAll()` ni embeddings sintéticos `Math.random()` | **CONFORME** | `Architecture` §6 L164, `ADR` §2 ADR-04 L107, `Decisions Matrix` §1.1 L34 y `TDS-P0-010` L126 |
| **9** | Prohibición inequívoca de ejecutar `ingest-legal-norms.ts` | **CONFORME** | `Normative` §2.2 L47–53 (6 condiciones obligatorias como primer paso técnico de `P0-B`) |
| **10** | Sin nuevas dependencias de proveedores, servicios pagos o fuentes externas | **CONFORME** | `DEC-P0-BUDGET-01` explicita no obligación de gasto para storage local; `P0-B` 100% offline |
| **11** | Secuencia y dependencias `P0-C` a `P0-I` preservadas | **CONFORME** | `Roadmap` §2 L46–77 y §3 L87–93; `Decisions Matrix` §2 L82–88 |
| **12** | Reglas económicas de `LEGAL-AI-CREDITS-SPEC-001.md` no modificadas indirectamente | **CONFORME** | `LEGAL-AI-CREDITS-SPEC-001.md` intacto (`v1.2.0`, `16.665 B`, `1 crédito = 10.000 microCredits`, `0,4 = 4.000`) |

---

## 11. Hallazgos nuevos detectados en esta auditoría

### `P0-V121-AUD-001` — Limitación probatoria VCS por estado *untracked* de los 8 documentos enmendados (`BASELINE_ANTERIOR_NO_VERIFICABLE`)
- **Severidad:** **`MEDIUM`**
- **Documento y sección:** Los 8 documentos enmendados (`??`, `0` commits) y `LEGAL-P0-DOCUMENTARY-AMENDMENT-001.md` (§9 L125–126, §10 L134–136).
- **Evidencia concreta:** `git log --all --oneline` devuelve `0` commits para los 8 archivos y `git status --short` los lista como `??`. `LEGAL-P0-DOCUMENTARY-AMENDMENT-001.md` §9–§10 afirma la preservación íntegra de los 198 elementos previos apoyándose en `git diff --stat` sin señalar que Git no registra diferencias sobre archivos *untracked*.
- **Descripción del defecto:** No existe una copia completa versionada de `v1.2.0` en el repositorio Git que permita producir un diff integral línea por línea contra `v1.2.1` (solo se cuenta con el contenido actual verificable en disco, los deltas de líneas/bytes y citas literales del artefacto `LEGAL-P0-FINAL-BASELINE-AUDIT-001.md` y el barrido de `mtime`).
- **Impacto:** Gobernanza y auditabilidad del baseline: el propietario revisa el texto final vigente de `v1.2.1` pero sin un diff nativo de Git contra `v1.2.0`.
- **Corrección requerida:** Aceptar expresamente la limitación probatoria histórica de `v1.2.0` basada en el estado *untracked* actual y, una vez aprobado formalmente el baseline `v1.2.1`, versionar los documentos aprobados bajo control de versiones en un commit autorizado por el propietario antes de iniciar fases de implementación.
- **Fase en la que debe resolverse:** Aprobación formal del baseline / gestión de configuración previa a `P0-B`.

### `P0-V121-AUD-002` — Referencia histórica potencialmente ambigua sobre la cuarentena de `ingest-legal-norms.ts` en `LEGAL-P0-A-EXECUTION-REPORT-001.md`
- **Severidad:** **`LOW`**
- **Documento y sección:** `LEGAL-P0-A-EXECUTION-REPORT-001.md` (§2.3 L52).
- **Evidencia concreta:** L52 dice: ``- `backend/scripts/ingest-legal-norms.ts`: **0 cambios y NO ejecutado** (en cuarentena documentada hasta `P0-E`).`` En cambio, §5 L91 del mismo documento aclara que `v1.2.1` trasladó la cuarentena fail-closed al primer paso técnico de `P0-B`.
- **Descripción del defecto:** En el registro histórico de §2.3 faltó una nota breve entre paréntesis remitiendo al adelanto a `P0-B` resuelto en `v1.2.1`, pudiendo parecer una contradicción si se lee L52 fuera de contexto.
- **Impacto:** Bajo; los 5 documentos normativos/técnicos y §5 del mismo informe son inequívocos respecto del primer paso técnico de `P0-B`.
- **Corrección requerida:** Aceptar expresamente como registro histórico de `P0-A` o añadir acotación *(enmendado en `v1.2.1` al primer paso técnico de `P0-B`)* si se realiza una revisión menor posterior.
- **Fase en la que debe resolverse:** Aceptable expresamente al aprobar `v1.2.1` (no bloqueante).

### `P0-V121-AUD-003` — Redacción residual «en `P0-E`» para la verificación del `ZIP` de InfoLEG en dos pasajes de registros P0-A
- **Severidad:** **`LOW`**
- **Documento y sección:** `LEGAL-P0-SOURCE-VALIDATION-MATRIX-001.md` (§3.4 L140) y `LEGAL-P0-A-EXECUTION-REPORT-001.md` (§4 L81).
- **Evidencia concreta:** `Source Matrix` L140: *"verificación de si el `ZIP` incluye textos legales completos: `PENDIENTE_DE_VERIFICACION` (en `P0-E`)."* `P0-A Report` L81: *"verificar el contenido textual del paquete `ZIP` oficial en `P0-E`."* En cambio, `Decisions Matrix` §2 L84, `Roadmap` §3 L89 / §5 L123 y `Normative` §4.1 L89 lo definen explícitamente como **pre-gate obligatorio previo a `P0-E`**.
- **Descripción del defecto:** Dos menciones secundarias heredadas de `v1.0.0` no se ajustaron de «en `P0-E`» a «pre-gate previo a `P0-E`».
- **Impacto:** Bajo; los documentos vinculantes de secuencia y normativa (`Roadmap`, `Decisions Matrix` y `Normative Spec`) establecen sin ambigüedad el pre-gate previo a la ingesta de `P0-E`.
- **Corrección requerida:** Aceptar expresamente priorizando la regla del Roadmap/Matriz de Decisiones, o ajustar ambas menciones antes de autorizar `P0-E`.
- **Fase en la que debe resolverse:** Previo a autorización de `P0-E` (aceptable expresamente al aprobar `v1.2.1`).

### `P0-V121-AUD-004` — Diferencia formal de columnas en `Historial de versiones` entre registros P0-A (5 columnas) y especificaciones `LEGAL-AI-*`/`ADR` (4 columnas)
- **Severidad:** **`LOW`**
- **Documento y sección:** `LEGAL-AI-JURISPRUDENCE-SPEC-001.md` (L17), `LEGAL-KNOWLEDGE-LIBRARIES-ADR-001.md` (L17), `LEGAL-AI-NORMATIVE-SPEC-001.md` (L17), `LEGAL-AI-RESEARCH-IMPLEMENTATION-ROADMAP-001.md` (L18), `LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001.md` (L19).
- **Evidencia concreta:** Los 3 documentos `LEGAL-P0-*` utilizan 5 columnas (`Versión | Fecha | Modificación | Motivo | Hallazgos relacionados`), mientras las 5 especificaciones conservan su formato previo de 4 columnas (`Versión | Fecha | Expediente | Resumen de cambios`), integrando motivo y hallazgos dentro del resumen.
- **Descripción del defecto:** Falta de uniformidad de encabezado de tabla entre ambos grupos documentales, sin omisión de datos ni fechas inventadas.
- **Impacto:** Muy bajo (puramente estilístico).
- **Corrección requerida:** Ninguna obligatoria; aceptable expresamente o homogeneizable en una futura versión mayor.
- **Fase en la que debe resolverse:** Aceptable expresamente al aprobar `v1.2.1`.

### `P0-V121-AUD-005` — Etiqueta saliente `v1.2.0` en la cabecera de `LEGAL-AI-CREDITS-SPEC-001.md` (archivo fuera de alcance)
- **Severidad:** **`LOW`**
- **Documento y sección:** `LEGAL-AI-CREDITS-SPEC-001.md` (cabecera L13).
- **Evidencia concreta:** L13 mantiene `| **Documentos relacionados (v1.2.0)** |`, porque `LEGAL-AI-CREDITS-SPEC-001.md` quedó excluido del alcance de §4 de la enmienda y se preservó intacto en `v1.2.0`.
- **Descripción del defecto:** Asimetría menor en la etiqueta de versión de los enlaces salientes desde `Credits` hacia los 5 documentos en `v1.2.1` (los 5 documentos `v1.2.1` sí referencian correctamente a `Credits` como `v1.2.0, sin cambios`).
- **Impacto:** Muy bajo; 0 impacto funcional o económico.
- **Corrección requerida:** Reconocer en el acta de aprobación que el paquete vigente se compone de 5 especificaciones `v1.2.1` + `LEGAL-AI-CREDITS-SPEC-001.md` `v1.2.0` + 3 registros `LEGAL-P0-*` `v1.0.1`.
- **Fase en la que debe resolverse:** Aceptable expresamente al aprobar el baseline.

### `P0-V121-AUD-006` — Referencia abreviada al campo `contentKind` y nivel de detalle en 3 filas de la tabla TDS en `LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md`
- **Severidad:** **`LOW`**
- **Documento y sección:** `LEGAL-P0-DECISIONS-DEPENDENCIES-MATRIX-001.md` (§3.1 L106, tabla TDS L122 `TDS-P0-006`, L125 `TDS-P0-009`, L128 `TDS-P0-012`, L133 `TDS-P0-017`).
- **Evidencia concreta:** En L106, L122 y L128 se utiliza el nombre de campo `contentKind` sin añadir explícitamente el tipo enum `JurisprudenceContentKind` (sí usado en `Roadmap` §6.1 L141/L151, `Jurisprudence` §5.1 y `ADR` §2 ADR-03). Asimismo, en la columna `Fase` de la tabla TDS, las filas `TDS-P0-006` (`P0-B/P0-C`), `TDS-P0-009` (`P0-B/P0-F`) y `TDS-P0-017` (`P0-B/P0-F`) no repiten el paréntesis *(offline)* que sí aparece en `TDS-P0-001`, `002`, `008` y `015`, aunque §3.1 inmediatamente arriba deslinda claramente el alcance offline de `P0-B`.
- **Descripción del defecto:** Menor asimetría de redacción en la tabla resumen TDS respecto del encabezado normativo §3.1 y del Roadmap §6.1.
- **Impacto:** Bajo; no genera ambigüedad ejecutable ni contradice los 7 valores del enum ni el Exit Gate offline.
- **Corrección requerida:** Usar `JurisprudenceContentKind` (campo `contentKind`) y el deslinde explícito de §3.1 al redactar la autorización de `P0-B` y sus tests RED.
- **Fase en la que debe resolverse:** Aceptable expresamente al aprobar `v1.2.1` (aplicable al preparar `P0-B`).

---

## 12. Limitaciones de evidencia

1. **Ausencia de snapshots `v1.2.0` en Git (`BASELINE_ANTERIOR_NO_VERIFICABLE` en VCS):** al no haber sido commiteados nunca en Git los documentos del paquete `v1.2.0`, la auditoría no pudo ejecutar un `git diff` contra la versión anterior; la verificación comparativa se apoyó en el contenido efectivo vigente en disco, en las métricas y citas textuales conservadas en `LEGAL-P0-FINAL-BASELINE-AUDIT-001.md` y en el barrido de `mtime` del filesystem.
2. **Elementos técnicos y jurídicos externos pendientes de etapas posteriores (`P0-FBA-009` y planos 2–7):** siguen debidamente marcados como `PENDIENTE_DE_VERIFICACION` / `PENDIENTE_DE_DEFINICIÓN` / `PENDIENTE_DE_ASIGNACIÓN` la URL exacta del buscador interno de TSJ CABA, la paginación/descarga PDF interna de TFN, el contenido del `ZIP` oficial de InfoLEG (`datos.jus.gob.ar`) y los planos jurídicos de fuentes sin licencia abierta explícita. No fueron verificados ni inferidos en esta auditoría READ-ONLY.

---

## 13. Matriz de riesgos pendientes

| Riesgo | Severidad | Fases afectadas | Estado / Mitigación prevista |
| :--- | :---: | :---: | :--- |
| Documentación del baseline aún *untracked* en Git sin snapshot inmutable de aprobación (`P0-V121-AUD-001`) | `MEDIUM` | Pre-`P0-B` | Commitear el paquete documental aprobado en un commit dedicado cuando el propietario autorice gestión Git. |
| 4 decisiones ejecutivas requeridas antes de iniciar `P0-B` (`DEC-IMPL-P0B`, `DEC-ADR-01-EXEC`, `DEC-ADR-02`, `DEC-ADR-03`) siguen `PENDIENTE` | `HIGH` *(gobierno)* | `P0-B` | Requieren firma/decisión explícita del propietario en actos separados de la aprobación documental. |
| Restricciones técnicas `RESTRINGIDA_POR_ROBOTS_TXT` (Buscador Nac./Fed. CSJN, JURISTECA, descarga web PDF SAIJ) y falta de licencia comercial verificada en fuentes `VIABLE_CON_CONDICIONES` | `HIGH` *(cobertura)* | `P0-C`, `P0-D`, `P0-E`, `P0-G` | No bloquea `P0-B`; gestionar vía `DEC-P0-LEGAL-01` (dictamen legal / canales de datos abiertos / convenios institucionales). |
| Incertidumbre sobre si el `ZIP` de InfoLEG en `datos.jus.gob.ar` contiene textos legales completos ante `HTTP 403` en `servicios.infoleg.gob.ar` | `MEDIUM` | `P0-E` | Mitigado por el pre-gate obligatorio de inspección técnica y jurídica del `ZIP` antes de iniciar `P0-E`. |
| Repositorio `master` con `90` archivos rastreados modificados y `110` *untracked* preexistentes | `MEDIUM` *(operativo)* | Implementación futura | Resolver limpieza/aislamiento de rama de trabajo antes de abrir implementación de `P0-B` o `F1`. |

---

## 14. Recomendación sobre aptitud para aprobación formal

**Dictamen:** **`APTO_CON_OBSERVACIONES`**

**Recomendación al propietario:**
1. **El baseline documental `v1.2.1`** (compuesto por las 5 especificaciones `v1.2.1`, los 3 registros `LEGAL-P0-*` `v1.0.1` y `LEGAL-AI-CREDITS-SPEC-001.md` `v1.2.0`) **está técnicamente y jurídicamente maduro para ser presentado al propietario para su aprobación formal**, habiéndose resuelto de forma verificable los 8 hallazgos de `LEGAL-P0-FINAL-BASELINE-AUDIT-001` y superado los 12 controles de coherencia.
2. **Tratamiento de las 6 observaciones registradas (`P0-V121-AUD-001` a `P0-V121-AUD-006`):**
   - **Ninguna observación es bloqueante (`0 CRITICAL`, `0 HIGH`).** Todas pueden ser **aceptadas expresamente** por el propietario en el acto de aprobación de `v1.2.1` (sin necesidad de emitir una enmienda `v1.2.2`, salvo que el propietario desee corregir previamente los 2 pasajes menores `P0-V121-AUD-002` y `P0-V121-AUD-003`).
   - Respecto de **`P0-V121-AUD-001` (`MEDIUM`)**, se recomienda que, una vez aprobado el baseline, el propietario autorice un paso controlado de versionado en Git para fijar un snapshot inmutable del baseline documental aprobado antes de iniciar cualquier código.
3. **Separación obligatoria de actos:** la eventual aprobación formal del baseline `v1.2.1` **no equivale** a autorizar `P0-B` ni `F1`. Si el propietario aprueba el baseline, deberá emitir decisiones expresas independientes para `DEC-ADR-02`, `DEC-ADR-03`, `DEC-ADR-01-EXEC` y `DEC-IMPL-P0B` (o, de optar por paralelizar el motor de créditos, una autorización específica independiente para `F1` técnico).

---

## 15. Declaración explícita sobre archivos productivos y bases de datos

Se declara expresamente que durante `LEGAL-P0-V1.2.1-CLOSURE-AUDIT-001`:
- **NO** se modificaron ninguno de los 9 documentos auditados ni `LEGAL-AI-CREDITS-SPEC-001.md` ni los 5 documentos `LEGAL-EXTERNAL-ASSISTANTS-*`.
- **NO** se modificaron ni ejecutaron archivos de código fuente productivo, configuraciones, `.env`, paquetes ni tests productivos.
- **NO** se ejecutaron scripts de ingesta (incluido `backend/scripts/ingest-legal-norms.ts`) ni se descargaron fuentes jurídicas.
- **NO** se ejecutaron migraciones Prisma ni SQL, ni se modificaron PostgreSQL, tablas, datos ni roles.
- **NO** se ejecutaron `git add`, `git commit`, `git push`, `git reset`, `git checkout`, `git restore` ni `git clean`.
- La **única incorporación** en el repositorio es este informe de auditoría: `LEGAL-P0-V1.2.1-CLOSURE-AUDIT-001.md`.

---

## 16. Declaración explícita sobre estado del baseline, `P0-B` y `F1`

Se declara expresamente que:
- **El baseline documental `v1.2.1` NO fue aprobado** en esta auditoría; queda sometido a revisión y decisión expresa del propietario.
- **`P0-B` NO fue autorizada ni iniciada.**
- **`F1` NO fue autorizada ni iniciada.**
- La auditoría se detiene aquí a la espera de la decisión expresa del propietario.

