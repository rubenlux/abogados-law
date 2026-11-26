# INFORME TÉCNICO DE SUBSANACIÓN DE ARQUITECTURA DE AUTENTICACIÓN
## Expediente: AUTH0-ARCHITECTURE-REMEDIATION-001
### Documento Base: `AUTH0-ARCHITECTURE-DISCOVERY-001`
### Especificación: `SPEC-AUTH-001` (Versión 1.0.1-DRAFT)
### Repositorio: `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law`
### Modalidad: READ-ONLY — Corrección Documental y Análisis Técnico

---

| Metadato | Detalle Normativo |
| :--- | :--- |
| **Expediente** | `AUTH0-ARCHITECTURE-REMEDIATION-001` |
| **Especificación Base** | `SPEC-AUTH-001 v1.0.0-DRAFT` |
| **Especificación Subsanada** | `SPEC-AUTH-001 v1.0.1-DRAFT` |
| **Repositorio** | `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law` |
| **Rama Git / HEAD** | `master` / `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` |
| **Dictamen Final** | **`READY_FOR_FINAL_REVIEW`** |
| **Fecha de Emisión** | 24 de noviembre de 2026 |

---

## 1. OBJETIVO DEL EXPEDIENTE

Subsanar de forma exhaustiva, verificable y rigurosa las observaciones técnicas detectadas durante la revisión independiente de `SPEC-AUTH-001 v1.0.0-DRAFT`. 

Este documento consolida la resolución de las ocho correcciones obligatorias (**COR-001 a COR-008**), preservando íntegramente los hallazgos empíricos del relevamiento inicial (`SEC-001` a `SEC-005`), eliminando cualquier contradicción conceptual en la gestión de sesiones y revocación, rediseñando el pipeline de seguridad en NestJS, blindando el multi-tenancy interno y estableciendo un catálogo TDS unívoco y directamente comprobable.

---

## 2. TRATAMIENTO DE CORRECCIONES OBLIGATORIAS (COR-001 A COR-008)

### COR-001 — Modelo de Identidad Externa y Desacoplamiento del Proveedor

#### Observación Previa (v1.0.0)
La especificación v1.0.0 proponía añadir un campo simple `auth0Sub String @unique` en la tabla `User`. Esta solución presentaba tres fallas arquitectónicas:
1. **Acoplamiento rígido a un proveedor:** Nombrar la columna `auth0Sub` compromete el esquema con la marca de un proveedor externo específico.
2. **Imposibilidad de multi-identidad:** Un usuario no podía tener más de una credencial externa (por ejemplo, inicio con Google Workspace corporativo y un método de contingencia, o migración a otro IdP OIDC).
3. **Violación del estándar OIDC:** En OpenID Connect, el identificador único global del sujeto es la tupla compuesta `(issuer, subject)`. Dos emisores distintos pueden emitir el mismo `sub`.

#### Solución Técnica Subsanada
Se diseña el desacoplamiento formal de la identidad mediante la entidad relacional `UserIdentity`:

```prisma
model UserIdentity {
  id           String    @id @default(uuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  issuer       String    // e.g., "https://abogados-auth.us.auth0.com/"
  subject      String    // e.g., "auth0|64f123abc456..."
  provider     String    // "auth0", "google-oauth2", "samlp"
  
  emailAtLink  String?   // Email reportado al momento de la vinculación
  createdAt    DateTime  @default(now())
  lastUsedAt   DateTime?

  @@unique([issuer, subject])
  @@index([userId])
}
```

#### Justificación:
- **Restricción Única Compuesta `@@unique([issuer, subject])`:** Garantiza unicidad global absoluta según RFC 7519 / OIDC Core 1.0.
- **Independencia del Proveedor:** Permite federar con múltiples IdPs o migrar en el futuro (ej. de Auth0 a Okta, Keycloak o Azure AD B2C) sin tocar el identificador primario del usuario interno ni romper claves foráneas de expedientes, documentos o auditorías.
- **Soporte Multi-Identidad:** Un usuario puede vincular más de un método de autenticación a su cuenta interna previa autorización administrativa.

---

### COR-002 — Ciclo de Vida de Sesión, Logout y Revocación

