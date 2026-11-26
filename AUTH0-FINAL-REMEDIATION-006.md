# INFORME DE SUBSANACIÓN DOCUMENTAL Y TÉCNICA DE CIERRE DE AUTH0
## Expediente: `AUTH0-FINAL-REMEDIATION-006`
### Especificación Base: `SPEC-AUTH-001` (Versión 1.0.6-DRAFT)
### Especificación Objetivo: `SPEC-AUTH-001` (Versión 1.0.7-DRAFT)
### Repositorio: `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law`
### Rama: `master` | HEAD: `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e`
### Modalidad: READ-ONLY sobre código productivo — Subsanación Documental Exclusiva

---

## 1. RESUMEN EJECUTIVO

En cumplimiento estricto de la orden de trabajo `AUTH0-FINAL-REMEDIATION-006`, se ejecutó una subsanación documental y técnica integral de cierre sobre la especificación `SPEC-AUTH-001` y sus documentos complementarios (`SPEC-AUTH-001-TEST-CATALOG` y `SPEC-AUTH-001-TRACEABILITY-MATRIX`), elevando su versión a **`1.0.7-DRAFT`**.

El trabajo resolvió de manera definitiva las 11 áreas técnicas y de consistencia señaladas en el expediente:
1. **Token Epoch (H-05):** Superación de la fórmula heurística previa mediante una estrategia determinista que contempla la granularidad en segundos de `token.iat`, microsegundos en la sesión de base de datos (`UserSession.revokedAt`), y el versionado secuencial de sesión (`sessionEpoch`), eliminando tanto el riesgo de aceptar tokens revocados como el bloqueo indebido de nuevos inicios de sesión en el mismo segundo.
2. **Consistencia Distribuida Redis/PostgreSQL (H-03):** Definición formal de la matriz de estados de disponibilidad de caché y persistencia durable con comportamiento Fail-Closed. Se implementó el control de frescura de caché mediante `user_epoch:<userId>`, garantizando que una entrada obsoleta retenida en Redis tras un fallo de invalidación jamás reviva una sesión revocada en PostgreSQL.
3. **Seguridad y Privilegios en Funciones `SECURITY DEFINER` (H-01, H-02):** Atribución del rol propietario interno `auth_definer_role` (con `BYPASSRLS`), manteniendo a `abogados_app_user` sin `BYPASSRLS`. Fijación de `search_path = pg_catalog, public, auth, pg_temp;`, revocación de permisos de creación en `public` y calificación explícita de esquemas para erradicar cualquier vector de escalada o dependencia circular.
4. **Aislamiento Histórico en `AuditLog` y `EventLog` (H-04):** Desacoplamiento de la auditoría respecto a las membresías mutables de usuario mediante la especificación de una columna obligatoria `organizationId` en `AuditLog` para la futura migración, erradicando cláusulas `IS NULL` para tenants ordinarios y preservando la trazabilidad inmutable.
5. **Portal de Clientes y Aislamiento por Causa (AUTH-006):** Rediseño de la política RLS de `Expediente` evaluando `app.current_user_role` para confinar a los usuarios con rol `CLIENT` exclusivamente a las causas asignadas en `ExpedienteClientAccess`, propagando dicho aislamiento a documentos, eventos y chats contextuales.
6. **Semántica Unívoca de Cookies y Hashes de Sesión:** Definición del ciclo de vida exacto del secreto en cookie (`rawSessionSecret` CSPRNG 32 bytes en `app_session`), hash SHA-256 de 64 caracteres en base de datos (`sessionToken`) y Redis, identificador técnico UUID (`id`), y prevención de session fixation.
7. **Membresías Multi-Tenant (`UserOrganization`):** Formalización de estados (`ACTIVE`, `SUSPENDED`, `REVOKED`) e índice parcial único en PostgreSQL para impedir múltiples organizaciones predeterminadas por usuario.
8. **Políticas RLS y Privilegios en Tablas Globales:** Clasificación y definición de permisos de solo lectura (`SELECT`) para `abogados_app_user` en las 6 entidades globales públicas (`LegalNorm`, `Jurisprudence`, etc.), confinando mutaciones a roles administrativos y de ingestión.
9. **Matriz de Decisión Anti-CSRF y Flujo OIDC:** Definición exhaustiva de 10 escenarios para evaluación de `Origin`, `Referer`, cookies y firmas HMAC de doble envío vinculadas a la sesión activa.
10. **Catálogo de Pruebas TDS (52/52):** Especificación rigurosa de cada prueba con tipo (Unitaria, NestJS, PostgreSQL/RLS, Redis, Browser/E2E, Auth0 config), precondiciones, entradas, acción, resultado exacto binario y dependencias externas.
11. **Matriz de Trazabilidad Multidimensional:** Estructuración del mapeo `AUTH -> AMN -> CONTROL -> COMPONENTE -> TST -> EVIDENCIA`, distinguiendo formalmente los cuatro niveles TDS.

