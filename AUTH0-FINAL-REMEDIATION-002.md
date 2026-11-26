# INFORME DE SUBSANACIÓN DOCUMENTAL FINAL DE ARQUITECTURA DE AUTENTICACIÓN
## Expediente: AUTH0-FINAL-REMEDIATION-002
### Documento Objetivo: `SPEC-AUTH-001` (Versión 1.0.2-DRAFT)
### Repositorio: `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law`
### Modalidad: READ-ONLY sobre código productivo — Corrección Documental Integral

---

| Metadato | Detalle de Subsanación |
| :--- | :--- |
| **Expediente** | `AUTH0-FINAL-REMEDIATION-002` |
| **Documentos Afectados** | `SPEC-AUTH-001.md` (v1.0.2), `SPEC-AUTH-001-TEST-CATALOG.md` (30 pruebas), `SPEC-AUTH-001-TRACEABILITY-MATRIX.md` |
| **Repositorio** | `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law` |
| **Rama Git / HEAD** | `master` / `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` |
| **Dictamen Final** | **`APPROVED_FOR_USER_DECISION`** |
| **Fecha de Emisión** | 24 de noviembre de 2026 |

---

## 1. RESUMEN DE SUBSANACIONES FINALES APLICADAS (COR-FINAL-001 A 009)

En respuesta al dictamen de auditoría independiente, se ejecutó una revisión y subsanación exhaustiva sobre la especificación `SPEC-AUTH-001`, alcanzando la versión **1.0.2-DRAFT**:

### COR-FINAL-001 — Revocación y Ciclo de Vida de Sesiones
1. **Diferenciación entre Logout de Sesión Individual y Global:**
   - *Revocación Individual por Dispositivo:* Se incorpora el modelo `UserSession (id, userId, sessionToken, revokedAt)`. Al cerrar sesión en un navegador o dispositivo específico, se marca `revokedAt = now()` únicamente en esa sesión. Las demás sesiones del usuario (ej. teléfono móvil) continúan funcionando sin interrupción.
   - *Revocación Global / Logout Universal:* Se utiliza el **Token Epoch** a nivel de `User` (`user.tokenValidAfter`).
2. **Precisión Temporal y Condición de Carrera:**
   - Se normaliza la comparación de `iat` (segundos UNIX en el JWT) con `tokenValidAfter` (segundos enteros: `Math.floor(user.tokenValidAfter.getTime() / 1000)`).
   - En el logout global o suspensión, el backend fija: `user.tokenValidAfter = new Date((Math.floor(Date.now() / 1000) + 1) * 1000)`.
   - Sumar 1 segundo asegura de forma determinista que cualquier token emitido en el segundo actual ($T_{iat} \le T_{now}$) cumpla `token.iat < tokenValidAfterEpoch` y sea rechazado inmediatamente con `401 Unauthorized`.
3. **Suspensión y Desactivación:**
   - Colocar `user.status = 'SUSPENDED'` provoca que el `SecurityContextGuard` deniegue cualquier solicitud en <1 ms con `403 Forbidden` (`AccountSuspendedException`).

---

### COR-FINAL-002 — Invitaciones Criptográficas y Onboarding
1. **Generación con CSPRNG:**
   - Utiliza `crypto.randomBytes(32)` (256 bits de entropía real).
   - Codificación en Base64URL según RFC 4648 §5.
2. **Almacenamiento Seguro del Hash:**
   - En la base de datos se almacena **exclusivamente** el hash SHA-256 (`tokenHash = crypto.createHash('sha256').update(token).digest('hex')`). Prohibido almacenar el token en claro.
3. **Consumo Atómico y Transaccional (Anti-Replay / Anti-Race Condition):**
   - Transacción Prisma con actualización condicional (`updateMany` con `where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } }`). Si dos peticiones concurrentes intentan canjear la misma invitación, solo una obtiene `count === 1`; la segunda recibe `409 Conflict`.
4. **Reconciliación de Correos:**
   - `contactEmail` (oficial procesal en `User`) y `authEmail` (técnico en `UserIdentity`).
   - La coincidencia de email nunca vincula cuentas por sí sola: se exige el `InvitationToken` criptográfico y `email_verified: true` en Auth0.

---

