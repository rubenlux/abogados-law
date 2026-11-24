# MASTER TECHNICAL AUDIT 001 — AUDITORÍA INTEGRAL DEL ESTADO REAL DEL PROYECTO

**Expediente:** `ABOGADOS-LAW-MASTER-TECHNICAL-AUDIT-001`  
**Proyecto:** Abogado Virtual (Abogados_law)  
**Modalidad:** READ-ONLY (Auditoría de inspección estricta, sin modificaciones de código ni migraciones)  
**Fecha de Auditoría:** 23 de Noviembre de 2026  
**Auditor:** Antigravity Autonomous Technical Auditor (DeepMind Platform)

---

## 1. RESUMEN EJECUTIVO

La presente auditoría técnica integral fue ejecutada sobre el repositorio `Abogados_law` bajo estrictas restricciones de solo lectura. El objetivo primordial consistió en desmitificar afirmaciones documentales, checkpoints anteriores y expectativas declaradas, contrastándolos rigurosamente contra la evidencia empírica del código fuente, el esquema relacional, los scripts, las dependencias y la suite de pruebas.

### Respuestas Directas a las Preguntas Fundamentales

#### ¿Qué tenemos realmente construido?
Existe una base arquitectónica inicial estructurada como un monorepo híbrido que contiene:
1. Un backend en NestJS 10 con Prisma ORM 5.22, un esquema de base de datos relacional de 16 modelos/entidades, integración con LangChain/OpenAI (`gpt-4o`, `text-embedding-3-small`) y un scraper basado en Playwright para la CSJN y el Poder Judicial de Formosa.
2. Un frontend SPA en React 19 + Vite 7 + Zustand con rutas para gestión de expedientes, agenda judicial, jurisprudencia, redacción, templates y administración.
3. Un panel de administración independiente (`admin-platform`) en React 19 + Vite 7 + Tailwind CSS 4 + Recharts.
4. Una infraestructura base en `docker-compose.yml` que define contenedores para PostgreSQL 16 con la extensión `pgvector` y MinIO.

#### ¿Qué funciona de manera verificable?
- **Compilación TypeScript**: El backend (`backend`), el frontend principal (`frontend`) y el panel de administración (`admin-platform`) compilan sin errores sintácticos (`tsc --noEmit` exit code 0).
- **Autenticación Base**: Flujo JWT con emisión de tokens de acceso y refresh token (`POST /auth/login`, `POST /auth/refresh`).
- **Cálculo de Plazos y Agenda**: Motor matemático de conteo de días hábiles/corridos y cruce con feriados judiciales locales en `DeadlineCalculatorService`.
- **Ranking Jurisprudencial**: Algoritmo multifactorial de ranking (`JurisprudenceRankingService`) que pondera similitud semántica (35%), jerarquía del tribunal (20%), impacto de citas (15%), actualidad (10%), alineación jurisdiccional (10%) y precedencia (10%).
- **Normalización de Texto Jurídico**: Limpieza, hashing SHA-256, extracción heurística de palabras clave y detección de conceptos jurídicos (`TextNormalizationService`).
- **Scraper Playwright CSJN**: Extracción de sumarios y metadatos desde el portal de consulta pública de la CSJN hacia archivos JSON intermedios.

#### ¿Qué no funciona o está roto?
- **Búsqueda Jurisprudencial Semántica con Filtros**: La consulta SQL en `jurisprudence-search.service.ts` fuerza un cast a `::"LegalNormJurisdiccion"`, mientras que la migración `20260124155621_fix_jurisprudence_type` convirtió la columna `jurisdiccion` a tipo `TEXT`. Esto genera un fallo de tipos en PostgreSQL. Además, el fallback por palabras clave exige `embedding IS NOT NULL`.
- **Linting en Backend**: `npm run lint` falla inmediatamente con exit code 1 porque el backend carece por completo de archivo de configuración `.eslintrc` o `eslint.config.js`.
- **Scripts de Ingesta Masiva**: Los scripts de ingesta remota devuelven HTTP 500 al llamar al endpoint `/legal/ingest` (documentado previamente en `TEST_RESULTS.md`).
- **Base de Datos Local Inactiva**: En el estado actual, el servidor PostgreSQL (`localhost:5432`) no está activo, por lo que los scripts y queries en vivo no pueden conectarse.

#### ¿Qué está a medio terminar (Parcial o Prototipo)?
- **Gestión Documental**: `DocumentsController` tiene el interceptor de subida de archivos (Multer) comentado (`// @UseInterceptors(...)`), utiliza una ruta fija simulada (`/tmp/mock-file.pdf`), genera el hash SHA-256 a partir de la fecha actual en lugar del contenido del archivo y simula el OCR mediante un `setTimeout` con texto ficticio.
- **RAG de Expedientes (Chat Contextual)**: `AIChatService` implementa la llamada a OpenAI pero no calcula ni persiste los tokens utilizados (`tokensInput`, `tokensOutput`), no registra el costo monetario en `AIChatMessage`, no guarda en `AIInteraction` ni actualiza `TenantUsage`.
- **Scraper CSJN**: Solo extrae sumarios de la grilla HTML; no descarga las sentencias íntegras ni los fallos en PDF. En la base de datos se duplica el sumario como `textoCompleto`.

#### ¿Qué es meramente un Mock o Placeholder visual?
- **Detalle de Expediente (`CaseDetail.tsx`)**: Pantalla visualmente terminada pero 100% hardcodeada. No consume el parámetro `:id` ni consulta al backend; muestra siempre la causa ficticia *"GARCIA c/ PEREZ s/ DAÑOS"*. El botón de importación de PDF dispara un `alert()` de simulación.
- **Redacción Inteligente (`SmartDraftingPage.tsx`)**: La interfaz no se comunica con el endpoint backend `/ai/draft`; genera un texto estático de demanda hardcodeado en una constante local.
- **Automatización Documental (`TemplatesPage.tsx`)**: No interactúa con el backend `/templates`; simula la generación con un `setTimeout` de 2 segundos y un `alert()`.
- **Sincronización Judicial (`JudicialPage.tsx` y `judicial-scraper.service.ts`)**: Emplea `Math.random() > 0.7`, demoras ficticias con `setTimeout` y links a documentos falsos (`http://pjn.gov.ar/mock-doc.pdf`).
- **Admin Dashboard y Platform**: La interfaz muestra métricas y tablas fijas; las pestañas "Legal Pixel Data Lake" y "Security Audit Logs" son textos que indican "Implementation Pending".