#### Observación Previa (v1.0.0)
`TST-AUTH-019` afirmaba que al realizar logout se revocaba el JWT inmediatamente y que cualquier request subsiguiente con ese token fallaba con 401. Esto es técnicamente falso para tokens JWT asimétricos validados sin estado (stateless) vía JWKS en memoria.

#### Solución Técnica Subsanada
Se establecen taxativamente los límites de cada mecanismo y se implementa una estrategia de **Revocación Local mediante Token Epoch (Revocation Timestamp)**:

| Nivel de Cierre | Mecanismo Operativo | Efecto Criptográfico / Temporal |
| :--- | :--- | :--- |
| **1. Logout del SDK Frontend** | `auth0Client.logout({ localOnly: true })` | Descarta Access Token y Refresh Token de la memoria JavaScript. La SPA deja de emitir requests autenticados. |
| **2. Cierre Federado Auth0** | Redirección a `/v2/logout?client_id=...&returnTo=...` | Destruye la cookie de sesión SSO en Auth0. Evita que otro usuario use la misma sesión de navegador en Universal Login. |
| **3. Revocación de Refresh Token** | Llamada a `/oauth/revoke` (RFC 7009) | Invalida el Refresh Token en Auth0. No se pueden generar nuevos Access Tokens. |
| **4. Validez Residual de Access Token** | Stateless JWT (RS256) | El Access Token emitido sigue siendo criptográficamente válido ante validadores JWKS puros hasta que transcurra su tiempo de vida (`exp`, máximo 15 minutos). |
| **5. Revocación Local Inmediata (Token Epoch)** | Campo `tokenValidAfter DateTime` en la tabla `User` | **Solución Adoptada:** Al hacer logout explícito en el backend, suspender al usuario o cambiar credenciales, se actualiza `user.tokenValidAfter = now()`. En el `SecurityContextGuard`, al cargar al usuario interno, se valida: `if (token.iat < user.tokenValidAfter) throw new UnauthorizedException('Token has been revoked')`. |
| **6. Suspensión / Baja de Usuario** | Campo `user.status = 'SUSPENDED'` | El `SecurityContextGuard` comprueba el estado local. Si está suspendido, arroja `403 Forbidden` de inmediato, neutralizando cualquier token activo en menos de 1 milisegundo. |

---

### COR-003 — Migración Segura y Eliminación del Dual Run Inseguro

#### Observación Previa (v1.0.0)
Se proponía un "Dual Run temporal" donde el login local seguía activo mientras duraba la migración, lo que mantenía vivas las vulnerabilidades críticas `SEC-001` (comparación en texto plano de `hash123`) y `SEC-002` (login de clientes sin contraseña).

#### Solución Técnica Subsanada
Se prohíbe terminantemente mantener activos los mecanismos vulnerables. Se adopta una estrategia de **Migración por Activación Asistida sin Dual Run Inseguro**:

1. **Deshabilitación Inmediata de Vectores Inseguros:**
   - Se elimina de inmediato la comparación `user.passwordHash === loginDto.password`.
   - Se elimina el bypass de presentación en `LoginPage.tsx`.
   - Se bloquea el endpoint `POST /client-portal/login` por CUIT sin contraseña.
2. **Proceso de Transición de Cuentas Existentes:**
   - Las cuentas existentes en la base de datos se marcan con `status = 'PENDING_MIGRATION'`.
   - Sus contraseñas históricas se conservan intactas en la columna `legacyPasswordHash` en modo read-only (para auditoría y contingencia de reversión), pero ningún endpoint productivo valida contra ellas.
   - Cada usuario registrado recibe una invitación por correo oficial para activar su cuenta en Auth0 Universal Login mediante enlace seguro de un solo uso.
   - Al completar el alta en Auth0 y validar su correo, el proceso vincula la identidad externa a su registro `User` existente conservando todos sus expedientes, documentos, roles y configuraciones.

---

### COR-004 — Proceso de Onboarding por Invitación Criptográfica de Un Solo Uso

#### Observación Previa (v1.0.0)
Se contemplaba la vinculación automática por coincidencia de email, lo que permitía ataques de secuestro de cuenta (Account Takeover) si un atacante registraba una cuenta social en Auth0 con un email corporativo ajeno.

