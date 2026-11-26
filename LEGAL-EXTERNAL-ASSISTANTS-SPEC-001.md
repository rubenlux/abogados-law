# LEGAL-EXTERNAL-ASSISTANTS-SPEC-001
## ESPECIFICACIÓN FUNCIONAL, CATÁLOGO DE HERRAMIENTAS MCP Y MODELO COMERCIAL — MÓDULO DE ASISTENTES EXTERNOS

| Campo | Valor |
| :--- | :--- |
| **Expediente** | `LEGAL-EXTERNAL-ASSISTANTS-SPEC-001` |
| **Versión** | `v1.0.0` |
| **Estado** | `BORRADOR — PENDIENTE DE APROBACIÓN FORMAL DEL PROPIETARIO` |
| **Fecha** | `2026-11-25` |
| **Autorización de implementación** | `NO AUTORIZADA` *(La aprobación de esta especificación NO constituye autorización para escribir código, migraciones ni instalar dependencias)* |
| **Baseline Git verificado** | Rama `master` — `1d3dc0148d0104e1bff5eeaaf9e098ba85fa739e` |
| **Documentos del paquete** | [LEGAL-EXTERNAL-ASSISTANTS-MCP-ADR-001.md](./LEGAL-EXTERNAL-ASSISTANTS-MCP-ADR-001.md) · [LEGAL-EXTERNAL-ASSISTANTS-SECURITY-001.md](./LEGAL-EXTERNAL-ASSISTANTS-SECURITY-001.md) · [LEGAL-EXTERNAL-ASSISTANTS-PROMPT-CATALOG-001.md](./LEGAL-EXTERNAL-ASSISTANTS-PROMPT-CATALOG-001.md) · [LEGAL-EXTERNAL-ASSISTANTS-ROADMAP-001.md](./LEGAL-EXTERNAL-ASSISTANTS-ROADMAP-001.md) |
| **Referencias relacionadas** | [SPEC-AUTH-001.md](./SPEC-AUTH-001.md) · [SPEC-AUTH-004.md](./SPEC-AUTH-004.md) · [LEGAL-AI-CREDITS-SPEC-001.md](./LEGAL-AI-CREDITS-SPEC-001.md) (`v1.1.0`) |

### Historial de versiones
| Versión | Fecha | Expediente | Resumen de cambios |
| :--- | :--- | :--- | :--- |
| `v1.0.0` | `2026-11-25` | `LEGAL-EXTERNAL-ASSISTANTS-SPEC-001` | Especificación funcional inicial, auditoría empírica del repositorio, evaluación de catálogo MCP (consulta y escritura futura) y análisis comercial/créditos. |

---

## 1. Auditoría empírica del estado actual del repositorio (READ-ONLY)

### 1.1. Capacidades realmente disponibles (verificadas en código y `schema.prisma`)
- **AUTH-01 a AUTH-04 (Identidad, BFF, Organizaciones, RBAC y RLS):**
  - Autenticación web mediante BFF con cookie HttpOnly `app_session` y token `csrf_token` (`BffSessionGuard`, `CsrfGuard`), además de validación JWT RS256 contra Auth0 JWKS (`Auth0JwtGuard` / `Auth0JwtStrategy`).
  - Contexto organizacional soberano y fail-closed en `ActiveOrgContextGuard` (revalida en vivo `OrganizationMembership.status === ACTIVE` y `Organization.status === ACTIVE`, congelando `req.orgContext`).
  - RBAC declarativo en `backend/src/authz/permissions.ts` (`OrgPermissionGuard`, 5 roles: `STAFF`, `ASSISTANT`, `LAWYER`, `ORG_ADMIN`, `ORG_OWNER`) y proyecciones explícitas por rol (`EXPEDIENTE_SELECT_BY_ROLE`, `CLIENT_SELECT_BY_ROLE`, `MOVIMIENTO_SELECT_BY_ROLE`, `AGENDA_EVENT_SELECT_BY_ROLE`, `VENCIMIENTO_SELECT_BY_ROLE`, `DOCUMENT_SELECT_BY_ROLE`) + `FORBIDDEN_RESPONSE_FIELDS`.
  - Aislamiento multi-tenant transaccional vía `ScopedPrismaService` (`SET LOCAL app.current_organization_id` + protección `AsyncLocalStorage` contra cambio anidado de tenant) y RLS `ENABLE + FORCE` en PostgreSQL.
  - Auditoría centralizada en `OrgAuditService` (`AuditLog`) con sanitización de claves sensibles (`token|secret|password|hash|verifier|authorization|cookie`).
- **AUTH-05 (Clientes):** `ClientsModule` (`/clients`), modelo `Client`, permisos `clients:read`, `clients:write`, `clients:delete`.
- **AUTH-06 (Expedientes y Partes):** `ExpedientesModule` (`/expedientes`), modelos `Expediente` y `ExpedienteParte`, permisos `cases:read`, `cases:write`, `cases:delete`.
- **AUTH-07 (Movimientos, Agenda y Vencimientos):**
  - `MovimientosModule` (`/movimientos`), modelo `MovimientoProcesal` (baja lógica trazable vía `anuladoAt`), permisos `cases:read`, `cases:write`, `cases:delete`.
  - `AgendaEventsController` (`/agenda/actividades`), modelo `AgendaEvent`, permisos `agenda:read`, `agenda:write`.
  - `VencimientosModule` (`/vencimientos`), modelo `Vencimiento` (`origenFechaLimite = MANUAL`), permisos `agenda:read`, `agenda:write`.