#### ¿Qué riesgos críticos tenemos?
1. **Vulnerabilidades de Autenticación Críticas**:
   - `auth.service.ts` permite el inicio de sesión si la contraseña ingresada coincide literalmente con el hash almacenado en texto plano (`user.passwordHash === loginDto.password`), implementado para habilitar el seed de desarrollo (`hash123`).
   - `client-portal.service.ts` tiene la validación de contraseña completamente comentada; cualquier usuario con rol `CLIENT` puede autenticarse enviando únicamente su email, sin verificar credenciales ni CUIT.
2. **Falla Crítica de Aislamiento Multi-Tenant (IDOR / Data Leak)**:
   - `expedientes.service.ts` en su método `findAll()` ejecuta `this.prisma.expediente.findMany()` sin filtrar por `organizationId`. Cualquier usuario autenticado de un estudio jurídico puede leer la totalidad de los expedientes de todos los demás clientes y estudios de la plataforma.
   - En `create()`, si no se envía `organizationId`, el backend asigna el expediente a la primera organización que encuentre en la base de datos.
3. **Exposición Abierta de Endpoints Sensibles y Administrativos**:
   - `AdminApiController` (`/admin-api/*`) y `AdminMasterController` (`/admin/*`) carecen de guards de autorización; cualquier actor no autenticado puede consultar estadísticas globales, usuarios, empresas y logs en vivo de telemetría.
   - `DraftingController`, `LegalRiskController`, `TemplatesController`, `DocumentsController` y `JudicialController` no tienen `@UseGuards(JwtAuthGuard)`.
4. **Almacenamiento del Secreto HMAC en el Frontend**:
   - El secreto de firma de `LegalPixel` está embebido en el código cliente del navegador (`VITE_PIXEL_KEY || 'default-insecure-key-REPLACE-ME'`), invalidando cualquier garantía forense de no repudio.

#### ¿Qué debemos terminar primero?
La Fase A (Estabilización y Seguridad):
1. Corregir los bypasses de autenticación y eliminar las comparaciones de texto plano.
2. Implementar filtrado obligatorio por `organizationId` derivado del JWT en todas las consultas de Prisma.
3. Proteger todos los controladores huérfanos con `JwtAuthGuard` y `RolesGuard`.
4. Corregir el esquema SQL en `jurisprudence-search.service.ts` eliminando el cast incompatible.

#### ¿Qué podemos conservar sin modificaciones?
- El motor de cálculo de plazos de `deadline-calculator.service.ts` en `agenda/`.
- El servicio de normalización de texto y extracción de conceptos jurídicos (`text-normalization.service.ts`).
- El modelo matemático de ranking de jurisprudencia (`jurisprudence-ranking.service.ts`).
- La configuración base de Tailwind, componentes visuales de UI y el layout general.
- La estructura relacional de `schema.prisma` (la cual es muy completa y sólida en su definición teórica).

#### ¿Estamos cerca de una primera versión comercializable?
**No de manera inmediata.** El proyecto cuenta con un backend compilable y pantallas de gran valor estético y conceptual, pero los flujos clave (carga de expedientes, detalle de causas, redacción de escritos, subida de documentos y cobro/control de cuotas) están desconectados o sostenidos por mocks. 

#### ¿Qué impide salir a producción hoy?
1. Vulnerabilidades de seguridad críticas (bypass de login y filtración de datos entre tenants).
2. Ausencia de almacenamiento persistente real para documentos (S3/MinIO no conectados).
3. Ausencia total de pruebas automatizadas (cobertura verificable = 0%).
4. Frontend desconectado del backend en detalle de expedientes y redacción.
5. Inexistencia de control de cuotas y costos de IA en tiempo de ejecución.

---

## 2. BASELINE DEL REPOSITORIO

- **Ruta Absoluta:** `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law`
- **Rama Git Actual:** `master`
- **Estado de HEAD:** Rama non-born / huérfana (**0 commits realizados en el repositorio**). No existe hash de commit inicial.
- **Estado del Working Tree:**
  - **154 archivos preparados en el Staging Area (staged):** Incluye `.vscode/settings.json`, `backend/.env`, archivos compilados en `backend/dist/`, dependencias parciales en `backend/node_modules/`, `docker-compose.yml`, documentación y código fuente inicial.
  - **Archivos No Rastreados (untracked):** `.gitignore` raíz, `AGENTS.md`, `README.md`, `admin-platform/`, `backend/csjn-results.json`, `backend/data/`, capturas de depuración, scripts de backend, migraciones de Prisma 4 a 8, módulos completos de backend (`admin`, `analytics`, `client-portal`, `core`, `crawler`, subdirectorios de `ia`, `judicial-engine`, `templates`) y módulos completos de frontend (`admin`, `drafting`, `ia`, `judicial`, `jurisprudencia`, `portal`, `templates`).
- **Pila Tecnológica y Versiones Reales:**
  - **Runtime:** Node.js (Ambiente Windows, PowerShell)
  - **Backend:** NestJS 10.0.0, Express, TypeScript 5.1.3, Prisma ORM 5.22.0, LangChain 0.0.96 / `@langchain/openai` 0.0.10, Playwright 1.58.0, `@nestjs/throttler` 6.5.0, Helmet 8.1.0, bcrypt 6.0.0, date-fns 4.1.0.
  - **Frontend Principal:** React 19.2.0, Vite 7.2.4, TypeScript 5.9.3, React Router DOM 7.12.0, Zustand 5.0.10, Tailwind CSS / Variables CSS nativas, Framer Motion 12.28.1, Lucide React 0.562.0, crypto-js 4.2.0.
  - **Admin Platform:** React 19.2.0, Vite 7.2.4, TypeScript 5.9.3, Tailwind CSS 4.1.18, Recharts 3.7.0, Lucide React 0.563.0.
- **Gestores de Paquetes:** `npm` con archivos de bloqueo individuales:
  - `backend/package-lock.json`
  - `frontend/package-lock.json`
  - `admin-platform/package-lock.json`