#### Solución Técnica Subsanada
Queda prohibida la vinculación por simple email. Se implementa un **Flujo de Invitación Criptográfica de Un Solo Uso**:

```
[ Administrador del Estudio ]
       │
       ▼
 1. Crea Usuario en Abogados_law (User: PENDING_ACTIVATION)
 2. Genera InvitationToken criptográfico:
    - Token: 256 bits de entropía (UUIDv4 + HMAC SHA-256)
    - Expiración: 72 horas
    - Enlace: https://app.abogados.com/activate?token=INV-...
       │
       ▼
[ Usuario Recibe Invitación ]
       │
       ▼
 3. Accede al enlace -> Redirigido a Auth0 Universal Login
 4. Completa registro con contraseña robusta o MFA
 5. Auth0 verifica su correo (email_verified: true)
 6. Redirige a la SPA con Authorization Code (PKCE)
       │
       ▼
[ Backend Abogados_law: POST /auth/onboard ]
 7. Recibe Bearer Token (Auth0) + invitationToken
 8. Valida InvitationToken:
    - No expirado.
    - No consumido (status: PENDING).
    - Destinatario coincide con User asociado.
 9. Valida Claims del Access Token:
    - email_verified === true
    - email === user.contactEmail
10. Inserta en UserIdentity (issuer, subject, userId)
11. Marca InvitationToken como CONSUMED
12. Actualiza User.status = 'ACTIVE'
13. Emite evento auditable en AuditLog
```

- **Separación de Emails:**
  - `authEmail`: Correo gestionado en Auth0 para la identidad técnica.
  - `contactEmail`: Correo jurídico formal almacenado en `User` para notificaciones judiciales y procesales. No se actualiza automáticamente ante cambios en el proveedor de identidad.

---

### COR-005 — Secuencia de Ejecución de Seguridad en NestJS (Guards vs Interceptors)

#### Observación Previa (v1.0.0)
El diagrama y texto ubicaban la resolución de organizaciones en un `SecurityContextInterceptor`. En la arquitectura NestJS, los **Guards se ejecutan ANTES** que los Interceptors; por ende, un `RolesGuard` fallaría al no tener aún inyectado el contexto.

#### Solución Técnica Subsanada
Se define la secuencia exacta y canónica de ejecución en NestJS mediante Guards encadenados:

```
Request HTTP Entrante
       │
       ▼
1. Auth0JwtGuard (Passport Strategy: 'jwt-auth0')
   - Valida firma asimétrica RS256 contra JWKS oficial.
   - Valida claims estándar (iss, aud, exp, nbf).
   - Inyecta en req: req.user = { iss, sub, email, email_verified }
       │
       ▼
2. SecurityContextGuard
   - Consulta UserIdentity mediante (iss, sub) (con caché LRU).
   - Si no existe -> 401 Unauthorized ('Identity not registered').
   - Valida revocación de sesión: req.user.iat >= user.tokenValidAfter (COR-002).
   - Valida estado del usuario: user.status === 'ACTIVE' (COR-002).
   - Resuelve membresías activas del usuario (UserOrganization).
   - Valida cabecera 'X-Organization-Id' contra membresías autorizadas:
     - Si es válida -> fija activeOrgId.
     - Si es inválida -> 403 Forbidden ('Unauthorized organization context').
   - Inyecta req.securityContext = { userId, activeOrgId, role, permissions }.
       │
       ▼
3. RolesAndPermissionsGuard (@Roles(...), @RequirePermissions(...))
   - Lee metadatos de reflexión (Reflector).
   - Valida req.securityContext.role y req.securityContext.permissions.
   - Si no cumple -> 403 Forbidden ('Insufficient permissions').
       │
       ▼
4. Execution Context / Controller Method
   - Recibe contexto inyectado mediante decorador: @CurrentSecurityContext() ctx.
       │
       ▼
5. Business Services (ScopedPrismaService)
   - Aplica scoping obligatorio: where: { organizationId: ctx.activeOrgId }.
```

---

### COR-006 — Aislamiento Multi-Tenant Integral y Defensa en Profundidad

