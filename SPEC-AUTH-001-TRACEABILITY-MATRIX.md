# MATRIZ DE TRAZABILIDAD Y COHERENCIA NORMATIVA
## Especificación: SPEC-AUTH-001 (Versión 1.0.8)
### Expediente: `AUTH0-IMPLEMENTATION-001`
### Repositorio: `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law`

---

| Metadato | Detalle de Trazabilidad |
| :--- | :--- |
| **Identificador** | `SPEC-AUTH-001-TRACEABILITY-MATRIX` |
| **Versión** | `1.0.8` (Baseline Consolidado de Implementación) |
| **Fecha de Versión** | 24 de noviembre de 2026 |
| **Cobertura Normativa** | **10 Requisitos Formales** (`AUTH-001` a `AUTH-010`) especificados con controles y pruebas asociadas. |
| **Cobertura de Amenazas** | **16 Amenazas Catalogadas** (`AMN-01` a `AMN-16`) asociadas a controles de mitigación arquitectónica. |
| **Total de Pruebas Mapeadas** | **54 Pruebas TDS Unívocas** (`TST-AUTH-001` a `TST-AUTH-054`) |
| **Distribución por Tipología** | **Unitarias:** 12 (`002-007, 024, 038-041, 051`)<br>**Integración NestJS:** 24 (`001, 008-013, 016-018, 020-023, 027, 032-037, 043, 052, 054`)<br>**Integración PostgreSQL/RLS:** 13 (`014, 015, 019, 025, 026, 028, 030, 042, 046, 047, 049, 050, 053`)<br>**Integración Redis:** 3 (`029, 044, 048`)<br>**Browser / E2E:** 1 (`031`)<br>**Configuración Auth0:** 1 (`045`) |
| **Modelo de Mapeo** | **Relación Multidimensional Muchos-a-Muchos:** `REQUISITO -> AMENAZAS -> CONTROLES -> COMPONENTES -> PRUEBAS TDS -> EVIDENCIA ESPERADA` |
| **Escala Metodológica TDS** | **7 Fases Formales de Ciclo de Vida**. Estado actual: **Fases 2, 3 y 4 al 100%**. Fase 5 (Implementación incremental de pruebas TDS) autorizada e iniciada en `AUTH0-IMPLEMENTATION-001`. |

---

## 1. ESCALA FORMAL DE 7 FASES TDS Y ESTADO DE VERIFICACIÓN

Para no equiparar trazabilidad documental con mitigación demostrada en código ejecutable, se define la siguiente escala objetiva:

1. **Fase 1 — Requisito Identificado:** Necesidad operativa o vulnerabilidad constatada en el código base.
2. **Fase 2 — Requisito Especificado:** Definición formal y criterio de aceptación en `SPEC-AUTH-001`.
3. **Fase 3 — Control Arquitectónico Diseñado:** Especificación técnica del mecanismo de defensa (Guards, Funciones SQL, RLS, Vault).
4. **Fase 4 — Prueba TDS Definida:** Caso de prueba con precondiciones, entrada, acción y resultado binario en `SPEC-AUTH-001-TEST-CATALOG`.
5. **Fase 5 — Prueba Automatizada Implementada:** (Estado futuro) Código ejecutable en suite Jest (`backend/test/`) en estado RED (falla comprobada).
6. **Fase 6 — Prueba Ejecutada:** (Estado futuro) Ejecución en entorno local contra base de datos de test `abogados_test`.
7. **Fase 7 — Evidencia de Aprobación:** (Estado futuro) Suite en estado GREEN con código de salida 0 y 0 open handles.

---

## 2. MATRIZ MULTIDIMENSIONAL DE TRAZABILIDAD (MUCHOS-A-MUCHOS)