- **AUTH-08 (Gestión Documental):** `DocumentsManagementService` (expuesto vía `DocumentsController` en `/documents`), modelos `Document` y `DocumentFileVersion`, almacenamiento privado (`DOCUMENT_STORAGE_ROOT`), verificación SHA-256, permisos `documents:metadata_read` (`STAFF`), `documents:read` / `documents:download` / `documents:write` (`ASSISTANT+`), `documents:delete` / `documents:sensitive` (`ORG_ADMIN+`).
- **AUTH-09, AUTH-10 y AUTH-11 (IA Legal interna):** `LegalWriting` + `LegalDraftTemplate`, `LegalAiContextService` (delimitadores `<UNTRUSTED_*>` anti-prompt-injection y `validSourceIds`), `DocumentTextExtractorService` (extracción segura DOCX/PDF vía `DocumentsManagementService.prepareDownload`, tope 5 MB y protección anti-ZIP-bomb de 2 MB).
- **Placeholder de interfaz:** existe únicamente el ítem deshabilitado `Asistentes externos` (`pending: true`) en [MainLayout.tsx](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/frontend/src/components/layout/MainLayout.tsx#L51) apuntando a `/ia-legal/asistentes-externos` en [App.tsx](file:///c:/Users/ruben/Documents/Mis-Proyectos/Abogados_law/frontend/src/App.tsx#L160-L173).

### 1.2. Capacidades inexistentes o incompletas (verificadas — NO dar por existentes)
| Capacidad | Estado real en repositorio | Impacto directo en Asistentes Externos |
| :--- | :--- | :--- |
| **Infraestructura MCP** | **Inexistente** (0 paquetes MCP en `package.json`, 0 endpoints, 0 tablas de conexión/tokens, 0 herramientas). | Debe diseñarse y construirse desde cero en Fase B reutilizando AUTH-01..08. |
| **Biblioteca de Prompts** | **Inexistente** (solo existe `LegalDraftTemplate` para plantillas de escritos en AUTH-09). | Componente independiente entregable primero en Fase A sin MCP. |
| **Módulo de Tareas (`Task` / `Tarea`)** | **Inexistente** en `schema.prisma` y `backend/src/`. | Bloquea `listar_tareas` y `crear_tarea` hasta crear el módulo de Tareas con RLS y permisos. |
| **Módulo de Honorarios y Cobranza / Finanzas** | **Inexistente** en `schema.prisma` y `backend/src/` (sin modelos ni permisos `finance:*`/`billing:*`). | Bloquea `consultar_honorarios` y `consultar_estado_cobranza` hasta crear el módulo financiero con permisos dedicados. |
| **Sistema dedicado de Alertas (`Alert`)** | **Inexistente** como tabla propia (solo `Vencimiento` con `prioridad`/`fechaLimite`/`estado` y `EventoAgenda.isCritical` legacy). | `consultar_alertas` solo puede ofrecer una vista derivada sobre `Vencimiento` en Fase B. |
| **Entidad dedicada de Notas (`Note`)** | **Inexistente** como tabla propia (solo campos de texto `Expediente.descripcion`, `Client.notes`, `Vencimiento.observaciones`). | `agregar_nota` requiere definir entidad propia con auditoría o acotar su alcance en Fase C. |
| **Jurisprudencia / Normativa operativas** | Tablas vacías (`0` filas) y búsqueda rota sin `pgvector` (cubiertas en `LEGAL-AI-RESEARCH-ARCHITECTURE-SPEC-001` `v1.1.0`). | Los prompts de Normativa/Jurisprudencia que dependan de consulta conectada quedan marcados como pendientes. |
| **Motor de Créditos** | **Inexistente** (especificado en `LEGAL-AI-CREDITS-SPEC-001.md` `v1.1.0`, Fase F1 pendiente). | El conector MCP no puede cobrar créditos automáticamente hasta que exista F1 y decisión comercial expresa. |

---

## 2. Objetivo funcional y separación en dos componentes independientes

La sección **Asistentes externos** (`/ia-legal/asistentes-externos`) se compone de **dos subsistemas funcional y técnicamente independientes**:

1. **Componente A — Biblioteca de Prompts (disponible sin MCP):**
   - Catálogo curado de instrucciones profesionales jurídicas y de gestión del estudio, listas para copiar y pegar manualmente en ChatGPT, Claude u otro asistente externo.
   - **Requisito invariante (`REQ-EA-001`):** debe operar al 100% sin conectar ninguna cuenta externa, sin activar MCP y sin consumir créditos.
   - Especificación completa del catálogo en [LEGAL-EXTERNAL-ASSISTANTS-PROMPT-CATALOG-001.md](./LEGAL-EXTERNAL-ASSISTANTS-PROMPT-CATALOG-001.md).
2. **Componente B — Conector MCP (Model Context Protocol):**
   - Integración controlada que permite a asistentes externos compatibles consultar información autorizada del estudio mediante herramientas tipadas, auditadas y acotadas al usuario y organización activos.
   - **Habilitación gradual (`REQ-EA-002`):** el primer MVP del conector (Fase B) es **estrictamente de solo lectura** sobre módulos existentes; la escritura controlada se evalúa recién para Fase C/D con confirmación explícita e idempotencia.

---

## 3. Requisitos funcionales principales

| ID | Requisito funcional | Componente | Fase |
| :--- | :--- | :---: | :---: |
| **REQ-EA-001** | La Biblioteca de Prompts debe ser accesible y utilizable mediante copia manual sin requerir conexión MCP ni cuenta externa vinculada. | Prompts | Fase A |
| **REQ-EA-002** | Cada prompt debe exponer metadatos completos: ID estable, título, descripción, categoría, nivel (`simple`/`avanzado`), texto completo, variables a completar, requisito MCP, permiso requerido, clasificación (`consulta`/`acción`), estado de disponibilidad y advertencias. | Prompts | Fase A |
| **REQ-EA-003** | Los prompts cuya ejecución automatizada dependa de módulos aún inexistentes (Tareas, Honorarios/Cobranza, Normativa InfoLEG, Jurisprudencia IA) deben clasificarse explícitamente como pendientes o modo manual sin inventar capacidades. | Prompts | Fase A |
| **REQ-EA-004** | La UI debe permitir filtrar prompts por categoría, nivel, clasificación y búsqueda por texto, y mostrar advertencias de confidencialidad antes de copiar. | Prompts | Fase A |
| **REQ-EA-005** | El Conector MCP debe permitir a un usuario autorizado vincular un cliente MCP compatible (ej. ChatGPT, Claude) asociado unívocamente a su identidad individual y a una organización activa específica. | MCP | Fase B |
| **REQ-EA-006** | Antes de activar una conexión MCP, la interfaz debe presentar la advertencia de privacidad externa (ver `SEC-EA-017`) y registrar aceptación explícita versionada en PostgreSQL. | MCP | Fase B |
| **REQ-EA-007** | El Conector MCP en Fase B debe exponer exclusivamente herramientas de solo lectura respaldadas por módulos existentes (`AUTH-05` a `AUTH-08`). | MCP | Fase B |
| **REQ-EA-008** | Toda herramienta MCP debe delegar en los servicios de dominio existentes (`ExpedientesService`, `ClientsService`, `MovimientosService`, `VencimientosService`, `AgendaEventsService`, `DocumentsManagementService`), nunca consultar Prisma/PostgreSQL directamente saltándose reglas de negocio. | MCP | Fase B |
| **REQ-EA-009** | Toda herramienta de listado debe imponer límites estrictos de resultados (`limit` acotado en servidor) y paginación determinista para impedir extracción masiva. | MCP | Fase B |
| **REQ-EA-010** | Los usuarios deben poder listar sus conexiones MCP activas, consultar su historial de invocaciones y revocar cualquier conexión con efecto inmediato; `ORG_ADMIN` y `ORG_OWNER` deben poder ver y revocar conexiones de cualquier miembro de su organización. | MCP | Fase B |
| **REQ-EA-011** | La organización (`ORG_OWNER` / `ORG_ADMIN`) debe poder habilitar o deshabilitar el Conector MCP a nivel estudio (interruptor maestro organizacional, desactivado por defecto `opt-in`). | MCP | Fase B |
| **REQ-EA-012** | Ninguna herramienta de escritura puede estar registrada ni invocable durante Fase B; la habilitación futura (Fase C/D) requerirá flags explícitos, permisos de escritura, idempotencia y confirmación humana para acciones sensibles. | MCP | Fase C/D |

---

## 4. Catálogo inicial de herramientas MCP de consulta (Evaluación detallada)

> [!IMPORTANT]
> **Regla de honestidad técnica:** De las 11 herramientas solicitadas para evaluación, **7 cuentan con módulo real completo**, **1 es viable de forma derivada y acotada (`consultar_alertas`)** y **3 están BLOQUEADAS por ausencia de módulo de dominio en el repositorio actual (`listar_tareas`, `consultar_honorarios`, `consultar_estado_cobranza`)**. Ninguna herramienta bloqueada puede exponerse con datos simulados ni en Fase B.

### Resumen de disponibilidad real
| Herramienta | Estado de viabilidad actual | Módulo subyacente real | Fase destino |
| :--- | :--- | :--- | :---: |
| `buscar_expedientes` | **DISPONIBLE** | AUTH-06 (`ExpedientesService` / `Expediente`) | Fase B |
| `obtener_expediente` | **DISPONIBLE** | AUTH-06 (`ExpedientesService` / `Expediente`) | Fase B |
| `obtener_partes_expediente` | **DISPONIBLE** | AUTH-06 (`ExpedientesService` / `ExpedienteParte`) | Fase B |
| `listar_movimientos` | **DISPONIBLE** | AUTH-07 (`MovimientosService` / `MovimientoProcesal`) | Fase B |
| `consultar_vencimientos` | **DISPONIBLE** | AUTH-07 (`VencimientosService` / `Vencimiento`) | Fase B |
| `buscar_clientes` | **DISPONIBLE** | AUTH-05 (`ClientsService` / `Client`) | Fase B |
| `buscar_documentos` | **DISPONIBLE (metadatos por defecto)** | AUTH-08 (`DocumentsManagementService` / `Document`) | Fase B |
| `consultar_alertas` | **PARCIAL / DERIVADA** | AUTH-07 (`Vencimiento` próximos/vencidos/críticos; no existe tabla `Alert`) | Fase B *(acotada)* |
| `listar_tareas` | **BLOQUEADA (módulo inexistente)** | Inexistente (`schema.prisma` sin tabla `Task`/`Tarea`) | Post-módulo Tareas |
| `consultar_honorarios` | **BLOQUEADA (módulo inexistente)** | Inexistente (`schema.prisma` sin modelos ni permisos financieros) | Post-módulo Finanzas |
| `consultar_estado_cobranza` | **BLOQUEADA (módulo inexistente)** | Inexistente (`schema.prisma` sin facturación/pagos ni permisos financieros) | Post-módulo Finanzas |

---

### 4.1. `buscar_expedientes` *(Disponible — Fase B)*
1. **Propósito:** Buscar y listar expedientes autorizados de la organización activa mediante filtros estructurados y texto libre acotado.
2. **Parámetros de entrada:** `query?: string` (máx. 120 chars), `estado?: ExpedienteEstado`, `fuero?: string`, `jurisdiccion?: string`, `responsableId?: UUID`, `page?: number` (default `1`), `limit?: number` (default `10`, máx. `25`).
3. **Validaciones:** Schema estricto (rechazo de campos desconocidos como `organizationId`), enums validados contra `ExpedienteEstado`, `query` sanitizado y longitud acotada, `page >= 1`, `1 <= limit <= 25`.
4. **Permiso requerido:** `external_assistants:connect` + `cases:read` (ver proyección según rol).
5. **Datos que puede devolver:** Lista acotada de `{ id, numeroExpediente, caratula, juzgado, jurisdiccion, provincia, fuero, tipoProceso, materia, estado, fechaInicio, updatedAt }` (para `ASSISTANT+` incluye `responsable.fullName`; **nunca** devuelve notas internas completas ni datos de contacto de clientes en listado).
6. **Límites de resultados:** Máximo **25 registros por llamada**, tope de payload JSON **32 KB**.
7. **Paginación:** `{ items, page, limit, total, hasMore }` ordenada por `updatedAt DESC, id ASC`.
8. **Riesgos de privacidad:** Enumeración masiva de la cartera del estudio y exposición de carátulas con nombres de personas físicas a un proveedor externo. Mitigación: tope de 25 por página, rate-limit y exclusión de `descripcion`/notas.
9. **Auditoría:** Registro en `AuditLog` (`action = "MCP_TOOL_CALL"`, `tool = "buscar_expedientes"`, filtros sanitizados sin texto sensible excesivo, `resultCount`, `correlationId`).
10. **Dependencias:** `ExpedientesService.findAll()` (AUTH-06), `ScopedPrismaService`, `EXPEDIENTE_SELECT_BY_ROLE`.

### 4.2. `obtener_expediente` *(Disponible — Fase B)*
1. **Propósito:** Recuperar el detalle estructurado de un expediente específico perteneciente a la organización activa.
2. **Parámetros de entrada:** `expedienteId: UUID` (obligatorio), `incluirNotasInternas?: boolean` (default `false`; ignorado/rechazado si rol es `STAFF`).
3. **Validaciones:** `expedienteId` debe ser UUID v4 válido; rechazo fail-closed (`404 Not Found`) si no existe en `ctx.organizationId` (sin revelar existencia en otro tenant).
4. **Permiso requerido:** `external_assistants:connect` + `cases:read`.
5. **Datos que puede devolver:** Ficha completa según `EXPEDIENTE_SELECT_BY_ROLE[orgRole]` excluyendo siempre `FORBIDDEN_RESPONSE_FIELDS`; `descripcion` (notas internas) solo para `ASSISTANT+` cuando `incluirNotasInternas=true`, acotada a 2.000 chars y envuelta en delimitadores no confiables. Incluye conteos agregados (`partesCount`, `movimientosCount`, `vencimientosPendientesCount`, `documentosCount`).
6. **Límites de resultados:** 1 expediente; payload máximo **24 KB**.
7. **Paginación:** No aplica (recurso puntual).
8. **Riesgos de privacidad:** Exposición de estrategia procesal en `descripcion` y potencial prompt injection embebido en notas o carátula. Mitigación: `incluirNotasInternas=false` por defecto + encapsulado anti-prompt-injection (`SEC-EA-021`).
9. **Auditoría:** `AuditLog` con `entityTable = "Expediente"`, `entityId = expedienteId`, `incluirNotasInternas`, `correlationId`.
10. **Dependencias:** `ExpedientesService.findById()` (AUTH-06), `ScopedPrismaService`, RLS en `Expediente`.

### 4.3. `listar_movimientos` *(Disponible — Fase B)*
1. **Propósito:** Listar movimientos procesales activos (no anulados) de un expediente o de la organización dentro de una ventana temporal.
2. **Parámetros de entrada:** `expedienteId?: UUID`, `tipo?: TipoMovimientoProcesal`, `desde?: ISO8601`, `hasta?: ISO8601`, `page?: number` (default `1`), `limit?: number` (default `15`, máx. `30`).
3. **Validaciones:** Al menos `expedienteId` o rango `desde..hasta` (ventana máxima 180 días si no se indica `expedienteId`); validación de UUID y enum `TipoMovimientoProcesal`; excluye `anuladoAt != null` por defecto.
4. **Permiso requerido:** `external_assistants:connect` + `cases:read`.
5. **Datos que puede devolver:** `{ id, expedienteId, expediente: { numeroExpediente, caratula }, tipo, titulo, descripcion (truncada a 500 chars; omitida para STAFF), fechaActuacion, origen, referencia }` según `MOVIMIENTO_SELECT_BY_ROLE`. Nunca incluye `metadatos` internos arbitrarios sin whitelist.
6. **Límites de resultados:** Máximo **30 registros por llamada**; payload máximo **32 KB**.
7. **Paginación:** `{ items, page, limit, total, hasMore }` ordenada por `fechaActuacion DESC, id ASC`.
8. **Riesgos de privacidad:** Filtración de resoluciones sensibles o prompt injection en `descripcion` de proveídos copiados de tribunales. Mitigación: truncado a 500 chars + delimitadores de contenido no confiable.
9. **Auditoría:** `AuditLog` con `entityTable = "MovimientoProcesal"`, `expedienteId` (si aplica), `resultCount`, `correlationId`.
10. **Dependencias:** `MovimientosService.findAll()` (AUTH-07), `ScopedPrismaService`, `MOVIMIENTO_SELECT_BY_ROLE`.

### 4.4. `consultar_vencimientos` *(Disponible — Fase B)*
1. **Propósito:** Consultar vencimientos registrados manualmente en el estudio por estado, prioridad, expediente o rango de fechas.
2. **Parámetros de entrada:** `expedienteId?: UUID`, `estado?: EstadoVencimiento`, `prioridad?: PrioridadVencimiento`, `desde?: ISO8601`, `hasta?: ISO8601`, `soloProximosDias?: number` (1..90), `page?: number` (default `1`), `limit?: number` (default `20`, máx. `50`).
3. **Validaciones:** Enums estrictos (`EstadoVencimiento`, `PrioridadVencimiento`), fechas ISO válidas, `1 <= limit <= 50`. Incluye siempre en la respuesta la advertencia explícita `origenFechaLimite: "MANUAL"` (nunca implica cómputo legal automático).
4. **Permiso requerido:** `external_assistants:connect` + `agenda:read`.
5. **Datos que puede devolver:** `{ id, expedienteId, expediente: { numeroExpediente, caratula }, titulo, tipo, fechaLimite, origenFechaLimite, prioridad, estado, responsable: { fullName }, descripcion (solo ASSISTANT+, máx. 400 chars) }` según `VENCIMIENTO_SELECT_BY_ROLE`.
6. **Límites de resultados:** Máximo **50 registros por llamada**; payload máximo **32 KB**.
7. **Paginación:** `{ items, page, limit, total, hasMore }` ordenada por `fechaLimite ASC, id ASC`.
8. **Riesgos de privacidad:** Riesgo bajo-medio (expone agenda procesal y fechas críticas del estudio). Riesgo jurídico de que el asistente recalcule plazos erróneamente; mitigado mediante campo explícito de advertencia `manualDeadlineNotice`.
9. **Auditoría:** `AuditLog` con `entityTable = "Vencimiento"`, filtros usados, `resultCount`, `correlationId`.
10. **Dependencias:** `VencimientosService.findAll()` (AUTH-07), `ScopedPrismaService`, `VENCIMIENTO_SELECT_BY_ROLE`.

### 4.5. `listar_tareas` *(BLOQUEADA — Módulo de Tareas inexistente)*
1. **Propósito:** Listar tareas operativas asignadas a integrantes del estudio, vinculadas o no a expedientes.
2. **Parámetros de entrada (propuestos para cuando exista el módulo):** `expedienteId?: UUID`, `assigneeId?: UUID`, `status?: TaskStatus`, `priority?: TaskPriority`, `dueBefore?: ISO8601`, `page?: number`, `limit?: number` (máx. `30`).
3. **Validaciones:** UUIDs, enums de estado/prioridad, `1 <= limit <= 30`.
4. **Permiso requerido:** `external_assistants:connect` + futuro permiso `tasks:read` (inexistente hoy en `permissions.ts`).
5. **Datos que puede devolver:** `{ id, title, status, priority, dueDate, expedienteId, assigneeName, updatedAt }` (sin notas privadas internas salvo opt-in).
6. **Límites de resultados:** Máximo **30 registros por llamada**.
7. **Paginación:** `{ items, page, limit, total, hasMore }`.
8. **Riesgos de privacidad:** Exposición de carga laboral y tareas confidenciales del equipo.
9. **Auditoría:** `AuditLog` con `entityTable = "Task"`, `resultCount`, `correlationId`.
10. **Dependencias:** **BLOQUEADA.** No existe tabla `Task`/`Tarea` en `schema.prisma` ni `TasksModule` en `backend/src/`. **No debe registrarse en Fase B**; su activación queda condicionada a la implementación previa de un módulo de Tareas con RLS `ENABLE + FORCE` y RBAC.

### 4.6. `buscar_clientes` *(Disponible — Fase B, con minimización estricta de PII)*
1. **Propósito:** Localizar clientes registrados en la organización activa por nombre/razón social, estado o tipo de persona.
2. **Parámetros de entrada:** `query?: string` (mín. 2 chars, máx. 100 chars — **obligatorio** o filtro `status` para impedir volcado sin filtro), `personType?: ClientPersonType`, `status?: ClientStatus`, `page?: number` (default `1`), `limit?: number` (default `10`, máx. `20`).
3. **Validaciones:** Exige al menos `query` (>= 2 chars) para prevenir extracción masiva de toda la cartera de clientes; `1 <= limit <= 20`.
4. **Permiso requerido:** `external_assistants:connect` + `clients:read`.
5. **Datos que puede devolver (minimizado por defecto):** `{ id, personType, firstName, lastName, status, city, province, dniCuitMasked }` (**por defecto `dniCuit` enmascarado** ej. `***-****456-*`, y **excluye** `email`, `phone`, `address` y `notes` de la respuesta de listado para minimizar PII enviada a terceros; la inclusión de contacto requiere política explícita de organización `DEC-EA-PRIV-01`).
6. **Límites de resultados:** Máximo **20 registros por llamada**; payload máximo **16 KB**.
7. **Paginación:** `{ items, page, limit, total, hasMore }` ordenada por `firstName ASC, id ASC`.
8. **Riesgos de privacidad:** **ALTO.** Alta concentración de datos personales (PII: DNI/CUIT, domicilio, teléfono, correo, notas confidenciales) bajo Ley 25.326 (Argentina) y secreto profesional. Mitigación: búsqueda acotada obligatoria, enmascaramiento por defecto, exclusión de `notes` y tope estricto de 20 resultados + rate-limit por hora.
9. **Auditoría:** `AuditLog` (`action = "MCP_TOOL_CALL"`, `entityTable = "Client"`, **sin registrar valores PII devueltos**, solo `resultCount`, `queryLength`, `correlationId`).
10. **Dependencias:** `ClientsService.findAll()` (AUTH-05), `ScopedPrismaService`, `CLIENT_SELECT_BY_ROLE` (aplicando proyección MCP aún más restrictiva).

### 4.7. `obtener_partes_expediente` *(Disponible — Fase B)*
1. **Propósito:** Consultar las partes procesales (actora, demandada, terceros, etc.) registradas en un expediente autorizado.
2. **Parámetros de entrada:** `expedienteId: UUID` (obligatorio), `page?: number` (default `1`), `limit?: number` (default `25`, máx. `50`).
3. **Validaciones:** `expedienteId` UUID v4 válido; verificación de pertenencia a `ctx.organizationId`; **bloqueada para rol `STAFF`** (en AUTH-06 `EXPEDIENTE_STAFF_SELECT` no expone `partes`).
4. **Permiso requerido:** `external_assistants:connect` + `cases:read` + rol `ASSISTANT` o superior (coherente con `EXPEDIENTE_SELECT_BY_ROLE`).
5. **Datos que puede devolver:** `{ id, nombre, tipoParte, rol, caracter, esCliente, clientId, cuitDniMasked }` (excluye `email`/`phone` de `client` y omite `observaciones` sensibles salvo política explícita).
6. **Límites de resultados:** Máximo **50 partes por llamada**; payload máximo **24 KB**.
7. **Paginación:** `{ items, page, limit, total, hasMore }`.
8. **Riesgos de privacidad:** **MEDIO-ALTO.** Exposición de identidades y DNI/CUIT de terceros y contrapartes. Mitigación: enmascaramiento de `cuitDni`, exclusión de datos de contacto, restricción a `ASSISTANT+`.
9. **Auditoría:** `AuditLog` con `entityTable = "ExpedienteParte"`, `entityId = expedienteId`, `resultCount`, `correlationId`.
10. **Dependencias:** `ExpedientesService` / `ExpedienteParte` (AUTH-06), `ScopedPrismaService`, `EXPEDIENTE_SELECT_BY_ROLE`.

### 4.8. `buscar_documentos` *(Disponible — Fase B, metadatos por defecto)*
1. **Propósito:** Buscar y listar metadatos de documentos activos gestionados en AUTH-08 (`Document` + versión actual), filtrados por expediente, cliente, categoría o título.
2. **Parámetros de entrada:** `expedienteId?: UUID`, `clientId?: UUID`, `category?: DocumentCategory`, `query?: string` (máx. 100 chars), `incluirExtracto?: boolean` (default `false`), `page?: number` (default `1`), `limit?: number` (default `10`, máx. `20`).
3. **Validaciones:** Enums contra `DocumentCategory`, `status = ACTIVE` siempre forzado; si `incluirExtracto = true`, requiere `limit <= 3`, permiso `documents:read` (rechazado para `STAFF`, que solo posee `documents:metadata_read`), y flag organizacional habilitado (`allowExternalDocumentExcerpts`).
4. **Permiso requerido:** `external_assistants:connect` + `documents:metadata_read` (solo metadatos) / `documents:read` (si `incluirExtracto = true`). **Nunca** accede a documentos restringidos/sensibles (`documents:sensitive`) ni entrega binarios ni `storageKey`.
5. **Datos que puede devolver:** Por defecto solo metadatos seguros `{ id, title, category, documentDate, status, currentVersionNumber, expedienteId, clientId, originalFilename, mimeType, sizeBytes, updatedAt }` (excluyendo siempre `storageKey`/`storagePath`). Si `incluirExtracto = true` y está autorizado, un extracto textual acotado (máx. 3.000 chars por documento) obtenido vía `DocumentTextExtractorService` y envuelto en `<UNTRUSTED_DOCUMENT_DATA>`.
6. **Límites de resultados:** Máximo **20 registros** en modo metadatos; máximo **3 documentos** (y 9.000 chars totales) si `incluirExtracto = true`.
7. **Paginación:** `{ items, page, limit, total, hasMore }` ordenada por `updatedAt DESC, id ASC`.
8. **Riesgos de privacidad:** **CRÍTICO.** Exfiltración de contratos, demandas, prueba confidencial y **prompt injection** incrustado en archivos PDF/DOCX aportados por terceros o contrapartes. Mitigación: solo metadatos por defecto, opt-in organizacional para extractos, límites duros de bytes/caracteres, exclusión de documentos marcados sensibles y encapsulado anti-injection (`SEC-EA-020`, `SEC-EA-021`).
9. **Auditoría:** `AuditLog` con `entityTable = "Document"`, `incluirExtracto`, IDs de documentos devueltos (si se extrajo texto), `correlationId`, **nunca** el contenido textual del documento.
10. **Dependencias:** `DocumentsManagementService` (AUTH-08), `DocumentTextExtractorService` (AUTH-10), `DOCUMENT_SELECT_BY_ROLE`, `FORBIDDEN_RESPONSE_FIELDS`. *(Nota: excluye deliberadamente la tabla legacy `Documento`.)*

### 4.9. `consultar_honorarios` *(BLOQUEADA — Módulo de Honorarios inexistente)*
1. **Propósito:** Consultar acuerdos de honorarios, regulación judicial o estado de honorarios por expediente o cliente.
2. **Parámetros de entrada (propuestos):** `expedienteId?: UUID`, `clientId?: UUID`, `status?: FeeStatus`, `page?: number`, `limit?: number` (máx. `20`).
3. **Validaciones:** UUIDs, enums financieros, rechazo estricto si el usuario carece de permiso financiero.
4. **Permiso requerido:** `external_assistants:connect` + futuro permiso granular `finance:read` / `fees:read` (inexistente hoy; restringido a roles autorizados ej. `ORG_OWNER` / `ORG_ADMIN` y socios/abogados habilitados, jamás `STAFF`).
5. **Datos que puede devolver:** Resumen estructurado sin datos bancarios ni CBU/cuentas sensibles.
6. **Límites de resultados:** Máximo **20 registros por llamada**.
7. **Paginación:** `{ items, page, limit, total, hasMore }`.
8. **Riesgos de privacidad:** **ALTO.** Información comercial y financiera sensible del estudio y sus clientes.
9. **Auditoría:** `AuditLog` con `entityTable = "Fee"` (futuro), `correlationId`, sin registrar importes en logs planos de aplicación.
10. **Dependencias:** **BLOQUEADA.** No existe modelo, tabla, servicio ni permisos de honorarios en el repositorio. **Excluida de Fase B.**

### 4.10. `consultar_estado_cobranza` *(BLOQUEADA — Módulo de Cobranza/Facturación inexistente)*
1. **Propósito:** Consultar saldos pendientes, cuotas vencidas y estado de cobranza de clientes o expedientes.
2. **Parámetros de entrada (propuestos):** `clientId?: UUID`, `expedienteId?: UUID`, `status?: CollectionStatus`, `desde?: ISO8601`, `hasta?: ISO8601`, `page?: number`, `limit?: number` (máx. `20`).
3. **Validaciones:** UUIDs, rango de fechas acotado, permisos financieros estrictos.
4. **Permiso requerido:** `external_assistants:connect` + futuro permiso granular `billing:read` / `finance:read` (inexistente hoy).
5. **Datos que puede devolver:** Estado agregado de cobranza sin exponer comprobantes fiscales completos, tarjetas ni datos bancarios.
6. **Límites de resultados:** Máximo **20 registros por llamada**.
7. **Paginación:** `{ items, page, limit, total, hasMore }`.
8. **Riesgos de privacidad:** **ALTO.** Datos patrimoniales, morosidad de clientes y facturación del estudio.
9. **Auditoría:** `AuditLog` con `entityTable = "Invoice"`/`"Collection"` (futuro), `correlationId`.
10. **Dependencias:** **BLOQUEADA.** No existe módulo de facturación/cobranza en el repositorio. **Excluida de Fase B.**

### 4.11. `consultar_alertas` *(PARCIAL / DERIVADA en Fase B)*
1. **Propósito:** Consultar alertas operativas vigentes de vencimientos próximos, vencimientos críticos o eventos inminentes de la organización activa.
2. **Parámetros de entrada:** `severidad?: "CRITICA" | "ALTA" | "NORMAL"`, `ventanaDias?: number` (default `7`, máx. `30`), `expedienteId?: UUID`, `page?: number` (default `1`), `limit?: number` (default `20`, máx. `30`).
3. **Validaciones:** `1 <= ventanaDias <= 30`, `1 <= limit <= 30`, UUID opcional validado.
4. **Permiso requerido:** `external_assistants:connect` + `agenda:read`.
5. **Datos que puede devolver:** Vista derivada en tiempo de lectura sobre `Vencimiento` (AUTH-07) con `estado IN (PENDIENTE, EN_CURSO)` vencidos o dentro de `ventanaDias` y `AgendaEvent` (`PROGRAMADO`/`CONFIRMADO`) próximos: `{ alertType, severity, sourceTable, sourceId, titulo, fechaReferencia, expedienteId, expedienteCaratula, manualDeadlineNotice }`. *(Nota: NO depende de `EventoAgenda` legacy salvo decisión de migración.)*
6. **Límites de resultados:** Máximo **30 alertas por llamada**; payload máximo **24 KB**.
7. **Paginación:** `{ items, page, limit, total, hasMore }` ordenada por severidad y `fechaReferencia ASC`.
8. **Riesgos de privacidad:** Bajo-medio (similar a `consultar_vencimientos`).
9. **Auditoría:** `AuditLog` (`action = "MCP_TOOL_CALL"`, `tool = "consultar_alertas"`, `resultCount`, `correlationId`).
10. **Dependencias:** `VencimientosService` y `AgendaEventsService` (AUTH-07). Si en el futuro se crea un motor dedicado de alertas judiciales (p. ej. notificaciones PJN/SCBA), esta herramienta podrá ampliarse sin romper contrato.

---

## 5. Evaluación de herramientas MCP de escritura futura (NO habilitadas en MVP / Fase B)

> [!WARNING]
> **Restricción obligatoria:** Ninguna herramienta de escritura se habilita en Fase B. Toda escritura futura requiere: (1) permiso específico de escritura en `OrgPermission`, (2) clave `idempotencyKey` obligatoria, (3) política organizacional que habilite escrituras MCP (`allowMcpWrites`, desactivada por defecto) y (4) confirmación explícita del abogado para acciones con impacto procesal o sobre terceros.

### 5.1. Evaluación de las 5 herramientas candidatas de escritura
| Herramienta | Viabilidad técnica actual | Permiso requerido | Confirmación explícita del abogado | Fase propuesta y observaciones |
| :--- | :--- | :--- | :---: | :--- |
| `crear_tarea` | **BLOQUEADA** (módulo de Tareas inexistente) | Futuro `tasks:write` | Recomendada (o borrador de tarea) | **Fase C.2** — Solo tras implementar módulo de Tareas con RLS y RBAC. |
| `agregar_nota` | **REQUIERE DISEÑO DE ENTIDAD** (hoy no existe tabla `Note`; solo `Expediente.descripcion` sobrescribible) | `cases:write` (o futuro `notes:write`) | **SÍ** (evitar sobrescribir notas existentes; crear nota append-only marcada `origen = MCP_ASSISTANT`) | **Fase C.2** — No sobrescribir `Expediente.descripcion`; crear entidad `ExpedienteNota` append-only auditada. |
| `crear_evento` | **VIABLE** sobre `AgendaEvent` (AUTH-07) | `agenda:write` | **SÍ** (confirmación humana previa vía Action Ticket o vista previa antes de persistir) | **Fase C.1** — Invoca `AgendaEventsService.create()` con `idempotencyKey` y trazabilidad de origen MCP. |
| `crear_vencimiento` | **VIABLE** sobre `Vencimiento` (AUTH-07) | `agenda:write` | **OBLIGATORIA (reforzada)** — Un vencimiento erróneo tiene riesgo de mala praxis | **Fase C.1 / D** — Exige fecha límite explícita confirmada por el abogado (`origenFechaLimite = MANUAL`, jamás fecha calculada por el LLM sin confirmación humana). |
| `registrar_movimiento` | **VIABLE** sobre `MovimientoProcesal` (AUTH-07) | `cases:write` | **OBLIGATORIA (reforzada)** — Altera historial procesal del expediente | **Fase D** — Requiere confirmación humana explícita en UI/Action Ticket antes de asentar; jamás permite anular movimientos existentes. |

### 5.2. Operaciones estrictamente prohibidas / fuera del alcance del conector MCP
Quedan **terminantemente excluidas** del conector MCP (no deben declararse ni exponerse):
1. Eliminar o archivar expedientes (`cases:delete`).
2. Eliminar o archivar documentos (`documents:delete`) o modificar `legalHold` / `isLocked`.
3. Registrar pagos o movimientos de caja/tesorería.
4. Modificar, regular o condonar honorarios.
5. Cambiar permisos, roles, membresías o invitaciones (`members:manage`, `members:change_role`, `org:transfer_ownership`, `org:manage_status`).
6. Cambiar datos de autenticación, contraseñas, sesiones BFF, credenciales judiciales (`JudicialAccount`) o políticas de seguridad.
7. Ejecutar presentaciones judiciales ante portales de tribunales (PJN, MEV/SCBA, etc.).
8. Enviar comunicaciones externas automáticamente (correos a clientes, WhatsApp, cédulas, notificaciones a contrapartes).
9. Ejecutar cualquier operación financiera, bancaria o de facturación.

---

## 6. Créditos y modelo comercial (Análisis sin tarifas definitivas)

En coherencia con [LEGAL-AI-CREDITS-SPEC-001.md](./LEGAL-AI-CREDITS-SPEC-001.md) (`v1.1.0`), se separan estrictamente **seis conceptos comerciales independientes** para evitar cobros arbitrarios o confusión del cliente:

| # | Concepto | Quién asume el costo de inferencia LLM | Relación con créditos de Abogados-Law | Regla de diseño |
| :---: | :--- | :--- | :--- | :--- |
| 1 | **Biblioteca de prompts manuales** | El usuario en su cuenta externa | **Gratuita (`0` créditos)** | Incluida en la plataforma; **NO requiere MCP** ni plan especial. |
| 2 | **Activación del conector MCP** | Sin inferencia LLM | **Sin tarifa fijada (`DEC-EA-COM-01`)** | **Prohibido establecer un cargo arbitrario de 150 créditos por activación** sin decisión comercial documentada y justificada. |
| 3 | **Operaciones MCP de consulta de datos** | El asistente externo (ChatGPT/Claude del usuario) | **NO consumen créditos de investigación jurídica** | Consultar un expediente o recuperar datos estructurados vía MCP no consume OpenAI de Abogados-Law; se controla por plan y rate-limits, no cobrando créditos de IA jurídica. |
| 4 | **Operaciones MCP de escritura futura** | El asistente externo | **A definir (`DEC-EA-COM-02`)** | Incluidas en el plan habilitado con límites operativos de seguridad (no cobran inferencia LLM de Abogados-Law). |
| 5 | **Investigaciones jurídicas premium de Abogados-Law** *(Jurisprudencia IA / Normativa IA)* | **Abogados-Law (`LEGAL_AI_PROVIDER`)** | **Consumen créditos según `LEGAL-AI-CREDITS-SPEC-001`** *(ref. `≈ 0,4` créditos = `4.000 microCredits`)* | Si en una fase muy posterior existiera una herramienta MCP que dispare una investigación premium interna, exigirá confirmación explícita previa con costo visible y reserva en `CreditsLedgerService`. |
| 6 | **Suscripción externa a ChatGPT o Claude** | Proveedor externo (OpenAI / Anthropic) | **Completamente ajena a Abogados-Law** | El estudio contrata y paga directamente su cuenta en ChatGPT/Claude; la UI debe aclararlo explícitamente. |

### Alternativas comerciales propuestas para decisión del propietario (`DEC-EA-COM-01`)
- **Alternativa A (Recomendada — Inclusión por plan):** Incluir el Conector MCP en planes `PRO` y `ENTERPRISE` (y opcionalmente como add-on mensual en `STARTER`), con cuota justa de llamadas diarias/mensuales (rate-limit anti-abuso) y **`0` créditos de activación** y **`0` créditos por consulta estructurada**. *Ventaja:* elimina fricción de adopción y refleja fielmente el costo marginal real (solo cómputo API/BD, sin inferencia LLM).
- **Alternativa B (Add-on mensual fijo):** Comercializar el Conector MCP como complemento de suscripción mensual independiente del consumo de créditos de IA.
- **Alternativa C (Híbrida con cupo):** Incluir un volumen base de consultas MCP en el plan y aplicar topes de tasa diferenciados por nivel (`STARTER` / `PRO` / `ENTERPRISE`), reservando créditos exclusivamente para operaciones donde Abogados-Law incurre en costos de IA propia.

---

## 7. Decisiones abiertas vinculadas a esta especificación

| ID | Decisión pendiente del propietario |
| :--- | :--- |
| **DEC-EA-COM-01** | Seleccionar el modelo comercial de habilitación del Conector MCP (Alternativa A por plan, B add-on mensual o C híbrida; confirmación explícita de que NO se cobra tarifa fija de 150 créditos sin justificación). |
| **DEC-EA-COM-02** | Definir límites de tasa/cuota de llamadas MCP por plan (`STARTER`, `PRO`, `ENTERPRISE`). |
| **DEC-EA-PRIV-01** | Confirmar si `buscar_clientes` y `obtener_partes_expediente` mantienen `dniCuit` enmascarado y exclusión de email/teléfono de forma fija o configurable por `ORG_OWNER`/`ORG_ADMIN`. |
| **DEC-EA-SCOPE-01** | Confirmar si el módulo de **Tareas** y el módulo de **Honorarios/Cobranza** serán priorizados en un expediente aparte antes de habilitar `listar_tareas`, `crear_tarea`, `consultar_honorarios` y `consultar_estado_cobranza`. |
| **DEC-EA-NOTE-01** | Confirmar la creación de una entidad dedicada append-only `ExpedienteNota` para habilitar `agregar_nota` en Fase C.2 en lugar de mutar `Expediente.descripcion`. |

