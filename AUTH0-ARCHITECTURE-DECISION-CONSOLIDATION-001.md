# INFORME TÉCNICO DE CONSOLIDACIÓN DE DECISIONES ARQUITECTÓNICAS DE AUTENTICACIÓN
## Expediente: AUTH0-ARCHITECTURE-DECISION-CONSOLIDATION-001
### Especificación Consolidada: `SPEC-AUTH-001` (Versión 1.0.3-DRAFT)
### Repositorio: `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law`
### Modalidad: READ-ONLY sobre código productivo — Modificación Documental Autorizada Exclusivamente

---

| Metadato | Detalle Normativo |
| :--- | :--- |
| **Expediente** | `AUTH0-ARCHITECTURE-DECISION-CONSOLIDATION-001` |
| **Especificación de Partida** | `SPEC-AUTH-001 v1.0.2-DRAFT` |
| **Especificación Consolidada** | `SPEC-AUTH-001 v1.0.3-DRAFT` |
| **Repositorio** | `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law` |
| **Rama de Referencia** | `master` |
| **HEAD Commit** | `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` |
| **Dictamen Final** | **`APPROVED_FOR_FORMAL_SPEC_APPROVAL`** |
| **Fecha de Emisión** | 24 de noviembre de 2026 |

---

## 1. RESUMEN EJECUTIVO

En cumplimiento estricto de la Orden de Trabajo `AUTH0-ARCHITECTURE-DECISION-CONSOLIDATION-001`, se consolidaron formalmente las **tres decisiones arquitectónicas aprobadas por el usuario** (`DEC-AUTH-001`, `DEC-AUTH-002`, `DEC-AUTH-003`) y se completaron todas las precisiones técnicas obligatorias (`COR-DEC-001` a `COR-DEC-007`) en el cuerpo documental de **`SPEC-AUTH-001`**, alcanzando la versión **1.0.3-DRAFT**.

### Principio Fundamental: Soberanía Jurídica Preservada
- **Auth0** opera exclusivamente como Proveedor Externo de Identidad (IdP), asumiendo la verificación de credenciales, Passwordless Magic Link, Universal Login, MFA y emisión de tokens asimétricos RS256.
- **Abogados_law** conserva el monopolio exclusivo de la **autorización funcional, jurídica y multi-tenant**, resolviendo roles contextuales en cada organización (`UserOrganization.roleInOrg`), permisos y acceso a causas (`ExpedienteClientAccess`).

---

## 2. DECISIONES DEL USUARIO INCORPORADAS COMO APROBADAS

Las tres directivas emanadas de la autoridad arquitectónica del usuario fueron integradas textualmente en la especificación:

### DEC-AUTH-001 — Autenticación del Portal de Clientes: Auth0 Passwordless Magic Link
- **Estado:** **APROBADA E INCORPORADA.**
- **Mecanismo:** Acceso mediante enlace de un solo uso con vigencia de 15 minutos, despacho vía email verificado (`email_verified: true`) y consumo atómico condicional.
- **Seguridad:** Protección anti-enumeración de usuarios (respuesta HTTP uniforme 200), rate limiting estricto y anti-replay.
- **Aislamiento Jurídico:** La identidad técnica se vincula mediante `UserIdentity(issuer, subject)`. El cliente tiene rol inmutable `UserRole.CLIENT` y solo accede a expedientes expresamente concedidos en `ExpedienteClientAccess`.