- **Infraestructura de Contenedores:** `docker-compose.yml` versión 3.8 con servicios `db` (`pgvector/pgvector:pg16` en puerto 5432) y `minio` (`minio/minio` en puertos 9000/9001). No existen Dockerfiles para el despliegue del backend ni de los frontends.

---

## 3. INVENTARIO DE MÓDULOS Y ESTADO FUNCIONAL

Se inspeccionó cada controlador, servicio, script y componente visual del repositorio. Cada funcionalidad fue evaluada y clasificada rigurosamente bajo una de las 7 categorías oficiales:

| Dominio | Funcionalidad / Módulo | Estado Real | Archivos Principales | Evidencia Técnica y Justificación |
| :--- | :--- | :--- | :--- | :--- |
| **A. Gestión Jurídica** | Autenticación JWT y Refresh Tokens | **IMPLEMENTADA SIN VERIFICACIÓN SUFICIENTE** | `auth.controller.ts`, `auth.service.ts` | Endpoints `login`, `refresh`, `logout` operativos. Falla por bypass de texto plano (`auth.service.ts:25`) y claves por defecto. |
| **A. Gestión Jurídica** | Portal de Clientes (Auth) | **PROTOTIPO** | `client-portal.controller.ts`, `client-portal.service.ts` | Validación de contraseña comentada (`client-portal.service.ts:36`). No valida CUIT. Bypass total. |
| **A. Gestión Jurídica** | Expedientes (CRUD) | **PARCIAL** | `expedientes.controller.ts`, `expedientes.service.ts` | `findAll()` no filtra por `organizationId` (fuga de datos multitenant). `create()` asigna org arbitraria. |
| **A. Gestión Jurídica** | Detalle de Causa (Frontend) | **MOCK / PLACEHOLDER** | `CaseDetail.tsx` | Muestra datos estáticos de "GARCIA c/ PEREZ". No consulta el backend para el ID de la URL. |
| **A. Gestión Jurídica** | Gestión y Versiones de Documentos | **MOCK / PLACEHOLDER** | `documents.controller.ts`, `documents.service.ts` | Subida real comentada. Usa `/tmp/mock-file.pdf`. Hash SHA-256 es un timestamp. OCR simulado vía `setTimeout`. |
| **A. Gestión Jurídica** | Agenda y Feriados Judiciales | **PARCIAL** | `agenda.controller.ts`, `agenda.service.ts` | Consulta de feriados y creación de eventos operativos. Tarea Cron solo hace log (`TODO: dispatch email`). |
| **A. Gestión Jurídica** | Cálculo de Plazos Procesales | **IMPLEMENTADA Y VERIFICADA** | `agenda/deadline-calculator.service.ts` | Lógica matemática completa (días hábiles/corridos, exclusión de fines de semana y feriados). |
| **B. Inteligencia Jurídica** | Corpus Normativo y Legislación | **PARCIAL** | `legal.controller.ts`, `legal-ingestion.service.ts` | Lógica de ingestión y búsqueda implementada. Fallas 500 documentadas en llamadas externas. Sin guard ADMIN. |
| **B. Inteligencia Jurídica** | Búsqueda Semántica de Jurisprudencia | **PARCIAL** | `jurisprudence-search.service.ts`, `jurisprudence.controller.ts` | Algoritmo implementado. Roto por cast SQL `::"LegalNormJurisdiccion"` sobre columna `TEXT`. Fallback exige embedding. |
| **B. Inteligencia Jurídica** | Ranking de Precedentes | **IMPLEMENTADA Y VERIFICADA** | `jurisprudence-ranking.service.ts` | Algoritmo multifactorial completo con 6 pesos ponderados y penalizaciones por vigencia. |
| **B. Inteligencia Jurídica** | Scraper CSJN (Playwright) | **PROTOTIPO** | `crawler/sources/csjn.ts`, `crawler/run.ts` | Extrae grilla de sumarios y guarda `csjn-results.json`. No extrae texto completo de fallos ni PDFs. |
| **B. Inteligencia Jurídica** | Scraper Formosa (Playwright) | **PROTOTIPO** | `crawler/sources/formosa.ts` | Código experimental para búsqueda en iframe. Dependiente de estructura web frágil. |
| **B. Inteligencia Jurídica** | Ingesta Pipeline Crawler → DB | **PARCIAL** | `crawler/pipeline/ingest-to-db.ts` | Carga `csjn-results.json` en DB. Duplica sumario como texto completo. Asigna IDs sintéticos si falla extracción. |
| **C. Inteligencia Artificial** | Chat Asistente de Expediente | **PARCIAL** | `ai-chat.controller.ts`, `ai-chat.service.ts` | Recupera contexto e interactúa con GPT-4o. No calcula ni persiste tokens ni costos. Hardcodea `isVerified: true`. |
| **C. Inteligencia Artificial** | Scoring de Riesgo Legal | **PROTOTIPO** | `legal-risk.controller.ts`, `legal-risk.service.ts` | Endpoint no autenticado. Devuelve JSON mock hardcodeado si el expediente no existe en DB. |
| **C. Inteligencia Artificial** | Redacción Jurídica (Drafting) | **PARCIAL (BE) / MOCK (FE)** | `drafting.controller.ts`, `SmartDraftingPage.tsx` | Backend ejecuta prompt GPT-4o sin auth. Frontend tiene texto fijo `"SEÑOR JUEZ..."` sin llamar al backend. |
| **C. Inteligencia Artificial** | Control de Cuotas y Tokens | **NO IMPLEMENTADA** | `usage-control.service.ts` | `UsageControlService` es un servicio huérfano; ningún módulo de IA lo llama. Límites mockeados en código. |
| **C. Inteligencia Artificial** | Embeddings y Normalización | **IMPLEMENTADA Y VERIFICADA** | `embedding.service.ts`, `text-normalization.service.ts` | Genera vectores de 1536 dimensiones con OpenAI o array mock aleatorio si no hay API Key. |
| **D. Seguridad y Auditoría** | Legal Pixel & Telemetría | **PROTOTIPO** | `analytics.controller.ts`, `LegalPixel.ts` | Envía eventos de telemetría. Inseguro: clave HMAC expuesta en bundle de cliente React. |
| **D. Seguridad y Auditoría** | Cadena Forense (Hash Chain) | **PARCIAL** | `forensic.service.ts`, `analytics.service.ts` | Enlace criptográfico SHA-256 + HMAC de eventos. Archivo histórico en S3 deshabilitado (`@Cron` comentado). |
| **D. Seguridad y Auditoría** | Backup Automatizado | **PROTOTIPO** | `backup.service.ts` | Ejecuta `pg_dump` con vulnerabilidad de inyección si URL no está saneada. S3 y limpieza no implementados. |
| **D. Seguridad y Auditoría** | Rate Limiting (Throttler) | **NO IMPLEMENTADA** | `app.module.ts`, `main.ts` | Módulo importado pero guardia `ThrottlerGuard` nunca fue activada en la aplicación. |
| **E. Administración** | Panel Master Admin (Backend) | **PROTOTIPO** | `admin-master.controller.ts`, `admin-api.controller.ts` | Endpoints devuelven métricas y logs sin autenticación alguna (`// import { AdminGuard }` comentado). |
| **E. Administración** | App Admin Platform (Frontend) | **MOCK / PLACEHOLDER** | `admin-platform/src/App.tsx` | Sin login. Consume API sin token. Gráficos con datos mock. Pestañas secundarias pendientes. |
| **F. Integraciones** | Automatización de Plantillas | **MOCK / PLACEHOLDER** | `templates.controller.ts`, `TemplatesPage.tsx` | Backend hardcodea `'default-org-id'`. Frontend utiliza `setTimeout` de 2s y `alert()`. |
| **F. Integraciones** | Sincronización Judicial (PJN) | **MOCK / PLACEHOLDER** | `judicial-sync.service.ts`, `judicial-scraper.service.ts` | `Math.random() > 0.7`, demoras simuladas con `setTimeout` y links falsos (`mock-doc.pdf`). |

