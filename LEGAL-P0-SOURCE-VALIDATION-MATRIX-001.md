# LEGAL-P0-SOURCE-VALIDATION-MATRIX-001
## MATRIZ CONSOLIDADA DE VALIDACIÓN DE FUENTES OFICIALES (BLOQUES A Y B) Y MATRIZ DE COBERTURA

| Campo | Valor |
| :--- | :--- |
| **Expediente origen** | `LEGAL-P0-START-001` *(Fase P0-A)* |
| **Expediente de enmienda** | `LEGAL-P0-DOCUMENTARY-AMENDMENT-001` *(Micro-enmienda `v1.2.1`)* |
| **Referencia** | `LEGAL-JURISPRUDENCE-NATIONAL-COVERAGE-AUDIT-001` · `LEGAL-P0-FINAL-BASELINE-AUDIT-001` |
| **Versión** | `v1.0.1` *(alineada con baseline documental `v1.2.1`)* |
| **Fecha de validación en vivo** | `2026-11-25` |
| **Estado** | `REGISTRO DE VALIDACIÓN P0-A ENMENDADO — PENDIENTE DE REVISIÓN DEL PROPIETARIO` |
| **Implementación / Extracción masiva** | `NO AUTORIZADA` *(solo lectura puntual de validación HTTP/HEAD y revisión documental; 0 scraping masivo, 0 evasión de CAPTCHA/auth/anti-bot)* |

### Historial de versiones
| Versión | Fecha | Modificación | Motivo | Hallazgos relacionados |
| :--- | :--- | :--- | :--- | :--- |
| `v1.0.0` | `2026-11-25` | Primer estado verificable emitido en P0-A con fichas de validación técnica/jurídica de Bloques A y B, ficha CSJN Colección Fallos y matriz de cobertura *(el historial anterior no está reconstruido por no existir versiones previas verificables)*. | Registro de validación viva de fuentes en `LEGAL-P0-START-001`. | N/A *(emisión inicial P0-A)* |
| `v1.0.1` | `2026-11-25` | Separación estricta entre restricciones técnicas (`robots.txt`) y prohibiciones legales; incorporación de `RESTRINGIDA_POR_ROBOTS_TXT` y matriz de 7 planos técnico-jurídicos sin inventar licencias ni autorizaciones; incorporación de historial de versiones. | Ejecución de la micro-enmienda documental `LEGAL-P0-DOCUMENTARY-AMENDMENT-001` (alineación `v1.2.1`). | `P0-FBA-001`, `P0-FBA-008` |

---

## 1. Metodología, separación de planos y criterios de clasificación

1. El `2026-11-25` se ejecutaron solicitudes HTTP read-only unitarias (`GET`/`HEAD` no invasivas, sin crawling, sin descarga masiva y sin evadir CAPTCHA ni controles perimetrales) con agente `AbogadosLaw-P0A-Audit/1.0 (ReadOnly-Verification)` para comprobar respuestas reales, `Content-Type`, `robots.txt`, endpoints API CKAN y la descarga individual de un PDF de la Colección *Fallos* CSJN.
2. **Principio jurídico invariante:**
   - El acceso público gratuito para lectura web **NO equivale** a autorización para extracción masiva ni reutilización comercial.
   - La **ausencia de `robots.txt`** o la ausencia de directivas `Disallow` **NO implica licencia de reutilización comercial**.
   - Una directiva `Disallow` en **`robots.txt` es una restricción técnica/protocolar de acceso automatizado y NO equivale por sí sola a una prohibición legal** (aunque Abogados-Law respeta `robots.txt` por política técnica y operativa).
   - Solo se reconoce reutilización comercial autorizada cuando existe una licencia abierta verificable (ej. `CC-BY-4.0`) o autorización institucional expresa y documentada.
3. **Estados permitidos (reconciliados en `v1.0.1` — `P0-FBA-001`):**
   - **`VIABLE`**: técnicamente accesible por canal oficial estructurado y con licencia abierta verificada (ej. `CC-BY-4.0`).
   - **`VIABLE_CON_CONDICIONES`**: técnicamente accesible bajo condiciones técnicas y/o jurídicas que requieren validación o cumplimiento antes de la ingesta masiva o uso comercial.
   - **`RESTRINGIDA_POR_ROBOTS_TXT`**: el archivo `robots.txt` del dominio declara `Disallow` sobre las rutas de consulta o descarga automatizada. **No constituye por sí sola una prohibición legal**; mientras no exista autorización institucional o canal alternativo habilitado (ej. datos abiertos), solo puede considerarse como `SOLO_REFERENCIA_EXTERNA`.
   - **`SOLO_REFERENCIA_EXTERNA`**: fuente utilizable únicamente mediante enlace o referencia externa, sin extracción automatizada ni almacenamiento local del documento.
   - **`BLOQUEADA_POR_AUTENTICACION`**: requiere credenciales o acceso restringido no público.
   - **`BLOQUEADA_POR_CAPTCHA`**: protegida por CAPTCHA interactivo obligatorio (prohibida su evasión).
   - **`BLOQUEADA_POR_RESTRICCION_LEGAL`**: **se utiliza ÚNICAMENTE cuando existe una norma jurídica, licencia o cláusula prohibitiva concreta y verificada** que impide la extracción o reutilización (nunca por la sola presencia de `robots.txt`).
   - **`PENDIENTE_DE_VERIFICACION`**: elemento técnico o jurídico todavía no comprobado documentalmente.

### 1.1. Matriz de separación obligatoria en 7 planos técnico-jurídicos (Bloques A y B)

Cada fuente se evalúa distinguiendo explícitamente los **7 planos independientes**: (1) Restricción técnica de acceso (`robots.txt`, CAPTCHA, rate limits, WAF), (2) Condiciones de uso del sitio, (3) Licencia de reutilización, (4) Derecho de autor (Ley 11.723), (5) Protección de datos personales (Ley 25.326), (6) Restricciones contractuales y (7) Autorización institucional o convenio específico. Cuando un plano no fue comprobado documentalmente, permanece `PENDIENTE_DE_VERIFICACION` o `PENDIENTE_DE_DEFINICIÓN`.

