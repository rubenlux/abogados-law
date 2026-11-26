# ACTA DE APROBACIÓN FORMAL — SPEC-AUTH-004
## Expediente: `AUTH04-FORMAL-APPROVAL-001`
**Repositorio:** `C:\Users\ruben\Documents\Mis-Proyectos\Abogados_law\`  
**Documento aprobado:** `SPEC-AUTH-004.md`  
**Versión aprobada:** `0.2.0` *(evolución desde `0.2.0-DRAFT` / `AUTH04-SPEC-RECONCILIATION-002`)*  
**Fecha:** 24/11/2026  
**Estado Documental:** `SPEC-AUTH-004 v0.2.0 — APPROVED`  
**Estado de Implementación:** `AUTH-04 IMPLEMENTATION — NOT AUTHORIZED`

---

## 1. Objeto del Acta

Formalizar la aprobación de `SPEC-AUTH-004 v0.2.0` incorporando las seis decisiones humanas (`DEC-04-01` a `DEC-04-06`) y sus condiciones obligatorias. Esta aprobación consolida la línea base documental para AUTH-04, pero **no autoriza todavía la escritura de código productivo, cambios en `schema.prisma`, migraciones, creación de roles PostgreSQL ni modificaciones de infraestructura**.

---

## 2. Registro de Decisiones Formalmente Aprobadas

| ID | Decisión | Dictamen | Condiciones Obligatorias Aplicables | Secciones Normativas en `SPEC-AUTH-004.md` |
|---|---|---|---|---|
| **`DEC-04-01`** | Arquitectura de doble barrera (Aplicación + PostgreSQL RLS + rol runtime `abogados_app_user`) | **APROBADA** | RLS actúa como segunda barrera y no sustituye autorización en aplicación; `abogados_app_user` es `NOSUPERUSER`, `NOBYPASSRLS`, no propietario de tablas y sin capacidad de asumir roles privilegiados; consultas 100% parametrizadas (sin raw SQL inseguro); separación estricta de credenciales runtime, migraciones y backup. | Registro de Decisiones, §9, §10.1, §10.4, §17 |
| **`DEC-04-02`** | Migración Expand/Contract y backfill verificable | **APROBADA** | Prohibido inferir pertenencia desde `User.organizationId` o `User.role`; prohibido asignar arbitrariamente huérfanos/ambiguos o borrar datos jurídicos; mantener `organizationId` nullable durante resolución; aplicar `NOT NULL` únicamente con `0` pendientes demostrados o resolución explícita aprobada; comportamiento Fail-Closed para filas `NULL`; `EmployeeMetric` clasificada como `TENANT-SCOPED`. | Registro de Decisiones, §4.2, §10.2, §16.1–16.3, §17 |
| **`DEC-04-03`** | Matriz de permisos y proyecciones por columnas | **APROBADA** | `STAFF` limitado a metadatos autorizados (sin documentos ni estrategia jurídica); `ASSISTANT` solo operaciones expresamente permitidas; `LAWYER` sin `documents:sensitive` ni `cases:delete` salvo nueva especificación formal; segregación en `ORG_ADMIN`/`ORG_OWNER`; proyecciones explícitas obligatorias en toda respuesta HTTP; RLS controla filas y aplicación controla columnas/DTOs; prohibido exponer secretos, hashes, tokens, verificadores o rutas internas de almacenamiento. | Registro de Decisiones, §7, §8.1, §8.2, §9, §15.1 (`TST-A04-012`) |
| **`DEC-04-04`** | Contención Fail-Closed de endpoints prototipales | **APROBADA** | Bloquear en Fail-Closed (`403`/`404`) durante AUTH-04: `admin/*`, `admin-api/*`, `GET /events/logs`, `POST /client-portal/login` y escrituras no autorizadas en `LegalNorm`/`Jurisprudence`; no eliminar módulos ni datos; no implementar aún el portal de clientes ni módulos administrativos definitivos; respetar lectura global `SELECT`-only para el runtime. | Registro de Decisiones, §7, §10.4, §14, §15.1 (`TST-A04-014`, `021`) |
| **`DEC-04-05`** | Seguridad legacy (`SecurityContextGuard` y `POST /auth/refresh`) | **APROBADA CON CONDICIÓN OBLIGATORIA** | Prohibido usar `User.role` o `User.organizationId` para autorización organizacional; módulos organizacionales dependen exclusivamente de `UserSession.activeOrganizationId`, membresía activa y permisos de organización; `SecurityContextGuard` conservado únicamente para usos legacy compatibles con AUTH-01/02 y **nunca** como sustituto de `ActiveOrgContextGuard` + `OrgPermissionGuard`; deprecar `POST /auth/refresh` legacy HS256 asegurando que no intervenga en el flujo BFF/Auth0; no eliminar aún campos legacy. | Registro de Decisiones, §6, §14 |
| **`DEC-04-06`** | Eventos de plataforma sin organización (`organizationId IS NULL`) | **APROBADA CON CONDICIÓN OBLIGATORIA** | Separación estricta entre auditoría de plataforma y auditoría organizacional; eventos `NULL` jamás visibles para tenants; prohibido introducir excepciones generales de lectura en RLS para `NULL`; escritura de eventos de plataforma mediante mecanismo/servicio de plataforma separado con privilegios mínimos que no habilite lectura/modificación/eliminación por usuarios de organizaciones; prohibido un rol genérico que eluda RLS desde el runtime ordinario; cualquier sub-decisión de privilegios SQL para el escritor de plataforma se documenta como pendiente sin inventar implementación. | Registro de Decisiones, §10.2 (Cat B), §15.1 (`TST-A04-016`, `020`, `031`) |

---

## 3. Checklist de Validación Documental Final

| Control de Validación | Resultado |
|---|---|
| Seis decisiones (`DEC-04-01` a `DEC-04-06`) registradas formalmente | **OK** |
| Condiciones obligatorias integradas en §7, §8, §9, §10, §14, §16 y §20 | **OK** |
| Sin contradicciones internas entre §8, §9, §10, §14, §15 y §16 | **OK** |
| Decisiones cerradas de AUTH-01, AUTH-02 y AUTH-03 preservadas intactas | **OK** |
| Catálogo TDS completo: 33 pruebas (`TST-A04-001` a `TST-A04-033`) + 4 bloques de regresión (82 pruebas existentes) | **OK** |
| Matriz de trazabilidad TDS (`Modelo → Servicio → Endpoint/Job → Permiso → Scoping → RLS → Test`) completa | **OK** |
| Historial de versiones actualizado (`0.1.0-DRAFT` → `0.2.0-DRAFT` → `0.2.0 APPROVED`) con trazabilidad a `AUTH04-SPEC-RECONCILIATION-002` | **OK** |
| Cero funcionalidades declaradas implementadas sin existir; cero cambios en código, Prisma, PostgreSQL o Git | **OK** |

---

## 4. Sub-decisión Pendiente Documentada (No Bloqueante para Aprobación de `v0.2.0`)

- **Escritor de eventos de plataforma (`organizationId IS NULL`) bajo `DEC-04-06`:** En §10.2 Cat B queda documentado que la escritura de eventos de plataforma sin organización deberá implementarse mediante un mecanismo/servicio separado de privilegio mínimo (p. ej., credencial `INSERT`-only separada o función `SECURITY DEFINER` acotada únicamente a `INSERT` de eventos de plataforma), sin permitir `SELECT`/`UPDATE`/`DELETE` a tenants ni rol genérico con bypass RLS. Su especificación concreta se resolverá únicamente cuando se requiera emitir eventos de plataforma sin organización bajo RLS.

---

## 5. Declaración de Estado Final

- **`SPEC-AUTH-004 v0.2.0 — APPROVED`**
- **`AUTH-04 IMPLEMENTATION — NOT AUTHORIZED`**

Toda modificación de código productivo, esquema Prisma, migraciones, roles PostgreSQL o tests requiere una autorización posterior, específica y expresa del usuario.