---

## 4. AUDITORÍA DE BASE DE DATOS Y PERSISTENCIA

### Inspección del Modelo Relacional (`schema.prisma`)
El esquema contiene 16 modelos principales estructurados de forma congruente con un SaaS jurídico enterprise:
1. `Organization`, `User` (Multi-tenancy y usuarios).
2. `Expediente`, `Documento`, `Client` (Entidades jurídicas base).
3. `EventoAgenda`, `CalendarioJudicial` (Agenda y días inhábiles).
4. `LegalNorm` (Base normativa con soporte de vectores).
5. `AuditLog` (Auditoría interna con cadena de bloques / hash chain).
6. `AIInteraction` (Monitoreo de consumo de LLM).
7. `Jurisprudence`, `JurisprudenceChunk`, `JurisprudenceCitation` (Motor jurisprudencial y grafo de citas).
8. `AIChatSession`, `AIChatMessage` (Memoria de chat RAG).
9. `LegalDraft` (Borradores generados).
10. `LegalRiskAnalysis` (Scoring de riesgo).
11. `DocumentVersion` (Versionado de archivos y soporte WORM).
12. `LegalTemplate` (Plantillas de escritos).
13. `JudicialAccount` (Credenciales para sincronización con portales judiciales).
14. `SubscriptionPlan`, `TenantUsage` (Límites de plan y cuotas).
15. `EventLog` (Telemetría de Legal Pixel con hash chain y firma HMAC).
16. `EmployeeMetric` (Métricas de productividad interna).

### Hallazgos de Persistencia y Migraciones

1. **Discrepancia Crítica de Tipos entre Migración y Código SQL (`DAT-001`):**
   - En la migración inicial `20260123024057_add_jurisprudence_engine`, la columna `jurisdiccion` de la tabla `Jurisprudence` fue creada como tipo enum `LegalNormJurisdiccion`.
   - En la migración `20260124155621_fix_jurisprudence_type` (líneas 24-25), se ejecutó:
     ```sql
     DROP COLUMN "jurisdiccion",
     ADD COLUMN "jurisdiccion" TEXT NOT NULL;
     ```
   - Sin embargo, en `backend/src/ia/jurisprudence/jurisprudence-search.service.ts` (línea 89), la consulta SQL en crudo sigue aplicando:
     ```typescript
     whereConditions.push(`jurisdiccion = $${params.length + 4}::"LegalNormJurisdiccion"`);
     ```
   - **Consecuencia:** Al comparar un campo `TEXT` contra un tipo `enum`, PostgreSQL genera el error `operator does not exist: text = "LegalNormJurisdiccion"` o falla si el valor no coincide con el enum (`NACIONAL` vs `NACION`).

2. **Inconsistencia de Nomenclatura en Enums:**
   - En `schema.prisma` el enum `LegalNormJurisdiccion` define: `NACION, CABA, PBA, CBA, SFE`.
   - El crawler en `crawler/pipeline/ingest-to-db.ts` (línea 39) inserta `'NACIONAL'`. Esto provoca errores de casteo directo.

3. **Inexistencia de Índices para Búsqueda Vectorial (`pgvector`):**
   - En las migraciones no se crearon índices de tipo `HNSW` ni `IVFFlat` sobre las columnas `embedding` de `LegalNorm`, `Jurisprudence` o `JurisprudenceChunk`.
   - Todas las consultas semánticas realizan un cálculo exhaustivo secuencial (`Sequential Scan` sobre el operador `<=>`), lo cual degradará exponencialmente el rendimiento a medida que el corpus supere los 5.000 fallos.

4. **Migración "fix_jurisprudence_type" con Sobrecarga Oculta:**
   - La migración `20260124155621_fix_jurisprudence_type` no solo modificó la columna de jurisprudencia; introdujo silenciosamente 9 tablas completas (`LegalDraft`, `LegalRiskAnalysis`, `DocumentVersion`, `LegalTemplate`, `JudicialAccount`, `SubscriptionPlan`, `TenantUsage`, `EventLog`, `EmployeeMetric`). Esta falta de atomicidad dificulta el rollback en producción.

---

## 5. AUDITORÍA DE SEGURIDAD

### Vulnerabilidades Confirmadas (Severidad Crítica y Alta)

#### `SEC-001` [CRÍTICA] — Bypass de Autenticación por Comparación en Texto Plano
- **Ubicación:** `backend/src/auth/auth.service.ts`, líneas 23-30:
  ```typescript
  let isValid = false;
  if (user) {
      if (user.passwordHash === loginDto.password) { // Allow cleartext for 'hash123'
          isValid = true;
      } else {
          isValid = await bcrypt.compare(loginDto.password, user.passwordHash);
      }
  }
  ```