| Fuente | 1. Restricción técnica (`robots.txt`/CAPTCHA/WAF/rate-limit) | 2. Condiciones de uso del sitio | 3. Licencia de reutilización | 4. Derecho de autor (Ley 11.723) | 5. Datos personales (Ley 25.326) | 6. Restricciones contractuales | 7. Autorización / convenio institucional | Estado clasificado (`v1.0.1`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`SRC-AR-CSJN-TOMOS-FALLOS`** | Sin `Disallow` `text/plain`, sin CAPTCHA puntual; sin API masiva; posibles rate-limits | `PENDIENTE_DE_VERIFICACION` | Sin licencia abierta explícita (`PENDIENTE_DE_VERIFICACION`) | Actos oficiales / compilación editorial (`PENDIENTE_DE_VERIFICACION`) | Pautas CSJN de disociación / Ley 25.326 (`PENDIENTE_DE_VERIFICACION`) | `PENDIENTE_DE_VERIFICACION` | No existe (`PENDIENTE_DE_DEFINICIÓN`) | **`VIABLE_CON_CONDICIONES`** |
| **`SRC-AR-CSJN-SJ`** | CSRF/JS en `sj.csjn.gov.ar`; `robots.txt` `404`/HTML; posibles rate-limits | `PENDIENTE_DE_VERIFICACION` | Sin licencia abierta explícita (`PENDIENTE_DE_VERIFICACION`) | Sumarios/sentencias (`PENDIENTE_DE_VERIFICACION`) | Pautas CSJN / Ley 25.326 (`PENDIENTE_DE_VERIFICACION`) | `PENDIENTE_DE_VERIFICACION` | No existe (`PENDIENTE_DE_DEFINICIÓN`) | **`VIABLE_CON_CONDICIONES`** |
| **`SRC-AR-CSJN-TFN-BUSC`** | **`robots.txt` declara `Disallow`** sobre `/tribunales-federales-nacionales/*` y `/adj/pdfs/` | `PENDIENTE_DE_VERIFICACION` | Sin licencia abierta explícita (`PENDIENTE_DE_VERIFICACION`) | Sentencias oficiales (`PENDIENTE_DE_VERIFICACION`) | Causas penales/sensibles + Ley 25.326 (`PENDIENTE_DE_VERIFICACION`) | `PENDIENTE_DE_VERIFICACION` | No existe (`PENDIENTE_DE_DEFINICIÓN`) | **`RESTRINGIDA_POR_ROBOTS_TXT`** *(operable como `SOLO_REFERENCIA_EXTERNA`)* |
| **`SRC-AR-PJN-SCW`** | **CAPTCHA obligatorio** y login en fueros reservados | Restricción de consulta interactiva (`PENDIENTE_DE_VERIFICACION`) | Sin licencia de extracción (`PENDIENTE_DE_VERIFICACION`) | Actuaciones judiciales (`PENDIENTE_DE_VERIFICACION`) | Alto riesgo PII de partes (Ley 25.326) | `PENDIENTE_DE_VERIFICACION` | No existe (`PENDIENTE_DE_DEFINICIÓN`) | **`BLOQUEADA_POR_CAPTCHA`** *(operable como `SOLO_REFERENCIA_EXTERNA`)* |
| **`SRC-AR-SAIJ-DATOS`** | API CKAN abierta sin CAPTCHA ni `Disallow` | Portal Datos Abiertos MJN | **`CC-BY-4.0` verificada** (atribución obligatoria) | Legislación oficial / metadatos bajo `CC-BY-4.0` | Datos normativos sin PII | Atribución `CC-BY-4.0` | No requerida bajo `CC-BY-4.0` | **`VIABLE`** *(normativa/tesauro)* |
| **`SRC-AR-SAIJ-WEB`** | **`robots.txt` declara `Disallow`** sobre `/convert-html-to-pdf`, `/descarga-archivo`, `/*resource/kbee:`, `/_pdf` | Reglamento de Uso SAIJ (`PENDIENTE_DE_VERIFICACION`) | Sin licencia CC para scraping web (`PENDIENTE_DE_VERIFICACION`) | Sumarios analíticos y compilación SAIJ (`PENDIENTE_DE_VERIFICACION`) | Ley 25.326 en fallos (`PENDIENTE_DE_VERIFICACION`) | Sujeto a Reglamento de Uso (`PENDIENTE_DE_VERIFICACION`) | No existe (`PENDIENTE_DE_DEFINICIÓN`) | **`RESTRINGIDA_POR_ROBOTS_TXT`** *(descarga web PDF; `SOLO_REFERENCIA_EXTERNA`)* |
| **`SRC-AR-PGN-MPF`** | `robots.txt` solo restringe `/wp-admin/`; sin CAPTCHA en portada | `PENDIENTE_DE_VERIFICACION` | Sin licencia CC explícita (`PENDIENTE_DE_VERIFICACION`) | Dictámenes oficiales MPF (`PENDIENTE_DE_VERIFICACION`) | Disociación penal/sensible + Ley 25.326 (`PENDIENTE_DE_VERIFICACION`) | `PENDIENTE_DE_VERIFICACION` | No existe (`PENDIENTE_DE_DEFINICIÓN`) | **`VIABLE_CON_CONDICIONES`** |
| **`SRC-AR-TFN`** | `robots.txt` `404`; sin CAPTCHA en portada; paginación `PENDIENTE_DE_VERIFICACION` | `PENDIENTE_DE_VERIFICACION` | Sin licencia CC explícita (`PENDIENTE_DE_VERIFICACION`) | Resoluciones TFN (`PENDIENTE_DE_VERIFICACION`) | Secreto fiscal / Ley 25.326 (`PENDIENTE_DE_VERIFICACION`) | `PENDIENTE_DE_VERIFICACION` | No existe (`PENDIENTE_DE_DEFINICIÓN`) | **`VIABLE_CON_CONDICIONES`** |
| **`SRC-CABA-TSJ`** | `robots.txt` Drupal estándar; subdominio `jurisprudencia.tsjbaires.gov.ar` caído (ruta interna `PENDIENTE_DE_VERIFICACION`) | `PENDIENTE_DE_VERIFICACION` | Sin licencia comercial verificada (`PENDIENTE_DE_VERIFICACION`) | Sentencias y tesauro TSJ (`PENDIENTE_DE_VERIFICACION`) | Anonimización penal/menores + Ley 25.326 (`PENDIENTE_DE_VERIFICACION`) | `PENDIENTE_DE_VERIFICACION` | No existe (`PENDIENTE_DE_DEFINICIÓN`) | **`VIABLE_CON_CONDICIONES`** |
| **`SRC-CABA-JURISTECA`** | **`robots.txt` declara `Disallow`** sobre `/fallos/`, `/busqueda-avanzada-de-jurisprudencia/` y `ClaudeBot: /` | `PENDIENTE_DE_VERIFICACION` | Sin licencia abierta verificada (`PENDIENTE_DE_VERIFICACION`) | Selección editorial / tesauro (`PENDIENTE_DE_VERIFICACION`) | Anonimización penal/menores + Ley 25.326 (`PENDIENTE_DE_VERIFICACION`) | Módulo daños restringido a personal judicial | No existe (`PENDIENTE_DE_DEFINICIÓN`) | **`RESTRINGIDA_POR_ROBOTS_TXT`** *(operable como `SOLO_REFERENCIA_EXTERNA`)* |
| **`SRC-CABA-BOCABA-API`** | API REST HTTPS sin CAPTCHA ni `Disallow` en `robots.txt`; respetar rate-limit | Términos ASI GCBA (`PENDIENTE_DE_VERIFICACION`) | Cláusula comercial exacta `PENDIENTE_DE_VERIFICACION` | Normativa oficial CABA (`PENDIENTE_DE_VERIFICACION`) | Actos oficiales públicos (revisar PII en anexos) | Notas informativas/no comerciales a verificar | No existe (`PENDIENTE_DE_DEFINICIÓN`) | **`VIABLE_CON_CONDICIONES`** |
| **`SRC-CABA-DIGESTO-CEDOM`** | `digesto`: `robots.txt` sin `Disallow`; `cedom`: `404`; sin CAPTCHA | `PENDIENTE_DE_VERIFICACION` | Cláusula comercial exacta `PENDIENTE_DE_VERIFICACION` | Textos ordenados oficiales (`PENDIENTE_DE_VERIFICACION`) | Normativa pública sin PII | `PENDIENTE_DE_VERIFICACION` | No existe (`PENDIENTE_DE_DEFINICIÓN`) | **`VIABLE_CON_CONDICIONES`** |
| **`SRC-AR-INFOLEG-WEB`** | **WAF/filtro perimetral (`HTTP 403`)** ante UA automatizado en web; dataset `datos.jus.gob.ar` abierto (`HTTP 200`) | Términos InfoLEG (`PENDIENTE_DE_VERIFICACION`) | CC 2.5 AR / `CC-BY-4.0` en `datos.jus.gob.ar` | Legislación nacional oficial | Datos normativos sin PII | Atribución CC | No requerida en `datos.jus.gob.ar` | **`VIABLE_CON_CONDICIONES`** *(web)* / **`VIABLE`** *(dataset)* |

---

## 2. Ficha técnica especial — CSJN Colección Fallos (Tomos descargables) (§5.3)

| Campo obligatorio | Evidencia verificada (`2026-11-25`) |
| :--- | :--- |
| **Identificador estable** | `SRC-AR-CSJN-TOMOS-FALLOS` |
| **Organismo / Jurisdicción / Fuero / Tribunal** | Secretaría de Jurisprudencia CSJN · `AR-NACION` / `AR-FEDERAL` · Todos los fueros (competencia CSJN) · Corte Suprema de Justicia de la Nación |
| **URL oficial principal** | `https://sjservicios.csjn.gov.ar/sj/tomosFallos.do?method=iniciar` |
| **Respuesta HTTP real verificada** | `HTTP 200 OK` · `Content-Type: text/html; charset=UTF-8` · `86.241 bytes` · Formulario `<form action="/sj/tomosFallos" method="post">` |
| **Listado de tomos y paginación** | **Verificado:** HTML contiene marcadores de paginación (`Pagination markers: True`) y enlaces relativos `/sj/verTomo?tomoId=<id>` (ej. `tomoId=446`, `445`, `444`, `443`, `441`, `436`, ..., `44`, `43`, `4`). Cantidad total exacta de páginas/volúmenes: `PENDIENTE_DE_VERIFICACION` (no se recorrieron páginas para evitar scraping en P0-A). |
| **Identificador documental individual** | Parámetro numérico `tomoId` en `/sj/verTomo?tomoId=<id>` + nombre de archivo oficial `LibroVol<tomo>-<volumen>.pdf` (verificado en `tomoId=446` → `LibroVol347-2.pdf`). |
| **Metadatos de tomo, volumen y año** | Presentes en la grilla HTML del listado (Tomo, Volumen, Año) y en el nombre de archivo PDF (`LibroVol347-2.pdf` = Tomo 347, Vol. 2). Estructura exacta de columnas de años anteriores: `PENDIENTE_DE_VERIFICACION`. |
| **Disponibilidad y prueba individual de PDF sin autenticación** | **COMPROBADO DOCUMENTALMENTE (`2026-11-25`):** `HEAD https://sjservicios.csjn.gov.ar/sj/verTomo?tomoId=446` respondió **`HTTP 200 OK`**, **`Content-Type: application/pdf`**, **`Content-Disposition: attachment; filename=LibroVol347-2.pdf`** sin cookies, sin sesión ni autenticación. |
| **Diferencia crítica: Tomo vs. Volumen vs. Fallo individual vs. Sumario** | Un archivo `LibroVol*.pdf` es un **volumen completo compilado** de la colección oficial *Fallos* (múltiples sentencias seleccionadas de un período con índice/paginación de tomo). **NO es un fallo individual**, **NO es un sumario aislado** y **NO contiene la totalidad de las sentencias ni resoluciones recientes de la CSJN** (las sentencias recientes tardan en compilarse en tomos y muchas causas/rechazos art. 280 no integran un volumen). |
| **Mecanismo oficial de descarga masiva / API** | **INEXISTENTE** (solo descarga individual por `tomoId` vía web). |
| **Estabilidad de enlaces** | Enlaces estructurados vía `tomoId` estable en `sjservicios.csjn.gov.ar/sj/verTomo`; sujeto a eventuales migraciones de aplicación Java/Struts (`*.do`). |
| **Cobertura histórica / texto completo / sumarios** | Colección histórica desde Tomo 1 (1863) hasta Tomo 347+ (2024–2026). Texto completo dentro de los volúmenes publicados (requiere segmentación por fallo y verificación de capa de texto/OCR en tomos antiguos: `PENDIENTE_DE_VERIFICACION`). |
| **Frecuencia de actualización** | Periódica (por publicación de nuevos volúmenes de *Fallos*, rezagada respecto de sentencias diarias). |
| **Condiciones de acceso y `robots.txt`** | Acceso público gratuito sin autenticación. `https://sjservicios.csjn.gov.ar/robots.txt` devuelve `HTTP 200 text/html` redirigiendo por JS a `https://sj.csjn.gov.ar/` (no declara directivas `Disallow` en `text/plain`). |
| **Condiciones de reutilización y licencia** | **Sin licencia abierta explícita publicada** (`PENDIENTE_DE_VERIFICACION` jurídica). Acceso individual libre **no equivale** a licencia para extracción masiva ni reproducción comercial; se rige por acordadas CSJN y normas de protección de datos personales. |
| **Rate-limits, CAPTCHA y privacidad** | Sin CAPTCHA en la prueba puntual; posibles límites perimetrales ante descarga intensiva. Sentencias publicadas sujetas a pautas CSJN de disociación de datos sensibles. |
| **Viabilidad técnica / jurídica** | Técnica: **Alta** (descarga PDF directa sin auth) · Jurídica: **Condicionada** (requiere revisión legal de reutilización comercial / límites de descarga). |
| **Estado clasificado** | **`VIABLE_CON_CONDICIONES`** |

### Métricas obligatoriamente separadas para CSJN
En el modelo de datos y Tablero de Cobertura, CSJN debe reportar **5 series independientes** (jamás sumadas en un único indicador engañoso):
1. **Colección *Fallos* (Tomos/Volúmenes PDF):** `SRC-AR-CSJN-TOMOS-FALLOS`.
2. **Sumarios oficiales:** `SRC-AR-CSJN-SUMARIOS` (`sjconsulta.csjn.gov.ar`).
3. **Sentencias completas individuales:** vinculadas a PDF individual en `sj.csjn.gov.ar` / `sjconsulta.csjn.gov.ar`.
4. **Sentencias individuales recientes:** publicadas previo a su consolidación en tomo.
5. **Acordadas y resoluciones administrativas/institucionales CSJN:** diferenciadas de sentencias jurisdiccionales.

---

## 3. Fichas obligatorias por fuente — Bloques A y B (26 campos verificados al `2026-11-25`)

### 3.1. `SRC-AR-CSJN-SJ` — Secretaría de Jurisprudencia CSJN (Portal y Sumarios)
- **Organismo / Jurisdicción / Fuero / Tribunal y salas:** CSJN · `AR-NACION` / `AR-FEDERAL` · Todos · Corte Suprema de Justicia de la Nación.
- **URL oficial:** `https://sj.csjn.gov.ar/` y `https://sjconsulta.csjn.gov.ar/sjconsulta/consultaSumarios/consulta.html`.
- **Tipo documental:** Sumarios oficiales, sentencias completas individuales, acordadas, citas a dictámenes PGN.
- **Cobertura histórica / texto completo / sumarios:** Sumarios desde 1863; textos completos amplios desde 1994 (universo total: `INDETERMINADO`).
- **Formato / Consulta / Descarga / Paginación / ID documental:** HTML + PDF · Buscador web (voces, texto libre, tribunal, fecha, tomo/página) · Descarga web/visor PDF · Paginación web (`PENDIENTE_DE_VERIFICACION` en nueva interfaz `sj.csjn.gov.ar` con token CSRF `_csrf`) · ID: Tomo/Página, Nro. expte., ID interno CSJN.
- **Actualización:** Continua / semanal tras acuerdos.
- **Acceso / Reutilización / Licencia:** Público gratuito · Sin API pública ni licencia abierta CC publicada; extracción masiva comercial no autorizada expresamente (`PENDIENTE_DE_VERIFICACION` jurídica).
- **`robots.txt` / Rate-limits y CAPTCHA / Privacidad:** `sjconsulta.csjn.gov.ar/robots.txt` = `HTTP 404`; `sj.csjn.gov.ar/robots.txt` devuelve HTML (contiene meta `_csrf`) · Sin CAPTCHA en home, sí protección CSRF y posibles rate-limits · Resguardo de datos sensibles según acordadas CSJN.
- **Viabilidad técnica / jurídica / Estado:** Técnica: Media (CSRF/JS) · Jurídica: Condicionada · **`VIABLE_CON_CONDICIONES`**.
- **Evidencia (`2026-11-25`):** `GET sj.csjn.gov.ar` = `HTTP 200` (`16.549 B`, `<meta name="_csrf">`); `GET sjconsulta.../consulta.html` = `HTTP 200` (`17.514 B`).

### 3.2. `SRC-AR-CSJN-TFN-BUSC` — Buscador Unificado de Sentencias de Tribunales Federales y Nacionales
- **Organismo / Jurisdicción / Fuero / Tribunal y salas:** CSJN / Consejo de la Magistratura · `AR-NACION` y `AR-FEDERAL` · Civil, Comercial, Trabajo, Penal, Casación Penal, Penal Económico, Contencioso Adm. Fed., Civil y Com. Fed., Seguridad Social, Electoral · Cámaras Nacionales y Federales con asiento en CABA (y del país), Tribunales Orales y Juzgados *(cobertura efectiva por sala heterogénea: `PENDIENTE_DE_VERIFICACION` por restricción `robots.txt`)*.
- **URL oficial operativa verificada:** `https://www.csjn.gov.ar/tribunales-federales-nacionales/inicio.html`.
- **Tipo documental:** Sentencias, resoluciones y resúmenes institucionales.
- **Cobertura histórica / texto completo / sumarios:** Variable por cámara y fuero (penal/familia restringidos; universo total: `INDETERMINADO`).
- **Formato / Consulta / Descarga / Paginación / ID:** HTML (`iso-8859-1`) + PDFs bajo `/tribunales-federales-nacionales/adj/pdfs/` y `/adj/fallos/` · Buscador web · ID por expediente/tribunal/fecha.
- **Actualización:** Periódica según carga de cada tribunal.
- **Acceso / Reutilización / Licencia:** Público para lectura web; **sin licencia de extracción automatizada**.
- **`robots.txt` (HALLAZGO CRÍTICO VERIFICADO `2026-11-25`):** `https://www.csjn.gov.ar/robots.txt` (`HTTP 200 text/plain`) declara expresamente:
  `User-agent: *` → **`Disallow: /tribunales-federales-nacionales/inicio.html`**, **`Disallow: /tribunales-federales-nacionales/d/`**, **`Disallow: /tribunales-federales-nacionales/scp/d/`**, **`Disallow: /tribunales-federales-nacionales/adj/pdfs/`**, **`Disallow: /tribunales-federales-nacionales/adj/fallos/`**, **`Disallow: /tribunales-federales-nacionales/adj/docs/`**, **`Disallow: /archivo-cij/adj/pdfs/`**.
- **Rate-limits / CAPTCHA / Privacidad:** Restricción técnica de acceso automatizado declarada en `robots.txt` *(no constituye por sí sola una prohibición legal)*; causas penales/sensibles sujetas a restricciones de privacidad y Ley 25.326.
- **Viabilidad técnica / jurídica / Estado:** Técnica: Restringida para extracción automatizada por `robots.txt` · Jurídica: Planos 2–7 `PENDIENTE_DE_VERIFICACION` / `PENDIENTE_DE_DEFINICIÓN` · **`RESTRINGIDA_POR_ROBOTS_TXT`** *(operar únicamente como `SOLO_REFERENCIA_EXTERNA` mientras no exista autorización institucional o canal de datos abiertos; nunca se califica como `BLOQUEADA_POR_RESTRICCION_LEGAL` únicamente por `robots.txt`)*.
- **Evidencia (`2026-11-25`):** `GET .../inicio.html` = `HTTP 200` (`165.845 B`); `GET www.csjn.gov.ar/robots.txt` = `HTTP 200` (`469 B`, `Disallow` verbatim verificado).

### 3.3. `SRC-AR-PJN-SCW` — SCW Consulta de Causas PJN
- **Organismo / Jurisdicción / Fuero / Tribunal y salas:** Poder Judicial de la Nación · `AR-NACION` / `AR-FEDERAL` · Civil, Comercial, Trabajo, CAF, CivComFed, Seg. Social (Penal/Familia restringidos) · Expedientes PJN.
- **URL oficial:** `https://scw.pjn.gov.ar/scw/home.seam`.
- **Tipo documental:** Trámite procesal, proveídos y sentencias públicas adjuntas a causas.
- **Cobertura / Formato / Consulta / Descarga / Paginación / ID:** Causas en Lex100 (Parcial; Penal/Familia excluidos de acceso abierto; Laboral exige Nro/año) · HTML/PDF puntual · Consulta interactiva por expediente/parte · Nro. y año de expediente.
- **Actualización:** Diaria / en línea.
- **Acceso / Reutilización / Licencia / `robots.txt` / Rate-limits y CAPTCHA / Privacidad:** Público interactivo con **CAPTCHA obligatorio** y login en fueros reservados · **Prohibida extracción masiva** · Alto riesgo de privacidad de partes.
- **Viabilidad técnica / jurídica / Estado:** Técnica: No viable para ingesta masiva (CAPTCHA) · Jurídica: No autorizada para scraping · **`BLOQUEADA_POR_CAPTCHA`** *(clasificada como **`SOLO_REFERENCIA_EXTERNA`**; no se diseña extracción masiva)*.
- **Evidencia (`2026-11-25`):** `GET scw.pjn.gov.ar/scw/home.seam` = `HTTP 200` (`26.769 B`).

### 3.4. `SRC-AR-SAIJ-DATOS` — SAIJ / Ministerio de Justicia — Datos Abiertos (`datos.jus.gob.ar`)
- **Organismo / Jurisdicción / Fuero / Tribunal y salas:** Dirección Nacional del SAIJ (Ministerio de Justicia) · `AR-NACION` + Provincial (`AR-*`) · Legislación y tesauro jurídico *(NO incluye datasets de jurisprudencia: consulta `q=jurisprudencia` devolvió `count = 0`)*.
- **URL oficial:** `https://datos.jus.gob.ar/` (API CKAN: `https://datos.jus.gob.ar/api/3/action/package_search`).
- **Datasets concretos verificados en vivo (`2026-11-25`):**
  1. `base-de-datos-legislativos-infoleg` (*Base Infoleg de Normativa Nacional*) — **7 recursos**, formatos **`CSV`, `ZIP`**, modificado **`11/02/2026 12:37:40`**.
  2. `base-saij-de-normativa-provincial` (*Base SAIJ de Normativa Provincial*) — **2 recursos**, formato **`CSV`**, modificado **`11/02/2026 12:35:23`**.
  3. `tesauro-saij-de-derecho-argentino` (*Tesauro SAIJ de Derecho Argentino*) — **1 recurso**, formato **`RDF`**, modificado **`06/03/2024 15:42:57`**.
- **Tipo documental / Cobertura texto completo / sumarios:** Metadatos normativos, relaciones y tesauro; verificación de si el `ZIP` incluye textos legales completos: `PENDIENTE_DE_VERIFICACION` (en `P0-E`). `0` datasets abiertos de jurisprudencia.
- **Formato / Consulta / Descarga / Paginación / ID:** JSON (API CKAN) + CSV/ZIP/RDF · Descarga directa por recurso · Paginación CKAN (`rows`/`start`) · `id_norma` / ID SAIJ.
- **Acceso / Reutilización / Licencia:** Público gratuito · **Licencia abierta verificada:** **`CC-BY-4.0`** (`https://creativecommons.org/licenses/by/4.0/`), autoriza reutilización incluso comercial con **atribución obligatoria** (*Ministerio de Justicia — Dirección Nacional del SAIJ*).
- **`robots.txt` / Rate-limits y CAPTCHA / Privacidad:** API CKAN abierta sin CAPTCHA · Datos normativos públicos sin PII.
- **Viabilidad técnica / jurídica / Estado:** Técnica: **Alta** · Jurídica: **Alta (`CC-BY-4.0`)** · **`VIABLE`** *(para normativa y tesauro; no cubre jurisprudencia)*.
- **Evidencia (`2026-11-25`):** `GET datos.jus.gob.ar/api/3/action/package_search?q=infoleg|saij|jurisprudencia` = `HTTP 200 application/json`.

### 3.5. `SRC-AR-SAIJ-WEB` — Portal Web SAIJ (`www.saij.gob.ar`)
- **Organismo / Jurisdicción / Fuero / Tribunal y salas:** Dirección Nacional del SAIJ · `AR-NACION`, `AR-FEDERAL`, `AR-CABA`, Provincial · Todos · CSJN, Cámaras, TSJ CABA y tribunales provinciales (cobertura selectiva).
- **URL oficial:** `https://www.saij.gob.ar/`.
- **Tipo documental:** Sumarios analíticos, sentencias seleccionadas, legislación y dictámenes.
- **Cobertura histórica / texto completo / sumarios:** Amplia en sumarios; selectiva en sentencias completas (universo total: `INDETERMINADO`).
- **Formato / Consulta / Descarga / Paginación / ID:** HTML/PDF · Buscador web · ID SAIJ (`FA...`, `SU...`, `NV...`).
- **Actualización:** Continua / diaria.
- **Acceso / Reutilización / Licencia / `robots.txt`:** Público gratuito para consulta interactiva · Sujeto a *Reglamento de Uso SAIJ* · **`robots.txt` verificado (`2026-11-25`, `HTTP 200`):** `User-agent: *` → **`Disallow: /convert-html-to-pdf`**, **`Disallow: /descarga-archivo`**, **`Disallow: /*resource/kbee:`**, **`Disallow: /_pdf`**.
- **Viabilidad técnica / jurídica / Estado:** Técnica: Descarga automatizada de PDFs/archivos restringida por `robots.txt` *(restricción técnica, no prohibición legal por sí sola)* · Jurídica: Reglamento de Uso, licencia y Ley 11.723/25.326 `PENDIENTE_DE_VERIFICACION` · **`RESTRINGIDA_POR_ROBOTS_TXT`** *(para descarga web de PDFs; operable como **`SOLO_REFERENCIA_EXTERNA`**, o **`VIABLE_CON_CONDICIONES`** únicamente sobre rutas permitidas tras validar el Reglamento de Uso y licencia en revisión legal)*.
- **Evidencia (`2026-11-25`):** `GET www.saij.gob.ar/` = `HTTP 200` (`78.163 B`); `GET www.saij.gob.ar/robots.txt` = `HTTP 200` (`291 B`).

### 3.6. `SRC-AR-PGN-MPF` — Procuración General de la Nación (Dictámenes MPF)
- **Organismo / Jurisdicción / Fuero / Tribunal y salas:** Ministerio Público Fiscal / Procuración General de la Nación · `AR-NACION` / `AR-FEDERAL` · Todos ante CSJN · **Dictámenes PGN (`PROSECUTORIAL_OPINION` — NUNCA clasificar como sentencia judicial)**.
- **URL oficial:** `https://www.mpf.gob.ar/buscador-dictamenes/`.
- **Tipo documental:** Dictámenes fiscales ante la CSJN y tomos digitales (e-books EPUB/PDF).
- **Cobertura histórica / texto completo / sumarios:** Serie histórica desde **1993** (>121.000 dictámenes publicados a texto completo según documentación oficial MPF; universo total emitido: `INDETERMINADO`).
- **Formato / Consulta / Descarga / Paginación / ID:** HTML + PDF + e-books · Buscador web por carátula, fecha, materia, texto libre · Paginación web (`PENDIENTE_DE_VERIFICACION` técnica de parámetros exactos) · Nro. expte. CSJN + fecha de dictamen.
- **Actualización:** Continua / periódica.
- **Acceso / Reutilización / Licencia / `robots.txt`:** Público gratuito · **`robots.txt` verificado (`2026-11-25`, `HTTP 200`):** solo `Disallow: /wp-admin/` (permite `/buscador-dictamenes/`) · Sin licencia abierta CC explícita publicada (`PENDIENTE_DE_VERIFICACION` jurídica para uso comercial masivo).
- **Rate-limits / CAPTCHA / Privacidad:** Sin CAPTCHA en página principal; disociación en causas penales/sensibles.
- **Viabilidad técnica / jurídica / Estado:** Técnica: **Alta** · Jurídica: Condicionada a validación de términos de reutilización · **`VIABLE_CON_CONDICIONES`**.
- **Evidencia (`2026-11-25`):** `GET mpf.gob.ar/buscador-dictamenes/` = `HTTP 200` (`77.638 B`); `GET mpf.gob.ar/robots.txt` = `HTTP 200` (`67 B`).

### 3.7. `SRC-AR-TFN` — Tribunal Fiscal de la Nación
- **Organismo / Jurisdicción / Fuero / Tribunal y salas:** Tribunal Fiscal de la Nación (Min. de Economía) · `AR-NACION` / `AR-FEDERAL` · Impositivo (Salas A, B, C, D) y Aduanero (Salas E, F, G y ampliaciones) · **Tribunal administrativo con función jurisdiccional (`ADMINISTRATIVE_TAX_COURT` — NO clasificar como Poder Judicial)**.
- **URL oficial:** `https://jurisprudenciatfn.mecon.gob.ar/` y `https://www.argentina.gob.ar/tribunalfiscal`.
- **Tipo documental:** Sentencias, resoluciones y plenarios del TFN.
- **Cobertura histórica / texto completo / sumarios:** Fallos digitalizados con texto/PDF (`PENDIENTE_DE_VERIFICACION` fecha exacta de inicio histórico, paginación interna y ratio exacto texto íntegro vs. resumen).
- **Formato / Consulta / Descarga / Paginación / ID:** Web SPA/HTML + PDF · Buscador por sala, vocalía, competencia, fecha, texto libre · Nro. expte. TFN + fecha + sala.
- **Actualización:** Periódica (`PENDIENTE_DE_VERIFICACION` frecuencia exacta).
- **Acceso / Reutilización / Licencia / `robots.txt`:** Público gratuito · `robots.txt` = `HTTP 404` · Sin licencia CC explícita verificada en el portal (`PENDIENTE_DE_VERIFICACION` jurídica).
- **Rate-limits / CAPTCHA / Privacidad:** Sin CAPTCHA detectado en portada; verificar API/límites internos en `P0-C` sin evadir controles; secreto fiscal en datos sensibles.
- **Viabilidad técnica / jurídica / Estado:** Técnica: Media (`PENDIENTE_DE_VERIFICACION` paginación/descarga PDF) · Jurídica: Condicionada · **`VIABLE_CON_CONDICIONES`**.
- **Evidencia (`2026-11-25`):** `GET jurisprudenciatfn.mecon.gob.ar/` = `HTTP 200` (`43.848 B`); `GET argentina.gob.ar/tribunalfiscal` = `HTTP 200` (`45.779 B`); `robots.txt` = `404`.

### 3.8. `SRC-CABA-TSJ` — Tribunal Superior de Justicia de CABA *(Bloque B)*
- **Organismo / Jurisdicción / Fuero / Tribunal y salas:** Tribunal Superior de Justicia de la CABA · **`AR-CABA`** *(estrictamente separado de `AR-NACION`)* · Secretarías de Asuntos Originarios y Relaciones de Consumo, CAyT, Penal y Penal Juvenil, Civil/Comercial, Laboral, Superintendencia Notariado · TSJ CABA (`SUPREME_COURT_JUDICIAL`).
- **URL oficial:** `https://www.tsjbaires.gov.ar/` *(Nota verificada `2026-11-25`: el subdominio histórico `https://jurisprudencia.tsjbaires.gov.ar/` falló en conexión/TLS; la URL operativa exacta del buscador interno dentro de `tsjbaires.gov.ar` queda `PENDIENTE_DE_VERIFICACION`)*.
- **Tipo documental:** Sentencias completas, resoluciones y sumarios con tesauro.
- **Cobertura histórica / texto completo / sumarios:** Desde **1999** (creación del TSJ) con textos completos y tesauro (universo total: `INDETERMINADO`).
- **Formato / Consulta / Descarga / Paginación / ID:** HTML/PDF · Consulta por expediente, fecha, carátula, texto libre, tesauro y secretaría · Paginación y descarga PDF exacta: `PENDIENTE_DE_VERIFICACION` · ID: Nro. expte. TSJ + fecha.
- **Actualización:** Continua / periódica.
- **Acceso / Reutilización / Licencia / `robots.txt`:** Público gratuito · `https://www.tsjbaires.gov.ar/robots.txt` (`HTTP 200`, `2.027 B`, plantilla Drupal estándar) · Principios de gobierno abierto CABA, sin licencia comercial masiva verificada documentalmente (`PENDIENTE_DE_VERIFICACION` jurídica).
- **Rate-limits / CAPTCHA / Privacidad:** Anonimización en causas penales/familia/menores; verificar límites del buscador interno.
- **Viabilidad técnica / jurídica / Estado:** Técnica: Condicionada (falta confirmar URL exacta del buscador interno tras caída de `jurisprudencia.tsjbaires.gov.ar`) · Jurídica: Condicionada · **`VIABLE_CON_CONDICIONES`**.
- **Evidencia (`2026-11-25`):** `GET www.tsjbaires.gov.ar/` = `HTTP 200` (`59.186 B`); `robots.txt` = `HTTP 200` (`2.027 B`); `GET jurisprudencia.tsjbaires.gov.ar/` = fallo de conexión.

### 3.9. `SRC-CABA-JURISTECA` — JURISTECA (Consejo de la Magistratura CABA) *(Bloque B)*
- **Organismo / Jurisdicción / Fuero / Tribunal y salas:** Consejo de la Magistratura CABA (Depto. Biblioteca y Jurisprudencia) · **`AR-CABA`** · Fuero CAyTyRC (Salas I–IV) y Fuero PPJCyF (Salas I–III) + juzgados locales seleccionados · Cámaras de Apelaciones y Juzgados CABA (`APPELLATE_OR_TRIAL_JUDICIAL`).
- **URL oficial:** `https://juristeca.jusbaires.gob.ar/`.
- **Tipo documental:** Fallos **seleccionados** (carácter editorial **selectivo**, NO exhaustivo de 1ª instancia), sumarios temáticos (tesauro) y boletines. *(Módulo de cuantificación de daños restringido a personal judicial — excluido.)*
- **Cobertura histórica / texto completo / sumarios:** Parcial/selectiva (`INDETERMINADO` sobre universo total de sentencias locales).
- **Formato / Consulta / Descarga / Paginación / ID:** HTML (WordPress) / PDF · Buscador avanzado por fuero, sala, fecha, carátula, causa y tesauro · ID interno JURISTECA + expediente.
- **Actualización:** Continua / boletines periódicos.
- **Acceso / Reutilización / Licencia / `robots.txt` (HALLAZGO CRÍTICO VERIFICADO `2026-11-25`):**
  `https://juristeca.jusbaires.gob.ar/robots.txt` (`HTTP 200 text/plain`) declara expresamente:
  - `User-agent: ClaudeBot` → **`Disallow: /`**
  - `User-agent: *` → **`Disallow: /fallos/`**, **`Disallow: /busqueda-avanzada-de-jurisprudencia/`**, **`Disallow: /ics-wpd/`**, **`Disallow: /anterior/ics-wpd/`**.
- **Rate-limits / CAPTCHA / Privacidad:** Restricción técnica explícita en `robots.txt` para rutas de jurisprudencia *(no constituye por sí sola una prohibición legal)*; anonimización de menores/penal (Ley 25.326).
- **Viabilidad técnica / jurídica / Estado:** Técnica: Restringida para extracción automatizada por `robots.txt` · Jurídica: Planos 2–7 `PENDIENTE_DE_VERIFICACION` / `PENDIENTE_DE_DEFINICIÓN` *(módulo de cuantificación de daños restringido a personal judicial)* · **`RESTRINGIDA_POR_ROBOTS_TXT`** *(operar únicamente como `SOLO_REFERENCIA_EXTERNA` hasta verificar existencia de portal de datos abiertos del Consejo de la Magistratura CABA o autorización institucional; nunca se califica como `BLOQUEADA_POR_RESTRICCION_LEGAL` únicamente por `robots.txt`)*.
- **Evidencia (`2026-11-25`):** `GET juristeca.jusbaires.gob.ar/` = `HTTP 200` (`632.060 B`); `GET juristeca.jusbaires.gob.ar/robots.txt` = `HTTP 200` (`333 B`, `Disallow` verbatim verificado).

### 3.10. `SRC-CABA-BOCABA-API` — Boletín Oficial CABA (Web + API REST) *(Bloque B — Normativa)*
- **Organismo / Jurisdicción / Fuero / Tribunal y salas:** Secretaría Legal y Técnica GCBA · **`AR-CABA`** · Legislación y actos administrativos locales CABA · Legislatura CABA, Jefatura de Gobierno, Ministerios GCBA.
- **URL oficial verificada:** `https://boletinoficial.buenosaires.gob.ar/` y API **`https://api-restboletinoficial.buenosaires.gob.ar/obtenerBoletin/{param}/{carga_datos}`**.
- **Tipo documental:** Boletines diarios, normas individuales y anexos/separatas PDF.
- **Cobertura histórica / texto completo / sumarios:** Texto oficial completo publicado (fecha exacta de inicio histórico en API: `PENDIENTE_DE_VERIFICACION`).
- **Formato / Consulta / Descarga / Paginación / ID:** **API REST JSON en HTTPS** + descarga PDF (`/download/{id}`) *(Nota: las URLs devueltas dentro del JSON usan `http://`, debiendo validarse su equivalente `https://` en P0-E)* · Consulta por fecha `dd-mm-yyyy`, número de boletín o `0` (último) · ID numérico de boletín/norma.
- **Actualización:** **Diaria (días hábiles)** — verificado en vivo el `2026-11-25` devolviendo Boletín N° `7501` del `25/11/2026`!
- **Acceso / Reutilización / Licencia / `robots.txt`:** Público gratuito sin API key · `boletinoficial.buenosaires.gob.ar/robots.txt` (`HTTP 200`): `User-agent: *` sin `Disallow` · Contenidos GCBA habitualmente bajo licencia compatible CC BY 2.5 AR, pero con notas de uso informativo/no comercial en algunos términos ASI (`PENDIENTE_DE_VERIFICACION` de cláusula comercial exacta antes de `P0-E`).
- **Rate-limits / CAPTCHA / Privacidad:** Sin CAPTCHA; respetar rate-limit prudente ASI GCBA.
- **Viabilidad técnica / jurídica / Estado:** Técnica: **Alta (API HTTPS JSON verificada en vivo)** · Jurídica: Condicionada a confirmar cláusula comercial · **`VIABLE_CON_CONDICIONES`**.
- **Evidencia (`2026-11-25`):** `GET https://api-restboletinoficial.buenosaires.gob.ar/obtenerBoletin/0/false` = `HTTP 200 application/json` (`308 B`, `numero: 7501`, `fecha_publicacion: "25/11/2026"`).

### 3.11. `SRC-CABA-DIGESTO-CEDOM` — Digesto Jurídico CABA y CEDOM *(Bloque B — Normativa)*
- **Organismo / Jurisdicción / Fuero / Tribunal y salas:** Secretaría Legal y Técnica GCBA / Legislatura CABA · **`AR-CABA`** · Leyes consolidadas vigentes y archivo legislativo histórico CABA.
- **URL oficial:** `https://digesto.buenosaires.gob.ar/` y `https://www.cedom.gob.ar/`.
- **Tipo documental:** Textos ordenados consolidados del Digesto Jurídico y archivo legislativo CEDOM.
- **Cobertura histórica / texto completo / sumarios:** Leyes vigentes consolidadas y archivo parlamentario (desfase periódico entre promulgación en BOCABA y ley de consolidación del Digesto).
- **Formato / Consulta / Descarga / Paginación / ID:** HTML/PDF · Búsqueda por ley/rama/texto · ID de ley CABA y rama del Digesto.
- **Actualización:** Periódica (por leyes de consolidación y sesiones legislativas).
- **Acceso / Reutilización / Licencia / `robots.txt`:** Público gratuito · `digesto.buenosaires.gob.ar/robots.txt` (`HTTP 200`) sin `Disallow`; `cedom.gob.ar/robots.txt` (`HTTP 404`) · Reutilización comercial sujeta a verificación de términos exactos (`PENDIENTE_DE_VERIFICACION`).
- **Viabilidad técnica / jurídica / Estado:** Técnica: Media-Alta · Jurídica: Condicionada · **`VIABLE_CON_CONDICIONES`**.
- **Evidencia (`2026-11-25`):** `GET digesto.buenosaires.gob.ar/` = `HTTP 200` (`88.130 B`); `GET cedom.gob.ar/` = `HTTP 200` (`20.610 B`).

### 3.12. `SRC-AR-INFOLEG-WEB` — InfoLEG Portal Web *(Bloque A — Normativa Nacional)*
- **Organismo / Jurisdicción / Fuero / Tribunal y salas:** Dirección Nacional del SAIJ (Min. de Justicia) · `AR-NACION` · Legislación nacional (todos los fueros).
- **URL oficial:** `https://servicios.infoleg.gob.ar/` (complementado con `SRC-AR-SAIJ-DATOS` → `base-de-datos-legislativos-infoleg` `CC-BY-4.0` en `datos.jus.gob.ar`; `datos.gob.ar` API arrojó `HTTP 502` transitorio el `2026-11-25`).
- **Tipo documental:** Texto original, texto actualizado/consolidado y fichas de reformas/vigencia.
- **Cobertura / Formato / Acceso / `robots.txt` / Rate-limits:** BO 1ª sección desde mayo 1997 + históricas clave · HTML · Licencia abierta CC Reconocimiento 2.5 AR / CC-BY-4.0 · **Hallazgo técnico `2026-11-25`:** `GET https://servicios.infoleg.gob.ar/` devolvió **`HTTP 403 Forbidden`** frente a User-Agent automatizado (WAF/filtro perimetral).
- **Viabilidad técnica / jurídica / Estado:** Jurídica: Alta (CC abierta) · Técnica: Restringida en acceso web automatizado (`HTTP 403`) → priorizar el paquete `ZIP`/`CSV` de `datos.jus.gob.ar` (`VIABLE`) y validar acceso web permitido sin evadir controles · **`VIABLE_CON_CONDICIONES`** *(web)* / **`VIABLE`** *(dataset `datos.jus.gob.ar`)*.
- **Evidencia (`2026-11-25`):** `GET servicios.infoleg.gob.ar/` = `HTTP 403`; `GET datos.jus.gob.ar/...?q=infoleg` = `HTTP 200` (`CC-BY-4.0`, `11/02/2026`); `GET datos.gob.ar/...?q=infoleg` = `HTTP 502`.

---

## 4. Matriz consolidada de cobertura — Bloques A y B (sin denominadores inventados)

> **Regla obligatoria (§6):** Cuando el organismo no publica el universo total de decisiones emitidas, la cobertura porcentual sobre el universo total permanece **`INDETERMINADO`**. Ninguna fuente selectiva se presenta como exhaustiva; los sumarios nunca se suman como sentencias completas. Cobertura ingerida hoy en `abogados_db`: **`0` en todas las filas**.

| Organismo | Tribunal | Salas | Fuero | Jurisdicción | Sentencia completa | Texto parcial | Sumario oficial | Reseña | Metadatos | Referencia externa | Universo total oficial | Restricción conocida |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| CSJN | Corte Suprema (Colección *Fallos*) | Tribunal Pleno | Todos | `AR-NACION` / `AR-FEDERAL` | Sí *(en volúmenes PDF compilados)* | No | Separado | No | Sí | N/A | `INDETERMINADO` *(solo fallos publicados en tomos)* | Volúmenes compilados (no fallos diarios ni art. 280); sin licencia comercial explícita |
| CSJN | Corte Suprema (Sumarios y Fallos indiv.) | Tribunal Pleno | Todos | `AR-NACION` / `AR-FEDERAL` | Sí *(amplio ≥1994)* | Parcial | Sí *(≥1863)* | Sí | Sí | Sí | `INDETERMINADO` | CSRF/JS en `sj.csjn.gov.ar`; sin API pública ni licencia comercial explícita |
| PJN / CSJN | CNACivil | A–M + Plenarios | Civil | `AR-NACION` | Parcial | Parcial | Selectivo (SAIJ) | Parcial | Sí | Sí (`SCW`) | `INDETERMINADO` | **`robots.txt` restringe acceso automatizado en Buscador Unificado CSJN** (`RESTRINGIDA_POR_ROBOTS_TXT`); `SCW` tiene CAPTCHA |
| PJN / CSJN | CNCom | A–F + Plenarios | Comercial | `AR-NACION` | Parcial | Parcial | Selectivo | Parcial | Sí | Sí | `INDETERMINADO` | **`robots.txt` restringe acceso automatizado en Buscador Unificado CSJN** (`RESTRINGIDA_POR_ROBOTS_TXT`); `SCW` tiene CAPTCHA |
| PJN / CSJN | CNAT | I–X + Plenarios | Laboral | `AR-NACION` | Parcial | Parcial | Selectivo | Parcial | Sí | Sí | `INDETERMINADO` | **`robots.txt` restringe acceso automatizado en Buscador Unificado** (`RESTRINGIDA_POR_ROBOTS_TXT`); `SCW` exige nro/año + CAPTCHA |
| PJN / CSJN | CCC y CNCC | CCC I, IV–VII · CNCC 1–3 | Penal ordinario CABA | `AR-NACION` | Restringida | Parcial | Selectivo | Sí | Parcial | Excluidas reservadas | `INDETERMINADO` | Secreto/privacidad penal + **`robots.txt` restringe Buscador Unificado** (`RESTRINGIDA_POR_ROBOTS_TXT`) |
| PJN / CSJN | CFCP | I–IV + Plenarios | Penal Federal | `AR-FEDERAL` | Restringida / públicos | Parcial | Selectivo | Sí | Parcial | Excluidas reservadas | `INDETERMINADO` | Privacidad penal + **`robots.txt` restringe Buscador Unificado** (`RESTRINGIDA_POR_ROBOTS_TXT`) |
| PJN / CSJN | CNPE | A–B | Penal Económico | `AR-NACION` | Parcial | Parcial | Selectivo | Parcial | Sí | Sí | `INDETERMINADO` | **`robots.txt` restringe acceso automatizado en Buscador Unificado CSJN** (`RESTRINGIDA_POR_ROBOTS_TXT`) |
| PJN / CSJN | CNACAF | I–V | Contencioso Adm. Fed. | `AR-FEDERAL` | Parcial | Parcial | Selectivo | Parcial | Sí | Sí | `INDETERMINADO` | **`robots.txt` restringe acceso automatizado en Buscador Unificado CSJN** (`RESTRINGIDA_POR_ROBOTS_TXT`) |
| PJN / CSJN | CNCivComFed, CFSS, CCCF, CNE, TO | Por cámara/TO | Federal CABA | `AR-FEDERAL` / `AR-NACION` | Parcial / Baja en TO | Parcial | Selectivo | Parcial | Sí | Sí | `INDETERMINADO` | **`robots.txt` restringe Buscador Unificado** (`RESTRINGIDA_POR_ROBOTS_TXT`); TO y CCCF con publicación muy selectiva |
| MPF | **Procuración General de la Nación (PGN)** | Dictámenes ante CSJN | Todos | `AR-NACION` / `AR-FEDERAL` | **Dictamen completo** *(NO sentencia)* | No | En CSJN/MPF | Sí | Sí | N/A | `INDETERMINADO` *(>121.000 publicados)* | **Nunca clasificar como sentencia judicial**; licencia comercial `PENDIENTE_DE_VERIFICACION` |
| Min. Economía | **Tribunal Fiscal de la Nación (TFN)** | A–D (Imp.), E–G (Ad.) | Impositivo y Aduanero | `AR-NACION` / `AR-FEDERAL` | Parcial / Sí *(validar)* | Parcial | Sí | Parcial | Sí | Sí | `INDETERMINADO` | **NO es Poder Judicial** (`ADMINISTRATIVE_TAX_COURT`); licencia y paginación `PENDIENTE_DE_VERIFICACION` |
| Poder Judicial CABA | **TSJ CABA** | Secretarías TSJ | Local CABA | **`AR-CABA`** | Sí *(≥1999)* | No | Sí *(tesauro)* | Sí | Sí | Causas reservadas | `INDETERMINADO` | Subdominio `jurisprudencia.tsjbaires.gov.ar` inoperativo; URL buscador y licencia `PENDIENTE_DE_VERIFICACION` |
| Cons. Mag. CABA | **Cámara CAyTyRC y Cámara PPJCyF (JURISTECA)** | CAyTyRC I–IV · PPJCyF I–III | Local CABA | **`AR-CABA`** | Selectiva | Parcial | Sí *(selectivo)* | Sí | Sí | Sí | `INDETERMINADO` | **Fuente selectiva + `robots.txt` restringe `/fallos/` y buscador** (`RESTRINGIDA_POR_ROBOTS_TXT`); módulo daños restringido |
| GCBA / Leg. CABA | **Normativa CABA (BOCABA + Digesto/CEDOM)** | N/A | Legislación CABA | **`AR-CABA`** | **Sí (API + PDF)** | No | N/A | No | Sí | N/A | `INDETERMINADO` *(diaria BOCABA)* | Separar norma publicada en BOCABA vs. consolidación periódica del Digesto; confirmar cláusula comercial |
| Min. Justicia | **Normativa Nacional (InfoLEG `datos.jus.gob.ar`)** | N/A | Legislación Nacional | **`AR-NACION`** | En revisión ZIP / web | No | N/A | No | **Sí (CSV CC-BY-4.0)** | Sí | `INDETERMINADO` *(exhaustivo BO ≥1997)* | `servicios.infoleg.gob.ar` devolvió `HTTP 403` ante UA automatizado; verificar contenido ZIP |

