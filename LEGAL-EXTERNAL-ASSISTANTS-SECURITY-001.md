# LEGAL-EXTERNAL-ASSISTANTS-SECURITY-001
## MODELO DE SEGURIDAD, AUTORIZACIÓN, PRIVACIDAD, REVOCACIÓN, AUDITORÍA Y MATRIZ DE RIESGOS — ASISTENTES EXTERNOS

| Campo | Valor |
| :--- | :--- |
| **Expediente** | `LEGAL-EXTERNAL-ASSISTANTS-SPEC-001` |
| **Versión** | `v1.0.0` |
| **Estado** | `BORRADOR — PENDIENTE DE APROBACIÓN FORMAL DEL PROPIETARIO` |
| **Fecha** | `2026-11-25` |
| **Autorización de implementación** | `NO AUTORIZADA` |
| **Documentos del paquete** | [LEGAL-EXTERNAL-ASSISTANTS-SPEC-001.md](./LEGAL-EXTERNAL-ASSISTANTS-SPEC-001.md) · [LEGAL-EXTERNAL-ASSISTANTS-MCP-ADR-001.md](./LEGAL-EXTERNAL-ASSISTANTS-MCP-ADR-001.md) · [LEGAL-EXTERNAL-ASSISTANTS-PROMPT-CATALOG-001.md](./LEGAL-EXTERNAL-ASSISTANTS-PROMPT-CATALOG-001.md) · [LEGAL-EXTERNAL-ASSISTANTS-ROADMAP-001.md](./LEGAL-EXTERNAL-ASSISTANTS-ROADMAP-001.md) |

### Historial de versiones
| Versión | Fecha | Expediente | Resumen de cambios |
| :--- | :--- | :--- | :--- |
| `v1.0.0` | `2026-11-25` | `LEGAL-EXTERNAL-ASSISTANTS-SPEC-001` | Definición de controles de identidad, autorización por llamada, aislamiento multi-tenant/RLS, revocación inmediata, auditoría, privacidad externa, defensa anti-prompt-injection y matriz de riesgos. |

---

## 1. Identidad y vinculación organizacional

| ID | Control obligatorio |
| :--- | :--- |
| **SEC-EA-001** | **Identidad individual obligatoria:** toda conexión MCP pertenece a un único `User.id` real autenticado mediante Auth0 / sesión BFF existente. Queda prohibida toda identidad técnica compartida, cuenta genérica de estudio o token multi-usuario. |
| **SEC-EA-002** | **Vinculación inmutable de organización:** cada `McpConnection` se vincula en el servidor a exactamente una `organizationId` (la organización activa verificada en el momento de autorizar la conexión). Si un profesional pertenece a dos estudios, deberá crear conexiones separadas; una conexión **jamás** puede cambiar de `organizationId`. |
| **SEC-EA-003** | **Prohibición de selección arbitraria por el asistente:** si una llamada MCP intenta suministrar `userId`, `organizationId`, `tenantId`, `role` o encabezados `x-org-id` / `x-organization-id`, el servidor debe rechazar la petición fail-closed con `403 Forbidden` (`ORGANIZATION_CONTEXT_MISMATCH`) y registrar el intento en `AuditLog`. |
| **SEC-EA-004** | **No reutilización de campos legacy:** la identidad y el rol se resuelven exclusivamente vía `McpConnection` + `OrganizationMembership` (`status = ACTIVE`) + `Organization` (`status = ACTIVE`). Jamás se confía en `User.organizationId` ni `User.role`. |

---

## 2. Autorización por llamada y principio de no-confianza en el modelo

> [!CAUTION]
> **Principio rector innegociable:** **El modelo de IA externo (ChatGPT, Claude u otro) NO es una autoridad de seguridad.** Las instrucciones de sistema del asistente, sus promesas de no pedir ciertos datos o sus afirmaciones sobre qué autorizó el usuario carecen de todo valor de seguridad. Todo control se aplica en el servidor en cada invocación.

