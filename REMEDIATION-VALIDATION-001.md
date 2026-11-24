# PLAN DE REMEDIACIÓN Y VALIDACIÓN TÉCNICA BASELINE 001

**Expediente:** `ABOGADOS-LAW-REMEDIATION-BASELINE-001`  
**Referencia:** `MASTER-TECHNICAL-AUDIT-001`  
**Modalidad:** READ-ONLY + DISEÑO TÉCNICO (Sin mutaciones en el repositorio)  
**Fecha de Elaboración:** 23 de Noviembre de 2026  
**Repositorio:** `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law`

---

## 1. RESULTADO DE VALIDACIÓN DEL BASELINE GIT Y RIESGOS

### 1.1. Estado Verificado del Árbol Git
- **Rama Actual:** `master` (rama huérfana / *unborn branch*).
- **HEAD:** Inexistente. El repositorio tiene **0 commits** en su historial.
- **Archivos Staged (Área de Preparación):** 154 archivos preparados.
  - **Archivos de Compilación e Infraestructura Staged:** `backend/dist/*` (código JS compilado, sourcemaps, definiciones `.d.ts`), `.vscode/settings.json`.
  - **Dependencias en Node Modules Staged:** Subdirectorios de `backend/node_modules/` (como `zod`, `uuid`, `p-limit`).
  - **Archivo de Secretos Staged:** `backend/.env` (contiene cadenas de conexión vivas y claves de API).
- **Archivos Unstaged (Modificaciones locales sobre archivos staged):**
  - Múltiples discrepancias entre la versión staged y la versión en disco (e.g. `backend/prisma/schema.prisma`, `backend/src/main.ts`, `backend/src/auth/auth.service.ts`).
- **Archivos Untracked (No rastreados):**
  - `.gitignore` raíz (¡no está en seguimiento!).
  - `admin-platform/` (aplicación completa de Vite).
  - Migraciones de Prisma 4 a 8 (`20260123010849_add_refresh_token` hasta `20260124155621_fix_jurisprudence_type`).
  - Módulos enteros de backend: `admin`, `analytics`, `client-portal`, `core`, `crawler`, `ia/chat`, `ia/drafting`, `ia/jurisprudence`, `ia/legal`, `ia/nlu`, `ia/risk`, `judicial-engine`, `templates`.
  - Módulos enteros de frontend: `admin`, `drafting`, `ia`, `judicial`, `jurisprudencia`, `portal`, `templates`.
  - Scripts en `backend/scripts/`.
  - Archivos de datos: `backend/csjn-results.json`, `backend/data/sample_jurisprudence.json`.

### 1.2. Riesgos Críticos de Realizar un Commit en el Estado Actual
1. **Fuga Permanente de Secretos en el Historial de Git (`P0`):** Al estar `backend/.env` en el staging area, cualquier commit grabará en el historial SHA-1 claves de OpenAI, credenciales de PostgreSQL y claves de AWS. Aunque luego se borre el archivo, el blob queda persistido en `.git`.
2. **Contaminación del Repositorio con Build Artifacts y `node_modules` (`P1`):** Subir `backend/dist/` y paquetes de `node_modules/` hinchará artificialmente el repositorio, generando conflictos constantes de merge y desincronización de compilación.
3. **Commit Incoherente / Código Quebrado (`P0`):** Los archivos staged corresponden a una versión previa incompleta del proyecto. El código no rastreado (`untracked`) contiene las migraciones y los módulos de NestJS que satisfacen las dependencias de `AppModule`. Si se commitea únicamente lo staged, el backend no compilará.

### 1.3. Procedimiento Diseñado para Establecer un Baseline Git Seguro (NO EJECUTADO)
Este procedimiento está diseñado para ejecutarse únicamente cuando se autorice expresamente el inicio de la Fase de Remediación:
```bash
# 1. Deshacer el staging actual completo sin alterar el código de trabajo
git reset

# 2. Asegurar que .gitignore incluya expresamente los patrones críticos
# (Verificar presencia de: .env, node_modules/, dist/, build/, *.log)

# 3. Preparar únicamente los archivos de configuración y código fuente limpio
git add .gitignore README.md AGENTS.md docker-compose.yml
git add backend/package.json backend/package-lock.json backend/tsconfig.json backend/prisma/
git add backend/src/ backend/scripts/
git add frontend/package.json frontend/package-lock.json frontend/tsconfig*.json frontend/vite.config.ts frontend/index.html
git add frontend/src/ frontend/public/
git add admin-platform/package.json admin-platform/package-lock.json admin-platform/tsconfig*.json admin-platform/vite.config.ts admin-platform/index.html
git add admin-platform/src/ admin-platform/public/
git add docs/

# 4. Verificar que .env y dist NO estén en el índice
git status

# 5. Crear el commit baseline inicial limpio y reproducible
git commit -m "chore(baseline): initial project baseline snapshot (clean tracking)"
```

---

## 2. REVISIÓN CRÍTICA DE LAS CONCLUSIONES DE LA AUDITORÍA

Se revisaron exhaustivamente las afirmaciones técnicas y cuantitativas emitidas en `MASTER-TECHNICAL-AUDIT-001`:

