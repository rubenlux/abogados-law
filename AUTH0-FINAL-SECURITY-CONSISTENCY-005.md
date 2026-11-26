# INFORME DE RECONCILIACIÓN FINAL DE SEGURIDAD Y CONSISTENCIA ARQUITECTÓNICA
## Expediente: `AUTH0-FINAL-SECURITY-CONSISTENCY-005`
### Especificación: `SPEC-AUTH-001` (Versión `1.0.6-DRAFT`)
### Proyecto: Abogado Virtual — Abogados_law
### Repositorio: `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law`
### Rama de Referencia: `master`
### HEAD de Referencia: `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`
### Fecha de Emisión: 24 de noviembre de 2026
### Modalidad: READ-ONLY sobre código productivo — Corrección documental y técnica autorizada exclusivamente.

---

## 1. RESUMEN EJECUTIVO

El presente dictamen técnico documenta la resolución integral, definitiva y verificable de los cinco hallazgos de seguridad (`H-01` a `H-05`) y las cuatro precisiones normativas (`COR-001` a `COR-004`) formuladas durante la auditoría técnica independiente de `SPEC-AUTH-001` versión `1.0.5-DRAFT`.

La arquitectura ratifica con carácter inmutable las tres decisiones estratégicas aprobadas expresamente por el usuario:
- **`DEC-AUTH-001` (Aprobada):** Autenticación de clientes mediante **Auth0 Passwordless (Magic Link por email)** operado exclusivamente por el IdP. Cero generación local de enlaces de login o almacenamiento local de credenciales de acceso.
- **`DEC-AUTH-002` (Aprobada):** Adopción del patrón **Backend for Frontend (BFF)** como la única arquitectura objetivo, con tokens confinados en el servidor, cookie opaca de sesión, almacenamiento L1 en Redis (Set indexado) y L2 durable en PostgreSQL.
- **`DEC-AUTH-003` (Aprobada):** Política de **MFA por roles y operaciones sensibles** con verificación obligatoria en el backend (`@RequireMFA()`), sin delegar la confianza en el cliente y sin considerar `auth_time` por sí solo como prueba suficiente de segundo factor.

### Principio Innegociable de Soberanía Jurídica:
- **Auth0** es la **única autoridad de autenticación** (credenciales, Passwordless Magic Link, emisión y firma RS256, Universal Login y desafíos MFA).
- **Abogados_law** conserva el **control soberano y exclusivo sobre la autorización jurídica, funcional y multi-tenant** (organizaciones, usuarios internos, roles en cada estudio, permisos granulares, asignación de causas, aislamiento RLS y acceso de clientes a expedientes).

---

## 2. ESTADO INICIAL DE GIT Y AUDITORÍA DE ENTORNO