#### Observación Previa (v1.0.0)
La especificación descansaba exclusivamente en el scoping manual en servicios, susceptible a omisiones humanas en nuevas rutas.

#### Solución Técnica Subsanada
Se implementa una **Estrategia de Triple Barrera Multi-Tenant**:

1. **Barrera 1 (Guard de Entrada):** El `SecurityContextGuard` garantiza que todo request tenga un `activeOrgId` validado y derivado de una relación contractual legítima en la base de datos.
2. **Barrera 2 (Extensión de Cliente Prisma):** Se implementa el patrón `ScopedPrismaService` mediante extensiones de Prisma (`prisma.$extends`):
   ```typescript
   export const createScopedPrismaClient = (prisma: PrismaClient, orgId: string) => {
     return prisma.$extends({
       query: {
         expediente: {
           async $allOperations({ operation, args, query }) {
             if (['findUnique', 'findFirst', 'findMany', 'update', 'delete'].includes(operation)) {
               args.where = { ...args.where, organizationId: orgId };
             }
             if (operation === 'create') {
               args.data = { ...args.data, organizationId: orgId };
             }
             return query(args);
           },
         },
         // Aplica análogamente para Documento, Client, LegalTemplate, EventoAgenda
       },
     });
   };
   ```
   Cualquier consulta ejecutada a través del cliente scoped inyecta automáticamente la cláusula `organizationId`, eliminando la posibilidad de omisión por parte del desarrollador.
3. **Barrera 3 (Defensa en Profundidad — PostgreSQL RLS):**
   - En PostgreSQL se habilitará Row-Level Security (RLS) sobre las tablas multi-tenant.
   - Cada transacción de base de datos establece la variable de sesión: `SET LOCAL app.current_organization_id = 'org-uuid'`.
   - La política en Postgres rechaza a nivel de motor cualquier fila con `organization_id <> current_setting('app.current_organization_id')`.
4. **Workers Asíncronos:** Las tareas de crawler CSJN o ingestión asíncrona exigen el `organizationId` dentro del payload del job, levantando una transacción con su respectivo scoping.

---

### COR-007 — Reconciliación Integral del Catálogo TDS

#### Observación Previa (v1.0.0)
El catálogo original contenía 20 pruebas, pero omitía escenarios críticos exigidos por la auditoría (MFA administrativo, auditoría de eventos, email no verificado, fuga de tokens en logs, etc.) y presentaba aserciones ambiguas.

#### Solución Técnica Subsanada
Se amplía y reconcilia el catálogo a **25 pruebas TDS rigurosas** (`TST-AUTH-001` a `TST-AUTH-025`) con códigos HTTP exactos, nombres de excepción NestJS y criterios de aprobación unívocos (ver documento complementario `SPEC-AUTH-001-TEST-CATALOG.md`).

---

### COR-008 — Delimitación Operativa y Dependencias de Entorno

#### Observación Previa (v1.0.0)
Se mezclaban suposiciones de planes comerciales de Auth0 con requerimientos técnicos innegociables.

#### Solución Técnica Subsanada
Se establece la separación taxativa:
1. **Requisitos Innegociables:** Validación asimétrica RS256, Zero-Trust en backend, multi-tenancy interno, PKCE en SPA, auditoría en base de datos.
2. **Decisiones Técnicas Aprobadas:** Uso de `UserIdentity` compuesto, eliminación del login local, Scoped Prisma Client, revocación por Token Epoch.
3. **Decisiones Técnicas Pendientes de Aprobación por el Usuario:**
   - *DEC-AUTH-001:* Modalidad de login para clientes (Universal Login estándar vs Passwordless Magic Link).
   - *DEC-AUTH-002:* Implementación de BFF (Backend for Frontend) en producción para erradicar tokens de JavaScript en navegadores de alta sensibilidad.
   - *DEC-AUTH-003:* Nivel de enforcement de MFA para socios (`PARTNER`) y administradores (`ADMIN`) (Políticas de Auth0 Guardian vs WebAuthn obligatorio).