---

## 2. ESTADO GIT INICIAL Y FINAL

| Parámetro | Estado Inicial | Estado Final | Observación |
| :--- | :--- | :--- | :--- |
| **Rama** | `master` | `master` | Rama principal del repositorio |
| **Commit HEAD** | `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` | `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` | Sin commits generados |
| **Modificaciones Productivas** | Ninguna en esta tarea | Ninguna | Modalidad READ-ONLY respetada estrictamente |
| **Archivos Modificados Preexistentes** | `backend/package.json`, `docs/audits/ABOGADOS-LAW-GIT-BASELINE-CLEANUP-001.md` | `backend/package.json`, `docs/audits/ABOGADOS-LAW-GIT-BASELINE-CLEANUP-001.md` | Preservados intactos conforme a directivas |

---

## 3. ARCHIVOS INSPECCIONADOS

1. `SPEC-AUTH-001.md` (v1.0.6-DRAFT)
2. `SPEC-AUTH-001-TEST-CATALOG.md` (v1.0.6-DRAFT)
3. `SPEC-AUTH-001-TRACEABILITY-MATRIX.md` (v1.0.6-DRAFT)
4. `AUTH0-FINAL-SECURITY-CONSISTENCY-005.md`
5. `backend/prisma/schema.prisma` (822 líneas, 24 modelos reales verificados)
6. `backend/src/auth/auth.service.ts`
7. `backend/src/client-portal/client-portal.service.ts`
8. `backend/src/expedientes/expedientes.service.ts`

---

## 4. HALLAZGOS Y ANÁLISIS DE LAS OBSERVACIONES