| Afirmación de la Auditoría | Clasificación | Justificación y Evidencia del Repositorio |
| :--- | :--- | :--- |
| **Cobertura de pruebas automatizadas en 0.0%** | **CONFIRMADA** | `npx jest --listTests` no detecta ningún archivo `*.spec.ts` ni `*.test.ts`. `package.json` en backend, frontend y admin carecen de scripts de test funcionales. No hay infraestructura de tests en ejecución. |
| **Ausencia de índices HNSW / IVFFlat para pgvector** | **CONFIRMADA** | La inspección de las 8 carpetas de migraciones en `backend/prisma/migrations/` revela que ninguna migración SQL incluye `CREATE INDEX ... USING hnsw` ni `USING ivfflat` sobre la columna `embedding`. |
| **Discrepancia de tipos SQL en búsqueda jurisprudencial (`DAT-001`)** | **CONFIRMADA** | La migración `20260124155621_fix_jurisprudence_type` convierte `jurisdiccion` a `TEXT`, pero `jurisprudence-search.service.ts` línea 89 castea forzosamente a `::"LegalNormJurisdiccion"`. |
| **Bypass de contraseña en `auth.service.ts` (`SEC-001`)** | **CONFIRMADA** | Verificado en `backend/src/auth/auth.service.ts` línea 25: `if (user.passwordHash === loginDto.password) isValid = true;`. Permite inicio de sesión con contraseña en texto plano. |
| **Bypass de contraseña en `client-portal.service.ts` (`SEC-002`)** | **CONFIRMADA** | Verificado en `backend/src/client-portal/client-portal.service.ts` líneas 35-37: la comparación de contraseña fue comentada y no valida el CUIT. Cualquier cliente con email válido se autentica. |
| **Fuga de datos multi-tenant en expedientes (`SEC-003`)** | **CONFIRMADA** | Verificado en `backend/src/expedientes/expedientes.service.ts` línea 9: `findAll()` ejecuta `findMany()` sin filtro de `organizationId`. Fuga masiva de causas entre estudios jurídicos. |
| **Controladores expuestos sin guards (`SEC-004`)** | **CONFIRMADA** | 16 de los 38 endpoints carecen de `@UseGuards(JwtAuthGuard)` o guards de rol, incluyendo endpoints administrativos, de generación de demandas y de descarga de documentos. |
| **Secreto HMAC expuesto en el frontend (`SEC-005`)** | **CONFIRMADA** | Verificado en `frontend/src/core/analytics/LegalPixel.ts` línea 83: `const HMAC_SECRET = import.meta.env.VITE_PIXEL_KEY \|\| 'default-insecure-key-REPLACE-ME'`. Secreto embebido en el bundle del cliente. |
| **Riesgo de inyección de comandos en backup (`SEC-006`)** | **CONFIRMADA** | Verificado en `backend/src/core/backup/backup.service.ts` línea 48: llamada a `execAsync` interpolando la variable de conexión `DATABASE_URL` en una subshell. |
| **Rate limiting inactivo en NestJS (`SEC-007`)** | **CONFIRMADA** | `ThrottlerModule` está importado en `AppModule`, pero no existe `APP_GUARD` en los providers ni uso de `ThrottlerGuard` en ningún controller. |
| **Desconexión de control de costos de IA (`AI-001`)** | **CONFIRMADA** | `UsageControlService` existe pero no es importado ni llamado por ningún endpoint de IA. Las llamadas a GPT-4o no validan saldo ni registran tokens en `AIChatMessage`. |
| **Degradación a 100% CPU con 10.000 fallos** | **NO DEMOSTRADA EMPÍRICAMENTE** | Si bien la teoría de bases de datos indica que un cálculo de distancia coseno sobre 1536 dimensiones sin índice realiza un Sequential Scan, la degradación exacta al 100% de CPU no fue medida en el hardware del servidor actual con datos de prueba. Se mantiene como riesgo fundado, no como métrica medida. |
| **Porcentajes de madurez cuantitativos asignados a módulos** | **CONFIRMADA PARCIALMENTE** | Las etiquetas cualitativas (*Implementada*, *Parcial*, *Prototipo*, *Mock*) son 100% exactas y contrastadas. Sin embargo, los porcentajes exactos (e.g. 85%, 40%) son estimaciones agregadas de avance técnico y no mediciones estadísticas formales. |

---

## 3. AUDITORÍA TRANSVERSAL MULTI-TENANT

### 3.1. Entidades con Alcance de Organización (Tenant-Scoped)
En `schema.prisma`, las siguientes entidades almacenan información privada de un estudio jurídico:
1. `Organization`: Raíz del tenant.
2. `User`: Pertenece a una organización (`organizationId`).
3. `Expediente`: Pertenece a una organización (`organizationId`).
4. `Documento`: Pertenece a un expediente (relación indirecta con `organizationId`).
5. `DocumentVersion`: Pertenece a un documento.
6. `Client`: Pertenece a una organización (`organizationId`).
7. `EventoAgenda`: Pertenece a un expediente.
8. `LegalTemplate`: Pertenece a una organización (`organizationId`).
9. `JudicialAccount`: Pertenece a una organización (`organizationId`).
10. `TenantUsage`: Pertenece a una organización (`organizationId`).
11. `EventLog`: Registra eventos con `organizationId`.
12. `AIChatSession`: Vinculado a `expedienteId` y `userId`.
13. `AIChatMessage`: Pertenece a una sesión de chat.
14. `LegalDraft`: Vinculado a `userId` y `expedienteId` (carece de columna directa `organizationId`).
15. `LegalRiskAnalysis`: Vinculado a `expedienteId` (carece de columna directa `organizationId`).

### 3.2. Matriz Transversal Multi-Tenant por Módulo y Operación

