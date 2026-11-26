# ESPECIFICACIÓN TÉCNICA DE IDENTIDAD Y AUTENTICACIÓN
## Identificador: SPEC-AUTH-001
### Versión: 1.0.8
### Expediente: `AUTH0-IMPLEMENTATION-001`
### Estado: BASELINE CONSOLIDADO DE IMPLEMENTACIÓN
### Repositorio: `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law`

---

| Metadato | Detalle Normativo |
| :--- | :--- |
| **Identificador** | `SPEC-AUTH-001` |
| **Versión** | `1.0.8` |
| **Fecha de Versión** | 24 de noviembre de 2026 |
| **Estado** | `BASELINE CONSOLIDADO DE IMPLEMENTACIÓN` |
| **Módulos Afectados** | `backend/src/auth/`, `frontend/src/core/store/`, `admin-platform/`, `backend/prisma/` |
| **Documentos de Soporte** | `AUTH0-ARCHITECTURE-REMEDIATION-001.md`, `AUTH0-FINAL-REMEDIATION-002.md`, `AUTH0-ARCHITECTURE-DECISION-CONSOLIDATION-001.md`, `AUTH0-ARCHITECTURE-FINAL-TECHNICAL-REMEDIATION-003.md`, `AUTH0-FINAL-CONSISTENCY-RECONCILIATION-004.md`, `AUTH0-FINAL-SECURITY-CONSISTENCY-005.md`, `AUTH0-FINAL-REMEDIATION-006.md`, `AUTH0-FINAL-REMEDIATION-007-REPORT.md`, `AUTH0-IMPLEMENTATION-001-BASELINE-CLOSURE.md` |
| **Catálogo de Pruebas** | `SPEC-AUTH-001-TEST-CATALOG` (TST-AUTH-001 a TST-AUTH-054) |
| **Matriz de Trazabilidad** | `SPEC-AUTH-001-TRACEABILITY-MATRIX` |

---

## 1. RESUMEN EJECUTIVO Y SOBERANÍA JURÍDICA

La presente especificación establece la arquitectura técnica consolidada para la sustitución del mecanismo de autenticación local actual por **Auth0 como Proveedor Externo de Identidad (IdP)** en la plataforma Abogados_law, incorporando las tres decisiones arquitectónicas expresamente aprobadas por el usuario:
1. **DEC-AUTH-001 (Aprobada):** Autenticación del portal de clientes mediante **Auth0 Passwordless (Magic Link por email)** operado con exclusividad por Auth0.
2. **DEC-AUTH-002 (Aprobada):** Arquitectura de sesión en frontend basada en **Backend for Frontend (BFF)** con cookies seguras desacopladas, protección Anti-CSRF criptográfica (Double Submit HMAC + Origin estricto), y almacenamiento dual L1 en Redis (con control de frescura de epoch) y L2 durable en PostgreSQL.
3. **DEC-AUTH-003 (Aprobada):** Política de **MFA por roles y operaciones sensibles** con verificación estricta en el backend y protocolo Step-Up.

### Principio Innegociable de Soberanía Jurídica:
- **Auth0** es la **única autoridad de autenticación** de identidades (verificación de credenciales, Passwordless Magic Link, emisión y firma de tokens RS256, Universal Login y desafíos MFA). Cero mecanismos locales de login o tokens caseros que compitan con el IdP.
- **Abogados_law** conserva el **control soberano y exclusivo de la autorización funcional, jurídica y multi-tenant** (gestión de organizaciones, usuarios internos, roles contextuales en cada estudio, permisos granulares, asignación de causas, aislamiento RLS y acceso de clientes a expedientes).

Bajo ninguna circunstancia se delega en Auth0 la gobernanza sobre expedientes judiciales, clientes jurídicos o documentos legales.

---

## 2. ESTADO ACTUAL COMPROBADO Y EVIDENCIAS TÉCNICAS