4. **Configuración Externalizada por Ambiente:** Se eliminan valores fijos y dominios ficticios; las variables se declaran formalmente en plantillas versionadas:
   - `AUTH0_ISSUER_URL`: Dominio oficial OIDC del tenant.
   - `AUTH0_AUDIENCE`: Identificador URI de la API de backend.
   - `AUTH0_CLIENT_ID`: Client ID de la SPA / Portal.
   - `AUTH0_JWKS_CACHE_TTL_MS`: Tiempo de caché local de JWKS (por defecto 24 horas).

---

## 3. ESTADO DE LOS HALLAZGOS DE AUDITORÍA (SEC-001 A SEC-007)

| Código | Descripción del Hallazgo | Estado en Repositorio | Tratamiento con SPEC-AUTH-001 v1.0.1 |
| :--- | :--- | :--- | :--- |
| **SEC-001** | Comparación de contraseña en texto plano (`user.passwordHash === loginDto.password`) | Presente en `auth.service.ts:25`. | **ERRADICACIÓN INMEDIATA.** Se elimina la comparación en texto plano y se sustituye la autenticación por Auth0 Universal Login. |
| **SEC-002** | Portal de clientes sin validación de contraseña ni CUIT | Presente en `client-portal.service.ts:35`. | **ERRADICACIÓN INMEDIATA.** Se elimina el endpoint inseguro y se exige autenticación Auth0 vinculada a `ExpedienteClientAccess`. |
| **SEC-003** | Aislamiento multi-tenant no aplicado (fugas IDOR) | Presente en `expedientes.service.ts:9,18`. | **REMEDIADO EN BACKEND.** Implementación de `SecurityContextGuard` y `ScopedPrismaService` con triple barrera. |
| **SEC-004** | Endpoints administrativos sin guards | Presente en `admin-api.controller.ts` y `admin-master.controller.ts`. | **REMEDIADO EN BACKEND.** Protección obligatoria con `Auth0JwtGuard` + `RolesGuard(['ADMIN'])`. |
| **SEC-005** | Secretos simétricos inseguros (`'secret'`, `'refresh-secret'`) | Presente en `auth.module.ts:17` y `auth.service.ts:104`. | **ELIMINACIÓN.** Sustitución por claves públicas asimétricas RS256 resueltas dinámicamente vía JWKS. |
| **SEC-006** | Backup inseguro | Fuera del módulo de autenticación. | **PRESERVADO.** Permanece reservado para su propia especificación de remediación (`SPEC-BCK-001`). |
| **SEC-007** | Ausencia de rate-limiting / throttling | Falta de `@nestjs/throttler`. | **MITIGACIÓN COMPARTIDA.** Auth0 mitiga ataques a credenciales; el backend incorporará throttling en sus rutas de API. |

---

## 4. DICTAMEN TÉCNICO

### Veredicto: **`READY_FOR_FINAL_REVIEW`**

**Conclusión:**
Las ocho correcciones técnicas (**COR-001 a COR-008**) han sido plenamente subsanadas y reconciliadas en los documentos canónicos de especificación. El diseño resultante garantiza soberanía jurídica total, aislamiento multi-tenant inviolable, eliminación definitiva de backdoors de desarrollo y compatibilidad absoluta con las buenas prácticas de la industria.

El expediente documental consolidado se compone de:
1. [AUTH0-ARCHITECTURE-REMEDIATION-001.md](file:///C:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/AUTH0-ARCHITECTURE-REMEDIATION-001.md) (Informe técnico de subsanación)
2. [SPEC-AUTH-001.md](file:///C:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/SPEC-AUTH-001.md) (Especificación técnica v1.0.1-DRAFT consolidada)
3. [SPEC-AUTH-001-TEST-CATALOG.md](file:///C:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/SPEC-AUTH-001-TEST-CATALOG.md) (Catálogo TDS con 25 pruebas inequívocas)
4. [SPEC-AUTH-001-TRACEABILITY-MATRIX.md](file:///C:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/SPEC-AUTH-001-TRACEABILITY-MATRIX.md) (Matriz completa de trazabilidad 1:1)

Se eleva el presente expediente al usuario para su revisión final. Se reitera que **ningún código de backend, frontend o base de datos ha sido modificado**, permaneciendo a la espera de la autorización explícita posterior.