| Requisito Formal | Amenazas Mitigadas | Controles Arquitectónicos Diseñados | Componentes Responsables | Pruebas TDS Asociadas | Evidencia Esperada en Implementación | Fase TDS Actual |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`AUTH-001`** (Autenticación Delegada) | `AMN-14` (Backdoors locales)<br>`AMN-15` (Fuerza bruta)<br>`AMN-07` (Replay de login) | - Retiro definitivo de `/auth/login` y comparación texto plano.<br>- Passwordless Magic Link con respuesta uniforme 200.<br>- Rate limiting 1 req/60s.<br>- Authorization code de un solo uso. | - Enrutador NestJS<br>- Auth0 Authentication API<br>- BFF Callback Router | `TST-AUTH-020`<br>`TST-AUTH-035`<br>`TST-AUTH-045` | - HTTP 404 en endpoint legado.<br>- HTTP 200 idéntico ante emails válidos/inválidos.<br>- HTTP 429 ante exceso de peticiones.<br>- HTTP 400 (`invalid_grant`) ante reuso de code. | **Fase 4 (Definida)** |
| **`AUTH-002`** (Validación Asimétrica RS256) | `AMN-02` (Tokens ID en API)<br>`AMN-03` (Firma alterada o HS256)<br>`AMN-07` (Token vencido)<br>`AMN-10` (Rotación JWKS)<br>`AMN-11` (Issuer Spoofing)<br>`AMN-13` (IdP caído) | - `Auth0JwtGuard` con estrategia Passport RS256.<br>- Validación contra JWKS oficial con caché 24h.<br>- Rechazo de algoritmos distintos de RS256.<br>- Validación estricta de `iss`, `aud`, `sub` y `exp` (30s tol).<br>- Fail-Closed estricto (503) ante clave nueva e IdP inaccesible. | - `Auth0JwtGuard`<br>- Cliente `jwks-rsa` | `TST-AUTH-001`<br>`TST-AUTH-002`<br>`TST-AUTH-003`<br>`TST-AUTH-004`<br>`TST-AUTH-005`<br>`TST-AUTH-006`<br>`TST-AUTH-007`<br>`TST-AUTH-008`<br>`TST-AUTH-018`<br>`TST-AUTH-043` | - HTTP 200 e inyección de contexto con token válido.<br>- HTTP 401 ante firma inválida, exp vencido, issuer ajeno, token ID o falta de `sub`.<br>- HTTP 200 automático ante rotación legítima de `kid`.<br>- HTTP 503 exacto ante clave no cacheada con IdP caído. | **Fase 4 (Definida)** |
| **`AUTH-003`** (Vinculación Desacoplada) | `AMN-06` (Secuestro por cambio de email)<br>`AMN-06` (Falsa vinculación)<br>`AMN-06` (Dependencia circular) | - Mapeo desacoplado por `(issuer, subject)` en `UserIdentity`.<br>- Función `auth.resolve_user_identity` bajo `auth_definer_role`.<br>- Invitación administrativa nominal con hash SHA-256 de 32B CSPRNG, vigencia 72h y consumo atómico. | - `UserIdentity`<br>- `SecurityContextGuard`<br>- `OnboardingService`<br>- `InvitationToken` | `TST-AUTH-009`<br>`TST-AUTH-010`<br>`TST-AUTH-021`<br>`TST-AUTH-022`<br>`TST-AUTH-030`<br>`TST-AUTH-046` | - HTTP 401 si `sub` no está enrolado.<br>- HTTP 200 y preservación de cuenta ante cambio de email.<br>- Retorno de fila técnica sin ciclo RLS.<br>- HTTP 410 ante invitación vencida y 409 ante concurrencia.<br>- Persistencia de hash hex de 64 chars sin token en claro. | **Fase 4 (Definida)** |
| **`AUTH-004`** (Autorización Soberana) | `AMN-08` (Escalada de privilegios)<br>`AMN-09` (Uso de token por suspendido) | - Roles resueltos exclusivamente en BD local (`UserOrganization`).<br>- Decoradores `@Roles()` validados en `RolesAndPermissionsGuard`.<br>- Distinción estricta entre Admin de Plataforma y Admin de Estudio.<br>- Bloqueo en <1ms para usuarios con `status !== 'ACTIVE'`. | - `RolesAndPermissionsGuard`<br>- `SecurityContextGuard` | `TST-AUTH-011`<br>`TST-AUTH-016`<br>`TST-AUTH-017` | - HTTP 403 inmediato ante usuario suspendido.<br>- HTTP 403 (`PLATFORM_ADMIN_REQUIRED`) para admin de estudio en `/admin/tenants`.<br>- HTTP 200 para admin de plataforma con MFA. | **Fase 4 (Definida)** |
| **`AUTH-005`** (Aislamiento Multi-Tenant) | `AMN-04` (Fuga cruzada entre firmas)<br>`AMN-04` (Inyección de tenant en body)<br>`AMN-04` (Bypass en Prisma / SQL raw)<br>`AMN-04` (Suplantación GUC) | - Membresía activa obligatoria en `UserOrganization`.<br>- `ScopedPrismaService` forzando `organizationId` del contexto.<br>- PostgreSQL `FORCE ROW LEVEL SECURITY` en motor SQL.<br>- Consultas parametrizadas y reseteo de conexión en PgBouncer.<br>- Documentación de límites: RLS previene errores lógicos/IDOR; consultas parametrizadas neutralizan inyección SQL (C-02). | - `SecurityContextGuard`<br>- `ScopedPrismaService`<br>- PostgreSQL RLS Engine | `TST-AUTH-012`<br>`TST-AUTH-013`<br>`TST-AUTH-014`<br>`TST-AUTH-026`<br>`TST-AUTH-027`<br>`TST-AUTH-028`<br>`TST-AUTH-042`<br>`TST-AUTH-053` | - HTTP 403 ante usuario sin membresía o header con tenant ajeno.<br>- Persistencia en BD con `organizationId` del contexto ignorando body.<br>- Conexión app_user sin SET LOCAL retorna 0 filas.<br>- Operaciones upsert/count/raw filtran estrictamente por tenant.<br>- Inyección de SET LOCAL en parámetro es neutralizada. | **Fase 4 (Definida)** |
| **`AUTH-006`** (Portal de Clientes Segmentado) | `AMN-05` (Cliente accede a causa ajena)<br>`AMN-05` (Enumeración de otros clientes)<br>`AMN-15` (Fuerza bruta sobre portal) | - RLS de `Expediente` confinado a causas en `ExpedienteClientAccess`.<br>- RLS de `ExpedienteClientAccess` con `organizationId` directo (no recursivo) y filtrado per-user para rol CLIENT.<br>- Respuesta 404 estricta ante causas no asignadas. | - PostgreSQL RLS<br>- `ExpedienteClientAccess`<br>- ClientPortalController | `TST-AUTH-015`<br>`TST-AUTH-035`<br>`TST-AUTH-045` | - HTTP 404 estricto ante consulta de causa no asignada.<br>- 0 filas retornadas al intentar listar grants de otros clientes.<br>- Cero inferencia de existencia de expedientes ajenos. | **Fase 4 (Definida)** |
| **`AUTH-007`** (Arquitectura de Sesión BFF) | `AMN-01` (Exfiltración XSS)<br>`AMN-01` (Session Fixation)<br>`AMN-01` (Ataques CSRF)<br>`AMN-01` (Tampering de Token Vault)<br>`AMN-01` (Fallas en flujo OIDC)<br>`AMN-12` (Sesión zombi o resurrección) | - Tokens confinados en servidor; cookie `app_session` HttpOnly opaca.<br>- Rotación de sesión en login/step-up.<br>- Anti-CSRF Double Submit con firma HMAC y validación de origen canónico exacto (sin startsWith).<br>- Token Vault AES-256-GCM con IV único de 12B y rotación preventiva cada 90 días.<br>- Validación estricta de state, nonce y PKCE en OIDC.<br>- Almacén dual L1 Redis (TTL 300s) / L2 PostgreSQL con control de frescura por epoch (30s) y validación sincrónica en PG para operaciones sensibles (C-01).<br>- Fail-Closed estricto (503) si PostgreSQL no puede validar durabilidad. | - BFF Session Router<br>- CSRF Engine<br>- Token Vault<br>- Redis L1 Cache<br>- PostgreSQL `UserSession` | `TST-AUTH-029`<br>`TST-AUTH-031`<br>`TST-AUTH-032`<br>`TST-AUTH-033`<br>`TST-AUTH-034`<br>`TST-AUTH-036`<br>`TST-AUTH-037`<br>`TST-AUTH-040`<br>`TST-AUTH-041`<br>`TST-AUTH-044`<br>`TST-AUTH-047`<br>`TST-AUTH-048`<br>`TST-AUTH-051`<br>`TST-AUTH-052`<br>`TST-AUTH-054` | - Encabezados `Set-Cookie` opacos y `localStorage` vacío.<br>- Nuevo `sessionTokenHash` emitido tras login.<br>- HTTP 403 ante origen ajeno, token ausente o firma inválida.<br>- HTTP 401 ante alteración de ciphertext en Token Vault.<br>- HTTP 400 ante state/PKCE inválido y 401 ante nonce inválido.<br>- HTTP 401 ante inactividad (>30m) o tiempo absoluto (>8h).<br>- Revocación granular por dispositivo operativa.<br>- Sesión revocada en PG no resucita desde entrada zombi en Redis.<br>- Fallback exitoso a PG (200 OK) si Redis cae. | **Fase 4 (Definida)** |
| **`AUTH-008`** (Migración Asistida) | `AMN-14` (Explotación de credenciales legacy) | - Retiro definitivo de contraseñas locales.<br>- Enlace nominal de activación en Auth0 para cuentas existentes.<br>- Retención máxima de 90 días en read-only para `legacyPasswordHash`. | - Script de Migración<br>- Modelo `User` | `TST-AUTH-020` | - Ausencia de código de login local en backend y frontend.<br>- HTTP 404 exacto en `/auth/login`. | **Fase 4 (Definida)** |
| **`AUTH-009`** (Administración y MFA) | `AMN-08` (Operaciones críticas sin MFA)<br>`AMN-08` (MFA vencida) | - Decorador `@RequireMFA()` exigiendo claim `amr` con `'mfa'` y factor complementario.<br>- Verificación de frescura: `(now - auth_time) <= 900` (15 min).<br>- Retorno de desafío Step-Up con `max_age: 900`. | - `MfaGuard`<br>- `@RequireMFA()` | `TST-AUTH-017`<br>`TST-AUTH-023`<br>`TST-AUTH-038`<br>`TST-AUTH-039` | - HTTP 403 con `{ code: 'STEP_UP_MFA_REQUIRED', max_age: 900 }` si falta MFA o si `auth_time` supera los 15 minutos.<br>- HTTP 200 únicamente tras completar desafío MFA interactivo. | **Fase 4 (Definida)** |
| **`AUTH-010`** (Trazabilidad y Auditoría) | `AMN-16` (Fuga de secretos en logs)<br>`AMN-04` (Acceso cruzado no auditado)<br>`AMN-04` (Fuga histórica de auditoría) | - Exclusión total de la cabecera `Authorization` en streams de log.<br>- Sanitización de bodies y cookies en `LoggingInterceptor`.<br>- Registro inmutable de eventos `CROSS_TENANT_ACCESS_ATTEMPT`.<br>- Atribución histórica en `AuditLog` vía `organizationId` sin cláusulas `IS NULL` para tenants ordinarios.<br>- Registros históricos no atribuibles quedan confinados a auditoría de plataforma. | - `LoggingInterceptor`<br>- `SecurityAuditService`<br>- PostgreSQL RLS en `AuditLog` y `EventLog` | `TST-AUTH-024`<br>`TST-AUTH-025`<br>`TST-AUTH-049`<br>`TST-AUTH-050` | - Verificación de ausencia de cabecera `Authorization`, cookies y contraseñas en logs.<br>- Inserción comprobada de fila en `AuditLog` con IP, actor, hashes y tenant ante acceso cruzado.<br>- 0 filas ajenas y 0 filas con `organizationId IS NULL` retornadas a tenants ordinarios. | **Fase 4 (Definida)** |