El relevamiento empírico del repositorio constató las siguientes vulnerabilidades estructurales en el código base actual:
1. **SEC-001 (Backdoor de Contraseñas):** En [auth.service.ts:25](file:///C:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/backend/src/auth/auth.service.ts#L25) existe una comparación en texto plano: `if (user.passwordHash === loginDto.password)` que valida contraseñas sin procesar por bcrypt, habilitando el uso de `hash123` proveniente de [seed.ts:27](file:///C:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/backend/prisma/seed.ts#L27).
2. **SEC-002 (Portal de Clientes sin Contraseña):** En [client-portal.service.ts:35](file:///C:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/backend/src/client-portal/client-portal.service.ts#L35), el login solicita email y CUIT pero **no valida contraseña ni verifica el CUIT** contra la base de datos, emitiendo JWT con rol `CLIENT` a cualquiera que conozca un email de cliente.
3. **SEC-003 (Fugas Multi-Tenant e IDOR):** En [expedientes.service.ts:9](file:///C:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/backend/src/expedientes/expedientes.service.ts#L9), `findAll()` retorna **todos los expedientes de todos los estudios** de la base de datos sin filtrar por `organizationId`. En `create()` ([expedientes.service.ts:18](file:///C:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/backend/src/expedientes/expedientes.service.ts#L18)), el `organizationId` se toma del cuerpo HTTP del cliente sin validación.
4. **SEC-004 (Endpoints Administrativos Desprotegidos):** En [admin-api.controller.ts](file:///C:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/backend/src/admin/admin-api.controller.ts) y [admin-master.controller.ts](file:///C:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/backend/src/admin/admin-master.controller.ts), las rutas `/admin-api/stats`, `/admin-api/logs` y `/admin/tenants` no tienen guards activos, exponiendo telemetría y datos multi-tenant a cualquier cliente no autenticado.
5. **SEC-005 (Secretos Simétricos Inseguros):** En [auth.module.ts:17](file:///C:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/backend/src/auth/auth.module.ts#L17) y [auth.service.ts:104](file:///C:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/backend/src/auth/auth.service.ts#L104), se utilizan claves simétricas (`JWT_SECRET`, `JWT_REFRESH_SECRET`) con fallbacks inseguros por defecto (`'secret'`, `'refresh-secret'`).
6. **Exposición en Frontend:** En [useAuthStore.ts:33](file:///C:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/frontend/src/core/store/useAuthStore.ts#L33) los tokens se persisten en `localStorage` (vulnerables a XSS) y en [LoginPage.tsx:48](file:///C:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/frontend/src/modules/auth/pages/LoginPage.tsx#L48) existe un bypass en cliente ante caídas del servidor.

---

## 3. TABLA DE REQUISITOS FORMALES CONSOLIDADOS (AUTH-001 A AUTH-010)

| Código | Título | Descripción Operativa y Criterio de Aceptación |
| :--- | :--- | :--- |
| **AUTH-001** | Autenticación Externa Delegada | Toda autenticación interactiva de personal se delega en Auth0 Universal Login vía Authorization Code Flow con PKCE. Los clientes se autentican exclusivamente mediante Auth0 Passwordless Magic Link (DEC-AUTH-001). Cero contraseñas locales ni mecanismos de login paralelos. |
| **AUTH-002** | Validación Asimétrica de Tokens | El backend valida Access Tokens RS256 contra el endpoint JWKS oficial (`jwks-rsa`). Rechaza firmas inválidas, tokens expirados, issuers incorrectos o ID Tokens enviados como credenciales de API. |
| **AUTH-003** | Vinculación Desacoplada de Identidad | La identidad se modela mediante la entidad `UserIdentity (issuer, subject, userId)` con restricción `@@unique([issuer, subject])`. Su resolución inicial se ejecuta mediante función `SECURITY DEFINER` restringida sin dependencia circular de RLS. |
| **AUTH-004** | Autorización Jurídica Soberana | Los roles contextuales (`UserOrganization.roleInOrg`), permisos y autorizaciones sobre causas judiciales son resueltos exclusivamente por la base de datos de Abogados_law a través del `SecurityContextGuard`. |
| **AUTH-005** | Aislamiento Multi-Tenant Inviolable | Todo acceso a datos implementa triple barrera: Guard de contexto, `ScopedPrismaService` obligatorio y PostgreSQL RLS exhaustivo (`FORCE ROW LEVEL SECURITY`). El parámetro `organizationId` no puede ser fijado ni sobreescrito por el frontend. |
| **AUTH-006** | Segmentación del Portal de Clientes | Los clientes tienen un flujo de login Passwordless gestionado por Auth0 (15m, uso único, anti-enumeración) y su autorización sobre causas se restringe estrictamente a la tabla relacional `ExpedienteClientAccess` tanto en backend como en PostgreSQL RLS no recursivo. |
| **AUTH-007** | Arquitectura de Sesión BFF | Se adopta el patrón Backend for Frontend (BFF) como arquitectura objetivo (DEC-AUTH-002). Cero tokens en el navegador. La sesión se mantiene mediante cookie opaca con segmentación `SameSite`, protección Anti-CSRF criptográfica (Double Submit HMAC + Origin estricto) y almacén dual L1 Redis (con control de frescura de epoch) / L2 PostgreSQL. |
| **AUTH-008** | Migración Asistida sin Dual Run Inseguro | La migración de usuarios existentes se ejecuta mediante Invitación Criptográfica de Un Solo Uso (CSPRNG 32 bytes) y activación en Auth0, erradicando de inmediato los backdoors locales sin riesgo de interrupción de servicio. |
| **AUTH-009** | Protección de Rutas Administrativas y MFA | MFA obligatoria para `ADMIN` y `PARTNER`; MFA obligatoria para operaciones sensibles en `ASSOCIATE` y `PARALEGAL` (DEC-AUTH-003). Se distingue nítidamente el rol de Administrador de Plataforma del Administrador de Estudio Jurídico. El backend verifica los claims `amr` (debe contener `'mfa'` y factor válido) y `auth_time` (< 15m) mediante `@RequireMFA()`. |
| **AUTH-010** | Trazabilidad, Auditoría y Privacidad | Registro obligatorio en `AuditLog` de eventos de onboarding, revocación e intentos de acceso denegado. Se erradica el registro de la cabecera `Authorization` en streams de log. Atribución histórica en `AuditLog` mediante columna `"organizationId"`, manteniendo sin atribución forzada los registros históricos no resolubles y bloqueando su fuga hacia vistas de tenants ordinarios. |

---

## 4. ARQUITECTURA OBJETIVO: BACKEND FOR FRONTEND (BFF)

De conformidad con **`DEC-AUTH-002`**, se establece el patrón **Backend for Frontend (BFF)** como la única arquitectura objetivo para la gestión de sesiones en el frontend, confinando todos los tokens de Auth0 al servidor.

```mermaid
flowchart TD
    subgraph Browser ["Navegador Web del Usuario"]
        SPA["Cliente Web (React 19 + Vite)"]
        CookieStorage["Cookies: app_session (Lax) + csrf_token (Strict)"]
    end

    subgraph BFF_Tier ["Capa BFF (Backend for Frontend Gateway)"]
        BFFRouter["BFF Session Router / Auth Endpoints"]
        CorrelationStore["Cookie auth0_correlation (SameSite=Lax, Path=/api/auth, TTL 5m)"]
        SessionStore["Almacén Dual: L1 Redis (TTL 300s + user_epoch) + L2 PostgreSQL (UserSession)"]
        CSRF_Engine["CSRF Protection Engine (HMAC Double Submit + Strict Origin Check)"]
        TokenVault["Token Vault Seguro AES-256-GCM (MEK Externa en Gestor de Secretos)"]
    end

    subgraph Identity_Tier ["Auth0 Cloud (IdP OIDC)"]
        UL["Universal Login / Passwordless Engine"]
        JWKS["JWKS Endpoint (/.well-known/jwks.json, Cache 24h, Rate-Limited)"]
    end

    subgraph Backend_API ["Backend de Negocio NestJS (API Protegida)"]
        Auth0Guard["1. Auth0JwtGuard (RS256 Validation)"]
        SecGuard["2. SecurityContextGuard (auth.resolve_user_identity, Epoch & Tenant)"]
        RoleGuard["3. RolesAndPermissionsGuard (@Roles, @RequireMFA)"]
        ScopedPrisma["4. ScopedPrismaService ($extends)"]
    end

    subgraph Database ["PostgreSQL 16 + pgvector"]
        DB[(schema.prisma con PostgreSQL FORCE RLS sin recursividad)]
    end

    SPA -->|1. Solicita Login| BFFRouter
    BFFRouter -->|2. Inicia Auth Code + PKCE (Set auth0_correlation Lax)| UL
    UL -->|3. Retorna Callback GET al BFF con Cookie de Correlación| BFFRouter
    BFFRouter -->|4. Valida state/nonce/PKCE y Canjea Code por Tokens RS256| UL
    BFFRouter -->|5. Cifra Tokens con AES-256-GCM en Token Vault| TokenVault
    BFFRouter -->|6. Emite app_session HttpOnly + csrf_token| CookieStorage
    SPA -->|7. Petición API con Cookie + Header X-CSRF-Token| BFFRouter
    BFFRouter -->|8. Valida Sesión y Pasa Contexto a API Interna| Auth0Guard
    Auth0Guard -->|9. Valida Firma con Clave Pública en Caché| JWKS
    Auth0Guard --> SecGuard
    SecGuard --> RoleGuard
    RoleGuard --> ScopedPrisma
    ScopedPrisma -->|10. Consulta SQL Scoped con SET LOCAL orgId, userId y userRole| DB
```

### 4.1. Desacoplamiento y Especificación de Políticas de Cookies
1. **Cookie de Transacción / Correlación OIDC (`auth0_correlation`):**
   - **Propósito:** Mantener `state`, `nonce` y `code_verifier` PKCE durante la redirección al IdP.
   - **Atributos:** `SameSite: Lax`, `HttpOnly: true`, `Secure: true`, `Path: /api/auth`, `Max-Age: 300` (5 minutos; se destruye inmediatamente tras el callback).
2. **Cookie de Sesión de Aplicación BFF (`app_session`):**
   - **Propósito:** Transportar el secreto aleatorio opaco de sesión generado criptográficamente (`rawSessionSecret`).
   - **Atributos:** `SameSite: Lax`, `HttpOnly: true`, `Secure: true`, `Path: /`, `Max-Age: 28800` (8 horas de vigencia absoluta).
3. **Cookie de Protección Anti-CSRF (`csrf_token`):**
   - **Propósito:** Token complementario para validar que solicitudes mutantes provengan legítimamente de la SPA.
   - **Atributos:** `SameSite: Strict`, `HttpOnly: false` (legible por el script cliente para inyectar en encabezado `X-CSRF-Token`), `Secure: true`, `Path: /`.

---

### 4.2. Topología y Frontera BFF / API de Negocio (B-10)

Para disipar cualquier ambigüedad sobre enrutamiento y credenciales, se establece la siguiente separación formal:

1. **Frontera Externa (Navegador <-> Gateway BFF):**
   - **Transporte:** Exclusivamente HTTPS sobre TLS 1.3.
   - **Credenciales Permitidas:** Cookie de sesión `app_session` y encabezado `X-CSRF-Token` (en mutaciones).
   - **Endpoints Públicos del BFF:**
     - `GET /api/auth/login` (inicia flujo Authorization Code + PKCE).
     - `GET /api/auth/callback` (consume callback OIDC de Auth0).
     - `POST /api/auth/portal-login` (inicia flujo Passwordless Magic Link de clientes).
     - `GET /api/public/health` (sonda de vitalidad del servicio).
   - **Endpoints Privados:** Todas las rutas `/api/*` de recursos jurídicos (`/api/expedientes`, `/api/documentos`, etc.).
   - **Responsabilidad del BFF:** Extrae `app_session`, calcula su hash SHA-256, valida existencia y frescura en Redis L1 / PostgreSQL L2, y ejecuta el control Anti-CSRF estricto.
2. **Frontera Interna (BFF <-> API de Negocio / Módulos Internos):**
   - El BFF recupera el Access Token RS256 de Auth0 desde el Token Vault descifrado en memoria.
   - La petición interna hacia los servicios de negocio viaja autenticada con `Authorization: Bearer <auth0_access_token>`.
   - En arquitectura monolítica modular NestJS: El interceptor del BFF inyecta el token y el contexto autenticado (`req.user`) directamente en el pipeline de ejecución sin exponer tokens al exterior.
   - **Responsabilidad de la API de Negocio:** `Auth0JwtGuard` valida la firma asimétrica RS256 del token contra JWKS, emisor, audiencia y el umbral de `tokenValidAfter`.

---

### 4.3. Ciclo de Vida Criptográfico de la Sesión BFF

1. **Generación del Secreto de Sesión (`rawSessionSecret`):**
   - Generado mediante generador criptográficamente seguro (CSPRNG): `crypto.randomBytes(32).toString('base64url')` (43 caracteres URL-safe).
   - **Regla Inquebrantable:** El `rawSessionSecret` reside **exclusivamente en el navegador** dentro de la cookie `app_session`. **JAMÁS se persiste en texto plano** en Redis ni en PostgreSQL.
2. **Cálculo del Hash de Búsqueda (`sessionTokenHash`):**
   $$\text{sessionTokenHash} = \text{crypto.createHash('sha256').update(rawSessionSecret).digest('hex')}$$
   (64 caracteres hexadecimales en minúsculas).
3. **Persistencia y Búsqueda:**
   - **PostgreSQL (`UserSession."sessionToken"`):** Almacena el `sessionTokenHash` con índice `@unique`.
   - **Redis (Clave L1):** Clave `session:<sessionTokenHash>` con TTL acotado a 300 segundos (5 minutos) para forzar comprobación periódica de frescura.
4. **Identificador de Fila (`UserSession."id"`):** UUID v4 primario técnico de base de datos para auditoría y relaciones.
5. **Rotación y Anti-Fixation:** En login, logout, elevación de privilegios (MFA Step-Up) o cambio de contexto, la sesión previa se revoca y se emite un nuevo `rawSessionSecret` con nuevo hash.

---

### 4.4. Matriz Estricta de Decisión Anti-CSRF y Validación Exacta de Origen (B-09)

Queda **terminantemente prohibido el uso de comparaciones parciales basadas en `startsWith`** (vulnerables a dominios como `https://frontend.com.attacker.com`). La validación de procedencia exige la reconstrucción y comparación canónica exacta del origen:

```typescript
function parseAndValidateOrigin(req: Request, trustedOrigin: string): boolean {
  const originHeader = req.headers['origin'];
  let candidate = originHeader;

  if (!candidate && req.headers['referer']) {
    try {
      const parsedUrl = new URL(req.headers['referer'] as string);
      // Rechazo estricto si contiene credenciales de usuario (userinfo)
      if (parsedUrl.username || parsedUrl.password) return false;
      candidate = parsedUrl.origin;
    } catch {
      return false; // URL de referer malformada
    }
  }

  if (!candidate || candidate === 'null') return false;

  // Comparación canónica estricta de protocolo, host y puerto exactos
  return candidate === trustedOrigin;
}
```

| Escenario | `Origin` / `Referer` | Cookie `csrf_token` | Header `X-CSRF-Token` | Verificación HMAC | Resultado / Código HTTP | Justificación de Seguridad |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Origen y Token Válidos** | Coincide exactamente con `FRONTEND_URL` | Presente | Idéntico a Cookie | Firma HMAC válida contra `csrfSecret` y sesión | **Procesar (Next)** | Petición legítima autenticada de la SPA. |
| **2. Falta Origin, Referer Válido** | Origin ausente, Referer canónico coincide | Presente | Idéntico a Cookie | Válida | **Procesar (Next)** | Petición permitida en navegadores que omiten Origin. |
| **3. Origen Ausente Total** | Ambos ausentes | Cualquiera | Cualquiera | N/A | **`403 Forbidden`** | Bloqueo por falta de procedencia (`CSRF_ORIGIN_MISSING`). |
| **4. Origen Malicioso o Prefijo** | `https://frontend.com.evil.com` | Cualquiera | Cualquiera | N/A | **`403 Forbidden`** | Bloqueo estricto por dominio no confiable (`CSRF_ORIGIN_MISMATCH`). |
| **5. Origen `null` o Userinfo** | `null` o `https://user:pwd@frontend.com` | Cualquiera | Cualquiera | N/A | **`403 Forbidden`** | Bloqueo por origen opaco o credenciales incrustadas. |
| **6. Token CSRF Ausente** | Válido | Ausente | Ausente | N/A | **`403 Forbidden`** | Bloqueo por falta de token Anti-CSRF (`CSRF_TOKEN_MISSING`). |
| **7. Discrepancia Header vs Cookie** | Válido | Token A | Token B (A $\ne$ B) | N/A | **`403 Forbidden`** | Falla del mecanismo Double Submit (`INVALID_CSRF_TOKEN`). |
| **8. Timestamp Expirado (>8h)** | Válido | Token A | Token A | Timestamp $> 28800\text{ s}$ | **`403 Forbidden`** | Firma CSRF vencida (`CSRF_TOKEN_EXPIRED`). |
| **9. Firma HMAC Inválida** | Válido | Token A | Token A | Firma corrupta o clave ajena | **`403 Forbidden`** | Falsificación de token CSRF (`INVALID_CSRF_SIGNATURE`). |
| **10. Token de Otra Sesión** | Válido | Token A | Token A | Firmado con otro `sessionTokenHash` | **`403 Forbidden`** | Intento de reutilización cruzada de CSRF (`INVALID_CSRF_SIGNATURE`). |
| **11. Sesión Revocada en Backend** | Válido | Token A | Token A | Válida | **`401 Unauthorized`** | Sesión inactiva o expirada en el almacén de sesiones. |

---

### 4.5. Token Vault AES-256-GCM: Taxonomía de Errores y Análisis de Colisión (B-08)

1. **Taxonomía Formal de Errores del Vault y Respuestas Seguras:**
   - **`MASTER_KEY_UNAVAILABLE`:** El keyring carece de la clave maestra requerida -> Retorna **`503 Service Unavailable`** (Fail-Closed). Se emite alerta crítica a operaciones sin registrar material criptográfico en logs.
   - **`UNKNOWN_KEY_VERSION`:** El prefijo de versión (`v3:`) no se encuentra en el keyring -> Retorna **`401 Unauthorized`** (la sesión no puede descifrarse) y se destruye la sesión corrupta.
   - **`CIPHERTEXT_MALFORMED`:** El formato de datos no respeta `v<ver>:<iv>:<tag>:<ciphertext>` -> Retorna **`401 Unauthorized`**, se elimina la sesión y se registra advertencia de integridad.
   - **`AUTH_TAG_MISMATCH` / `INTEGRITY_FAILURE`:** `decipher.final()` falla por tag inválido o alteración de bytes -> Retorna **`401 Unauthorized`**, destruye la cookie y emite alerta de seguridad `VAULT_CIPHERTEXT_TAMPERED`.
   - **Principio de Confidencialidad en Errores:** En ningún caso se revelan trazas de descifrado, textos planos o claves en respuestas HTTP o archivos de registro.
2. **Análisis Probabilístico de Colisión de IV y Límites Operativos (NIST SP 800-38D §8.3):**
   - Para vectores de inicialización aleatorios de 96 bits generados con CSPRNG, la probabilidad de al menos una colisión tras $n$ operaciones se aproxima por:
     $$P_{\text{collision}} \approx \frac{n^2}{2^{97}}$$
   - La norma NIST SP 800-38D fija un límite teórico máximo de $2^{32}$ operaciones de cifrado por clave ($P \approx 1.16 \times 10^{-10}$).
   - **Directiva Operativa de Abogados_law:** Se adopta un umbral conservador de **rotación preventiva obligatoria cada 90 días o tras $2^{24}$ operaciones de cifrado** (16.7 millones de sesiones). Con $n = 2^{24}$, la probabilidad de colisión es:
     $$P_{\text{collision}} \approx \frac{(2^{24})^2}{2^{97}} = 2^{-49} \approx 1.77 \times 10^{-15} \quad (\text{virtualmente nula})$$

---

## 5. AUTENTICACIÓN PASSWORDLESS POR MAGIC LINK (DEC-AUTH-001)

1. **Soberanía y Deslinde:** Auth0 genera, firma, despacha por email y valida el enlace Passwordless. Abogados_law no emite tokens de login locales ni almacena secretos de clientes en texto plano.
2. **Anti-Enumeración Estricta:** Ante cualquier solicitud a `POST /client-portal/magic-link`, la API responde **siempre** con `200 OK` y mensaje idéntico: `"Si su correo corresponde a un cliente registrado, recibirá un enlace seguro para acceder a sus causas."`, independientemente de si el correo existe o no en la base de datos.
3. **Rate Limiting:** Máximo 1 solicitud cada 60 segundos por IP y correo. Excesos responden `429 Too Many Requests`.
4. **Anti-Replay:** El enlace expira en 15 minutos. Al ser consumido, Auth0 emite un `authorization_code` OIDC de un solo uso. Un segundo intento de canje es rechazado con `invalid_grant`.

---

## 6. POLÍTICA DE AUTENTICACIÓN MULTIFACTOR Y STEP-UP (DEC-AUTH-003)

1. **Matriz de Exigencia MFA:**
   - `ADMIN` (Plataforma y Estudio): MFA universal obligatoria en login.
   - `PARTNER`: MFA universal obligatoria en login.
   - `ASSOCIATE` y `PARALEGAL`: MFA obligatoria mediante Step-Up para operaciones sensibles.
   - `CLIENT`: Autenticación Passwordless por factor de posesión (email).
2. **Operaciones Sensibles Sujetas a Step-Up:** Reasignación de causas, levantamiento de Legal Hold (`Documento."legalHold"`), exportación masiva de expedientes, alteración de membresías y configuración de seguridad.
3. **Contrato de Validación `@RequireMFA()`:**
   - Exige que el claim `amr` contenga `'mfa'` y al menos un método válido (`'otp'`, `'sms'`, `'webauthn'`, `'fido2'`).
   - Exige que `(Math.floor(Date.now() / 1000) - token.auth_time) <= 900` (15 minutos).
   - `auth_time` reciente **NUNCA acredita MFA** si `amr` carece del claim de segundo factor. Incumplimiento retorna `403 Forbidden` (`STEP_UP_MFA_REQUIRED`).

---

## 7. PIPELINE DE SEGURIDAD EN NESTJS Y ROLES ADMINISTRATIVOS (B-11)

### 7.1. Distinción Estricta entre Roles Administrativos (B-11)
Queda terminantemente prohibido mezclar la autoridad del Administrador de Plataforma con la del Administrador de Organización:
1. **Administrador de Plataforma (`SUPER_ADMIN` / Platform Operator):**
   - Ámbito: Global SaaS (gestión de tenants, telemetría, facturación de plataforma en `/admin/tenants` y `/admin-api/*`).
   - Autenticación: Credenciales administrativas dedicadas con MFA por hardware/WebAuthn. Opera con contexto `"organizationId" IS NULL`.
2. **Administrador de Estudio / Tenant (`ADMIN` en `UserOrganization."roleInOrg"`):**
   - Ámbito: Exclusivamente su propio estudio jurídico (`Organization`).
   - Permisos: Invitar personal, gestionar miembros del estudio, consultar auditoría de su firma.
   - **Restricción Inviolable:** Un administrador de estudio que intente consultar `/admin/tenants` o APIs de plataforma recibe de inmediato **`403 Forbidden`** (`PLATFORM_ADMIN_REQUIRED`).

### 7.2. Política de Caché JWKS y Comportamiento Fail-Closed
- Clave pública en caché (24h) ante falla de red de Auth0: `200 OK` (continuidad matemática local).
- Clave desconocida ante JWKS disponible: `401 Unauthorized` (token falsificado).
- Clave desconocida ante JWKS caído: **`503 Service Unavailable`** (**Fail-Closed estricto**).

---

## 8. MODELO DE DATOS Y CONVENCIÓN PRISMA/SQL (B-03, B-05)

### 8.1. Convención Canónica de Nombres SQL: CamelCase Entrecomillado (B-03)
Dado que el archivo `backend/prisma/schema.prisma` preexistente define sus atributos en formato `camelCase` sin anotaciones `@map`, el motor Prisma genera columnas PostgreSQL entrecomilladas respetando las mayúsculas (`"organizationId"`, `"userId"`, etc.).

**Norma Canónica Obligatoria:** Todas las consultas SQL, funciones y políticas RLS deben utilizar **nombres camelCase entrecomillados**, eliminando discrepancias sintácticas:
`"organizationId"`, `"userId"`, `"expedienteId"`, `"sessionToken"`, `"tokenValidAfter"`, `"sessionEpoch"`, `"isDefault"`, `"revokedAt"`, `"expiresAt"`, `"idleExpiresAt"`.

### 8.2. Esquema Prisma Objetivo (29 Modelos: 24 Existentes + 5 Nuevos)

Para romper la recursividad en RLS (B-05), se incorpora `"organizationId"` de forma directa en `ExpedienteClientAccess`:

```prisma
enum UserStatus {
  PENDING_ACTIVATION
  ACTIVE
  SUSPENDED
  DEACTIVATED
}

enum UserRole {
  ADMIN
  PARTNER      // Socio
  ASSOCIATE    // Asociado
  PARALEGAL
  CLIENT       // Vista limitada cliente
}

enum MembershipStatus {
  ACTIVE
  SUSPENDED
  REVOKED
}

model User {
  id                 String       @id @default(uuid())
  contactEmail       String       @unique
  fullName           String
  role               UserRole     @default(ASSOCIATE)
  status             UserStatus   @default(PENDING_ACTIVATION)
  permissions        Json?
  
  tokenValidAfter    DateTime     @default(now())
  sessionEpoch       Int          @default(1)
  
  legacyPasswordHash String?      // Retención máxima 90 días, read-only
  organizationId     String?      // Compatibilidad transitoria con schema original
  organization       Organization? @relation(fields: [organizationId], references: [id])
  
  identities         UserIdentity[]
  memberships        UserOrganization[]
  sessions           UserSession[]
  invitations        InvitationToken[]
  assignedCases      Expediente[]
  clientAccesses     ExpedienteClientAccess[]
  auditLogs          AuditLog[]
  aiChatSessions     AIChatSession[]
  drafts             LegalDraft[]
  
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt

  @@index([status])
}

model UserIdentity {
  id           String    @id @default(uuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  issuer       String    // e.g. "https://abogados-auth.us.auth0.com/"
  subject      String    // e.g. "auth0|64f123abc456..."
  provider     String    // "auth0", "google-oauth2"
  authEmail    String?
  createdAt    DateTime  @default(now())
  lastUsedAt   DateTime?

  @@unique([issuer, subject])
  @@index([userId])
}

model UserSession {
  id             String    @id @default(uuid())
  userId         String
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessionToken   String    @unique // Hash SHA-256 de rawSessionSecret
  sessionVersion Int       @default(1)
  auth0Sid       String?
  deviceInfo     String?
  ipAddress      String?
  expiresAt      DateTime  // Vencimiento absoluto (8 horas)
  idleExpiresAt  DateTime  // Vencimiento por inactividad (30 minutos)
  revokedAt      DateTime? // Marca de revocación individual
  createdAt      DateTime  @default(now())
  lastActiveAt   DateTime  @default(now())

  @@index([userId])
  @@index([sessionToken])
}

model UserOrganization {
  id             String           @id @default(uuid())
  userId         String
  user           User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  organizationId String
  organization   Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  roleInOrg      UserRole         @default(ASSOCIATE)
  status         MembershipStatus @default(ACTIVE)
  isDefault      Boolean          @default(false)
  createdAt      DateTime         @default(now())

  @@unique([userId, organizationId])
  @@index([organizationId])
}

model InvitationToken {
  id             String    @id @default(uuid())
  tokenHash      String    @unique // Hash SHA-256 de 32 bytes CSPRNG
  userId         String
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  organizationId String
  expiresAt      DateTime  // 72 horas
  consumedAt     DateTime?
  createdBy      String
  createdAt      DateTime  @default(now())

  @@index([userId])
}

model ExpedienteClientAccess {
  id             String     @id @default(uuid())
  expedienteId   String
  expediente     Expediente @relation(fields: [expedienteId], references: [id], onDelete: Cascade)
  userId         String     // Usuario con rol CLIENT
  user           User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  organizationId String     // Directo Multi-Tenant para erradicar recursividad RLS (B-05)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  grantedAt      DateTime   @default(now())
  grantedBy      String

  @@unique([expedienteId, userId])
  @@index([userId])
  @@index([organizationId])
}
```

### 8.3. Requisito Normativo de Migración para `AuditLog` (B-06)
`AuditLog` en `schema.prisma` incorporará:
1. `organizationId String?` indexado.
2. `organization Organization? @relation(fields: [organizationId], references: [id])`.
3. Script de migración con backfill forense basado en registros de entidades concretas (`entityTable` y `entityId`). **Cero inferencia automática** basada en la organización actual del usuario.

---

## 9. FUNCIONES POSTGRESQL `SECURITY DEFINER` Y PRIVILEGIOS MÍNIMOS (B-04)

### 9.1. Modelo Formal de Roles y Separación de Privilegios
1. **Rol Propietario (`auth_definer_role`):**
   - Rol técnico interno sin inicio de sesión (`CREATE ROLE auth_definer_role WITH NOLOGIN NOINHERIT BYPASSRLS;`).
   - **Privilegios de Acceso a Tablas:** Posee **estrictamente `GRANT SELECT`** sobre `public."UserIdentity"`, `public."User"`, `public."UserOrganization"` y `public."UserSession"`. Cero privilegios de escritura (`INSERT`, `UPDATE`, `DELETE`).
   - El atributo `BYPASSRLS` permite leer filas técnicas antes de que `SET LOCAL app.current_user_id` sea ejecutado, pero **no otorga acceso a tablas no concedidas expresamente**.
2. **Rol de Aplicación (`abogados_app_user`):**
   - **Carece de `BYPASSRLS`**. No es miembro de `auth_definer_role` y no puede escalar privilegios.
   - Solo posee `GRANT USAGE ON SCHEMA auth;` y `GRANT EXECUTE` sobre las funciones específicas.
3. **Protección de Esquemas:** `REVOKE CREATE ON SCHEMA public FROM PUBLIC;`.

### 9.2. Función Restringida de Resolución de Identidad (`auth.resolve_user_identity`)
```sql
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.resolve_user_identity(
  p_issuer text,
  p_subject text
)
RETURNS TABLE (
  user_id text,
  user_status text,
  default_org_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
BEGIN
  IF p_issuer IS NULL OR p_subject IS NULL OR length(p_issuer) = 0 OR length(p_subject) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    u."id"::text,
    u."status"::text,
    uo."organizationId"::text
  FROM public."UserIdentity" ui
  JOIN public."User" u ON ui."userId" = u."id"
  LEFT JOIN public."UserOrganization" uo 
    ON uo."userId" = u."id" 
   AND uo."isDefault" = true 
   AND uo."status" = 'ACTIVE'
  WHERE ui."issuer" = p_issuer 
    AND ui."subject" = p_subject
  LIMIT 1;
END;
$$;

ALTER FUNCTION auth.resolve_user_identity(text, text) OWNER TO auth_definer_role;
REVOKE ALL ON FUNCTION auth.resolve_user_identity(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.resolve_user_identity(text, text) TO abogados_app_user;
```

### 9.3. Función Restringida de Resolución de Sesión BFF (`auth.lookup_session`)
```sql
CREATE OR REPLACE FUNCTION auth.lookup_session(
  p_session_token_hash text
)
RETURNS TABLE (
  session_id text,
  user_id text,
  session_version int,
  auth0_sid text,
  idle_expires_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  user_status text,
  user_epoch int,
  token_valid_after timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
BEGIN
  IF p_session_token_hash IS NULL OR length(p_session_token_hash) <> 64 OR p_session_token_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    s."id"::text,
    s."userId"::text,
    s."sessionVersion",
    s."auth0Sid"::text,
    s."idleExpiresAt",
    s."expiresAt",
    s."revokedAt",
    u."status"::text,
    u."sessionEpoch",
    u."tokenValidAfter"
  FROM public."UserSession" s
  JOIN public."User" u ON s."userId" = u."id"
  WHERE s."sessionToken" = p_session_token_hash
  LIMIT 1;
END;
$$;

ALTER FUNCTION auth.lookup_session(text) OWNER TO auth_definer_role;
REVOKE ALL ON FUNCTION auth.lookup_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.lookup_session(text) TO abogados_app_user;
```

---

## 10. REVOCACIÓN, CONSISTENCIA REDIS/POSTGRESQL Y TOKEN EPOCH (B-01, B-07)

### 10.1. Consistencia Distribuida y Cierre de la Ventana de Revocación (B-01)
1. **Autoridad Absoluta:** PostgreSQL es la única fuente durable y autoritativa. Redis es un caché con TTL acotado (300s).
2. **Protocolo de Logout Global:**
   - PostgreSQL incrementa `"sessionEpoch"` y fija `"tokenValidAfter" = clock_timestamp()` en `User`, marcando `"revokedAt"` en `UserSession`. Commit en disco.
   - El BFF desaloja `session:<tokenHash>` y actualiza `user_epoch:<userId>`.
3. **Cierre de Ventana ante Falla de Redis (C-01):**
   - Para impedir que Redis conserve una sesión y un epoch antiguo coincidentes:
     - El TTL máximo de las entradas de sesión en Redis es de **300 segundos** (5 minutos).
     - El TTL de frescura del epoch en Redis (`user_epoch:<userId>`) es de **30 segundos**.
     - Toda operación sensible (financiera, asignación de causas, borrado irreversible) **exige validación síncrona obligatoria contra PostgreSQL**, garantizando la **ausencia de ventana adicional de aceptación** tras la confirmación de la revocación en disco para las operaciones que consultan esa fuente síncronamente.
     - En operaciones de lectura no críticas sujetas a caché, se documenta expresamente la existencia de una ventana residual máxima de revocación acotada al TTL de frescura del epoch (máximo 30 segundos) en el caso contingente de fallo de invalidación en Redis.
4. **Matriz de Estados y Fail-Closed:**
   - Si PostgreSQL está inaccesible: el BFF **falla inmediatamente con `503 Service Unavailable`**. **Nunca se acepta una sesión basada únicamente en Redis si PostgreSQL no puede confirmar la durabilidad.**

### 10.2. Semántica Unificada de Revocación por Clase de Credencial (B-07)
| Clase de Credencial | Mecanismo de Revocación | Campo Evaluado | Comportamiento en Mismo Segundo |
| :--- | :--- | :--- | :--- |
| **Clase 1: Sesión BFF (`app_session`)** | Stateful en PostgreSQL L2 / Redis L1 | `UserSession."revokedAt" IS NULL` | **Determinismo a microsegundos:** Sesiones previas tienen `revokedAt` no nulo en BD y son rechazadas de inmediato. |
| **Clase 2: Access Token Auth0 (RS256)** | Temporal y sincronización Auth0 | `token.iat >= floor(tokenValidAfter)` | Auth0 Actions sincroniza `app_metadata.tokenEpoch`. Si la sincronización con Auth0 falla, el backend entra en **Fail-Closed para el segundo límite** (`iat == floor(S_rev)` rechaza con 401). |
| **Clase 3: Credenciales M2M/CLI** | Scopes y lista de revocación | `client_id` y revocación de grants | Inmediata mediante revocación de Client Grants en Auth0 o blacklist local. |

---

## 11. AISLAMIENTO MULTI-TENANT Y MATRIZ EXHAUSTIVA POSTGRESQL RLS (B-02, B-05, B-06, B-12)

### 11.1. Modelo de Amenazas y Límites de Confianza de GUC (B-02, C-02)
- **Alcance Real de RLS:** Row-Level Security es una **barrera de defensa en profundidad contra errores de lógica de aplicación, omisiones de cláusulas WHERE en el ORM y ataques de inyección o manipulación de parámetros HTTP (IDOR/BOLA)** a nivel de API.
- **Límites de Confianza y Restricciones:** RLS **no protege contra inyección SQL arbitraria que permita ejecutar sentencias arbitrarias (`SET LOCAL app.current_organization_id = ...`)** bajo el rol `abogados_app_user` durante una transacción activa si el atacante logra alterar el contexto. Asimismo, `DISCARD ALL` limpia el estado de conexión al ser devuelta al pool en PgBouncer evitando la fuga de GUCs entre transacciones distintas, pero no impide por sí mismo la suplantación dentro de una transacción ya comprometida por SQL arbitrario.
- **Medidas Primarias contra Inyección SQL:** La prevención primaria de SQL injection reside en la parametrización forzada obligatoria de todas las consultas en Prisma Client (`$queryRaw` con plantillas etiquetadas tipadas), la prohibición estricta de `$queryRawUnsafe` y la validación de esquemas en DTOs. RLS garantiza que las consultas parametrizadas legítimas del sistema jamás accedan a filas de tenants ajenos.

### 11.2. Políticas RLS No Recursivas para Portal de Clientes (B-05, B-12)

```sql
ALTER TABLE public."Expediente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Expediente" FORCE ROW LEVEL SECURITY;

-- Expediente: Evalúa rol del usuario sin recursión
CREATE POLICY expediente_tenant_isolation_policy ON public."Expediente"
  FOR ALL
  USING (
    "organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
    AND (
      NULLIF(current_setting('app.current_user_role', true), '') IN ('ADMIN', 'PARTNER', 'ASSOCIATE', 'PARALEGAL')
      OR (
        NULLIF(current_setting('app.current_user_role', true), '') = 'CLIENT'
        AND "id" IN (
          SELECT eca."expedienteId" 
          FROM public."ExpedienteClientAccess" eca 
          WHERE eca."userId" = NULLIF(current_setting('app.current_user_id', true), '')
        )
      )
    )
  );

ALTER TABLE public."ExpedienteClientAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ExpedienteClientAccess" FORCE ROW LEVEL SECURITY;

-- ExpedienteClientAccess: Totalmente autónomo sin subconsultar a Expediente (Rompe Recursividad - B-05)
CREATE POLICY expediente_client_access_policy ON public."ExpedienteClientAccess"
  FOR ALL
  USING (
    "organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
    AND (
      -- Abogados del estudio pueden gestionar permisos
      NULLIF(current_setting('app.current_user_role', true), '') IN ('ADMIN', 'PARTNER', 'ASSOCIATE', 'PARALEGAL')
      OR (
        -- Clientes solo ven sus propias asignaciones; cero enumeración de otros clientes (B-12)
        NULLIF(current_setting('app.current_user_role', true), '') = 'CLIENT'
        AND "userId" = NULLIF(current_setting('app.current_user_id', true), '')
      )
    )
  );
```

### 11.3. Políticas Seguras de Auditoría y Atribución Histórica Verificable (B-06)
```sql
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog" FORCE ROW LEVEL SECURITY;

CREATE POLICY auditlog_tenant_policy ON public."AuditLog"
  FOR SELECT
  USING (
    "organizationId" IS NOT NULL 
    AND "organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
  );

ALTER TABLE public."EventLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EventLog" FORCE ROW LEVEL SECURITY;

CREATE POLICY eventlog_tenant_policy ON public."EventLog"
  FOR SELECT
  USING (
    "organizationId" IS NOT NULL 
    AND "organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
  );
```

---

## 12. MIGRACIÓN ASISTIDA Y BACKFILL HISTÓRICO DE AUDITORÍA (B-06)

1. **Erradicación Inmediata:** Se elimina la comparación en texto plano de `auth.service.ts` y el bypass de `LoginPage.tsx`. Cero dual run inseguro.
2. **Backfill Verificable de `AuditLog` (B-06):**
   - Para registros vinculados a una entidad concreta (`entityTable = 'Expediente'`): se consulta el `"organizationId"` de esa entidad en el momento de la migración.
   - Para registros no resolubles: `"organizationId"` permanece en **`NULL`**. No se inventa pertenencia a la organización predeterminada del usuario. Los registros sin organización quedan confinados a la auditoría de plataforma y son invisibles para tenants ordinarios.
3. **Retención de `legacyPasswordHash`:** Máximo 90 días en modo read-only de contingencia forense; luego se elimina la columna mediante migración SQL.

---

## 13. AUDITORÍA, PRIVACIDAD Y SANITIZACIÓN ESTRICTA (B-13)

1. **Exclusión Absoluta de la Cabecera `Authorization`:**
   - **Regla Estricta:** La cabecera `Authorization` **NO se registra en los logs del sistema bajo ninguna circunstancia** (ni siquiera redactada como `Bearer [REDACTED]`).
2. **Lista Exhaustiva de Datos Excluidos de Registros:**
   - **Encabezados Excluidos:** `Authorization`, `Cookie`, `Set-Cookie`, `X-CSRF-Token`, `X-Api-Key`.
   - **Campos de Cuerpo Excluidos:** `password`, `token`, `secret`, `refreshToken`, `rawSessionSecret`, `invitationToken`, `cuit`, `dni`.
   - **Parámetros de Consulta Excluidos:** `code`, `state`, `code_verifier`, `invitationToken`.

---

## 14. CATÁLOGO DE PRUEBAS TÉCNICAS TDS CONSOLIDADO (54 PRUEBAS)

Se definen **54 pruebas técnicas unívocas y binarias** detalladas en `SPEC-AUTH-001-TEST-CATALOG`, incorporando los escenarios específicos requeridos por B-02 y B-15:
- `TST-AUTH-001` a `TST-AUTH-008`: Validación asimétrica RS256, expiración, emisor, algoritmos y rotación JWKS.
- `TST-AUTH-009` a `TST-AUTH-011`: Desacoplamiento de identidad, cambio de email y bloqueo de cuentas inactivas.
- `TST-AUTH-012` a `TST-AUTH-014`: Aislamiento multi-tenant por membresía e inmunidad a inyecciones en payload.
- `TST-AUTH-015`: Portal de clientes, aislamiento de causas asignadas y no enumeración entre clientes (B-12).
- `TST-AUTH-016` a `TST-AUTH-017`: Distinción estricta entre Administrador de Plataforma y Administrador de Estudio (B-11).
- `TST-AUTH-018`: Indisponibilidad de JWKS ante clave desconocida (Fail-Closed 503).
- `TST-AUTH-019`: Revocación global mediante Token Epoch y Session Epoch.
- `TST-AUTH-020`: Erradicación total de login local legacy (404 Not Found).
- `TST-AUTH-021` a `TST-AUTH-022`: Tokens de invitación de personal (expiración 410 y concurrencia 409).
- `TST-AUTH-023`: Desafío Step-Up MFA en operaciones críticas (403 Forbidden).
- `TST-AUTH-024`: Sanitización estricta y eliminación total de la cabecera `Authorization` en streams de log (B-13).
- `TST-AUTH-025`: Auditoría de intentos de acceso cruzado con verificación de campos reales (B-16).
- `TST-AUTH-026` a `TST-AUTH-028`: PostgreSQL RLS a nivel de motor SQL, Scoped Prisma y SQL Raw.
- `TST-AUTH-029`: Revocación granular por dispositivo (`UserSession`).
- `TST-AUTH-030`: Persistencia de hash SHA-256 en invitaciones de staff.
- `TST-AUTH-031` a `TST-AUTH-034`: Sesiones BFF: cookies seguras, rotación anti-session fixation, Anti-CSRF y expiración.
- `TST-AUTH-035`: Auth0 Passwordless Magic Link: respuesta uniforme 200 y rate limiting 429.
- `TST-AUTH-036`: OIDC Callback: validación de `state` y cookie de correlación `auth0_correlation` (B-15).
- `TST-AUTH-037`: Expiración absoluta de 8 horas de sesión BFF.
- `TST-AUTH-038` a `TST-AUTH-039`: Validación de claims `amr` y `auth_time` en Step-Up MFA.
- `TST-AUTH-040` a `TST-AUTH-041`: Token Vault AES-256-GCM, detección de tampering, rotación y límites NIST (B-08).
- `TST-AUTH-042`: Cobertura real de aislamiento RLS en entidades directas e indirectas conciliadas (B-14).
- `TST-AUTH-043`: JWKS resiliencia y modo degradado con clave en caché.
- `TST-AUTH-044`: Resiliencia BFF ante caída de Redis y fallback determinista a PostgreSQL.
- `TST-AUTH-045`: Auth0 Passwordless Anti-Replay ante reutilización de código de autorización.
- `TST-AUTH-046` a `TST-AUTH-047`: Pruebas de integración PostgreSQL para funciones `SECURITY DEFINER` (B-04).
- `TST-AUTH-048`: Consistencia distribuida Redis/PostgreSQL ante falla de invalidación (B-01).
- `TST-AUTH-049` a `TST-AUTH-050`: Aislamiento histórico de auditoría sin inferencias y bloqueo de eventos globales (B-06).
- `TST-AUTH-051`: Fronteras temporales y semántica unificada de revocación por clase de credencial (B-07).
- `TST-AUTH-052`: Motor Anti-CSRF: validación de origen canónico exacto y firma HMAC vinculada a sesión (B-09).
- `TST-AUTH-053`: Verificación de consultas parametrizadas en Prisma y neutralización de inyección de comandos GUC (`SET LOCAL`) como valores literales, verificando que la aplicación previene la alteración del contexto de sesión en la transacción activa (B-02, C-02).
- `TST-AUTH-054` *(Nueva)*: OIDC Callback: validación independiente de `nonce` y `code_verifier` PKCE (B-15).

---

## 15. RIGOR METODOLÓGICO Y ESCALA TDS DE 7 FASES FORMALES

Para garantizar transparencia absoluta y no equiparar trazabilidad documental con mitigación demostrada, se adopta la escala formal de 7 fases:
1. **Fase 1 — Requisito Identificado:** Necesidad funcional o de seguridad relevada empíricamente.
2. **Fase 2 — Requisito Especificado:** Definición normativa con criterio de aceptación en la presente especificación.
3. **Fase 3 — Control Arquitectónico Diseñado:** Mecanismo técnico detallado (guards, funciones SQL, RLS).
4. **Fase 4 — Prueba TDS Definida:** Caso de prueba unívoco catalogado en `SPEC-AUTH-001-TEST-CATALOG`.
5. **Fase 5 — Prueba Automatizada Implementada:** Código de test escrito en Jest y fallando (Red Phase).
6. **Fase 6 — Prueba Ejecutada:** Ejecución técnica en entorno local con salida registrada.
7. **Fase 7 — Evidencia de Aprobación:** Prueba en verde (`passed`) con código 0 y sin fugas.

**Estado Actual:** La totalidad de requisitos y controles se encuentran en **Fase 2, Fase 3 y Fase 4 (100% Especificados, Diseñados y Definidos)**. Las Fases 5, 6 y 7 corresponden estrictamente a la etapa posterior de implementación bajo autorización formal.