| ID | Control obligatorio |
| :--- | :--- |
| **SEC-EA-005** | **Evaluación completa en cada invocación:** antes de ejecutar cualquier herramienta MCP (nunca solo al conectar), el servidor verifica secuencialmente: (1) validez criptográfica y temporal de la credencial, (2) estado `ACTIVE` y no revocado de `McpConnection`, (3) interruptor maestro organizacional `mcpEnabled === true`, (4) `Organization.status === ACTIVE`, (5) `OrganizationMembership.status === ACTIVE` con lectura en vivo de `membership.role`, (6) permiso organizacional específico de la herramienta (`OrgPermission`), (7) scope habilitado en la conexión y (8) alcance del recurso dentro del tenant. |
| **SEC-EA-006** | **Reutilización de `OrgPermission` (AUTH-04):** se reutilizan los permisos existentes (`cases:read`, `clients:read`, `agenda:read`, `documents:metadata_read`, `documents:read`, etc.) añadiendo únicamente 3 permisos específicos de gobierno del módulo (propuestos para Fase A/B, sin modificar AUTH-04 hasta autorización expresa): `external_assistants:read` (acceso a Biblioteca de Prompts: `STAFF+`), `external_assistants:connect` (conectar y usar MCP propio: `LAWYER+`, configurable en `DEC-EA-SEC-01`) y `external_assistants:manage_org` (habilitar/deshabilitar MCP del estudio y revocar conexiones de terceros: `ORG_ADMIN`, `ORG_OWNER`). |
| **SEC-EA-007** | **Fail-closed por defecto:** toda herramienta sin permiso explícito declarado, toda herramienta deshabilitada para la fase actual o todo módulo no implementado responde con denegación explícita (`403` / error MCP estandarizado `PERMISSION_DENIED` o `TOOL_NOT_AVAILABLE`) sin revelar existencia de registros. |
| **SEC-EA-008** | **Proyecciones mínimas por rol:** se aplican como techo las proyecciones existentes en `permissions.ts` (`*_SELECT_BY_ROLE`) y sobre ellas una proyección MCP más restrictiva (minimizando PII y excluyendo siempre `FORBIDDEN_RESPONSE_FIELDS`). |

---

## 3. Aislamiento multi-tenant y preservación de RLS

| ID | Control obligatorio |
| :--- | :--- |
| **SEC-EA-009** | **Cero excepciones a RLS:** no se añade `BYPASSRLS`, no se modifican políticas RLS existentes y no se crean vistas sin seguridad. Todas las nuevas tablas del módulo (`McpConnection`, `McpPrivacyConsent`, `McpPendingAction`) llevan `organizationId NOT NULL` + RLS `ENABLE + FORCE`. |
| **SEC-EA-010** | **Ejecución obligatoria vía `ScopedPrismaService`:** toda operación de negocio disparada por MCP corre dentro de `ScopedPrismaService.runInOrgContext(activeOrgContext, ...)` ejecutando `SELECT set_config('app.current_organization_id', $1, true)` (`SET LOCAL`) al inicio de la transacción y bloqueando cambios anidados de tenant vía `AsyncLocalStorage`. |
| **SEC-EA-011** | **Prevención de oráculo de existencia cross-tenant:** al invocar `obtener_expediente`, `obtener_partes_expediente` o `buscar_documentos` con un UUID perteneciente a otro estudio, la respuesta debe ser indistinguible de un UUID inexistente (`NOT_FOUND`), sin filtrar metadatos ni diferenciar `403` vs `404` sobre IDs ajenos. |

---

## 4. Revocación de conexiones, credenciales y tokens