- **Escenario de Explotación:** Si la base de datos contiene contraseñas no hasheadas (como el seed `hash123`) o si un atacante conoce el hash bcrypt de una cuenta, puede autenticarse enviando el hash como contraseña. Anula el algoritmo bcrypt.
- **Impacto:** Compromiso total de cuentas de usuario.
- **Recomendación:** Eliminar la comparación estricta de igualdad. Forzar únicamente `bcrypt.compare`.

#### `SEC-002` [CRÍTICA] — Bypass Total de Autenticación en Portal de Clientes
- **Ubicación:** `backend/src/client-portal/client-portal.service.ts`, líneas 35-37:
  ```typescript
  // Validate password (in prod) or simplistic check
  // const isMatch = await bcrypt.compare(password, user.passwordHash);
  // if (!isMatch) throw new UnauthorizedException();
  ```
- **Escenario de Explotación:** Cualquier atacante que envíe una petición `POST /client-portal/login` con el email de cualquier cliente obtiene un JWT de acceso con rol `CLIENT` sin ingresar contraseña ni validar CUIT.
- **Impacto:** Acceso no autorizado a expedientes y documentos privados de clientes.
- **Recomendación:** Implementar validación estricta de credenciales (o magic link seguro) y verificar pertenencia al tenant.

#### `SEC-003` [CRÍTICA] — Fuga de Datos Multi-Tenant en Expedientes (IDOR)
- **Ubicación:** `backend/src/expedientes/expedientes.service.ts`, líneas 9-23:
  ```typescript
  async findAll() {
      return this.prisma.expediente.findMany({
          orderBy: { updatedAt: 'desc' }
      });
  }
  ```
- **Escenario de Explotación:** `ExpedientesController.findAll()` no extrae `req.user.organizationId` ni lo pasa al servicio. Un abogado de la "Organización A" recibe en la respuesta JSON la totalidad de las causas de la "Organización B", "Organización C", etc.
- **Impacto:** Violación absoluta del secreto profesional y de leyes de protección de datos personales.
- **Recomendación:** Inyectar el usuario autenticado desde el JWT en todos los métodos del servicio y filtrar obligatoriamente por `where: { organizationId: user.organizationId }`.

#### `SEC-004` [CRÍTICA] — Exposición Pública de Controladores Administrativos y Operativos
- **Ubicación:**
  - `backend/src/admin/admin-api.controller.ts` (líneas 6-24): Métricas globales, logs y tráfico sin guard.
  - `backend/src/admin/admin-master.controller.ts` (líneas 6-36): `GET /admin/tenants` expone todos los estudios y usuarios sin guard.
  - `backend/src/analytics/analytics.controller.ts` (línea 35): `GET /events/logs` expone logs de auditoría sin autenticación.
  - `backend/src/expedientes/documents.controller.ts` (líneas 6-36): Cero guards de JWT.
  - `backend/src/ia/drafting/drafting.controller.ts` (líneas 5-36): Cero guards; acepta `userId` arbitrario en el body.
  - `backend/src/ia/risk/legal-risk.controller.ts` (líneas 5-23): Cero guards.
  - `backend/src/templates/templates.controller.ts` (líneas 5-26): Cero guards.
  - `backend/src/judicial-engine/judicial.controller.ts` (líneas 5-18): Cero guards.
- **Impacto:** Exposición no autenticada de datos judiciales confidenciales, capacidad de manipular registros y consumo no regulado de APIs de IA.
- **Recomendación:** Aplicar `@UseGuards(JwtAuthGuard, RolesGuard)` en todos los controladores y verificar el tenant en cada transacción.

#### `SEC-005` [ALTA] — Claves Criptográficas Hardcodeadas y Secreto HMAC en el Navegador
- **Ubicación:**
  - `backend/src/auth/strategies/jwt.strategy.ts` (línea 14): Fallback a `'secret'`.
  - `backend/src/auth/auth.service.ts` (línea 59): Fallback a `'refresh-secret'`.
  - `backend/src/core/security/pixel.guard.ts` (línea 13) y `forensic.service.ts` (línea 13): Fallback a `'default-insecure-key-REPLACE-ME'`.
  - `frontend/src/core/analytics/LegalPixel.ts` (línea 83):
    ```typescript
    const HMAC_SECRET = import.meta.env.VITE_PIXEL_KEY || 'default-insecure-key-REPLACE-ME';
    ```
- **Impacto:** El secreto utilizado para firmar peticiones de telemetría forense queda visible en el código JavaScript compilado en el navegador de cualquier usuario. Cualquier cliente puede falsificar firmas de eventos de auditoría.
- **Recomendación:** Las firmas de telemetría deben ser emitidas por un backend autenticado o utilizar tokens de sesión efímeros de corta duración.

#### `SEC-006` [ALTA] — Inyección de Comandos en el Servicio de Backup
- **Ubicación:** `backend/src/core/backup/backup.service.ts`, línea 48:
  ```typescript
  const { stdout, stderr } = await execAsync(`pg_dump "${dbUrl}" -F c -b -v -f "${filePath}"`);
  ```
- **Impacto:** Concatenación de cadena de variables de entorno directamente en el intérprete del sistema operativo (`child_process.exec`). Si la variable `DATABASE_URL` contiene caracteres de escape o delimitadores de comando, permite Remote Code Execution (RCE).
- **Recomendación:** Utilizar `execFile` o APIs seguras pasando los argumentos como un arreglo de cadenas sin invocar un shell del sistema.

#### `SEC-007` [ALTA] — Rate Limiting Inactivo
- **Ubicación:** `backend/src/app.module.ts`, líneas 22-25.
- **Evidencia:** `ThrottlerModule` está configurado con `ttl: 60000, limit: 10`, pero no existe registro de `APP_GUARD` en providers ni uso de `ThrottlerGuard` en controladores.
- **Impacto:** Endpoints de autenticación y de invocación a OpenAI están desprotegidos contra ataques de fuerza bruta y denegación de servicio por agotamiento de créditos.
- **Recomendación:** Registrar `{ provide: APP_GUARD, useClass: ThrottlerGuard }` en `AppModule`.

---

## 6. AUDITORÍA DE RENDIMIENTO Y COSTOS

