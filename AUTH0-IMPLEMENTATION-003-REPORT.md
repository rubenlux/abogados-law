# INFORME TÉCNICO DE IMPLEMENTACIÓN: ENTREGA AUTH-02
## BFF, OIDC Authorization Code + PKCE y Persistencia de Identidad

**Expediente:** `AUTH0-IMPLEMENTATION-003`  
**Proyecto:** Abogado Virtual — Abogados_law  
**Repositorio:** `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law`  
**Rama:** `master`  
**HEAD de Referencia:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`  
**Fecha de Emisión:** 24 de noviembre de 2026  
**Metodología:** Test-Driven Specification (TDS) — *Test-First*

---

## 1. RESUMEN EJECUTIVO

En cumplimiento estricto de la orden de trabajo `AUTH0-IMPLEMENTATION-003` (AUTH-02):

1. **Persistencia Relacional de Identidad y Sesiones:**
   - Se incorporó en `backend/prisma/schema.prisma` el modelo `UserIdentity` con restricción de unicidad compuesta `@@unique([issuer, subject])`, clave foránea e integridad referencial (`onDelete: Cascade`) hacia `User`.
   - Se incorporó el modelo `UserSession` con control estricto de caducidad absoluta (8 horas) e inactividad (30 minutos), persistiendo **únicamente el hash SHA-256** del secreto de sesión.
   - Se ejecutó `npx prisma generate` actualizando los tipos del cliente Prisma.
2. **Ciclo TDS Test-First (RED to GREEN):**
   - Se creó primero la suite `backend/test/bff/bff-flow.spec.ts` abarcando los escenarios normativos requeridos (`TST-AUTH-009`, `TST-AUTH-031`, `TST-AUTH-032`, `TST-AUTH-033`, `TST-AUTH-034`, `TST-AUTH-036`, `TST-AUTH-037`, `TST-AUTH-046`, `TST-AUTH-052`, `TST-AUTH-054` y Logout).
   - Se ejecutó la suite comprobando y registrando documentalmente la **Fase Roja (RED Phase)** ante la ausencia de los componentes.
   - Se implementaron los componentes productivos mínimos autorizados: `OidcClientService`, `BffSessionService`, `CsrfService`, `BffController`, `CsrfGuard`, `BffSessionGuard` y el refactor de `SecurityContextGuard`.
   - Se ejecutó la suite comprobando la **Fase Verde (GREEN Phase)**: **9 pasadas de 9 (100%)** en `bff-flow.spec.ts`.
3. **Control de Regresiones Global:**
   - La suite completa del backend pasó con éxito: **6 suites de prueba, 33 tests pasados, 0 fallidos (100%)**.
   - Transpilación TypeScript (`nest build`): **Código de salida 0 (limpio)**.
   - Análisis estático (`eslint` y `prettier`): **0 errores, 0 advertencias**.
4. **Cumplimiento de Restricciones:**
   - Cero llamadas salientes de red a Auth0 durante los tests (mocks controlados en memoria).
   - Cero tokens o credenciales expuestos al navegador (almacenamiento en `localStorage`/`sessionStorage` nulo).
   - Cero `git commit` o `git push` realizados.

---

## 2. INVENTARIO DE ARCHIVOS CREADOS Y MODIFICADOS

```text
Esquema y Tipado Prisma:
- backend/prisma/schema.prisma                  (Modificado - adición de UserIdentity y UserSession)

Componentes de Backend (BFF y Seguridad):
- backend/src/auth/bff/oidc-client.service.ts   (Creado - PKCE S256, state, nonce, almacén transaccional)
- backend/src/auth/bff/bff-session.service.ts   (Creado - sesiones CSPRNG, hash SHA-256, expiraciones duales)
- backend/src/auth/bff/csrf.service.ts          (Creado - HMAC-SHA256 timingSafeEqual, allowlist canónica Origin)
- backend/src/auth/bff/bff.controller.ts        (Creado - /api/auth/login, /callback, /logout, /session)
- backend/src/auth/guards/csrf.guard.ts         (Creado - validación en mutaciones POST/PUT/PATCH/DELETE)
- backend/src/auth/guards/bff-session.guard.ts  (Creado - extracción y validación de cookie app_session)
- backend/src/auth/guards/security-context.guard.ts (Modificado - resolución relacional UserIdentity)
- backend/src/auth/auth.module.ts               (Modificado - cableado y exportación de componentes BFF)