---

## 3. ESTADÍSTICAS OBJETIVAS DE COBERTURA NORMATIVA

Conforme a la regla metodológica de no declarar porcentajes sin fórmula verificable:

| Dimensión de Cobertura | Total Requerido (Denominador) | Estado Actual (Numerador) | Porcentaje Verificable | Criterio de Verificación |
| :--- | :--- | :--- | :--- | :--- |
| **Requisitos Formales Especificados** | 10 (`AUTH-001` a `AUTH-010`) | 10 | **100 % (10/10)** | Sección 3 de `SPEC-AUTH-001` v1.0.8 (Baseline Consolidado) |
| **Amenazas Catalogadas Mitigadas en Diseño** | 16 (`AMN-01` a `AMN-16`) | 16 | **100 % (16/16)** | Controles arquitectónicos diseñados en secciones 4 a 13 |
| **Pruebas TDS Normativamente Definidas** | 54 (`TST-AUTH-001` a `TST-AUTH-054`) | 54 | **100 % (54/54)** | Catálogo completo con precondición, entrada, acción y resultado binario (12 Unitarias, 24 NestJS, 13 PG/RLS, 3 Redis, 1 Browser, 1 Config) |
| **Pruebas Automatizadas Implementadas en Código** | 54 (`TST-AUTH-001` a `TST-AUTH-054`) | En curso | **Fase 5 en progreso** | En ejecución incremental bajo expediente `AUTH0-IMPLEMENTATION-001` |
| **Pruebas Ejecutadas y Aprobadas en Entorno Local** | 54 (`TST-AUTH-001` a `TST-AUTH-054`) | En curso | **Fase 6 y 7 en progreso** | En ejecución incremental en suite Jest |
| **Modelos de Datos Reconciliados** | 29 (24 existentes + 5 nuevos) | 29 | **100 % (29/29)** | Sección 8 de `SPEC-AUTH-001` con convención camelCase entrecomillada |