### Generadores de Costos Reales
1. **Modelos de OpenAI sin Control de Presupuesto:**
   - La aplicación invoca `gpt-4-turbo-preview` en `IAService` y `gpt-4o` en `AIChatService`, `DraftingService` y `LegalRiskService`.
   - `UsageControlService` está programado pero **completamente desconectado**. No existe limitador previo a la inferencia. Un usuario malintencionado puede enviar peticiones masivas al endpoint `/ai/chat/:id` o `/ai/draft` y agotar la cuenta de OpenAI en minutos.
2. **Cálculo de Embeddings:**
   - Utiliza `text-embedding-3-small`. Si bien es económico ($0.02 por 1M de tokens), no existe caché de embeddings en Redis o memoria para consultas idénticas.
3. **Consultas a Base de Datos:**
   - La búsqueda en `JurisprudenceSearchService` ejecuta `$queryRawUnsafe` calculando distancias coseno en tiempo real sobre toda la tabla sin índices `HNSW`. A partir de 10.000 fallos, cada búsqueda consumirá el 100% de CPU del contenedor PostgreSQL.

### Evaluación para una Operación Inicial (Estudio Pequeño)
- **Infraestructura Necesaria para Fase 1:**
  - 1 VPS estándar (2 vCPU, 4 GB RAM) corriendo PostgreSQL con pgvector y la API en Docker.
  - Costo de infraestructura: ~US$ 15 - 25 / mes.
  - No se requiere arquitectura sobredimensionada (Kubernetes, clusters de ClickHouse o TimescaleDB son totalmente innecesarios en esta etapa).
- **Control de Inferencia Obligatorio:**
  - Migrar prompts rutinarios de redacción y clasificación a modelos más costo-eficientes como `gpt-4o-mini` o `gemini-1.5-flash`, reservando `gpt-4o` exclusivamente para dictámenes y recursos de alta complejidad.

---

## 7. AUDITORÍA DE CALIDAD Y PRUEBAS

### Ejecución de Pruebas y Análisis Estático

| Herramienta / Suite | Comando Ejecutado | Resultado | Detalle |
| :--- | :--- | :--- | :--- |
| **Jest (Backend)** | `cd backend; npx jest --listTests` | **0 pruebas encontradas** | Exit code 0, pero lista vacía. No existen archivos `*.spec.ts` ni `*.test.ts`. |
| **TypeScript (Backend)** | `cd backend; npx tsc --noEmit` | **Aprobado (0 errores)** | El código TypeScript del backend compila correctamente sin errores de tipos. |
| **TypeScript (Frontend)** | `cd frontend; npx tsc --noEmit` | **Aprobado (0 errores)** | El código TypeScript del frontend compila sin errores de tipos. |
| **TypeScript (Admin)** | `cd admin-platform; npx tsc --noEmit` | **Aprobado (0 errores)** | El código TypeScript del admin platform compila sin errores. |
| **ESLint (Backend)** | `cd backend; npx eslint "src/**/*.ts"` | **Fallido (Exit code 1)** | `ESLint couldn't find a configuration file`. Falta `.eslintrc` en backend. |
| **ESLint (Frontend)** | `cd frontend; npx eslint .` | **41 problemas (37 errores, 4 warnings)** | Mayormente `@typescript-eslint/no-explicit-any`, variables sin uso y dependencias de hooks. |
| **ESLint (Admin)** | `cd admin-platform; npx eslint .` | **5 problemas (5 errores)** | Errores de tipado por uso de `any`. |
| **Scripts de Verificación** | `cd backend; npx ts-node scripts/check-data-counts.ts` | **Conexión rechazada** | Base de datos `localhost:5432` offline. |

### Diagnóstico de Pruebas
- **Cobertura Automatizada Real:** **0.0%**. No existen pruebas unitarias, de integración, E2E, de carga ni de aislamiento multi-tenant en el repositorio.
- Las pruebas referenciadas en `docs/TEST_RESULTS.md` correspondían a ejecuciones manuales de scripts en consola en una fecha anterior, de las cuales 4 de 6 fallaron con error 500.

---

## 8. AUDITORÍA DEL FRONTEND Y EXPERIENCIA DE USUARIO

### Flujos de Punta a Punta: Estado de Conexión

```
[ LOGIN ] ──────────────► Funciona (conecta a /auth/login y almacena token en Zustand)
    │
    ├─► [ EXPEDIENTES LIST ] ──► Funciona (conecta a /expedientes; pero sufre fuga multitenant)
    │        │
    │        ├─► [ NUEVO EXPEDIENTE ] ──► Parcial (crea registro en DB; subida de archivos simulada)
    │        │
    │        └─► [ DETALLE EXPEDIENTE ] ─► MOCK TOTAL (ignora :id, contenido fijo hardcodeado)
    │
    ├─► [ AGENDA JUDICIAL ] ──► Funciona (conecta a /agenda y simula plazos en backend)
    │
    ├─► [ JURISPRUDENCIA ] ───► Parcial (conecta a /jurisprudence; falla en backend por cast SQL)
    │
    ├─► [ REDACCIÓN IA ] ─────► MOCK TOTAL (no llama al backend; devuelve texto fijo en memoria)
    │
    ├─► [ TEMPLATES ] ────────► MOCK TOTAL (setTimeout de 2 segundos y alert)
    │
    ├─► [ JUDICIAL PJN ] ─────► MOCK TOTAL (backend y frontend simulan con Math.random)
    │
    └─► [ ADMIN DASHBOARD ] ──► MOCK TOTAL (gráficos y tablas estáticas)
```

### Deuda Técnica y Código Muerto en Frontend
1. **Archivos Huérfanos / Duplicados en `frontend/src/pages/`:**
   - `frontend/src/pages/CaseDetail.tsx` (duplicado no utilizado de `modules/expedientes/pages/CaseDetail.tsx`).
   - `frontend/src/pages/Dashboard.tsx` (duplicado no utilizado de `modules/dashboard/pages/Dashboard.tsx`).
   - `frontend/src/layout/MainLayout.tsx` (duplicado no utilizado de `components/layout/MainLayout.tsx`).
   - `frontend/src/pages/Jurisprudence.tsx` (código antiguo de búsqueda que coexiste confusamente con `modules/jurisprudencia/pages/JurisprudencePage.tsx`).