| ID | Control obligatorio |
| :--- | :--- |
| **SEC-EA-012** | **Revocación individual y administrativa:** todo usuario autenticado en BFF puede consultar y revocar cualquiera de sus conexiones MCP activas (`POST /external-assistants/connections/:id/revoke`). `ORG_ADMIN` y `ORG_OWNER` (`external_assistants:manage_org`) pueden listar todas las conexiones activas de la organización, revocar cualquier conexión individual o ejecutar una **revocación masiva organizacional** ("kill switch" al desactivar MCP en el estudio). |
| **SEC-EA-013** | **Efecto inmediato sin ventana de gracia (`0 segundos`):** cada llamada MCP consulta en vivo el estado de `McpConnection` (`status = ACTIVE`, `revokedAt IS NULL`, `expiresAt > NOW()`) en PostgreSQL sin caché local de autorización. Al revocar una conexión, la marca `revokedAt = NOW()` y `status = REVOKED` invalida cualquier token asociado **inmediatamente (0 s de propagación)**, incluso si el JWT de acceso aún no expiró. Adicionalmente, si se usa OAuth 2.1 con refresh tokens en Auth0, el backend solicita la revocación del refresh token en Auth0 (best-effort sin depender de ella para el bloqueo inmediato). |
| **SEC-EA-014** | **Revocación automática en cascada ante cambios de acceso:** la suspensión o revocación de `OrganizationMembership`, el cambio de rol a uno sin `external_assistants:connect`, la suspensión de `Organization` o la revocación global de sesiones del usuario invalidan en el acto toda operación MCP en la siguiente invocación (y revocan en cascada las `McpConnection` afectadas). |
| **SEC-EA-015** | **Visibilidad de actividad:** el usuario puede consultar el historial de operaciones de sus conexiones (fecha/hora, cliente, herramienta, resultado, recurso) y `ORG_ADMIN`/`ORG_OWNER` pueden auditar el historial consolidado de la organización. |

---

## 5. Auditoría forense y minimización de logs

| ID | Control obligatorio |
| :--- | :--- |
| **SEC-EA-016** | **Registro auditable obligatorio en `AuditLog` (`OrgAuditService`):** toda conexión, aceptación de privacidad, revocación, llamada exitosa, llamada denegada (`DENIED`) o fallo (`FAILED`) de herramienta MCP genera un registro inmutable en `AuditLog` con: `userId` (actor), `organizationId`, `action` (`MCP_CONNECTION_CREATED`, `MCP_PRIVACY_ACCEPTED`, `MCP_CONNECTION_REVOKED`, `MCP_TOOL_CALL`, `MCP_TOOL_DENIED`, `MCP_ORG_KILL_SWITCH`), `result` (`SUCCESS`/`DENIED`/`FAILED`), `correlationId` (UUID), `entityTable`, `entityId` (cuando aplique), `ipAddress`, `userAgent` y `newValues` sanitizado con `{ connectionId, mcpClientName, toolName, durationMs, resultCount, responseBytes, truncated }`. |
| **SEC-EA-016b** | **Prohibición estricta de secretos y contenido sensible en logs:** nunca registrar tokens Bearer, refresh tokens, `codeVerifier`, hashes de sesión, contenido completo de documentos, cuerpos de escritos, notas internas ni valores de PII devueltos (DNI/CUIT, teléfonos, correos). Se hereda y amplía `SENSITIVE_KEY_PATTERN` de `OrgAuditService`. |

---

## 6. Privacidad, datos transferidos a terceros y defensa anti-prompt-injection

### 6.1. Advertencia obligatoria previa a activar el conector (`SEC-EA-017`)
Antes de habilitar o vincular cualquier asistente externo, Abogados-Law debe mostrar de forma bloqueante (con casilla de confirmación explícita registrada en `McpPrivacyConsent` con versión y fecha/hora) el siguiente texto de advertencia:

> **Advertencia de privacidad y confidencialidad profesional antes de conectar un asistente externo:**  
> Al activar el conector MCP, la información autorizada de tu estudio que consultes a través de ChatGPT, Claude u otro asistente externo será enviada a la plataforma de ese proveedor y quedará sujeta a sus propias políticas de almacenamiento, retención, entrenamiento y privacidad.  
> **Abogados-Law no controla ni puede eliminar el historial de conversaciones, memorias ni registros guardados en tu cuenta del asistente externo.**  
> Como profesional, sos responsable de verificar que el plan y la configuración de privacidad de tu asistente externo cumplan con el secreto profesional y la normativa vigente de protección de datos personales antes de compartir información de clientes o causas. Podés desconectar y revocar este acceso en cualquier momento desde Abogados-Law.