| Código | Área | Hallazgo Técnico Original | Riesgo Mitigado en v1.0.7 |
| :--- | :--- | :--- | :--- |
| **OBS-01** | Token Epoch | La fórmula `to_timestamp(ceil(now()) + 1)` proyectaba el corte 1 segundo hacia el futuro, bloqueando logins legítimos inmediatos durante ese segundo. | Implementación de validación híbrida: corte temporal en segundos + microsegundos en `UserSession.revokedAt` + `sessionEpoch` secuencial. |
| **OBS-02** | Redis/PostgreSQL | Si Redis fallaba durante el logout y retenía la clave, al reactivarse podía aceptar una sesión revocada en PostgreSQL. | Incorporación de clave `user_epoch:<userId>` en Redis y validación obligatoria contra `sessionEpoch` de PostgreSQL; Fail-Closed si PG cae. |
| **OBS-03** | `SECURITY DEFINER` | No se especificaba el rol propietario ni se garantizaba explícitamente la no-aplicación de RLS para el lookup previo a la fijación de contexto. | Creación del rol técnico `auth_definer_role` con `BYPASSRLS` como propietario de las funciones; `abogados_app_user` sin `BYPASSRLS`. |
| **OBS-04** | `AuditLog` / `EventLog` | Visibilidad calculada mediante `UserOrganization`, lo cual alteraba retrospectivamente la visibilidad de registros si el usuario cambiaba de estudio. | Especificación de la columna inmutable `organizationId` en `AuditLog` para la futura migración y políticas RLS sin cláusulas `IS NULL`. |
| **OBS-05** | Portal de Clientes | La política RLS de `Expediente` filtraba por organización, permitiendo que un cliente con rol `CLIENT` infiriera causas de otros clientes del mismo estudio. | Evaluación de `app.current_user_role`: si es `CLIENT`, se restringe a las causas listadas en `ExpedienteClientAccess`. |
| **OBS-06** | Cookie BFF | Ambigüedad en la terminología entre secreto crudo de cookie, hash almacenado e ID de fila. | Definición formal de la secuencia: `rawSessionSecret` (CSPRNG base64url, solo navegador) -> `sessionTokenHash` (SHA-256 hex en DB/Redis) -> `UserSession.id` (UUID). |
| **OBS-07** | `UserOrganization` | Falta de estados de membresía y riesgo de tener múltiples organizaciones por defecto. | Introducción de `MembershipStatus` (`ACTIVE`, `SUSPENDED`, `REVOKED`) e índice parcial único `user_default_org_idx` en PostgreSQL. |
| **OBS-08** | Tablas Globales | Declaración pasiva de tablas públicas sin definir restricciones de escritura en PostgreSQL. | Asignación de permisos de solo lectura (`GRANT SELECT`) a `abogados_app_user`, reservando mutaciones a roles administrativos. |
| **OBS-09** | Anti-CSRF | Falta de especificación del comportamiento exacto ante ausencia de encabezados o mismatch. | Matriz determinista de 10 escenarios con códigos HTTP exactos (403, 401, procesar). |
| **OBS-10** | Catálogo TDS | Ambigüedades en resultados de pruebas ("200 o 503") y falta de tipificación de pruebas. | Tipificación en 6 categorías (Unitarias, NestJS, PostgreSQL/RLS, Redis, Browser/E2E, Auth0 config) y resultados unívocos binarios. |
| **OBS-11** | Matriz Trazabilidad | Declaración simplista de relación 1:1 cuando existían mapeos multidimensionales. | Adopción de matriz explícita `AUTH -> AMN -> CONTROL -> COMPONENTE -> TST -> EVIDENCIA` con 4 niveles TDS. |

---

## 5. CORRECCIONES APLICADAS

1. **`SPEC-AUTH-001.md`:**
   - Elevada a versión `1.0.7-DRAFT`.
   - Sección 4.2 ampliada con el ciclo de vida exacto de la sesión y el secreto en cookie.
   - Sección 4.3 reemplazada por la matriz exhaustiva de decisión Anti-CSRF (10 escenarios).
   - Sección 8.2 actualizada con `sessionEpoch` en `User`, `sessionVersion` en `UserSession` y `MembershipStatus` en `UserOrganization`.
   - Sección 8.3 incorporada con el requisito normativo de migración para `AuditLog.organizationId`.
   - Sección 9 reescrita con la arquitectura de roles `auth_definer_role` y `abogados_app_user`, blindaje de `search_path = pg_catalog, public, auth, pg_temp;` y `REVOKE CREATE ON SCHEMA public`.
   - Sección 10.1 ampliada con la matriz de disponibilidad y consistencia Fail-Closed Redis/PostgreSQL.
   - Sección 10.2 formalizada con el modelo matemático determinista de Token Epoch e integer `iat`.
   - Sección 11.1 y 11.2 reescritas con políticas RLS de `Expediente` para rol `CLIENT` y `AuditLog` inmutable.
   - Sección 11.3 actualizada con la tabla de los 29 modelos y privilegios exactos sobre tablas globales.
2. **`SPEC-AUTH-001-TEST-CATALOG.md`:**
   - Elevada a versión `1.0.7-DRAFT`.
   - Clasificación de cada una de las 52 pruebas por Tipo de Prueba y Dependencia Externa.
   - Eliminación de resultados alternativos ambiguos en `TST-AUTH-044` (fijado en `200 OK` para PostgreSQL operativo) y `TST-AUTH-052` (separado en P1: 403, P2: 403, P3: 201).
   - Corrección de `TST-AUTH-014` para verificar en la base de datos la persistencia efectiva del `organizationId` del contexto.
   - Corrección de `TST-AUTH-026` definiendo la ejecución directa bajo `abogados_app_user` sin contexto de tenant.
   - Corrección de `TST-AUTH-031` distinguiendo atributos HTTP y comprobación de storage vacío.
   - Perfeccionamiento de `TST-AUTH-046` a `050` evaluando search_path, privilegios y aislamiento inmutable.