### DEC-AUTH-002 — Arquitectura de Sesión Frontend: Backend for Frontend (BFF)
- **Estado:** **APROBADA E INCORPORADA.**
- **Mecanismo:** La capa BFF intermedia todas las peticiones entre el navegador y las APIs de backend. Los tokens de Auth0 residen exclusivamente del lado servidor cifrados en reposo (AES-256-GCM).
- **Seguridad del Navegador:** Cero tokens en `localStorage` o `sessionStorage`. La sesión se mantiene mediante cookie opaca con atributos `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, con expiración por inactividad a los 30 minutos y duración absoluta de 8 horas.
- **Protección Web:** Mitigación total de XSS contra exfiltración de credenciales bearer, protección Anti-CSRF mediante token sincronizado en métodos mutantes y regeneración de sesión anti-Session Fixation.
- **Resolución Normativa:** Se eliminó cualquier referencia a una "SPA transitoria" como requisito de implementación. El patrón BFF es la única arquitectura objetivo aprobada.

### DEC-AUTH-003 — Política de MFA por Roles y Operaciones Sensibles
- **Estado:** **APROBADA E INCORPORADA.**
- **Matriz de Aplicación:**
  - `ADMIN`: MFA Obligatoria universal en cada login.
  - `PARTNER`: MFA Obligatoria universal en cada login.
  - `ASSOCIATE` y `PARALEGAL`: MFA obligatoria para operaciones sensibles (opcional en login general).
  - `CLIENT`: Sin MFA obligatoria general (protegido por Magic Link de un solo uso).
- **Catálogo de Operaciones Sensibles (Step-Up):** Reasignación de socios, eliminación masiva de causas, modificación de Legal Hold forense (`Documento.legalHold`), exportación de expedientes y cambio de membresías en `UserOrganization`.
- **Verificación Backend:** El decorador `@RequireMFA()` inspecciona los claims `amr: ['mfa']` y `auth_time` (<15m) en el token. Si faltan, el `MfaGuard` rechaza con `403 Forbidden` (`{ code: 'STEP_UP_MFA_REQUIRED' }`). MFA jamás sustituye el aislamiento multi-tenant ni RBAC.

---

## 3. EVALUACIÓN Y RESOLUCIÓN DE PRECISIONES TÉCNICAS (COR-DEC-001 A 007)

| Código | Precisión Técnica Requerida | Resolución Documental en SPEC-AUTH-001 v1.0.3 |
| :--- | :--- | :--- |
| **COR-DEC-001** | Sesiones BFF y Revocación | Se incorpora el modelo `UserSession (id, userId, sessionToken, auth0Sid, revokedAt, idleExpiresAt, expiresAt)`. El logout individual invalida la cookie del dispositivo marcando `revokedAt = now()`. El logout universal/global actualiza el Token Epoch en `user.tokenValidAfter = now() + 1s` (segundos normalizados), eliminando la condición de carrera en el mismo segundo. La suspensión (`status = 'SUSPENDED'`) deniega el acceso en <1 ms. |
| **COR-DEC-002** | RLS y Scoped Prisma | Cobertura explícita de `ScopedPrismaService` ($extends) para todas las operaciones CRUD, `upsert`, `count` y `aggregate`. Prohibición de escrituras anidadas profundas sobre modelos multi-tenant. En PostgreSQL RLS: `FORCE ROW LEVEL SECURITY`, rol `abogados_app_user` sin `BYPASSRLS`, denegación por defecto con `NULLIF(..., '')` y uso transaccional exclusivo de `SET LOCAL app.current_organization_id = ...` compatible con connection pooling (PgBouncer). |
| **COR-DEC-003** | MFA y Step-Up | Definición precisa de operaciones sensibles. Separación conceptual estricta: 1. Autenticado, 2. Con MFA, 3. Con autenticación reforzada reciente (<15m), 4. Autorizado en tenant y rol. Rechazo inequívoco con código `STEP_UP_MFA_REQUIRED`. |
| **COR-DEC-004** | Magic Link Criptográfico | Generación mediante CSPRNG de 32 bytes (`crypto.randomBytes(32)`), codificación Base64URL y almacenamiento exclusivo de hash SHA-256 en `InvitationToken.tokenHash`. Expiración a 15 minutos para login de clientes (y 72 horas para invitaciones de onboarding). Consumo atómico condicional en transacción Prisma (`updateMany` con `consumedAt: null`). Anti-enumeración con respuesta 200 genérica. |
| **COR-DEC-005** | Reconciliación Prisma | Cotejo con `schema.prisma` real: preservación de todas las columnas de `User`. `User.role` es el rol global de plataforma; **`UserOrganization.roleInOrg` es la autoridad jurídica soberana** en cada organización activa. Se incorporan `UserIdentity`, `UserOrganization`, `UserSession`, `InvitationToken` y `ExpedienteClientAccess`. `User.organizationId` se conserva transitoriamente para compatibilidad hacia atrás. |
| **COR-DEC-006** | Migración Segura | Cero dual run inseguro: erradicación inmediata de `hash123` y del bypass en `LoginPage.tsx`. Preservación íntegra de UUIDs de usuarios, expedientes y documentos. Retención de `legacyPasswordHash` limitada a **90 días calendario** en modo read-only de contingencia, seguida de eliminación DDL obligatoria (`DROP COLUMN`). Cuentas inactivas pasan a `DEACTIVATED`. |
| **COR-DEC-007** | Auditoría y Privacidad | Catálogo de 15 eventos mínimos de seguridad en `AuditLog`. Sanitización estricta: prohibición de registrar tokens bearer, refresh tokens, contraseñas, secretos o links en claro (redacción como `Bearer [REDACTED]`). Intentos de acceso cruzado generan evento `CROSS_TENANT_ACCESS_ATTEMPT`, pero retornan un genérico `404 Not Found` al atacante. |

---

## 4. RECONCILIACIÓN DEL CATÁLOGO TDS (35 PRUEBAS UNÍVOCAS)

Se preservaron íntegramente las 30 pruebas previas (`TST-AUTH-001` a `TST-AUTH-030`) y se incorporaron 5 pruebas específicas para blindar la arquitectura BFF y Magic Link, alcanzando **35 pruebas TDS exhaustivas**:

- `TST-AUTH-031`: BFF: Cookie de sesión opaca (`HttpOnly; Secure; SameSite=Strict`) y ausencia de tokens en `localStorage`/`sessionStorage`.
- `TST-AUTH-032`: BFF: Regeneración obligatoria de ID de sesión anti-Session Fixation tras autenticación exitosa.
- `TST-AUTH-033`: BFF: Validación de token Anti-CSRF en operaciones mutantes (`POST`, `PUT`, `DELETE`), respondiendo `403 Forbidden` si falta.
- `TST-AUTH-034`: BFF: Expiración de sesión por inactividad (`idleExpiresAt`) tras 30 minutos sin peticiones.
- `TST-AUTH-035`: Magic Link: Protección anti-enumeración de usuarios en solicitud de enlace, retornando siempre `200 OK` uniforme.

---

## 5. COMPARACIÓN CON LA VERSIÓN PREVIA (v1.0.2 vs v1.0.3)

| Aspecto Arquitectónico | Versión 1.0.2-DRAFT | Versión Consolidada 1.0.3-DRAFT |
| :--- | :--- | :--- |
| **Portal de Clientes** | Propuesta pendiente (DEC-AUTH-001) | **Auth0 Passwordless Magic Link formalmente APROBADO e integrado.** |
| **Sesión en Frontend** | Disyuntiva pendiente SPA vs BFF (DEC-AUTH-002) | **Patrón BFF formalmente APROBADO como única arquitectura objetivo.** |
| **Política MFA** | Propuesta pendiente (DEC-AUTH-003) | **MFA por roles y operaciones sensibles formalmente APROBADA e integrada.** |
| **Modelo de Sesión** | Token Epoch global exclusivamente | **Modelo híbrido: `UserSession` (revocación individual) + Token Epoch (revocación global).** |
| **Pruebas TDS** | 30 pruebas catalogadas | **35 pruebas exhaustivas y unívocas (cobertura total de BFF y Anti-CSRF).** |
| **Estado Documental** | Borrador con decisiones pendientes | **Especificación completa y consolidada para aprobación formal.** |

---

## 6. CONTROL DE CAMBIOS Y HASHES CRIPTOGRÁFICOS (SHA-256)

Se registraron los hashes SHA-256 de todos los documentos afectados en la raíz del repositorio:

| Archivo Documental | Hash SHA-256 Previo (v1.0.2) | Hash SHA-256 Consolidado (v1.0.3) | Estado de Modificación |
| :--- | :--- | :--- | :--- |
| **`AUTH0-ARCHITECTURE-REMEDIATION-001.md`** | `3F08CEE077AF74B570784E41002158A637B020C7A246039BDD25484B287EC216` | `3F08CEE077AF74B570784E41002158A637B020C7A246039BDD25484B287EC216` | Preservado intacto como antecedente histórico |
| **`SPEC-AUTH-001.md`** | `829E6E69843D90F5810BFA3B3E15AB4D057C55CEA2E0B6E3A35CA7DFFE2C4A23` | `7F9F6304EE88D2CF673D224BE63138FDDBFF3F9A27F11C8407B8749807B40A5D` | Consolidado a **v1.0.3-DRAFT** |
| **`SPEC-AUTH-001-TEST-CATALOG.md`** | `7C087C58BD07BC1BBBF53A19958EDE47B384FD805FFAD58462ADEB9F2739A6A5` | `AD7291F03144A15A1A9A2CE12224A9A6BB8D7C7A3C5BF66C935749E5BA490892` | Actualizado a **35 pruebas TDS** |
| **`SPEC-AUTH-001-TRACEABILITY-MATRIX.md`** | `0C58E689EB038151780F0905A6592F3C6D086017FB55F2BB24E5A2C7460F9A92` | `0F37E90B042FB85B049DF9791D11B55B63EFA346BEE119A5CF6BE0A4D597A8D0` | Actualizado con trazabilidad 1:1 de 35 pruebas |
| **`AUTH0-ARCHITECTURE-DECISION-CONSOLIDATION-001.md`** | *(Nuevo documento)* | *(Calculado en verificación final)* | Creado como informe oficial de entrega |

### Verificación de Integridad Git:
- **`git diff --check`:** Salida limpia de errores de formato en todos los documentos actualizados.
- **`git status --short`:** Confirma que **cero archivos de código productivo** en `backend/src/`, `frontend/src/` o `admin-platform/` fueron tocados.

---

## 7. RIESGOS RESIDUALES Y CONTROLES COMPENSATORIOS

1. **Casillas de Correo Compartidas en Clientes Corporativos:**  
   - *Riesgo:* Un enlace Magic Link enviado a `legales@empresa.com` puede ser abierto por cualquier empleado con acceso al buzón.  
   - *Control Compensatorio:* Se instruye a los estudios jurídicos a enrolar casillas nominales individuales (`nombre.apellido@empresa.com`) y se audita cada IP y User-Agent en `AuditLog`.
2. **Latencia de Conexión en la Capa BFF:**  
   - *Riesgo:* Intermediar cada petición en el BFF añade una sobrecarga de red marginal.  
   - *Control Compensatorio:* Colocalización del BFF y la API en la misma red privada / cluster y uso de caché en memoria de sesión (Redis).
3. **Dependencia de Disponibilidad Externa de Auth0:**  
   - *Riesgo:* Caída o lentitud en el servicio de Auth0.  
   - *Control Compensatorio:* Caché local de claves públicas JWKS (`jwks-rsa`) con TTL de 24 horas, permitiendo que el backend continúe validando tokens ya emitidos sin consultar a Auth0 en cada request.

---

## 8. DICTAMEN TÉCNICO FINAL

### Veredicto: **`APPROVED_FOR_FORMAL_SPEC_APPROVAL`**

**Conclusión:**
La especificación técnica **`SPEC-AUTH-001 v1.0.3-DRAFT`** ha alcanzado el estado de completitud, coherencia y rigor normativo definitivo. Incorpora con precisión las tres decisiones aprobadas por el usuario, resuelve todos los casos límite de revocación, RLS, MFA y aislamiento multi-tenant, y cuenta con un arnés TDS de 35 pruebas automatizadas listo para guiar la implementación.

Se eleva el presente expediente a la espera de la **aprobación formal de la especificación** por parte del usuario, previa a la autorización independiente para iniciar la **Fase 0 de Implementación TDS**.

> [!IMPORTANT]
> **RESTRICCIÓN READ-ONLY CUMPLIDA:** No se ha modificado ningún archivo de código fuente, dependencia, configuración ni base de datos en el repositorio.