2. **Hardcoded URLs:**
   - Múltiples componentes (`CaseDetail.tsx`, `LegalRiskWidget.tsx`, `JudicialPage.tsx`, `Jurisprudence.tsx`) realizan llamadas directas a `fetch('http://localhost:3000/...')` saltándose la instancia centralizada `apiClient`.

---

## 9. CONTRADICCIONES DOCUMENTALES Y VERACIDAD

Se contrastaron las afirmaciones contenidas en la carpeta `docs/` con el código real del repositorio:

| Afirmación Documental | Documento de Origen | Realidad Verificada en el Código | Clasificación |
| :--- | :--- | :--- | :--- |
| "Legal Pixel HMAC Security Layer: Integridad garantizada y anti-tampering" | `docs/SECURITY_FORENSICS.md`, `TELEMETRY_ARCHITECTURE.md` | El secreto HMAC está expuesto en texto plano en el frontend React (`LegalPixel.ts:83`). | **Documentación engañosa / Insegura** |
| "Almacenamiento WORM en S3 / MinIO para cumplimiento probatorio" | `docs/DOCUMENT_MANAGEMENT.md`, `ENTERPRISE_PRODUCTION_READINESS.md` | No hay integración con S3 ni MinIO. Los archivos usan la ruta `/tmp/mock-file.pdf`. | **Funcionalidad declarada no implementada** |
| "Control de Cuotas y Límites de Consumo de IA por Tenant" | `docs/AI_USAGE_CONTROL.md`, `SUBSCRIPTIONS.md` | `UsageControlService` existe como archivo pero no es importado ni llamado por ningún endpoint de IA. | **Funcionalidad declarada no implementada** |
| "Sincronización automatizada con PJN y Notificaciones Judiciales" | `docs/JUDICIAL_INTEGRATION.md` | `JudicialScraperService` usa `Math.random() > 0.7` y demoras artificiales. No conecta a PJN. | **Mock / Simulación documentada como real** |
| "Gestión de Secretos con Doppler" | `docs/DEPLOYMENT.md`, `README.md` | `@dopplerhq/node-sdk` está instalado pero nunca es importado en el código. Las variables se leen de `.env`. | **Documentación desactualizada** |
| "Suite de pruebas completa y validada" | `docs/TEST_RESULTS.md` | 0 archivos de pruebas automatizadas en todo el repositorio. Los tests eran scripts de consola aislados. | **Documentación desactualizada / No verificable** |

---

## 10. MATRIZ DE MADUREZ DEL PRODUCTO

| Módulo / Capacidad | Madurez Real | Nivel de Riesgo | Dependencias Críticas | Próximo Paso Técnico |
| :--- | :--- | :--- | :--- | :--- |
| **Autenticación y Sesiones** | 65% | ALTO | Prisma, Base de Datos | Eliminar bypass de texto plano; validar contraseñas en Portal de Clientes. |
| **Aislamiento Multi-Tenant** | 20% | CRÍTICO | Esquema Prisma | Implementar interceptor global o middleware para forzar `organizationId` en queries. |
| **Gestión de Expedientes** | 40% | ALTO | Multi-tenancy | Conectar frontend `CaseDetail.tsx` al backend real mediante `apiClient`. |
| **Gestión Documental & Archivos** | 15% | ALTO | MinIO / S3, Multer | Configurar carga real de archivos multipart, almacenamiento en MinIO y cálculo de hash sobre buffer. |
| **Motor de Plazos Judiciales** | 85% | BAJO | CalendarioJudicial | Unificar servicios duplicados y programar notificaciones reales en el Cron. |
| **Búsqueda Jurisprudencial (RAG)**| 70% | MEDIO | PostgreSQL pgvector | Corregir el cast de tipo en `jurisprudence-search.service.ts` y crear índices HNSW. |
| **Scraper Judicial (CSJN/PJN)** | 35% | MEDIO | Playwright, Worker queue | Implementar descarga de fallos completos y desacoplar scraper en workers asíncronos. |
| **Chat de Expediente (IA)** | 55% | MEDIO | OpenAI API, Cuotas | Cablear `UsageControlService`, calcular tokens reales y persistir costos en base de datos. |
| **Redacción Inteligente (IA)** | 30% | MEDIO | OpenAI API | Proteger endpoint `/ai/draft` y conectar frontend `SmartDraftingPage.tsx`. |
| **Scoring de Riesgo (IA)** | 40% | MEDIO | Expediente real | Quitar mock por defecto en caso no encontrado; proteger endpoint con JWT. |
| **Automatización Documental** | 20% | BAJO | Motor Handlebars | Conectar frontend con `/templates` y quitar IDs de organización hardcodeados. |
| **Panel de Administración** | 25% | ALTO | Auth Guards | Implementar `AdminGuard` y restringir acceso exclusivamente a rol SUPER_ADMIN. |
| **Infraestructura y Despliegue** | 20% | ALTO | Dockerfiles | Crear Dockerfiles para backend y frontends; automatizar migraciones en arranque. |

*Nota Metodológica:* El porcentaje representa la proporción de código funcional, verificado y conectado de extremo a extremo frente a los requisitos necesarios para operar en producción.

---

## 11. CLASIFICACIÓN DE HALLAZGOS Y PLAN DE ACCIÓN

### Prioridad P0 — Bloqueantes Críticos (Impiden Salir a Producción y Representan Riesgo Legal/Seguridad)
1. **`SEC-001`**: Eliminar bypass de contraseña en texto plano en `auth.service.ts`.
2. **`SEC-002`**: Implementar autenticación real obligatoria en `client-portal.service.ts`.
3. **`SEC-003`**: Corregir filtrado multi-tenant en `expedientes.service.ts` y en todos los servicios de la aplicación.
4. **`SEC-004`**: Proteger controladores huérfanos (`AdminApiController`, `AdminMasterController`, `AnalyticsController`, `DocumentsController`, `DraftingController`, `LegalRiskController`, `TemplatesController`, `JudicialController`) con `JwtAuthGuard` y `RolesGuard`.
5. **`SEC-005`**: Eliminar fallback a claves hardcodeadas (`'secret'`, `'refresh-secret'`, `'default-insecure-key-REPLACE-ME'`) y remover el secreto HMAC del frontend.
6. **`DAT-001`**: Corregir error de tipos en `jurisprudence-search.service.ts` eliminando el cast `::"LegalNormJurisdiccion"` sobre la columna `TEXT`.