| Módulo | Operación | Endpoint / Método | Identidad Requerida | Tenant Validado | Riesgo Identificado | Prueba Requerida |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Expedientes** | Lectura masiva | `GET /expedientes` | Abogado / Socio | **NO** | `CRÍTICO`: Un usuario de Org A lee todos los expedientes de Org B y C. | `TEST-TENANT-EXP-001` |
| **Expedientes** | Creación | `POST /expedientes` | Abogado / Socio | **NO** | `CRÍTICO`: Permite inyectar `organizationId` arbitrario o asigna el primer tenant de la BD. | `TEST-TENANT-EXP-002` |
| **Documentos** | Subida versión | `POST /documents/:id/versions` | Abogado / Empleado | **NO** | `CRÍTICO`: Permite subir versiones a documentos de otra organización sin autenticación. | `TEST-TENANT-DOC-001` |
| **Documentos** | Legal Hold | `PATCH /documents/:id/legal-hold`| Abogado / Socio | **NO** | `ALTO`: Bloqueo o desbloqueo no autorizado de documentos de cualquier estudio. | `TEST-TENANT-DOC-002` |
| **Documentos** | Comparación | `GET /documents/compare/:v1/:v2` | Abogado | **NO** | `MEDIO`: Lectura cruzada de contenido OCR de versiones ajenas. | `TEST-TENANT-DOC-003` |
| **Agenda** | Listar eventos | `GET /agenda` | Abogado | **SÍ** | `BAJO`: Filtra correctamente por `user.organizationId`. | `TEST-TENANT-AGE-001` |
| **Agenda** | Crear evento | `POST /agenda/eventos` | Abogado | **NO** | `ALTO`: No verifica si el `expedienteId` pertenece a la organización del usuario. | `TEST-TENANT-AGE-002` |
| **Chat IA** | Inferencia / Prompt | `POST /ai/chat/:expedienteId` | Abogado | **NO** | `CRÍTICO`: Permite dialogar con la IA sobre expedientes de otros estudios; RAG inyecta datos ajenos. | `TEST-TENANT-AI-001` |
| **Chat IA** | Historial de chat | `GET /ai/chat/:expedienteId/history`| Abogado | **NO** | `ALTO`: Acceso a conversaciones confidenciales si se conoce el `expedienteId`. | `TEST-TENANT-AI-002` |
| **Redacción IA**| Generar escrito | `POST /ai/draft` | Abogado | **NO** | `CRÍTICO`: Genera escritos vinculados a casos ajenos sin autenticación alguna. | `TEST-TENANT-DFT-001` |
| **Redacción IA**| Listar borradores | `GET /ai/draft/user/:userId` | Abogado | **NO** | `ALTO`: Lectura de todos los escritos de cualquier usuario pasando su ID. | `TEST-TENANT-DFT-002` |
| **Riesgo IA** | Evaluar riesgo | `POST /ai/risk-score/:id` | Abogado | **NO** | `ALTO`: Inferencia y análisis de estrategia sobre causas ajenas sin autenticación. | `TEST-TENANT-RSK-001` |
| **Plantillas** | Listar plantillas | `GET /templates` | Abogado | **NO** | `MEDIO`: Hardcodeado a `'default-org-id'`. Otros estudios no ven sus plantillas. | `TEST-TENANT-TPL-001` |
| **Plantillas** | Generar escrito | `POST /templates/:id/generate` | Abogado | **NO** | `ALTO`: Ejecución y visualización de plantillas creadas por otras firmas. | `TEST-TENANT-TPL-002` |
| **Portal Cliente**| Listar causas | `GET /client-portal/cases` | Cliente | **SÍ** | `BAJO`: Valida asignación en `expediente.users`. | `TEST-TENANT-CLT-001` |
| **Portal Cliente**| Detalle de causa | `GET /client-portal/cases/:id` | Cliente | **SÍ** | `BAJO`: Valida asignación explícita al caso. | `TEST-TENANT-CLT-002` |
| **Admin** | Listar tenants | `GET /admin/tenants` | Superadmin Global | **NO** | `CRÍTICO`: Cualquier visitante anónimo obtiene métricas y datos de todos los estudios. | `TEST-TENANT-ADM-001` |
| **Analytics** | Ver eventos en vivo | `GET /events/logs` | Admin de Seguridad | **NO** | `CRÍTICO`: Exposición no autenticada de telemetría de todos los clientes. | `TEST-TENANT-ANL-001` |

### 3.3. Propagación de Contexto y Modelo de Identidades
Actualmente, `JwtStrategy` extrae del token el siguiente payload:
```typescript
{ userId: payload.sub, email: payload.email, role: payload.role, organizationId: payload.organizationId }
```
**Falla Identificada:** El objeto `req.user` queda varado en el controller. Ningún service lo recibe sistemáticamente.  
**Solución Requerida:** Todo servicio que acceda a entidades tenant-scoped debe recibir obligatoriamente el contexto de seguridad del usuario autenticado (`UserContext { userId, organizationId, role }`). Nunca se debe tomar el `organizationId` del body o query del cliente.

#### Jerarquía de Identidades y Permisos
1. **SUPER_ADMIN (Global):** Acceso exclusivo a `/admin/*` y métricas de infraestructura. No debe tener acceso arbitrario al contenido de expedientes de los clientes salvo auditoría explícita registrada en `AuditLog`.
2. **ADMIN / PARTNER (Socio del Estudio):** Control total dentro de su `organizationId` (usuarios, plantillas, expedientes, facturación, reportes).
3. **ASSOCIATE / PARALEGAL (Abogado / Empleado):** Lectura y escritura de expedientes asignados o de su organización; sin acceso a facturación ni borrado de causas.
4. **CLIENT (Cliente Final):** Acceso restringido exclusivamente a `/client-portal/*` y solo a los expedientes donde esté formalmente vinculado.
5. **SYSTEM / WORKER (Procesos en Segundo Plano):** Tareas programadas de backup o sincronización judicial que operan con contexto de sistema validado.

---

## 4. MATRIZ EXHAUSTIVA DE AUTORIZACIÓN DE ENDPOINTS

Se auditaron los 38 endpoints expuestos por los controladores del backend:

| Método | Ruta Completa | Controlador | Autenticación Requerida | Rol Requerido | Tenant Requerido | Sensibilidad | Estado Actual | Protección Esperada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | `AuthController` | No (Público) | Cualquiera | No | Alta | Vulnerable (SEC-001) | Rate limited + Bcrypt estricto |
| `POST` | `/auth/refresh` | `AuthController` | No (Público) | Cualquiera | No | Alta | Operativo | Rate limited + Valida firma refresh |
| `POST` | `/auth/logout` | `AuthController` | Sí (JWT) | Cualquiera | Propio | Media | Protegido | `JwtAuthGuard` |
| `POST` | `/client-portal/login` | `ClientPortalController` | No (Público) | Cliente | No | Crítica | Vulnerable (SEC-002) | Autenticación real + CUIT validado |
| `GET` | `/client-portal/cases` | `ClientPortalController` | Sí (JWT) | `CLIENT` | Propio | Alta | Protegido | `JwtAuthGuard` + `RolesGuard(['CLIENT'])` |
| `GET` | `/client-portal/cases/:id` | `ClientPortalController`| Sí (JWT) | `CLIENT` | Propio | Alta | Protegido | `JwtAuthGuard` + `RolesGuard(['CLIENT'])` |
| `GET` | `/expedientes` | `ExpedientesController` | Sí (JWT) | Estudio Jurídico | Propio | Crítica | Fuga Multi-Tenant | `JwtAuthGuard` + Filtro obligatorio Org |
| `POST` | `/expedientes` | `ExpedientesController` | Sí (JWT) | Abogado/Socio | Propio | Alta | Falla Asignación Org | `JwtAuthGuard` + Org inyectada desde JWT |
| `POST` | `/documents/:id/versions` | `DocumentsController` | Sí (JWT) | Abogado/Socio | Propio | Crítica | **SIN GUARD (Público)**| `JwtAuthGuard` + Valida Org expediente |
| `PATCH`| `/documents/:id/legal-hold` | `DocumentsController` | Sí (JWT) | `PARTNER`/`ADMIN`| Propio | Alta | **SIN GUARD (Público)**| `JwtAuthGuard` + `RolesGuard(['ADMIN','PARTNER'])` |
| `GET` | `/documents/compare/:v1/:v2` | `DocumentsController` | Sí (JWT) | Abogado/Socio | Propio | Media | **SIN GUARD (Público)**| `JwtAuthGuard` + Valida Org de documentos |
| `GET` | `/agenda` | `AgendaController` | Sí (JWT) | Estudio Jurídico | Propio | Media | Protegido | `JwtAuthGuard` + Tenant validado |
| `GET` | `/agenda/feriados/:jur/:year` | `AgendaController` | Sí (JWT) | Cualquiera | No | Baja | Protegido | `JwtAuthGuard` |
| `POST` | `/agenda/eventos` | `AgendaController` | Sí (JWT) | Abogado/Socio | Propio | Alta | Falta Validar Caso | `JwtAuthGuard` + Valida Org de expediente |
| `POST` | `/agenda/simular-vencimiento` | `AgendaController` | Sí (JWT) | Abogado/Socio | No | Baja | Protegido | `JwtAuthGuard` |
| `POST` | `/ia/ask` | `IAController` | Sí (JWT) | Abogado/Socio | Propio | Alta | Protegido | `JwtAuthGuard` + Control de Cuotas |
| `POST` | `/ia/analyze` | `IAController` | Sí (JWT) | Abogado/Socio | Propio | Alta | Protegido | `JwtAuthGuard` + Control de Cuotas |
| `POST` | `/ia/ingest` | `IAController` | Sí (JWT) | `ADMIN`/`SUPER` | No | Crítica | Falta Role Guard | `JwtAuthGuard` + `RolesGuard(['ADMIN'])` |
| `POST` | `/ai/chat/:expedienteId` | `AIChatController` | Sí (JWT) | Abogado/Socio | Propio | Crítica | Falla Aislamiento Org | `JwtAuthGuard` + Valida Org de caso + Cuota |
| `GET` | `/ai/chat/:expedienteId/history`| `AIChatController` | Sí (JWT) | Abogado/Socio | Propio | Alta | Falta Validar Org | `JwtAuthGuard` + Valida Org de caso |
| `DELETE`| `/ai/chat/:expedienteId/history`| `AIChatController` | Sí (JWT) | Abogado/Socio | Propio | Media | Falta Validar Org | `JwtAuthGuard` + Valida Org de caso |
| `GET` | `/jurisprudence/stats` | `JurisprudenceController` | Sí (JWT) | Cualquiera | No | Baja | Protegido | `JwtAuthGuard` |
| `GET` | `/jurisprudence/list` | `JurisprudenceController` | Sí (JWT) | Cualquiera | No | Baja | Protegido | `JwtAuthGuard` |
| `GET` | `/jurisprudence/search` | `JurisprudenceController` | Sí (JWT) | Cualquiera | No | Media | Error SQL (DAT-001) | `JwtAuthGuard` + Corrección SQL |
| `POST` | `/jurisprudence/import` | `JurisprudenceController` | Sí (JWT) | `ADMIN`/`PARTNER`| No | Alta | Falta Role Guard | `JwtAuthGuard` + `RolesGuard(['ADMIN'])` |
| `GET` | `/jurisprudence/:id` | `JurisprudenceController` | Sí (JWT) | Cualquiera | No | Baja | Protegido | `JwtAuthGuard` |
| `POST` | `/jurisprudence/ingest` | `JurisprudenceController` | Sí (JWT) | `ADMIN` | No | Crítica | Falta Role Guard | `JwtAuthGuard` + `RolesGuard(['ADMIN'])` |
| `POST` | `/legal/ingest` | `LegalController` | Sí (JWT) | `ADMIN` | No | Crítica | Falta Role Guard | `JwtAuthGuard` + `RolesGuard(['ADMIN'])` |
| `POST` | `/legal/ingest/batch` | `LegalController` | Sí (JWT) | `ADMIN` | No | Crítica | Falta Role Guard | `JwtAuthGuard` + `RolesGuard(['ADMIN'])` |
| `GET` | `/legal/search` | `LegalController` | Sí (JWT) | Cualquiera | No | Baja | Protegido | `JwtAuthGuard` |
| `GET` | `/legal/article/:norma/:art` | `LegalController` | Sí (JWT) | Cualquiera | No | Baja | Protegido | `JwtAuthGuard` |
| `GET` | `/legal/versions/:norma/:art` | `LegalController` | Sí (JWT) | Cualquiera | No | Baja | Protegido | `JwtAuthGuard` |
| `GET` | `/legal/conflicts/:normId` | `LegalController` | Sí (JWT) | Cualquiera | No | Baja | Protegido | `JwtAuthGuard` |
| `GET` | `/legal/stats` | `LegalController` | Sí (JWT) | Cualquiera | No | Baja | Protegido | `JwtAuthGuard` |
| `POST` | `/legal/version/:normId` | `LegalController` | Sí (JWT) | `ADMIN` | No | Crítica | Falta Role Guard | `JwtAuthGuard` + `RolesGuard(['ADMIN'])` |
| `POST` | `/ai/draft` | `DraftingController` | Sí (JWT) | Abogado/Socio | Propio | Crítica | **SIN GUARD (Público)**| `JwtAuthGuard` + Inyecta userId + Cuota |
| `GET` | `/ai/draft/user/:userId` | `DraftingController` | Sí (JWT) | Abogado/Socio | Propio | Alta | **SIN GUARD (Público)**| `JwtAuthGuard` + Valida userId del JWT |
| `GET` | `/ai/draft/:id` | `DraftingController` | Sí (JWT) | Abogado/Socio | Propio | Alta | **SIN GUARD (Público)**| `JwtAuthGuard` + Valida pertenencia |
| `POST` | `/ai/risk-score/:expedienteId` | `LegalRiskController` | Sí (JWT) | Abogado/Socio | Propio | Crítica | **SIN GUARD (Público)**| `JwtAuthGuard` + Valida Org + Cuota |
| `GET` | `/ai/risk-score/:expedienteId` | `LegalRiskController` | Sí (JWT) | Abogado/Socio | Propio | Alta | **SIN GUARD (Público)**| `JwtAuthGuard` + Valida Org de caso |
| `POST` | `/templates` | `TemplatesController` | Sí (JWT) | `ADMIN`/`PARTNER`| Propio | Alta | **SIN GUARD (Público)**| `JwtAuthGuard` + Org inyectada desde JWT |
| `GET` | `/templates` | `TemplatesController` | Sí (JWT) | Estudio Jurídico | Propio | Media | **SIN GUARD (Público)**| `JwtAuthGuard` + Filtra por Org del JWT |
| `POST` | `/templates/:id/generate` | `TemplatesController` | Sí (JWT) | Abogado/Socio | Propio | Media | **SIN GUARD (Público)**| `JwtAuthGuard` + Valida Org de plantilla |
| `POST` | `/judicial/sync/:expedienteId` | `JudicialController` | Sí (JWT) | Abogado/Socio | Propio | Alta | **SIN GUARD (Público)**| `JwtAuthGuard` + Valida Org de caso |
| `POST` | `/judicial/sync-system` | `JudicialController` | Sí (JWT) | `SUPER_ADMIN` | No | Crítica | **SIN GUARD (Público)**| `JwtAuthGuard` + `RolesGuard(['SUPER_ADMIN'])`|
| `GET` | `/admin-api/stats` | `AdminApiController` | Sí (JWT) | `SUPER_ADMIN` | No | Crítica | **SIN GUARD (Público)**| `JwtAuthGuard` + `RolesGuard(['SUPER_ADMIN'])`|
| `GET` | `/admin-api/logs` | `AdminApiController` | Sí (JWT) | `SUPER_ADMIN` | No | Crítica | **SIN GUARD (Público)**| `JwtAuthGuard` + `RolesGuard(['SUPER_ADMIN'])`|
| `GET` | `/admin-api/traffic` | `AdminApiController` | Sí (JWT) | `SUPER_ADMIN` | No | Alta | **SIN GUARD (Público)**| `JwtAuthGuard` + `RolesGuard(['SUPER_ADMIN'])`|
| `GET` | `/admin/tenants` | `AdminMasterController` | Sí (JWT) | `SUPER_ADMIN` | No | Crítica | **SIN GUARD (Público)**| `JwtAuthGuard` + `RolesGuard(['SUPER_ADMIN'])`|
| `GET` | `/admin/stats` | `AdminMasterController` | Sí (JWT) | `SUPER_ADMIN` | No | Alta | **SIN GUARD (Público)**| `JwtAuthGuard` + `RolesGuard(['SUPER_ADMIN'])`|
| `POST` | `/events/collect` | `AnalyticsController` | HMAC / JWT | Actor Validador | Propio | Media | Secreto Expuesto | Firma emitida por server / JWT |
| `GET` | `/events/logs` | `AnalyticsController` | Sí (JWT) | `ADMIN` / Segur. | Propio | Crítica | **SIN GUARD (Público)**| `JwtAuthGuard` + `RolesGuard(['ADMIN'])` |