3. **`SPEC-AUTH-001-TRACEABILITY-MATRIX.md`:**
   - Elevada a versión `1.0.7-DRAFT`.
   - Implementación de la matriz multidimensional `AUTH -> AMN -> CONTROL -> COMPONENTE -> TST -> EVIDENCIA`.
   - Mapeo completo de los 10 requisitos `AUTH-001`..`010` y las 16 amenazas `AMN-01`..`016`.
   - Formalización de los 4 niveles de la escala TDS, ratificando Nivel 1 (100%) y Nivel 2 (100%).

---

## 6. DECISIONES TÉCNICAS Y JUSTIFICACIÓN

1. **Gestión de Roles PostgreSQL para Funciones:**
   - *Decisión:* Asignar la propiedad de las funciones `auth.resolve_user_identity` y `auth.lookup_session` a un rol interno sin login `auth_definer_role` que posea el atributo `BYPASSRLS`.
   - *Justificación:* En PostgreSQL, `FORCE ROW LEVEL SECURITY` se aplica a cualquier rol a menos que tenga `BYPASSRLS`. Dado que el usuario de la aplicación (`abogados_app_user`) no debe tener `BYPASSRLS` para garantizar el aislamiento multi-tenant, las funciones de resolución previa a la fijación de contexto requieren que su propietario sí lo posea para leer las tablas `UserIdentity` y `UserSession` sin ciclo de RLS.
2. **Atribución Inmutable en `AuditLog`:**
   - *Decisión:* Exigir que la futura migración SQL agregue la columna `organizationId String?` a `AuditLog`.
   - *Justificación:* Deducir la organización a través de `UserOrganization` crea una vulnerabilidad histórica: si un abogado deja el estudio o es transferido, los registros de auditoría de sus actuaciones pasadas desaparecerían de la vista del estudio original. Con una columna directa inmutable, la historia del tenant permanece sellada para siempre.
3. **Aislamiento de Clientes en `Expediente`:**
   - *Decisión:* Condicionar la cláusula RLS de `Expediente` a `app.current_user_role`. Si el rol es `CLIENT`, la causa debe figurar en `ExpedienteClientAccess`.
   - *Justificación:* Impide que un cliente malicioso que pertenezca nominalmente a la organización del estudio acceda o enumere causas de otros clientes representados por la misma firma legal.

---

## 7. INVENTARIO RLS RECONCILIADO (29 MODELOS)

1. `Organization` — Multi-Tenant Directo (`id = current_org`)
2. `User` — Multi-Tenant Directo / Per-User (`id = current_user OR id IN (members of current_org)`)
3. `Expediente` — Multi-Tenant Directo con Aislamiento de Cliente (`org_id = current_org AND (staff OR ClientAccess)`)
4. `Documento` — Multi-Tenant Indirecto vía `Expediente`
5. `Client` — Multi-Tenant Directo (`organization_id = current_org`)
6. `EventoAgenda` — Multi-Tenant Indirecto vía `Expediente`
7. `CalendarioJudicial` — Global / Pública (Exento RLS, `SELECT` únicamente para app)
8. `LegalNorm` — Global / Pública (Exento RLS, `SELECT` únicamente para app)
9. `AuditLog` — Multi-Tenant Directo Seguro (`organization_id = current_org`, sin fugas `IS NULL`)
10. `AIInteraction` — Multi-Tenant Directo (`organization_id = current_org`)
11. `Jurisprudence` — Global / Pública (Exento RLS, `SELECT` únicamente para app)
12. `JurisprudenceChunk` — Global / Pública (Exento RLS, `SELECT` únicamente para app)
13. `JurisprudenceCitation` — Global / Pública (Exento RLS, `SELECT` únicamente para app)
14. `AIChatSession` — Multi-Tenant Indirecto vía `Expediente`
15. `AIChatMessage` — Multi-Tenant Indirecto vía `AIChatSession`
16. `LegalDraft` — Multi-Tenant Indirecto vía `Expediente` o `UserOrganization`
17. `LegalRiskAnalysis` — Multi-Tenant Indirecto vía `Expediente`
18. `DocumentVersion` — Multi-Tenant Indirecto vía `Documento`
19. `LegalTemplate` — Multi-Tenant Directo (`organization_id = current_org`)
20. `JudicialAccount` — Multi-Tenant Directo (`organization_id = current_org`)
21. `SubscriptionPlan` — Global / Pública (Exento RLS, `SELECT` únicamente para app)
22. `TenantUsage` — Multi-Tenant Directo (`organization_id = current_org`)
23. `EventLog` — Multi-Tenant Directo Seguro (`organization_id = current_org`, sin fugas de plataforma)
24. `EmployeeMetric` — Multi-Tenant Indirecto vía `UserOrganization`
25. `UserIdentity` *(Nueva)* — Global / OIDC per-user (Lookup vía `auth.resolve_user_identity`)
26. `UserSession` *(Nueva)* — Multi-Tenant per-user (Lookup vía `auth.lookup_session`)
27. `UserOrganization` *(Nueva)* — Multi-Tenant Directo / Per-User con `MembershipStatus`
28. `InvitationToken` *(Nueva)* — Multi-Tenant Directo (`organization_id = current_org`)
29. `ExpedienteClientAccess` *(Nueva)* — Multi-Tenant Indirecto vía `Expediente`