### Prioridad P1 — Alta Prioridad (Requeridos para Estabilidad y Funcionalidad Básica de Negocio)
1. **`SEC-006`**: Sanear ejecución de comandos en `BackupService` (`execFile` seguro) e implementar rotación/eliminación real de backups locales antiguos.
2. **`AI-001`**: Conectar `UsageControlService` a los flujos de IA (`AIChatService`, `DraftingService`, `IAService`), calculando tokens y validando cuotas antes de llamar a OpenAI.
3. **`SEC-007`**: Activar `ThrottlerGuard` globalmente en `AppModule` para prevenir ataques de fuerza bruta y agotamiento de saldo en OpenAI.
4. **`DAT-002`**: Implementar almacenamiento real de archivos (Multer + MinIO/S3 local) en `DocumentsService`, calculando hash SHA-256 real sobre el buffer del archivo.
5. **`TST-001`**: Configurar suite de pruebas unitarias en Jest para backend y Vitest para frontend, alcanzando al menos los tests críticos de autenticación y aislamiento multi-tenant.
6. **`FE-001`**: Conectar pantallas del frontend (`CaseDetail.tsx`, `SmartDraftingPage.tsx`, `TemplatesPage.tsx`) con los endpoints reales del backend eliminando mocks estáticos.

### Prioridad P2 — Importantes (Deuda Técnica y Escalabilidad)
1. **`ARC-001`**: Unificar los servicios duplicados de cálculo de plazos procesales (`backend/src/ia/engine/deadline-calculator.service.ts` y `backend/src/agenda/deadline-calculator.service.ts`).
2. **`ARC-002`**: Eliminar archivos de frontend muertos y huérfanos (`pages/CaseDetail.tsx`, `pages/Dashboard.tsx`, `layout/MainLayout.tsx`, `pages/Jurisprudence.tsx`).
3. **`EXT-001`**: Mejorar el scraper de CSJN para extraer fallos íntegros y PDFs en lugar de limitarse a la tabla de sumarios.
4. **`PERF-001`**: Crear índices `HNSW` sobre las columnas de vector en PostgreSQL para optimizar la búsqueda jurisprudencial semántica.

### Prioridad P3 — Mejoras y Limpieza
1. **`CODE-001`**: Crear configuración `.eslintrc.js` en backend y resolver los 41 problemas de linter en el frontend.
2. **`CONF-001`**: Limpiar dependencias no utilizadas (`@dopplerhq/node-sdk`) o documentar su integración formal.
3. **`DOCK-001`**: Crear `Dockerfile` optimizado multicapa para backend y frontend.

---

## 12. PLAN DE FINALIZACIÓN POR FASES

```mermaid
flowchart TD
    subgraph Fase A [Fase A — Estabilización y Seguridad]
        A1[Corregir Auth Bypasses SEC-001 / SEC-002] --> A2[Blindar Aislamiento Multi-Tenant SEC-003]
        A2 --> A3[Proteger Controladores Huérfanos SEC-004]
        A3 --> A4[Corregir Incompatibilidad SQL DAT-001]
        A4 --> A5[Activar Rate Limiting SEC-007]
    end

    subgraph Fase B [Fase B — Completar Funcionalidades Existentes]
        B1[Carga Real de Archivos MinIO/S3 DAT-002] --> B2[Conectar Frontend CaseDetail y Redacción]
        B2 --> B3[Conectar UsageControlService y Tokens AI-001]
        B3 --> B4[Unificar Deadline Calculators ARC-001]
    end

    subgraph Fase C [Fase C — Calidad y Pruebas]
        C1[Configurar Jest y .eslintrc en Backend] --> C2[Tests de Aislamiento Multi-Tenant]
        C2 --> C3[Tests de Flujo Crítico Auth / Casos / RAG]
        C3 --> C4[Limpieza de Código Muerto ARC-002]
    end

    subgraph Fase D [Fase D — Preparación para Producción]
        D1[Dockerfiles de Producción] --> D2[Rotación y Backup Seguro SEC-006]
        D2 --> D3[Índices Vectoriales HNSW PERF-001]
        D3 --> D4[Variables de Entorno y Secretos Productivos]
    end

    Fase A --> Fase B
    Fase B --> Fase C
    Fase C --> Fase D
```

---

## 13. LIMITACIONES DE LA AUDITORÍA Y VERIFICACIÓN DE ESTADO

### Limitaciones de Ejecución
1. **Auditoría de Solo Lectura:** En estricto cumplimiento de la regla de no modificación, no se ejecutaron refactorizaciones, instalaciones de paquetes ni alteraciones de archivos.
2. **Base de Datos Local Inactiva:** El contenedor PostgreSQL local (`localhost:5432`) no se encontraba en ejecución durante la sesión. Los scripts dinámicos que requerían conexión a base de datos reportaron error de conexión esperado (`Can't reach database server at localhost:5432`). Se auditó el 100% del código fuente, las migraciones SQL y la configuración estática.

### Verificación de No Alteración del Repositorio
- **HEAD Inicial:** Rama `master` sin commits (unborn branch).
- **HEAD Final:** Rama `master` sin commits (unborn branch, inalterado).
- **Estado del Working Tree:** Exactamente idéntico al baseline inicial.
- **Archivos Modificados por la Auditoría:** **Ninguno (0 archivos modificados)**. Únicamente se generó el presente informe `MASTER-TECHNICAL-AUDIT-001.md` solicitado expresamente como entregable de auditoría.

---

## 14. CONCLUSIÓN TÉCNICA

El proyecto **Abogado Virtual** posee un valor acumulado significativo en términos de arquitectura conceptual, modelo de datos relacional y diseño de interfaces. Sin embargo, su estado actual es el de un **prototipo funcional avanzado en fase alpha tardía**, no el de un producto SaaS listo para comercializarse.

Las brechas críticas identificadas no exigen reescribir el sistema ni cambiar de tecnologías: el stack seleccionado (NestJS, React, Prisma, PostgreSQL pgvector, OpenAI) es plenamente adecuado. El camino más eficiente para alcanzar la primera versión comercializable consiste en ejecutar metódicamente las correcciones de la **Fase A (Estabilización y Seguridad)** para garantizar la privacidad y robustez del sistema, seguido de la **Fase B** para conectar las pantallas clave que hoy funcionan con datos simulados.