---

## 5. CATÁLOGO DE PRUEBAS TEST-FIRST (TDS)

Se define el catálogo exhaustivo de pruebas antes de autorizar cualquier modificación de código. Todas las pruebas deben fallar en el estado actual (demostrando la vulnerabilidad o falla) y pasar exitosamente una vez aplicada la remediación correspondiente.

### 5.1. Pruebas de Autenticación y Sesiones
- **`TEST-AUTH-001` (Bypass de contraseña en texto plano):**
  - *Objetivo:* Demostrar que un usuario con contraseña hasheada no puede autenticarse enviando el hash literal o una contraseña incorrecta.
  - *Acción:* `POST /auth/login` con email de usuario y `password: "$2b$10$..."` o `"hash123"` cuando el hash real es distinto.
  - *Resultado Esperado:* HTTP 401 Unauthorized.
  - *Estado Actual:* Falla (devuelve 200 OK por comparación de igualdad en línea 25).
- **`TEST-AUTH-002` (Login legítimo con Bcrypt):**
  - *Objetivo:* Verificar que un usuario con hash bcrypt legítimo se autentica correctamente con su contraseña real.
  - *Acción:* `POST /auth/login` con credenciales válidas.
  - *Resultado Esperado:* HTTP 200 OK con access token, refresh token y datos de usuario.
- **`TEST-AUTH-003` (Bypass de Portal de Clientes):**
  - *Objetivo:* Demostrar que el portal de clientes rechaza solicitudes sin contraseña válida.
  - *Acción:* `POST /client-portal/login` con email de cliente y contraseña vacía o incorrecta.
  - *Resultado Esperado:* HTTP 401 Unauthorized.
  - *Estado Actual:* Falla (devuelve 200 OK y token JWT sin validar password).

### 5.2. Pruebas de Aislamiento Multi-Tenant (Prioridad Crítica)
- **`TEST-TENANT-001` (Lectura cruzada de expedientes):**
  - *Precondición:* Org A posee Expediente A1. Org B posee Expediente B1.
  - *Acción:* Usuario de Org A autenticado ejecuta `GET /expedientes`.
  - *Resultado Esperado:* La lista contiene únicamente A1; B1 está estrictamente excluido.
  - *Estado Actual:* Falla (la lista contiene A1 y B1).
- **`TEST-TENANT-002` (Inyección de `organizationId` en creación):**
  - *Acción:* Usuario de Org A ejecuta `POST /expedientes` enviando `organizationId: "id-de-org-b"`.
  - *Resultado Esperado:* El expediente se crea obligatoriamente asignado a Org A (ignora el parámetro del body) o devuelve HTTP 400 Bad Request. Nunca se asigna a Org B.
  - *Estado Actual:* Falla (asigna el expediente a Org B).
- **`TEST-TENANT-003` (Chat de IA sobre expediente ajeno):**
  - *Acción:* Usuario de Org A ejecuta `POST /ai/chat/:id-de-expediente-B1` con mensaje `"Resume este caso"`.
  - *Resultado Esperado:* HTTP 404 Not Found o HTTP 403 Forbidden.
  - *Estado Actual:* Falla (permite chatear y la IA revela la carátula y datos de Org B).
- **`TEST-TENANT-004` (Inyección de eventos de agenda cruzados):**
  - *Acción:* Usuario de Org A ejecuta `POST /agenda/eventos` vinculando `expedienteId: "id-de-expediente-B1"`.
  - *Resultado Esperado:* HTTP 403 Forbidden o HTTP 404 Not Found.
  - *Estado Actual:* Falla (crea el evento en el expediente de Org B).