Arnés de Pruebas TDS:
- backend/test/bff/bff-flow.spec.ts             (Creado - 9 casos de prueba exhaustivos)
- backend/test/mocks/prisma.mock.ts             (Modificado - mocks tipados para userIdentity y userSession)
- backend/test/fixtures/user.fixture.ts         (Modificado - fixtures tipados UserIdentity y UserSession)

Informe de Cierre:
- AUTH0-IMPLEMENTATION-003-REPORT.md            (Creado)
```

---

## 3. ESTADO DEL ESQUEMA Y BASE DE DATOS

En `backend/prisma/schema.prisma` se declararon los modelos conforme a `SPEC-AUTH-001 v1.0.8`:

```prisma
model UserIdentity {
  id           String    @id @default(uuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  issuer       String    // e.g. "https://abogados-auth.us.auth0.com/"
  subject      String    // e.g. "auth0|64f123abc456..."
  provider     String    @default("auth0")
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
```

- **Unicidad e Integridad:** Restricción `@@unique([issuer, subject])` previene colisiones entre IdPs; `onDelete: Cascade` asegura que la eliminación de un `User` elimine automáticamente sus identidades y sesiones asociadas.
- **Cliente Prisma:** `npx prisma generate` compiló satisfactoriamente `PrismaClient v5.22.0`.
- **Protección de Base de Datos:** Los tests operan sobre mocks fuertemente tipados e interfaces en memoria aisladas por `db-guard.ts`. La migración a base de datos PostgreSQL física (`prisma db push` / `prisma migrate deploy`) se ejecutará sobre el entorno configurado según el ciclo de despliegue.

---

## 4. EVIDENCIA DE EJECUCIÓN TDS (TEST-FIRST)

### 4.1. Fase Roja (RED Phase) — Comprobación de Falla Inicial

Ejecución previa a la creación de los componentes de producción:

```bash
> jest test/bff/bff-flow.spec.ts

FAIL test/bff/bff-flow.spec.ts
  ● Test suite failed to run

    test/bff/bff-flow.spec.ts:47:31 - error TS2307: Cannot find module '../../src/auth/bff/bff.controller' or its corresponding type declarations.
    test/bff/bff-flow.spec.ts:48:35 - error TS2307: Cannot find module '../../src/auth/bff/oidc-client.service' or its corresponding type declarations.
    test/bff/bff-flow.spec.ts:49:35 - error TS2307: Cannot find module '../../src/auth/bff/bff-session.service' or its corresponding type declarations.
    test/bff/bff-flow.spec.ts:50:29 - error TS2307: Cannot find module '../../src/auth/bff/csrf.service' or its corresponding type declarations.
    test/bff/bff-flow.spec.ts:51:33 - error TS2307: Cannot find module '../../src/auth/guards/bff-session.guard' or its corresponding type declarations.
    test/bff/bff-flow.spec.ts:52:27 - error TS2307: Cannot find module '../../src/auth/guards/csrf.guard' or its corresponding type declarations.

Test Suites: 1 failed, 1 total
Tests:       0 total
```

### 4.2. Fase Verde (GREEN Phase) — Aprobación de la Suite AUTH-02

Ejecución tras completar la implementación de los servicios, controladores y guards:

```bash
> jest test/bff/bff-flow.spec.ts

PASS test/bff/bff-flow.spec.ts (7.598 s)
  AUTH-02 — BFF, OIDC PKCE & Session Management TDS Suite
    √ TST-AUTH-036 [Login]: should initiate OIDC PKCE login, emit opaque correlation cookie and redirect to Auth0 (44 ms)
    √ TST-AUTH-036 [Callback Failure]: should reject callback with 400 Bad Request when state is invalid or correlation cookie missing (12 ms)
    √ TST-AUTH-054: should reject callback with 401 Unauthorized when ID token nonce does not match transaction (8 ms)
    √ TST-AUTH-009 / TST-AUTH-046: should reject callback with 401 Unauthorized if external identity (issuer, sub) is not enrolled (7 ms)
    √ TST-AUTH-031 & TST-AUTH-032: should exchange code, create UserSession, destroy correlation and emit app_session cookie (200/302 OK) (8 ms)
    √ TST-AUTH-033 & TST-AUTH-052: should enforce CSRF protection on mutations with exact Origin allowlist and HMAC validation (29 ms)
    √ TST-AUTH-034: should reject request with 401 Unauthorized when session exceeded inactivity threshold (idleExpiresAt) (4 ms)
    √ TST-AUTH-037: should reject request with 401 Unauthorized when session exceeded absolute lifetime of 8 hours (4 ms)
    √ Logout: should revoke session in database and clear cookies on POST /api/auth/logout (4 ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
Snapshots:   0 total
Time:        7.967 s
```

### 4.3. Suite Completa del Backend (Verificación de Cero Regresiones)

```bash
> jest

PASS src/smoke.spec.ts (8.84 s)
PASS test/harness/env-isolation.spec.ts (8.985 s)
PASS test/harness/nestjs-di.spec.ts (10.261 s)
PASS test/harness/prisma-mock.spec.ts (13.827 s)
PASS test/bff/bff-flow.spec.ts (7.112 s)
PASS test/auth/auth0-jwt.spec.ts (16.423 s)

Test Suites: 6 passed, 6 total
Tests:       33 passed, 33 total
Snapshots:   0 total
Time:        17.376 s
Ran all test suites.
```

### 4.4. Compilación NestJS y Linters

```text
> nest build
(Exit code 0 — Transpilación TypeScript sin errores)

> npx eslint "src/auth/**/*.ts" "test/bff/**/*.ts"
(Exit code 0 — 0 errores, 0 advertencias)

> npx prettier --write ...
(Exit code 0 — Formato 100% consistente)
```

---

## 5. TABLA DE TRAZABILIDAD TDS DE PRUEBAS DE AUTH-02

| Identificador TDS | Requisito Normativo | Amenaza Mitigada | Componente Responsable | Comportamiento y Verificación Binaria | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`TST-AUTH-036` (A)** | `AUTH-007` | `AMN-01` | `OidcClientService`, `BffController` | `GET /api/auth/login` redirige a Auth0 con `code_challenge` S256, `state` y cookie opaca `auth0_correlation` (HttpOnly, Path=/). | **PASSED** |
| **`TST-AUTH-036` (B)** | `AUTH-007` | `AMN-01` | `OidcClientService`, `BffController` | `GET /api/auth/callback` con `state` alterado o cookie faltante retorna `400 Bad Request` (`Invalid state or missing correlation cookie`). | **PASSED** |
| **`TST-AUTH-054`** | `AUTH-007` | `AMN-01` | `OidcClientService`, `BffController` | ID Token con `nonce` no coincidente con la transacción local es rechazado con `401 Unauthorized` (`Nonce mismatch in ID token`). | **PASSED** |
| **`TST-AUTH-009`** / **`046`** | `AUTH-003` | `AMN-06` | `BffController`, `SecurityContextGuard` | Callback rechaza identidades no enroladas con `401 Unauthorized` (`Identity not registered in system`). Consulta relacional estricta por `(issuer, subject)`. | **PASSED** |
| **`TST-AUTH-031`** | `AUTH-007` | `AMN-01` | `BffSessionService`, `BffController` | Canje exitoso crea `UserSession` (persiste solo hash SHA-256) y emite cookie `app_session` con `HttpOnly; SameSite=Lax; Path=/`. Storage de navegador limpio (0 tokens). | **PASSED** |
| **`TST-AUTH-032`** | `AUTH-007` | `AMN-01` | `BffSessionService`, `BffController` | Regeneración de sesión anti-Session Fixation: nuevo ID CSPRNG emitido; cookie de correlación destruida (`Max-Age=0`). | **PASSED** |
| **`TST-AUTH-033`** | `AUTH-007` | `AMN-01` | `CsrfGuard`, `CsrfService` | Mutaciones sin `X-CSRF-Token` o con `Origin` no coincidente son rechazadas con `403 Forbidden`. | **PASSED** |
| **`TST-AUTH-052`** | `AUTH-007` | `AMN-09` | `CsrfService`, `CsrfGuard` | Validación de origen canónico exacto (sin `startsWith` ni sufijos maliciosos) y validación de firma HMAC en tiempo constante (`timingSafeEqual`). | **PASSED** |
| **`TST-AUTH-034`** | `AUTH-007` | `AMN-12` | `BffSessionService`, `BffSessionGuard` | Petición con cookie cuya sesión superó los 30 minutos de inactividad (`idleExpiresAt`) retorna `401 Unauthorized` (`Session expired due to inactivity`). | **PASSED** |
| **`TST-AUTH-037`** | `AUTH-007` | `AMN-12` | `BffSessionService`, `BffSessionGuard` | Petición con cookie cuya sesión superó las 8 horas absolutas (`expiresAt`) retorna `401 Unauthorized` (`Session expired by absolute timeout`). | **PASSED** |
| **`Logout`** | `AUTH-007` | `AMN-12` | `BffSessionService`, `BffController` | `POST /api/auth/logout` marca `revokedAt = now()` en BD y destruye cookies `app_session` y `csrf_token` (`Max-Age=0`). | **PASSED** |

---

## 6. DECISIONES TÉCNICAS Y REGLAS DE SEGURIDAD APLICADAS

1. **Resolución Soberana sin Inferencia de Identidad:**  
   Se eliminó cualquier heurística de recorte de prefijo `auth0|` y cualquier vinculación automática por correo electrónico. La identidad externa es únicamente el par unívoco `(issuer, subject)` resuelto contra `UserIdentity`.
2. **Protección Criptográfica contra leniency de decodificadores Hex:**  
   Se detectó y blindó que la decodificación nativa `Buffer.from(str, 'hex')` ignora caracteres no hexadecimales appended. Se introdujo validación estricta por expresión regular `/^[0-9a-f]{64}$/i` previo a la validación de tiempo constante `crypto.timingSafeEqual`, neutralizando cualquier intento de bypass por alteración de firma CSRF.
3. **Cookie de Correlación OIDC Opaca:**  
   El `code_verifier` PKCE se almacena exclusivamente en memoria del servidor asociado a un `transactionId` opaco (32 bytes CSPRNG). El navegador nunca recibe ni expone el `code_verifier`.
4. **Almacenamiento Zero-Token en Frontend:**  
   Ni access tokens ni refresh tokens se transmiten al cliente web ni se almacenan en `localStorage` o `sessionStorage`. El cliente web interactúa exclusivamente a través de la cookie opaca `app_session` y el token `X-CSRF-Token`.

---

## 7. RIESGOS RESIDUALES Y ALCANCE PENDIENTE

1. **Capa L1 de Redis para Sesiones (Diferido):**  
   `BffSessionService` opera actualmente contra PostgreSQL L2 (`UserSession`). El almacenamiento dual L1 Redis (TTL 300s, epoch freshness) será conectado en la fase correspondiente a optimización de alta concurrencia.
2. **Token Vault AES-256-GCM (Diferido):**  
   Conforme a la regla expresa del alcance, no se persiste el access token de Auth0 en la sesión de base de datos. Si en el futuro una llamada M2M delegada o sincronización requiriese almacenar el access token en el servidor, se implementará el cifrado autenticado AES-256-GCM con rotación de claves.
3. **Membresías Multi-Tenant (`UserOrganization`) y RLS:**  
   El modelo relacional `UserOrganization` y las políticas RLS en PostgreSQL corresponden al alcance de las siguientes entregas autorizadas (`AUTH-03` y `AUTH-04`).

---

## 8. ESTADO DE GIT

- **Rama:** `master`
- **HEAD:** `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`
- **Commits realizados:** 0 (en estricto cumplimiento de la restricción de no realizar commits ni pushes).
- **Archivos listos para revisión y commit:** Todos los componentes se encuentran limpios, formateados con Prettier, validados con ESLint y con el arnés de pruebas al 100% de aprobación.