### 6.2. Controles técnicos de minimización, confidencialidad y anti-abuso
| ID | Control obligatorio |
| :--- | :--- |
| **SEC-EA-018** | **Minimización de datos y exclusión de campos innecesarios:** las respuestas MCP omiten por defecto `email`, `phone`, `address`, `notes` de clientes, `descripcion` de expedientes (opt-in explícito), `metadatos` crudos y enmascaran `dniCuit` / `cuitDni`. Se filtran siempre todas las claves de `FORBIDDEN_RESPONSE_FIELDS`. |
| **SEC-EA-019** | **Tratamiento de documentos confidenciales:** `buscar_documentos` devuelve **exclusivamente metadatos** por defecto. La extracción textual acotada (`incluirExtracto=true`) está desactivada por defecto a nivel organización, exige permiso `documents:read`, limita a 3 documentos / 3.000 chars por documento, excluye todo documento con categoría/marca confidencial o `documents:sensitive` y nunca devuelve binarios ni URLs de descarga directa. |
| **SEC-EA-020** | **Límites de tamaño, resultados y prevención de exposición masiva:** cada herramienta impone `limit` máximo en servidor (20–50 ítems) y tope de payload (16–32 KB). Se aplican límites de tasa en capas: por conexión (ej. 30 req/min), por usuario (ej. 300 req/día) y por organización (configurable por plan), más alertas de anomalía en `AuditLog` si una conexión realiza paginación secuencial acelerada (detección de bulk harvesting). |
| **SEC-EA-021** | **Defensa contra prompt injection contenido en documentos y causas:** todo texto no estructurado (descripciones de expedientes, descripciones de movimientos, extractos de documentos) se devuelve encapsulado con delimitadores explícitos (`<UNTRUSTED_STUDY_DATA ...>...</UNTRUSTED_STUDY_DATA>`) y bandera estructural `containsUntrustedUserOrThirdPartyText: true`, sin secuencias de control ocultas. En combinación con `ADR-EA-06` (confirmación humana obligatoria para escrituras), un documento malicioso **no puede** forzar la ejecución silenciosa de herramientas mutantes ni escalar permisos. |
| **SEC-EA-022** | **Entradas y salidas del asistente externo como datos no confiables:** todo parámetro enviado por el asistente externo se valida estrictamente con esquemas tipados (tipos, longitudes, UUIDs, enums, rechazo de propiedades extra, protección contra inyección SQL/HTML/XSS). Ninguna respuesta del asistente externo se persiste automáticamente en la base de datos sin validación de servidor y, en Fase C/D, confirmación humana explícita. |

---

## 7. Matriz formal de riesgos de seguridad