- **`TEST-TENANT-005` (Aislamiento de plantillas documentales):**
  - *Acción:* Usuario de Org A ejecuta `GET /templates`.
  - *Resultado Esperado:* Devuelve solo plantillas donde `organizationId == Org A`.
  - *Estado Actual:* Falla (busca por `'default-org-id'`).

### 5.3. Pruebas de Autorización y Endpoints Expuestos
- **`TEST-RBAC-001` (Acceso no autenticado a God Mode / Admin):**
  - *Acción:* Petición anónima `GET /admin-api/stats` y `GET /admin/tenants`.
  - *Resultado Esperado:* HTTP 401 Unauthorized.
  - *Estado Actual:* Falla (devuelve HTTP 200 OK con datos de todas las empresas).
- **`TEST-RBAC-002` (Acceso anónimo a redacción de demandas):**
  - *Acción:* Petición anónima `POST /ai/draft`.
  - *Resultado Esperado:* HTTP 401 Unauthorized.
  - *Estado Actual:* Falla (devuelve 200 OK y ejecuta inferencia GPT-4o).
- **`TEST-RBAC-003` (Acceso anónimo a subida y versiones de documentos):**
  - *Acción:* Petición anónima `POST /documents/:id/versions`.
  - *Resultado Esperado:* HTTP 401 Unauthorized.
  - *Estado Actual:* Falla (devuelve 200 OK).
- **`TEST-RBAC-004` (Intento de cliente accediendo a endpoints de abogado):**
  - *Acción:* Usuario con rol `CLIENT` intenta `GET /expedientes` o `POST /ai/draft`.
  - *Resultado Esperado:* HTTP 403 Forbidden.

### 5.4. Pruebas de Control de Costos y Cuotas de IA
- **`TEST-AI-001` (Agotamiento de cuota de tokens):**
  - *Precondición:* Org A tiene límite de 50.000 tokens en su plan y ya consumió 49.500.
  - *Acción:* Usuario de Org A envía prompt que requiere ~1.000 tokens a `/ai/chat/:id`.
  - *Resultado Esperado:* HTTP 429 Too Many Requests o 403 con mensaje de cuota excedida. OpenAI NO es invocado.
  - *Estado Actual:* Falla (OpenAI es invocado sin validar cuota).
- **`TEST-AI-002` (Persistencia de tokens y costos reales):**
  - *Acción:* Ejecución exitosa de `/ai/chat/:id`.
  - *Resultado Esperado:* En la base de datos, `AIChatMessage` tiene `tokensInput > 0`, `tokensOutput > 0` y `cost > 0`. `TenantUsage.aiTokensUsed` se incrementa con la suma de tokens.
  - *Estado Actual:* Falla (los campos quedan en `null`).

### 5.5. Pruebas de Persistencia y Búsqueda Jurisprudencial
- **`TEST-DAT-001` (Búsqueda semántica con filtro de jurisdicción):**
  - *Acción:* `GET /jurisprudence/search?query=daño+moral&jurisdiccion=NACIONAL`.
  - *Resultado Esperado:* HTTP 200 OK con resultados coincidentes sin error SQL.
  - *Estado Actual:* Falla por error de tipos (`text = "LegalNormJurisdiccion"`).
- **`TEST-DAT-002` (Búsqueda por palabras clave sin embedding):**
  - *Precondición:* Existen fallos en la base de datos donde `embedding IS NULL`.
  - *Acción:* `GET /jurisprudence/search?query=accidente`.
  - *Resultado Esperado:* El fallback de palabras clave recupera los fallos con coincidencia textual en carátula o resumen.
  - *Estado Actual:* Falla (la consulta filtra por `embedding IS NOT NULL`).

---

## 6. ESPECIFICACIONES TÉCNICAS DE REMEDIACIÓN

### `SPEC-SEC-001`: Autenticación, Sesiones y Seguridad de Contraseñas
1. **Problema Demostrado:** `auth.service.ts` permite bypass con contraseñas en texto plano. `client-portal.service.ts` tiene la validación de contraseña comentada.
2. **Archivos Afectados:**
   - `backend/src/auth/auth.service.ts`
   - `backend/src/client-portal/client-portal.service.ts`
   - `backend/prisma/seed.ts`
3. **Reglas de Seguridad:**
   - Todas las contraseñas en base de datos deben ser exclusivamente hashes generados con `bcrypt.hash(password, 10)`.
   - `auth.service.ts` debe eliminar la comparación `user.passwordHash === loginDto.password`. Únicamente se admite `await bcrypt.compare(...)`.
   - `client-portal.service.ts` debe descomentar y exigir la validación de contraseñas con bcrypt, o implementar validación estricta de CUIT verificado contra `client.cuit`.
   - El script `prisma/seed.ts` debe generar el hash con bcrypt antes de insertar al usuario de prueba (`passwordHash: await bcrypt.hash('password_segura', 10)`).
4. **Criterios de Aceptación:** `TEST-AUTH-001`, `TEST-AUTH-002` y `TEST-AUTH-003` pasan al 100%.

---

### `SPEC-SEC-002`: Aislamiento Multi-Tenant Transversal
1. **Problema Demostrado:** Las consultas en `ExpedientesService`, `DocumentsService`, `AIChatService` y `AgendaService` no validan la pertenencia del recurso al `organizationId` del usuario solicitante, permitiendo IDOR masivo.
2. **Archivos Afectados:**
   - `backend/src/expedientes/expedientes.controller.ts` y `expedientes.service.ts`
   - `backend/src/expedientes/documents.controller.ts` y `documents.service.ts`
   - `backend/src/ia/chat/ai-chat.controller.ts` y `ai-chat.service.ts`
   - `backend/src/ia/chat/chat-context.service.ts`
   - `backend/src/agenda/agenda.controller.ts` y `agenda.service.ts`
   - `backend/src/templates/templates.controller.ts` y `templates.service.ts`
3. **Reglas de Negocio y Seguridad:**
   - Crear un decorador `@CurrentUser()` que extraiga el contexto tipado del JWT (`{ userId, organizationId, role }`).
   - Ningún endpoint aceptará `organizationId` en el payload de entrada proveniente del cliente; el `organizationId` se deriva indefectiblemente del token verificado.
   - En `ExpedientesService.findAll()`, forzar:
     ```typescript
     where: { organizationId: user.organizationId }
     ```
   - En toda operación puntual (`findUnique`, `update`, `delete`, `uploadVersion`, `chat`), validar previamente que el `expedienteId` o `documentId` pertenezca a la organización del usuario:
     ```typescript
     const exp = await this.prisma.expediente.findFirst({
         where: { id: expedienteId, organizationId: user.organizationId }
     });
     if (!exp) throw new NotFoundException('Expediente no encontrado');
     ```