Previo al inicio de los trabajos, se ejecutó la verificación estricta del entorno local en modo de solo lectura:
- **Rama:** `master`
- **Commit HEAD:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`
- **Archivos de código productivo modificados durante este expediente:** **0 (CERO)**.
- **Modificaciones preexistentes detectadas en el árbol de trabajo:** `backend/package.json` y `docs/audits/ABOGADOS-LAW-GIT-BASELINE-CLEANUP-001.md` (provenientes de la fase previa de testing harness, preservadas intactas y sin alteraciones).

---

## 3. EVIDENCIA DE INSPECCIÓN DE `schema.prisma` Y MODELOS REALES

Se inspeccionó físicamente el archivo [backend/prisma/schema.prisma](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/backend/prisma/schema.prisma), confirmando:
1. **Modelos Preexistentes Reales (Exactamente 24 modelos):**
   - Multi-tenancy & Auth: `Organization` (L25), `User` (L50).
   - Core Legal: `Expediente` (L88), `Documento` (L121), `Client` (L149).
   - Agenda & Plazos: `EventoAgenda` (L179), `CalendarioJudicial` (L201).
   - Knowledge Base & RAG: `LegalNorm` (L244), `Jurisprudence` (L393), `JurisprudenceChunk` (L454), `JurisprudenceCitation` (L479).
   - Forensics & Telemetry: `AuditLog` (L314), `AIInteraction` (L346), `EventLog` (L761).
   - Chat Contextual: `AIChatSession` (L501), `AIChatMessage` (L521).
   - Drafting & Risk: `LegalDraft` (L556), `LegalRiskAnalysis` (L600).
   - Document Management: `DocumentVersion` (L629), `LegalTemplate` (L655).
   - Integración Judicial & Métricas: `JudicialAccount` (L678), `SubscriptionPlan` (L700), `TenantUsage` (L715), `EmployeeMetric` (L806).
2. **Modelos Normativos Incorporados por SPEC-AUTH-001 (Exactamente 5 modelos):**
   - `UserIdentity`, `UserSession`, `UserOrganization`, `InvitationToken`, `ExpedienteClientAccess`.
3. **Total Consolidado:** **29 modelos** (24 preexistentes + 5 normativos).

---

## 4. RESOLUCIÓN INDIVIDUAL DE HALLAZGOS OBLIGATORIOS (H-01 A H-05)

### H-01 — Resolución Inicial de `UserIdentity` sin Dependencia Circular
- **Defecto Identificado:** La política RLS `user_id = NULLIF(current_setting('app.current_user_id', true), '')::text` bloqueaba el login: durante la autenticación OIDC entrante, el `userId` aún no se conoce, provocando que la búsqueda de identidad devuelva 0 filas.
- **Solución Arquitectónica Implementada:**
  - Se define la función PostgreSQL restringida `auth.resolve_user_identity(p_issuer text, p_subject text)`.
  - Definida como `SECURITY DEFINER` con `SET search_path = public, auth, pg_temp;`.
  - Permisos: `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO abogados_app_user;`.
  - Parámetros: Estrictamente `(p_issuer, p_subject)` de un token previamente validado en firma RS256, emisor y audiencia por `Auth0JwtGuard`.
  - Retorno: Estrictamente `(user_id, user_status, default_org_id)`.
  - Operaciones prohibidas: Prohibido listar identidades, prohibidas consultas comodín o actualizaciones.
  - La tabla `UserIdentity` mantiene `FORCE ROW LEVEL SECURITY`, impidiendo lecturas arbitrarias.

### H-02 — Resolución Inicial de `UserSession` y Validación de Cookie BFF
- **Defecto Identificado:** RLS sobre `UserSession` requería `app.current_user_id`, impidiendo al BFF validar la cookie `app_session` antes de identificar al usuario.
- **Solución Arquitectónica Implementada:**
  - Se define la función PostgreSQL restringida `auth.lookup_session(p_session_token_hash text)`.
  - Definida como `SECURITY DEFINER` con `SET search_path = public, auth, pg_temp;`.
  - Recibe exclusivamente el hash SHA-256 de 64 caracteres de la cookie opaca.
  - Retorna únicamente los metadatos de validación de sesión (`session_id`, `user_id`, `auth0_sid`, `idle_expires_at`, `expires_at`, `revoked_at`, `user_status`, `token_valid_after`).
  - No permite listar sesiones de otros usuarios ni volcar la tabla.
  - Se especifica el protocolo formal de resolución en 10 pasos (recepción, validación sintáctica, hashing, lookup L1/L2, verificación de inactividad, verificación de revocación, verificación de status de usuario, inyección de contexto de usuario, inyección de contexto tenant y autorización).

### H-03 — Revocación Individual y Global: PostgreSQL como Fuente Durable de Verdad
- **Defecto Identificado:** Se asumía atomicidad distribuida entre Redis y PostgreSQL, y se utilizaban expresiones ambiguas sobre neutralización en "< 1 ms" o comandos `KEYS`/`SCAN`.
- **Solución Arquitectónica Implementada:**
  - **PostgreSQL como Fuente de Verdad:** Ninguna revocación se considera exitosa ni se responde al usuario hasta que PostgreSQL confirme el commit en disco.
  - **Revocación Individual:** Transacción durable `UPDATE "UserSession" SET "revokedAt" = clock_timestamp() ... RETURNING "userId";` -> Desalojo en Redis `MULTI DEL session:<hash> SREM user_sessions:<userId> <hash> EXEC` -> `Set-Cookie` de destrucción -> Inserción en `AuditLog`.
  - **Revocación Global:** Transacción durable `UPDATE "User" SET "tokenValidAfter" = ...; UPDATE "UserSession" SET "revokedAt" = ... RETURNING "sessionToken";` -> Desalojo en Redis de la lista exacta de sesiones y del Set `user_sessions:<userId>` sin escaneos globales.
  - **Consistencia y Resiliencia:** Si Redis cae, la revocación durable en PostgreSQL garantiza que ningún request subsiguiente sea admitido (fallback seguro). Si PostgreSQL cae, se adopta **Fail-Closed estricto: `503 Service Unavailable`**.

### H-04 — Corrección de Políticas RLS de `AuditLog` y `EventLog`
- **Defecto Identificado:** Las condiciones `user_id IS NULL OR ...` en `AuditLog` y `organization_id IS NULL OR ...` en `EventLog` permitían que eventos huérfanos o de plataforma fueran visibles por cualquier tenant.
- **Solución Arquitectónica Implementada:**
  - `AuditLog`: Se rediseña la política exigiendo taxativamente `user_id IS NOT NULL AND user_id IN (SELECT uo.user_id FROM "UserOrganization" uo WHERE uo.organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text)`. Los registros con `user_id IS NULL` quedan inaccesibles para tenants ordinarios y se reservan para auditoría administrativa de plataforma.
  - `EventLog`: Se rediseña la política exigiendo taxativamente `organization_id IS NOT NULL AND organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text`. Los eventos globales de telemetría (`organization_id IS NULL`) son invisibles para tenants.

### H-05 — Corrección del Protocolo Token Epoch y Semántica Temporal
- **Defecto Identificado:** Afirmar que `now() + interval '1 second'` neutralizaba sesiones en < 1 ms ignoraba la granularidad en segundos enteros del claim OIDC `iat`, posibles desfases de reloj y latencias de commit.
- **Solución Arquitectónica Implementada:**
  - Formulación determinista:
    $$\text{tokenValidAfter} = \text{to\_timestamp}(\lceil\text{EXTRACT(EPOCH FROM clock\_timestamp())}\rceil + 1)$$
  - Comparación en backend:
    $$\text{token.iat} \ge \lfloor\text{EXTRACT(EPOCH FROM user.tokenValidAfter)}\rfloor$$
  - Al avanzar al siguiente entero de segundo y sumar 1 segundo, cualquier token emitido previamente ($T_{\text{issued}} \le T_{\text{current}}$) tiene forzosamente $T_{\text{issued}} < \text{tokenValidAfter}$, garantizando rechazo determinista con `401 Unauthorized`.
  - Se eliminan afirmaciones no demostradas de "< 1 ms", estableciendo que la invalidación es inmediata en el siguiente request procesado tras el commit de base de datos.

---

## 5. RESOLUCIÓN DE PRECISIONES COMPLEMENTARIAS (COR-001 A COR-004)

- **`COR-001` (Motor Anti-CSRF Criptográfico):** Double Submit Cookie firmado con HMAC (`csrfToken = timestamp + "." + hmac_sha256(csrfSecret, sessionTokenHash + ":" + timestamp)`). Validación de encabezado `Origin` contra whitelist `FRONTEND_URL` (`403 Forbidden: CSRF_ORIGIN_MISMATCH`). Validación en tiempo constante (`timingSafeEqual`) de `X-CSRF-Token` contra cookie y HMAC de la sesión activa (`403 Forbidden: INVALID_CSRF_TOKEN`).
- **`COR-002` (MFA y Step-Up):** Claim `amr` debe contener explícitamente `'mfa'` y al menos un factor válido (`'otp'`, `'sms'`, `'webauthn'`, `'fido2'`). `auth_time` reciente (< 15 min) por sí solo **NO acredita MFA**. Si no se cumple, responde `403 Forbidden` (`STEP_UP_MFA_REQUIRED`, `max_age: 900`). El frontend nunca decide si Step-Up fue superado.
- **`COR-003` (AES-256-GCM en Token Vault):** MEK de 256 bits custodiada externamente (`BFF_ENCRYPTION_KEY_V1`). IV de 12 bytes CSPRNG único por operación. Tag de 16 bytes verificado obligatoriamente (`CiphertextTamperedException`). Límite operativo NIST de $2^{32}$ cifrados con rotación preventiva cada 90 días y soporte de keyring multiversión (`v1:`, `v2:`). Fail-Closed sin registrar secretos en logs.
- **`COR-004` (Rigor Metodológico TDS):** Escala formal de 4 niveles:
  1. *Control Especificado:* 100% formalizado en la especificación.
  2. *Prueba TDS Definida:* 100% catalogada normativamente con precondiciones, entrada, acción y resultado binario (52 pruebas).
  3. *Prueba Automatizada Implementada:* (Estado futuro post-autorización).
  4. *Prueba Ejecutada y Aprobada:* (Estado futuro en Green Phase).

---

## 6. INVENTARIO DEFINITIVO DE MODELOS Y POLÍTICAS RLS (29 MODELOS)

| N° | Modelo Prisma | Tabla PostgreSQL | Clasificación | Tenancy | Clave Organización / Relación | Política PostgreSQL RLS (`USING` / `WITH CHECK`) | Justificación de Inclusión / Exclusión | Prueba TDS |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **`Organization`** | `"Organization"` | Multi-Tenant | Directo | `id` | `id = NULLIF(current_setting('app.current_organization_id', true), '')::text` | Entidad raíz del estudio jurídico; aislamiento de tenant. | `TST-AUTH-013` |
| 2 | **`User`** | `"User"` | Multi-Tenant | Directo / Per-User | `organizationId` / `UserOrganization` | `id = NULLIF(current_setting('app.current_user_id', true), '')::text OR id IN (SELECT user_id FROM "UserOrganization" WHERE organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text)` | Nómina de abogados y empleados del estudio activo o propio perfil. | `TST-AUTH-011` |
| 3 | **`Expediente`** | `"Expediente"` | Multi-Tenant | Directo | `organizationId` | `organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text` | Secreto profesional del expediente judicial; causas del estudio. | `TST-AUTH-026` |
| 4 | **`Documento`** | `"Documento"` | Multi-Tenant | Indirecto | `expedienteId -> Expediente.organizationId` | `expediente_id IN (SELECT id FROM "Expediente" WHERE organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text)` | Escritos, cédulas y piezas procesales del expediente protegido. | `TST-AUTH-042` |
| 5 | **`Client`** | `"Client"` | Multi-Tenant | **Directo** | `organizationId` | `organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text` | Cartera de clientes representados por el estudio (L156 schema.prisma). | `TST-AUTH-042` |
| 6 | **`EventoAgenda`** | `"EventoAgenda"` | Multi-Tenant | Indirecto | `expedienteId -> Expediente.organizationId` | `expediente_id IN (SELECT id FROM "Expediente" WHERE organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text)` | Plazos fatales y audiencias de los expedientes del estudio. | `TST-AUTH-042` |
| 7 | **`CalendarioJudicial`** | `"CalendarioJudicial"` | Global / Pública | Exento | N/A | **Sin RLS** (Lectura pública) | Feriados y asuetos de observancia procesal común por fuero. | `TST-AUTH-001` |
| 8 | **`LegalNorm`** | `"LegalNorm"` | Global / Pública | Exento | N/A | **Sin RLS** (Lectura pública) | Corpus legislativo público nacional y provincial (RAG común). | `TST-AUTH-001` |
| 9 | **`AuditLog`** | `"AuditLog"` | Multi-Tenant | Indirecto Seguro | `userId -> UserOrganization.organizationId` | `user_id IS NOT NULL AND user_id IN (SELECT uo.user_id FROM "UserOrganization" uo WHERE uo.organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text)` | Trazabilidad forense de miembros de la firma legal; sin fugas `user_id IS NULL`. | `TST-AUTH-025`, `TST-AUTH-049` |
| 10 | **`AIInteraction`** | `"AIInteraction"` | Multi-Tenant | Directo | `organizationId` | `organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text` | Consultas confidenciales a modelos de lenguaje por cada estudio. | `TST-AUTH-014` |
| 11 | **`Jurisprudence`** | `"Jurisprudence"` | Global / Pública | Exento | N/A | **Sin RLS** (Lectura pública) | Fallos judiciales públicos (CSJN, Cámaras Federales/Provinciales). | `TST-AUTH-001` |
| 12 | **`JurisprudenceChunk`**| `"JurisprudenceChunk"`| Global / Pública | Exento | N/A | **Sin RLS** (Lectura pública) | Considerandos y doctrinas públicas para embeddings vectoriales. | `TST-AUTH-001` |
| 13 | **`JurisprudenceCitation`**| `"JurisprudenceCitation"`| Global / Pública | Exento | N/A | **Sin RLS** (Lectura pública) | Grafo objetivo de citas entre fallos judiciales públicos. | `TST-AUTH-001` |
| 14 | **`AIChatSession`** | `"AIChatSession"` | Multi-Tenant | Indirecto | `expedienteId -> Expediente.organizationId` | `expediente_id IN (SELECT id FROM "Expediente" WHERE organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text)` | Hilos de chat contextualizados en expedientes jurídicos. | `TST-AUTH-026` |
| 15 | **`AIChatMessage`** | `"AIChatMessage"` | Multi-Tenant | Indirecto | `sessionId -> AIChatSession -> Expediente` | `session_id IN (SELECT s.id FROM "AIChatSession" s JOIN "Expediente" e ON s.expediente_id = e.id WHERE e.organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text)` | Mensajes confidenciales y citas del chat contextual de la causa. | `TST-AUTH-026` |
| 16 | **`LegalDraft`** | `"LegalDraft"` | Multi-Tenant | Indirecto | `expedienteId` o `userId` | `(expediente_id IS NOT NULL AND expediente_id IN (SELECT id FROM "Expediente" WHERE organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text)) OR (user_id IN (SELECT user_id FROM "UserOrganization" WHERE organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text))` | Borradores de escritos redactados por abogados del estudio activo. | `TST-AUTH-027` |
| 17 | **`LegalRiskAnalysis`**| `"LegalRiskAnalysis"`| Multi-Tenant | Indirecto | `expedienteId -> Expediente.organizationId` | `expediente_id IN (SELECT id FROM "Expediente" WHERE organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text)` | Dictámenes automatizados de riesgo procesal de causas del estudio. | `TST-AUTH-026` |
| 18 | **`DocumentVersion`** | `"DocumentVersion"` | Multi-Tenant | Indirecto | `documentId -> Documento -> Expediente` | `document_id IN (SELECT d.id FROM "Documento" d JOIN "Expediente" e ON d.expediente_id = e.id WHERE e.organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text)` | Historial de versiones y hashes SHA-256 de documentos. | `TST-AUTH-042` |
| 19 | **`LegalTemplate`** | `"LegalTemplate"` | Multi-Tenant | Directo | `organizationId` | `organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text` | Plantillas de escritos y cartas documento privadas de la firma. | `TST-AUTH-014` |
| 20 | **`JudicialAccount`** | `"JudicialAccount"` | Multi-Tenant | Directo | `organizationId` | `organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text` | Credenciales cifradas de portales judiciales (PJN, MEV, CSJN). | `TST-AUTH-014` |
| 21 | **`SubscriptionPlan`**| `"SubscriptionPlan"`| Global / Pública | Exento | N/A | **Sin RLS** (Lectura pública) | Catálogo de planes y cuotas del sistema comercial SaaS. | `TST-AUTH-001` |
| 22 | **`TenantUsage`** | `"TenantUsage"` | Multi-Tenant | Directo | `organizationId` | `organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text` | Métricas de consumo de almacenamiento y tokens de IA del estudio. | `TST-AUTH-014` |
| 23 | **`EventLog`** | `"EventLog"` | Multi-Tenant | Directo Seguro | `organizationId` | `organization_id IS NOT NULL AND organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text` | Telemetría forense de plataforma; sin fugas de eventos de plataforma (`organization_id IS NULL`). | `TST-AUTH-025`, `TST-AUTH-050` |
| 24 | **`EmployeeMetric`** | `"EmployeeMetric"` | Multi-Tenant | Indirecto | `userId -> UserOrganization.organizationId` | `user_id IN (SELECT user_id FROM "UserOrganization" WHERE organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text)` | Métricas de rendimiento y horas de los abogados del estudio. | `TST-AUTH-027` |
| 25 | **`UserIdentity`** *(Nueva)* | `"UserIdentity"` | Global / OIDC | Acceso vía Función | N/A (Mapeo OIDC) | RLS per-user: `user_id = NULLIF(current_setting('app.current_user_id', true), '')::text`. Resolución inicial vía `auth.resolve_user_identity()`. | Mapeo OIDC `(iss, sub) -> userId` resuelto de forma segura sin dependencia circular. | `TST-AUTH-009`, `TST-AUTH-046` |
| 26 | **`UserSession`** *(Nueva)* | `"UserSession"` | Multi-Tenant | Per-User (Acceso vía Función) | `userId` | RLS per-user: `user_id = NULLIF(current_setting('app.current_user_id', true), '')::text`. Lookup inicial vía `auth.lookup_session()`. | La sesión pertenece al usuario; permite cambiar de estudio sin re-login. | `TST-AUTH-029`, `TST-AUTH-047` |
| 27 | **`UserOrganization`** *(Nueva)*| `"UserOrganization"`| Multi-Tenant | Directo | `organizationId` | `organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text OR user_id = NULLIF(current_setting('app.current_user_id', true), '')::text` | Membresías y roles en el estudio activo o propias del usuario. | `TST-AUTH-012` |
| 28 | **`InvitationToken`** *(Nueva)*| `"InvitationToken"`| Multi-Tenant | Directo | `organizationId` | `organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text` | Enlaces de invitación administrativa de personal emitidos por el estudio. | `TST-AUTH-021` |
| 29 | **`ExpedienteClientAccess`** *(Nueva)*| `"ExpedienteClientAccess"`| Multi-Tenant | Indirecto | `expedienteId -> Expediente.organizationId` | `expediente_id IN (SELECT id FROM "Expediente" WHERE organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text)` | Habilitación de causas a clientes del estudio jurídico. | `TST-AUTH-015` |

---

## 7. PROTOCOLO DE RESOLUCIÓN DE IDENTIDAD Y SESIÓN (H-01, H-02)

Se establece la separación formal entre la resolución técnica y la autorización jurídica:
1. **Resolución de Identidad OIDC:** Ejecutada por `Auth0JwtGuard` -> invoca la función `auth.resolve_user_identity(iss, sub)` únicamente tras validar la firma RS256, emisor y audiencia del token. La función es `SECURITY DEFINER`, tiene `search_path` seguro y restringe su salida a `(user_id, status, default_org_id)`.
2. **Resolución de Sesión BFF:** Ejecutada por el middleware de sesión del BFF -> valida sintaxis de la cookie `app_session`, calcula el hash SHA-256, consulta la caché L1 en Redis y, ante miss o fallo, invoca la función `auth.lookup_session(sessionTokenHash)` en PostgreSQL.
3. **Establecimiento de Contexto:** Una vez obtenido el `userId` y resuelta la membresía activa en `UserOrganization`, el backend abre transacción y ejecuta:
   ```sql
   SET LOCAL app.current_organization_id = '<resolvedOrgId>';
   SET LOCAL app.current_user_id = '<resolvedUserId>';
   ```
4. **Autorización y Scoped Query:** `RolesAndPermissionsGuard` valida roles y MFA; `ScopedPrismaService` y PostgreSQL RLS aplican las políticas sobre las entidades de negocio.

---

## 8. PROTOCOLO DE REVOCACIÓN Y CONSISTENCIA DURABLE (H-03, H-05)

- **PostgreSQL como Verdad Durable:** La revocación no se considera confirmada hasta que el commit en PostgreSQL finaliza exitosamente.
- **Revocación Individual:** Transacción durable `UPDATE "UserSession" SET "revokedAt" = clock_timestamp() ...` -> Desalojo en Redis `MULTI DEL session:<hash> SREM user_sessions:<userId> <hash> EXEC` -> `Set-Cookie` de expiración inmediata.
- **Revocación Global:** Transacción durable `UPDATE "User" SET "tokenValidAfter" = ...; UPDATE "UserSession" SET "revokedAt" = ...` -> Desalojo atómico en Redis vía Set `user_sessions:<userId>` sin escaneos `KEYS`/`SCAN`.
- **Token Epoch Determinista:** Se calcula como $\text{to\_timestamp}(\lceil\text{now()}\rceil + 1)$ para resolver la granularidad de segundos enteros de JWT y absorberclock skew. Todo token previo cumple $T_{\text{iat}} < \text{epoch}$ y es rechazado con `401 Unauthorized`.

---

## 9. PROTOCOLO CSRF Y OIDC (COR-001)

- **Anti-CSRF:** Double Submit Cookie con HMAC vinculado a sesión.
- **Validación de Origen:** Verificación de `Origin` (o `Referer`) contra whitelist `FRONTEND_URL` (`403 Forbidden: CSRF_ORIGIN_MISMATCH`).
- **Validación Criptográfica:** Encabezado `X-CSRF-Token` verificado en tiempo constante contra cookie y firma HMAC vinculada a la sesión activa (`403 Forbidden: INVALID_CSRF_TOKEN`).
- **OIDC:** Flujo Authorization Code con PKCE para personal; Auth0 Passwordless Magic Link para clientes. Verificación estricta de `state`, `nonce` y prevención de replay attacks (`invalid_grant`).

---

## 10. CAMBIOS DEL CATÁLOGO TDS (52 PRUEBAS UNÍVOCAS)

Se preservan las 45 pruebas originales y se incorporan 7 pruebas específicas para verificar los nuevos controles de seguridad:
- `TST-AUTH-001` a `TST-AUTH-045`: Pruebas base de validación RS256, RBAC, tenant isolation, Magic Link, BFF cookies, timeout, Step-Up y resiliencia JWKS/Redis.
- `TST-AUTH-046` *(Nueva)*: Resolución inicial de `UserIdentity` vía función `auth.resolve_user_identity` sin dependencia circular (H-01).
- `TST-AUTH-047` *(Nueva)*: Resolución inicial de `UserSession` vía función `auth.lookup_session` por hash de cookie (H-02).
- `TST-AUTH-048` *(Nueva)*: Revocación global con commit durable en PostgreSQL e invalidación en Redis (H-03).
- `TST-AUTH-049` *(Nueva)*: `AuditLog`: Bloqueo estricto de eventos huérfanos (`user_id IS NULL`) a tenants ordinarios (H-04).
- `TST-AUTH-050` *(Nueva)*: `EventLog`: Bloqueo estricto de eventos de plataforma (`organization_id IS NULL`) a tenants ordinarios (H-04).
- `TST-AUTH-051` *(Nueva)*: Token Epoch: Evaluación determinista de frontera temporal con segundos enteros y prevención de desfase (H-05).
- `TST-AUTH-052` *(Nueva)*: Motor Anti-CSRF: Validación de Origin y verificación de firma HMAC vinculada a sesión activa (COR-001).

---

## 11. MATRIZ DE TRAZABILIDAD ACTUALIZADA (1:1)

En [SPEC-AUTH-001-TRACEABILITY-MATRIX.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/SPEC-AUTH-001-TRACEABILITY-MATRIX.md):
- **10/10 Requisitos Formales** (`AUTH-001` a `AUTH-010`) asociados a pruebas TDS.
- **16/16 Amenazas Catalogadas** (`AMN-01` a `AMN-16`) mitigadas mediante controles especificados.
- **52/52 Pruebas TDS Mapeadas 1:1** con componentes y evidencias verificables.

---

## 12. HALLAZGOS PENDIENTES

- **Hallazgos Bloqueantes:** **0 (CERO)**. Todos los hallazgos `H-01` a `H-05` y `COR-001` a `COR-004` han sido subsanados con especificaciones técnicas rigurosas y verificables.
- **Observaciones de Implementación Futura:** La ejecución técnica de las migraciones SQL, la creación de las funciones `SECURITY DEFINER` y la codificación de las pruebas en Jest requerirán la correspondiente autorización formal e independiente de implementación TDS por parte del usuario.

---

## 13. VERIFICACIÓN DE RESTRICCIONES READ-ONLY EN CÓDIGO PRODUCTIVO

- **Archivos de código productivo modificados:** **0 (CERO)**.
- **Esquema de base de datos (`schema.prisma`) modificado:** **0 (CERO)**.
- **Migraciones creadas o ejecutadas:** **0 (CERO)**.
- **Dependencias alteradas (`package.json`):** **0 (CERO)**.
- **Configuraciones de entorno alteradas (`.env`):** **0 (CERO)**.
- **Estado de trabajo:** Exclusivamente documental sobre los archivos canónicos del expediente.

---

## 14. HASHES CRIPTOGRÁFICOS SHA-256 DE TODOS LOS DOCUMENTOS

| Documento | Estado / Versión | Hash SHA-256 |
| :--- | :--- | :--- |
| [SPEC-AUTH-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/SPEC-AUTH-001.md) | `1.0.6-DRAFT` | `AA3CBEE20E270A6D1B9D66F7E5373FEF5089E954E0CE1C20C2406163722CB879` |
| [SPEC-AUTH-001-TEST-CATALOG.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/SPEC-AUTH-001-TEST-CATALOG.md) | `1.0.6-DRAFT` | `0AE1C19615D05B085EFD792DFFB07823BBE47BD8AC1D83AFF50C7099796F7A60` |
| [SPEC-AUTH-001-TRACEABILITY-MATRIX.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/SPEC-AUTH-001-TRACEABILITY-MATRIX.md) | `1.0.6-DRAFT` | `2B8A6CF4B17EEED40D30068D109C8B034DE09CA545526C224D758DBB24E3BAAF` |
| [AUTH0-FINAL-CONSISTENCY-RECONCILIATION-004.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/AUTH0-FINAL-CONSISTENCY-RECONCILIATION-004.md) | Preservado | `1222D9BE4CE2C360F3F45B932BE126430E8C22C01B075B0CCAE9C07616C247C8` |
| [AUTH0-ARCHITECTURE-FINAL-TECHNICAL-REMEDIATION-003.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/AUTH0-ARCHITECTURE-FINAL-TECHNICAL-REMEDIATION-003.md) | Preservado | `3F29D68643643A8CDBAB7E0CEC7DE03666F188615C4C073ED834AE29BA9EC493` |
| [AUTH0-ARCHITECTURE-DECISION-CONSOLIDATION-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/AUTH0-ARCHITECTURE-DECISION-CONSOLIDATION-001.md) | Preservado | `35A3BACAFDB719892F7EBBC358152A922A0DEC082284791CEC678EB5034A5857` |
| [AUTH0-FINAL-REMEDIATION-002.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/AUTH0-FINAL-REMEDIATION-002.md) | Preservado | `3570908BF17FF346949CB851BF0199AEE8F600EE57FA089AF03D6951D9231D85` |
| [AUTH0-ARCHITECTURE-REMEDIATION-001.md](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/AUTH0-ARCHITECTURE-REMEDIATION-001.md) | Preservado | `3F08CEE077AF74B570784E41002158A637B020C7A246039BDD25484B287EC216` |

---

## 15. DICTAMEN TÉCNICO FINAL

Se constata la resolución rigurosa, matemática y documental de las cinco observaciones obligatorias (`H-01` a `H-05`) y las cuatro precisiones (`COR-001` a `COR-004`). La arquitectura objetivo elimina las dependencias circulares en la resolución de identidad y sesión, establece a PostgreSQL como fuente durable de verdad de revocación sin confiar en atomicidad distribuida con Redis, blinda las políticas RLS de `AuditLog` y `EventLog` eliminando fugas de eventos `IS NULL`, formula matemáticamente el Token Epoch sobre segundos enteros, especifica el motor Anti-CSRF criptográfico con HMAC y Origin, y expande el catálogo TDS a 52 pruebas binarias bajo estricto rigor metodológico.

### Veredicto:
# **`APPROVED_FOR_FORMAL_SPEC_APPROVAL`**

*(Aprobada para la Aprobación Formal de la Especificación por parte de la Dirección Técnica y el Usuario).*