---

## 4. CONTROL DE COHERENCIA DOCUMENTAL CRUZADA

| Verificación Cruzada | Fuente de Verdad | Documento Confrontado | Veredicto de Consistencia |
| :--- | :--- | :--- | :--- |
| **Cantidad Total de Pruebas** | `SPEC-AUTH-001` Sección 14 (54 pruebas) | `SPEC-AUTH-001-TEST-CATALOG` (54 pruebas: TST-AUTH-001 a 054) | **100 % CONSISTENTE** |
| **Convención de Nombres SQL** | `backend/prisma/schema.prisma` (camelCase) | `SPEC-AUTH-001` Políticas RLS y funciones SQL (quoted camelCase) | **100 % CONSISTENTE (B-03)** |
| **Modelo de Privilegios `SECURITY DEFINER`** | `SPEC-AUTH-001` Sección 9 (`auth_definer_role`) | `SPEC-AUTH-001-TEST-CATALOG` (`TST-AUTH-046`, `TST-AUTH-047`) | **100 % CONSISTENTE (B-04)** |
| **Aislamiento No Recursivo de Clientes** | `SPEC-AUTH-001` Sección 8 y 11 (`ExpedienteClientAccess`) | `SPEC-AUTH-001-TEST-CATALOG` (`TST-AUTH-015`) | **100 % CONSISTENTE (B-05, B-12)** |
| **Atribución Histórica de Auditoría** | `SPEC-AUTH-001` Sección 8.3 y 11.3 (sin inferencia) | `SPEC-AUTH-001-TEST-CATALOG` (`TST-AUTH-049`) | **100 % CONSISTENTE (B-06)** |
| **Consistencia Distribuida Redis/PG** | `SPEC-AUTH-001` Sección 10.1 (TTL 300s, epoch check) | `SPEC-AUTH-001-TEST-CATALOG` (`TST-AUTH-048`) | **100 % CONSISTENTE (B-01)** |
| **Validación Canónica de Origen Anti-CSRF** | `SPEC-AUTH-001` Sección 4.4 (sin startsWith) | `SPEC-AUTH-001-TEST-CATALOG` (`TST-AUTH-052`) | **100 % CONSISTENTE (B-09)** |
| **Roles Administrativos Separados** | `SPEC-AUTH-001` Sección 7.1 (Platform vs Tenant Admin) | `SPEC-AUTH-001-TEST-CATALOG` (`TST-AUTH-016`, `TST-AUTH-017`) | **100 % CONSISTENTE (B-11)** |
| **Exclusión de Header Authorization** | `SPEC-AUTH-001` Sección 13 (no loguear Authorization) | `SPEC-AUTH-001-TEST-CATALOG` (`TST-AUTH-024`) | **100 % CONSISTENTE (B-13)** |
| **Límites de Confianza GUC y SET LOCAL** | `SPEC-AUTH-001` Sección 11.1 (defensa en profundidad) | `SPEC-AUTH-001-TEST-CATALOG` (`TST-AUTH-053`) | **100 % CONSISTENTE (B-02)** |
| **Validación OIDC Desacoplada** | `SPEC-AUTH-001` Sección 4.1 y 14 (state, nonce, PKCE) | `SPEC-AUTH-001-TEST-CATALOG` (`TST-AUTH-036`, `TST-AUTH-054`) | **100 % CONSISTENTE (B-15)** |