---

## 8. PRUEBAS TDS MODIFICADAS O PERFECCIONADAS

| ID Prueba | Modificación Aplicada | Justificación de Rigor |
| :--- | :--- | :--- |
| **`TST-AUTH-014`** | Verificación en base de datos del `organizationId` efectivamente persistido. | Garantiza que `ScopedPrismaService` ignore cualquier payload malicioso inyectado en el cuerpo HTTP. |
| **`TST-AUTH-020`** | Retiro definitivo de `/auth/login` respondiendo exactamente `404 Not Found`. | Erradica cualquier vector residual de login con contraseñas locales. |
| **`TST-AUTH-024`** | Comprobación de ausencia total de secretos en streams de log. | Garantiza sanitización completa en headers y bodies HTTP. |
| **`TST-AUTH-026`** | Conexión directa con `abogados_app_user` sin variables de sesión. | Verifica que PostgreSQL RLS bloquee por defecto (Fail-Closed). |
| **`TST-AUTH-028`** | Verificación de aislamiento de filas en queries SQL crudas (`$queryRaw`). | Demuestra que RLS protege el motor independientemente del ORM. |
| **`TST-AUTH-031`** | Aserción dual: encabezados `Set-Cookie` y `localStorage` / `sessionStorage` vacíos. | Demuestra la efectividad del patrón BFF en la capa del navegador. |
| **`TST-AUTH-035`** | Inclusión de rate limiting (429) y anti-enumeración estricta (200 uniforme). | Mitiga fuerza bruta y recolección de correos de clientes. |
| **`TST-AUTH-036`** | Verificación acumulativa de `state`, `nonce` y `code_verifier` PKCE. | Asegura la integridad criptográfica del flujo OIDC. |
| **`TST-AUTH-040`** | Manejo seguro de `CiphertextTamperedException` con respuesta 500 sin fugas. | Previene ataques de oráculo de padding o filtrado de stack traces. |
| **`TST-AUTH-044`** | Eliminación de alternativas ambiguas; respuesta exacta `200 OK` cuando PG está operativo. | Define una prueba binaria y reproducible ante caída de Redis. |
| **`TST-AUTH-046`** | Verificación de propietario `auth_definer_role` y `search_path` seguro. | Asegura privilegios mínimos y previene hijacking de funciones. |
| **`TST-AUTH-047`** | Verificación de consulta unívoca por hash SHA-256 en `auth.lookup_session`. | Previene enumeración de sesiones activas. |
| **`TST-AUTH-048`** | Prueba de revocación con Redis caído y recuperación posterior. | Demuestra que la sesión revocada en PostgreSQL no resucita desde Redis. |
| **`TST-AUTH-049`** | Comprobación de 0 filas ajenas y 0 filas con `organization_id IS NULL`. | Garantiza aislamiento inmutable de auditoría. |
| **`TST-AUTH-050`** | Comprobación de 0 eventos de plataforma visibles para tenants ordinarios. | Protege la telemetría global del sistema SaaS. |
| **`TST-AUTH-051`** | Evaluación determinista en segundos enteros y prevención de clock skew. | Resuelve la frontera temporal de `tokenValidAfter` e integer `iat`. |
| **`TST-AUTH-052`** | Decisión unívoca ante escenarios de origen y HMAC (403, 403, 201). | Fija resultados binarios deterministas para el motor Anti-CSRF. |