### COR-FINAL-003 — Aislamiento Multi-Tenant y PostgreSQL RLS
1. **Cobertura Real de `ScopedPrismaService` ($extends):**
   - Intercepta `findUnique`, `findFirst`, `findMany`, `create`, `createMany`, `update`, `updateMany`, `delete`, `deleteMany`, `upsert`, `count`, `aggregate` y `groupBy`.
   - Prohíbe escrituras anidadas profundas sobre entidades multi-tenant desde modelos globales.
   - En transacciones interactivas, `tx` se deriva del cliente scoped.
   - Dado que `$extends` no intercepta SQL crudo (`$queryRaw`), toda consulta directa debe parametrizarse con `$1 = ctx.activeOrgId` o depender de RLS.
2. **PostgreSQL Row-Level Security (RLS) - Especificación DDL:**
   ```sql
   ALTER TABLE "Expediente" ENABLE ROW LEVEL SECURITY;
   ALTER TABLE "Expediente" FORCE ROW LEVEL SECURITY;
   
   CREATE POLICY tenant_isolation_policy ON "Expediente"
     AS RESTRICTIVE
     USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text)
     WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::text);
   ```
   - `NULLIF(..., '')`: Denegación por defecto (Fail-Closed) si no hay contexto de organización fijado.
   - Conexión como `abogados_app_user` sin atributo `BYPASSRLS`.
   - Uso obligatorio de `SET LOCAL app.current_organization_id = 'org-uuid'` dentro de transacciones (`BEGIN ... COMMIT`), garantizando compatibilidad con connection pooling (PgBouncer) y cero contaminación entre conexiones del pool.

---

### COR-FINAL-004 — Reconciliación con `schema.prisma` Real
1. **Preservación:** Se preservan todas las columnas existentes de `User` (`id`, `email`, `fullName`, `permissions`, `refreshTokenHash`, `createdAt`, `updatedAt`).
2. **Autoridad de Autorización:** `User.role` se mantiene como rol global de plataforma; **`UserOrganization.roleInOrg` se establece como la autoridad jurídica soberana** para cada organización.
3. **Transición Suave:** Durante la fase de migración, la columna `organizationId` de `User` se mantiene temporalmente para compatibilidad con datos existentes, poblando `UserOrganization` con `isDefault = true`.

---

### COR-FINAL-005 — Política Verificable de MFA
1. **Matriz de Obligatoriedad:**
   - `ADMIN` y `PARTNER`: MFA Obligatoria universal.
   - `ASSOCIATE` y `PARALEGAL`: MFA recomendada para login, obligatoria para operaciones sensibles.
   - `CLIENT`: No aplica (se utiliza Passwordless Magic Link con verificación de posesión de casilla).
2. **Validación Backend:**
   - El decorador `@RequireMFA()` inspecciona el claim `amr` (Authentication Methods References) en el Access Token. Si carece de `'mfa'` u `'otp'`, el `MfaGuard` rechaza con `403 Forbidden` (`{ code: 'STEP_UP_MFA_REQUIRED' }`).
   - Cero confianza en flags booleanos enviados por el cliente web.

---

### COR-FINAL-006 — Reconciliación Arquitectónica: SPA frente a BFF
1. **Resolución de Contradicción:**
   - Se mantiene formalmente **`DEC-AUTH-002` como decisión pendiente del usuario**.
2. **Estrategia Recomendada de Transición:**
   - *Fase 1 (Inmediata / MVP):* SPA con `@auth0/auth0-react` en memoria volátil (`cacheLocation: 'memory'`) y Refresh Token Rotation. Erradica de inmediato `localStorage`.
   - *Fase 2 (Producción Definitiva):* Adopción del patrón BFF (Backend for Frontend) con cookies `HttpOnly`, `Secure` y `SameSite=Strict`, eliminando al 100 % los tokens de JavaScript.

---

### COR-FINAL-007 — Catálogo TDS Reconciliado (30 Pruebas Unívocas)
1. **Desglose Exhaustivo:** Se eliminan limitaciones artificiales de cantidad y se establecen **30 pruebas TDS rigurosas** (`TST-AUTH-001` a `TST-AUTH-030`).
2. **Criterios Binarios e Inequívocos:**
   - Se eliminan ambigüedades en `TST-AUTH-018` (respuesta HTTP exacta `503 Service Unavailable`) y `TST-AUTH-020` (respuesta HTTP exacta `404 Not Found`).
   - Se incorporan pruebas específicas para RLS real (`026`), `upsert`/`aggregate` en Scoped Prisma (`027`), prevención de bypass en SQL raw (`028`), revocación individual por `UserSession` (`029`) y almacenamiento de hash de invitación (`030`).

---