| ID Riesgo | Amenaza / Vector | Severidad | Controles de mitigación | Pruebas TDS vinculadas |
| :--- | :--- | :---: | :--- | :--- |
| **RISK-EA-01** | **Acceso cross-tenant:** el asistente intenta pasar un `organizationId` ajeno o un UUID de expediente/cliente de otro estudio. | **CRÍTICA** | `SEC-EA-002`, `SEC-EA-003`, `SEC-EA-009`, `SEC-EA-010`, `SEC-EA-011` (`ScopedPrismaService` + RLS `FORCE`). | `TDS-EA-003`, `TDS-EA-004`, `TDS-EA-008` |
| **RISK-EA-02** | **Escalada de privilegios / token compartido:** un usuario `STAFF` intenta leer partes, notas o extractos documentales, o un ex-miembro usa una conexión vieja. | **CRÍTICA** | `SEC-EA-001`, `SEC-EA-005`, `SEC-EA-006`, `SEC-EA-008`, `SEC-EA-014` (revalidación online por llamada). | `TDS-EA-001`, `TDS-EA-005`, `TDS-EA-009` |
| **RISK-EA-03** | **Prompt injection indirecto en PDF/DOCX/proveídos:** un documento de contraparte contiene instrucciones ocultas ordenando exfiltrar clientes o crear vencimientos falsos. | **ALTA** | `SEC-EA-021`, `SEC-EA-022`, Fase B solo lectura, `ADR-EA-06` (confirmación humana en Fase C/D), rate-limits. | `TDS-EA-017`, `TDS-EA-018`, `TDS-EA-023` |
| **RISK-EA-04** | **Exfiltración masiva de cartera de clientes o documentos:** el asistente itera páginas rápidamente para descargar toda la base del estudio a un proveedor externo. | **ALTA** | `SEC-EA-018`, `SEC-EA-019`, `SEC-EA-020` (`query` obligatorio en `buscar_clientes`, topes 16–32 KB, cuotas por hora/día, solo metadatos en docs). | `TDS-EA-011`, `TDS-EA-012`, `TDS-EA-015` |
| **RISK-EA-05** | **Fuga de secretos o credenciales internas:** exposición de `storageKey`, `passwordHash`, `encryptedPassword` (`JudicialAccount`) o tokens en respuestas o logs. | **CRÍTICA** | `FORBIDDEN_RESPONSE_FIELDS`, `SEC-EA-016b`, `ADR-EA-01` (solo servicios de dominio). | `TDS-EA-014`, `TDS-EA-016` |
| **RISK-EA-06** | **Persistencia post-revocación:** el usuario revoca la conexión pero un JWT previamente emitido sigue funcionando hasta expirar. | **ALTA** | `SEC-EA-012`, `SEC-EA-013` (validación online de `McpConnection.revokedAt` en 0 s sin caché). | `TDS-EA-006`, `TDS-EA-007` |
| **RISK-EA-07** | **Uso indebido de `SecurityContextGuard` legacy:** heredar el fallback `User.organizationId`/`User.role` de `FINDING-SEC-01`. | **ALTA** | `SEC-EA-004`, `ADR-EA-02` (guard MCP dedicado que revalida `OrganizationMembership` + `Organization` en vivo). | `TDS-EA-002`, `TDS-EA-005` |
| **RISK-EA-08** | **Violación de secreto profesional / Ley 25.326 sin consentimiento informado:** un abogado conecta una cuenta gratuita de ChatGPT con entrenamiento activado sin advertencia. | **ALTA** | `SEC-EA-017` (advertencia bloqueante + consentimiento versionado), interruptor maestro organizacional (`REQ-EA-011`). | `TDS-EA-013`, `TDS-EA-015` |
| **RISK-EA-09** | **Escrituras duplicadas o no deseadas en Fase C/D:** reintentos de red del asistente creando múltiples eventos/vencimientos o fechas erróneas inventadas por el LLM. | **ALTA** | `ADR-EA-06` (`idempotencyKey` + `UNIQUE`, confirmación humana obligatoria, `origenFechaLimite = MANUAL`). | `TDS-EA-021`, `TDS-EA-022`, `TDS-EA-023` |
| **RISK-EA-10** | **Suplantación de cliente o CSRF/DNS rebinding sobre `/mcp`:** páginas web maliciosas intentando llamar al endpoint MCP del usuario. | **MEDIA** | `ADR-EA-03` (Bearer explícito, cero cookies BFF en `/mcp`, validación estricta de `Origin`, HTTPS obligatorio). | `TDS-EA-001`, `TDS-EA-010` |

---

## 8. Decisiones de seguridad pendientes de aprobación

| ID | Decisión pendiente del propietario |
| :--- | :--- |
| **DEC-EA-SEC-01** | Definir qué roles reciben por defecto `external_assistants:connect` (recomendado: `LAWYER`, `ORG_ADMIN`, `ORG_OWNER`; evaluar si `ASSISTANT` puede conectarse con acceso solo a sus permisos). |
| **DEC-EA-SEC-02** | Confirmar TTL máximo de una `McpConnection` sin renovación (propuesta: 30 o 90 días con renovación explícita) y límites concretos de tasa por minuto/día. |
| **DEC-EA-SEC-03** | Confirmar si el interruptor maestro organizacional (`mcpEnabled`) arranca en `false` (opt-in explícito por `ORG_OWNER`/`ORG_ADMIN`, recomendado) para todas las organizaciones. |