4. **Criterios de Aceptación:** `TEST-TENANT-001` a `TEST-TENANT-005` pasan exitosamente.

---

### `SPEC-SEC-003`: Autorización, RBAC y Protección de Endpoints
1. **Problema Demostrado:** 16 endpoints carecen de guards de autenticación. No existe `RolesGuard` ni diferenciación de privilegios entre socio, abogado, cliente y superadmin.
2. **Archivos Afectados:**
   - `backend/src/auth/guards/jwt-auth.guard.ts`
   - Creación de `backend/src/auth/guards/roles.guard.ts`
   - Creación de decorador `backend/src/auth/decorators/roles.decorator.ts`
   - `backend/src/admin/admin-api.controller.ts`
   - `backend/src/admin/admin-master.controller.ts`
   - `backend/src/analytics/analytics.controller.ts`
   - `backend/src/expedientes/documents.controller.ts`
   - `backend/src/ia/drafting/drafting.controller.ts`
   - `backend/src/ia/risk/legal-risk.controller.ts`
   - `backend/src/templates/templates.controller.ts`
   - `backend/src/judicial-engine/judicial.controller.ts`
3. **Reglas de Seguridad:**
   - Aplicar `@UseGuards(JwtAuthGuard, RolesGuard)` en todos los controladores expuestos.
   - Endpoints en `/admin/*` y `/admin-api/*` restringidos a usuarios con rol `ADMIN` (global/plataforma).
   - Endpoints de ingesta normativa (`/legal/ingest`, `/legal/version`) restringidos a `ADMIN`.
   - Endpoints de redacción y riesgo (`/ai/draft`, `/ai/risk-score`) protegidos con JWT, asociando las transacciones al `userId` autenticado.
4. **Criterios de Aceptación:** `TEST-RBAC-001` a `TEST-RBAC-004` pasan sin excepciones.

---

### `SPEC-SEC-004`: Gestión Segura de Secretos y Firma de Telemetría
1. **Problema Demostrado:** Fallbacks a claves inseguras (`'secret'`, `'refresh-secret'`, `'default-insecure-key-REPLACE-ME'`). Secreto HMAC presente en el frontend React.
2. **Archivos Afectados:**
   - `backend/src/auth/strategies/jwt.strategy.ts`
   - `backend/src/auth/auth.service.ts`
   - `backend/src/core/security/pixel.guard.ts`
   - `backend/src/core/security/forensic.service.ts`
   - `frontend/src/core/analytics/LegalPixel.ts`
3. **Reglas de Seguridad:**
   - Prohibir terminantemente fallbacks a contraseñas débiles en código. Si `JWT_SECRET` o `JWT_REFRESH_SECRET` no están configurados, el backend debe fallar en el arranque (`throw new Error("Missing JWT_SECRET in environment")`).
   - Eliminar el secreto HMAC del frontend. `LegalPixel` debe enviar los eventos autenticándose mediante la cabecera estándar `Authorization: Bearer <token>` cuando el usuario haya iniciado sesión, o firmar los eventos en un endpoint intermedio backend (BFF).
4. **Criterios de Aceptación:** El bundle cliente compilado de React no contiene ningún secreto ni clave HMAC.

---

### `SPEC-DAT-001`: Consistencia de Tipos y Búsqueda Jurisprudencial
1. **Problema Demostrado:** El cast SQL `::"LegalNormJurisdiccion"` sobre una columna de tipo `TEXT` genera error en PostgreSQL. El fallback de palabras clave exige `embedding IS NOT NULL`.
2. **Archivos Afectados:**
   - `backend/src/ia/jurisprudence/jurisprudence-search.service.ts`
   - `backend/src/crawler/pipeline/ingest-to-db.ts`
3. **Reglas Técnicas:**
   - En `jurisprudence-search.service.ts`:
     ```typescript
     // Eliminar el casteo al enum
     if (query.jurisdiccion) {
         whereConditions.push(`jurisdiccion = $${params.length + 4}`);
         params.push(query.jurisdiccion);
     }
     ```
   - En el fallback de búsqueda por palabras clave: remover la cláusula `embedding IS NOT NULL` de la subconsulta para permitir indexar fallos que aún no tengan embeddings generados.
   - Normalizar los valores de jurisdicción en el pipeline de ingesta (`'NACIONAL'` -> mapeado de forma coherente con los filtros del frontend).
4. **Criterios de Aceptación:** `TEST-DAT-001` y `TEST-DAT-002` devuelven resultados correctos sin errores de PostgreSQL.

---

### `SPEC-OPS-001`: Backup Seguro, Rotación y Ejecución Aislada
1. **Problema Demostrado:** `backup.service.ts` ejecuta `execAsync` con interpolación de cadenas, con riesgo de inyección de comandos en caso de manipulación de `DATABASE_URL`. La limpieza de archivos antiguos está vacía.
2. **Archivos Afectados:**
   - `backend/src/core/backup/backup.service.ts`
3. **Reglas Técnicas:**
   - Reemplazar `exec` por `execFile` pasando los argumentos desglosados en un arreglo seguro:
     ```typescript
     await execFileAsync('pg_dump', [dbUrl, '-F', 'c', '-b', '-v', '-f', filePath]);
     ```
   - Implementar la función `cleanupOldLocalBackups()` recorriendo `this.backupDir` y eliminando archivos con antigüedad mayor a 7 días.
   - Envolver el método en un bloque de control de errores que no arroje excepciones fatales en la aplicación si la herramienta `pg_dump` no se encuentra instalada en el contenedor.
4. **Criterios de Aceptación:** El cron de medianoche no arroja excepciones de subshell y mantiene como máximo 7 snapshots en disco.

---

### `SPEC-AI-001`: Gobernanza de Consumo, Cuotas y Costos de IA
1. **Problema Demostrado:** `UsageControlService` está huérfano. Las peticiones a OpenAI se ejecutan sin límite de cuota y sin persistir el consumo real de tokens ni el costo financiero.
2. **Archivos Afectados:**
   - `backend/src/admin/usage-control.service.ts`
   - `backend/src/ia/chat/ai-chat.service.ts`
   - `backend/src/ia/drafting/drafting.service.ts`
   - `backend/src/ia/risk/legal-risk.service.ts`
   - `backend/src/ia/ia.module.ts`