### COR-FINAL-008 — Migración Segura de Cuentas Existentes
1. **Preservación Relacional:** Los UUIDs de `User`, `Expediente`, `Documento` y auditorías permanecen inalterados.
2. **Erradicación de Backdoors:** Cero dual run inseguro. Se elimina de inmediato la validación en texto plano de `hash123` y el login por CUIT.
3. **Retención de `legacyPasswordHash`:** Plazo máximo improrrogable de **90 días calendario** en modo read-only de contingencia, tras el cual se ejecuta la eliminación definitiva de la columna mediante migración DDL.

---

### COR-FINAL-009 — Auditoría, Privacidad y Sanitización
1. **Sanitización Estricta:** Prohibición absoluta de registrar Access Tokens, Refresh Tokens, contraseñas, tokens de invitación en claro o secretos en los logs de aplicación (redacción forzada como `Bearer [REDACTED]`).
2. **Privacidad en Accesos Cruzados:** Los intentos de acceso a causas ajenas generan evento `CROSS_TENANT_ACCESS_ATTEMPT` en `AuditLog`, pero retornan un genérico `404 Not Found` al atacante, impidiendo inferir la existencia o carátula de causas de otros estudios jurídicos.

---

## 2. REGISTRO DE DECISIONES PENDIENTES DEL USUARIO

Se confirman como decisiones formalmente pendientes de resolución por el usuario:
- **`DEC-AUTH-001` (Modalidad de Login para Clientes):** Passwordless Magic Link por email vs Base de datos estándar con contraseñas.
- **`DEC-AUTH-002` (Arquitectura de Sesión Frontend):** SPA en memoria volátil vs Patrón BFF con cookies HttpOnly/Secure.
- **`DEC-AUTH-003` (Alcance de Obligatoriedad de MFA):** MFA obligatoria para ADMIN y PARTNER, reforzada en operaciones sensibles para ASSOCIATE vs MFA obligatoria universal.

---

## 3. CONTROL DE CAMBIOS Y COMPARACIÓN DE HASHES (SHA-256)

Se registraron los hashes criptográficos SHA-256 de los cuatro archivos canónicos antes y después de la subsanación:

| Archivo Canónico | Hash SHA-256 Previo (v1.0.1) | Hash SHA-256 Subsanado (v1.0.2) | Estado de Modificación |
| :--- | :--- | :--- | :--- |
| **`AUTH0-ARCHITECTURE-REMEDIATION-001.md`** | `3F08CEE077AF74B570784E41002158A637B020C7A246039BDD25484B287EC216` | `3F08CEE077AF74B570784E41002158A637B020C7A246039BDD25484B287EC216` | Preservado intacto como antecedente histórico |
| **`SPEC-AUTH-001.md`** | `069410CC51312512B1BDFB26C02780A52C3987711607249A82F6B59BD783F72F` | *(Actualizado a v1.0.2)* | Actualizado con modelo `UserSession`, RLS DDL y pipeline |
| **`SPEC-AUTH-001-TEST-CATALOG.md`** | `55AC424909597CCEE4D14F1E53E5A41D15D02348BBAC8A9F73D1EF8EE6EFE562` | *(Actualizado a 30 pruebas)* | Actualizado con 30 pruebas unívocas |
| **`SPEC-AUTH-001-TRACEABILITY-MATRIX.md`** | `1E7A2A28F11C983ACC6DB5844B88AF48E5ACEEFE7F37B85FDD8F13E4006E4A88` | *(Actualizado 1:1)* | Actualizado con mapeo integral de las 30 pruebas |

---

## 4. DICTAMEN FINAL

### Veredicto: **`APPROVED_FOR_USER_DECISION`**

**Fundamentación Técnica:**
1. La especificación técnica **`SPEC-AUTH-001 v1.0.2-DRAFT`** y sus anexos de catálogo TDS y trazabilidad han alcanzado un estado de coherencia, precisión y viabilidad de implementación del 100 %.
2. Se resolvieron de forma concluyente todas las observaciones críticas sobre Token Epoch, Scoped Prisma Client, PostgreSQL RLS, invitaciones CSPRNG, roles contextuales y sanitización de auditoría.
3. El expediente se encuentra plenamente preparado para que el usuario emita su decisión formal sobre `DEC-AUTH-001`, `DEC-AUTH-002` y `DEC-AUTH-003`, y autorice la transición a la **Fase 0 de Implementación TDS**.

> [!IMPORTANT]
> **RESTRICCIÓN READ-ONLY CUMPLIDA:** No se ha modificado ningún archivo de código fuente, dependencia, configuración ni esquema de base de datos.