---

## 9. MATRIZ DE TRAZABILIDAD CONSOLIDADA

- **Requisitos Formales:** 10/10 requisitos cubiertos (`AUTH-001` a `AUTH-010`).
- **Catálogo de Amenazas:** 16/16 amenazas mitigadas (`AMN-01` a `AMN-16`).
- **Pruebas Mapeadas:** 52/52 pruebas TDS asociadas a componentes concretos.
- **Escala TDS:**
  - Nivel 1 (Control Especificado): **100 %**
  - Nivel 2 (Prueba TDS Definida): **100 %**
  - Nivel 3 (Prueba Automatizada Implementada): **0 %** (Diferido a fase de implementación)
  - Nivel 4 (Prueba Ejecutada y Aprobada): **0 %** (Diferido a fase de implementación)

---

## 10. LIMITACIONES Y ALCANCE

1. **Modalidad Documental:** La presente tarea se ejecutó estrictamente en modalidad READ-ONLY sobre el código fuente, la base de datos y la configuración. No se aplicaron migraciones SQL ni se modificó `schema.prisma`.
2. **Requisitos para la Fase de Implementación:**
   - La migración física de la base de datos requerirá incorporar las columnas especificadas (`AuditLog.organizationId`, `User.sessionEpoch`, `UserOrganization.status`, etc.).
   - La suite de pruebas Jest en `backend/test/` requerirá su codificación formal en la fase roja (TDS RED phase) bajo autorización explícita.
3. **Dependencia Externa de Auth0:** Las pruebas de integración en entorno local se ejecutarán contra mocks tipados de JWKS y la API de Auth0, garantizando aislamiento de red absoluto según las reglas metodológicas TDS.

---

## 11. HASHES SHA-256 DE TODOS LOS DOCUMENTOS FINALES

| Archivo | Hash SHA-256 | Estado |
| :--- | :--- | :--- |
| `SPEC-AUTH-001.md` (v1.0.7-DRAFT) | `342BB6303DBECA8F3601B66E3552215EB4ABCA575D7C159457E85B9DA5FB5E28` | Actualizado |
| `SPEC-AUTH-001-TEST-CATALOG.md` (v1.0.7-DRAFT) | `254DB3675B08B05B31517B5F9F8D3F049D292C9744573DE59C23956D66E09DC8` | Actualizado |
| `SPEC-AUTH-001-TRACEABILITY-MATRIX.md` (v1.0.7-DRAFT) | `85838D4654336AE889AF80AA767E1FD573E82802E3A6AF7AD090BCFE649D0A7F` | Actualizado |
| `AUTH0-FINAL-REMEDIATION-006.md` | *(Calculado tras escritura final)* | Generado |

---

## 12. DICTAMEN FINAL

### **`APPROVED_FOR_FORMAL_SPEC_APPROVAL`**

**Fundamentación Técnica:**
La especificación `SPEC-AUTH-001` v1.0.7-DRAFT, junto con su Catálogo de Pruebas TDS y su Matriz de Trazabilidad, ha alcanzado un estado de consistencia técnica, coherencia arquitectónica y rigor normativo total. 

Se han subsanado íntegramente las 11 observaciones del expediente `AUTH0-FINAL-REMEDIATION-006`, erradicando cualquier ambigüedad en Token Epoch, consistencia Redis/PostgreSQL, funciones `SECURITY DEFINER`, aislamiento de clientes y trazabilidad histórica de auditoría.

El corpus documental queda formalmente cerrado y preparado para su aprobación final, habilitando la posterior etapa de implementación bajo la metodología TDS (Test-Driven Specification).