3. **Reglas de Negocio y Finanzas:**
   - Inyectar `UsageControlService` en `AIChatService` y `DraftingService`.
   - Antes de llamar a OpenAI: validar si la organización posee cuota disponible (`await this.usageControl.checkAiQuota(organizationId, estimacionTokens)`). Si no hay saldo, rechazar con HTTP 429.
   - Extraer los tokens reales devueltos por el SDK de LangChain/OpenAI (`llmResult.response_metadata.token_usage`).
   - Persistir en `AIChatMessage`: `tokensInput`, `tokensOutput`, `cost` (calculado con la tarifa oficial del modelo utilizado).
   - Registrar la interacción en `AIInteraction` e incrementar `TenantUsage.aiTokensUsed`.
4. **Criterios de Aceptación:** `TEST-AI-001` y `TEST-AI-002` verifican el bloqueo por cuota y la persistencia de métricas.

---

### `SPEC-TST-001`: Estrategia y Configuración de Pruebas Automatizadas
1. **Problema Demostrado:** Ausencia total de pruebas automatizadas y falta de configuración de ESLint en backend.
2. **Archivos Afectados:**
   - `backend/.eslintrc.js` (a crear)
   - `backend/package.json` (agregar script `"test": "jest"`)
   - `backend/test/` (directorio para tests E2E y de integración)
3. **Estrategia de Pruebas:**
   - Crear suite de pruebas de integración con Jest + Supertest (`auth.e2e-spec.ts`, `multi-tenant.e2e-spec.ts`).
   - Configurar base de datos de pruebas aislada en PostgreSQL para no alterar datos de desarrollo ni producción.
   - Establecer umbral de cobertura mínimo del 80% sobre los módulos de autenticación y aislamiento multi-tenant.
4. **Criterios de Aceptación:** `npm test` en backend ejecuta y aprueba todas las pruebas del catálogo TDS.

---

## 7. ORDEN RECOMENDADO DE IMPLEMENTACIÓN

Para garantizar que ninguna corrección parcial rompa el sistema ni introduzca nuevas vulnerabilidades, la remediación debe seguir un orden estricto de dependencias:

```
[ PASO 1: LIMPIEZA BASELINE GIT ]
   - Resetear staging, actualizar .gitignore, commitear snapshot inicial limpio.
          │
          ▼
[ PASO 2: INFRAESTRUCTURA DE PRUEBAS (SPEC-TST-001) ]
   - Configurar Jest, .eslintrc en backend y entorno de BD de test.
          │
          ▼
[ PASO 3: SEGURIDAD DE AUTENTICACIÓN (SPEC-SEC-001 + SPEC-SEC-004) ]
   - Eliminar bypass de texto plano, proteger portal de clientes y quitar secretos del frontend.
   - Validar con TEST-AUTH-001..003.
          │
          ▼
[ PASO 4: BLINDAJE MULTI-TENANT Y ROLES (SPEC-SEC-002 + SPEC-SEC-003) ]
   - Inyectar contexto tenant desde JWT, forzar filtros en Prisma, proteger los 16 endpoints expuestos.
   - Validar con TEST-TENANT-001..005 y TEST-RBAC-001..004.
          │
          ▼
[ PASO 5: CORRECCIÓN DE BASE DE DATOS Y RAG (SPEC-DAT-001) ]
   - Corregir error de tipos SQL en JurisprudenceSearchService y fallback de keywords.
   - Validar con TEST-DAT-001..002.
          │
          ▼
[ PASO 6: GOBERNANZA DE IA Y COSTOS (SPEC-AI-001) ]
   - Conectar UsageControlService, calcular y persistir tokens/costos reales.
   - Validar con TEST-AI-001..002.
          │
          ▼
[ PASO 7: OPERACIONES Y BACKUP SEGURO (SPEC-OPS-001) ]
   - Asegurar pg_dump con execFile y rotación de snapshots.
```

---

## 8. DECISIONES TÉCNICAS QUE REQUIEREN APROBACIÓN EXPRESA

Antes de comenzar cualquier modificación en código, se somete a consideración y decisión del usuario:

1. **Estrategia de Autenticación para Clientes del Portal (`client-portal`):**
   - *Opción A (Recomendada):* Autenticación estándar con email y contraseña hasheada con bcrypt (requiere interfaz de asignación de contraseña al dar de alta al cliente).
   - *Opción B:* Acceso mediante Magic Link / OTP por email (requiere integrar servicio de correo transaccional tipo Resend o SendGrid).
   - *Opción C:* Acceso con Email + CUIT validado contra la base de datos (más simple, pero menos seguro si los CUITs de clientes son públicos).
2. **Manejo de Contraseñas del Seed Actual:**
   - La contraseña `'hash123'` del usuario de prueba debe ser reemplazada por un hash bcrypt precalculado en `prisma/seed.ts`.
3. **Modelo de Firma de Legal Pixel:**
   - Confirmar si se elimina la firma criptográfica en el cliente para pasar a telemetría protegida por JWT de sesión estándar, o si se desea un microservicio proxy para la firma.
4. **Política de Excedente de Cuota de IA:**
   - Definir si al superar el límite mensual de tokens el sistema:
     - Bloquea inmediatamente nuevas consultas de IA (modo estricto).
     - Permite continuar facturando como sobreconsumo (*pay-as-you-go*).

---

## 9. RECOMENDACIÓN FINAL Y CRITERIO DE CIERRE

> [!IMPORTANT]
> **RECOMENDACIÓN DEL AUDITOR:**  
> Se recomienda aprobar en primer término la **limpieza del baseline Git y la especificación `SPEC-SEC-001` (Autenticación)** junto con **`SPEC-SEC-002` (Aislamiento Multi-Tenant)**.  
> 
> **Justificación:** Son los dos vectores de riesgo que comprometen directamente la privacidad de los clientes, la legalidad del servicio y la viabilidad del negocio. Ningún desarrollo funcional o interfaz debe avanzar mientras exista la posibilidad de que un usuario acceda a causas ajenas o evite el control de contraseñas.
>
> **ESTADO READ-ONLY MANTENIDO:** No se ha aplicado ninguna modificación sobre el repositorio. El working tree se mantiene intacto. Quedo a la espera de tus instrucciones y aprobaciones para dar el siguiente paso.

