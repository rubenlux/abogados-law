# Especificación Técnica: Legal Pixel™ (Telemetría)

El **Legal Pixel** es el sistema de observabilidad y auditoría forense distribuido de la plataforma. Su objetivo es capturar cada interacción relevante dentro del ecosistema para fines de seguridad, control de productividad y análisis de negocio.

## 1. Arquitectura de Datos

### Modelo `EventLog`
Almacena eventos atómicos e inmutables.
*   `actorType`: Quién realizó la acción (USER, EMPLOYEE, SYSTEM).
*   `eventType`: Qué hizo (LOGIN, EXPORT_DOC, VIEW_CASE).
*   `payload`: JSON detallado con contexto (ej: ID del documento, filtros usados).
*   `riskScore`: Puntaje de anomalía calculado en tiempo real.

### Modelo `EmployeeMetric`
Agregación diaria (Roll-up) para dashboards rápidos.
*   Mide: Tiempo activo, Tickets resueltos, IA usada.

## 2. Ingestión de Datos
*   **Endpoint**: `POST /events/collect`
*   **Fire-and-forget**: El cliente no espera confirmación (tracking no bloqueante).
*   **Enriquecimiento**: El backend añade automáticamente IP, UserAgent y GeoIP (futuro).

## 3. Implementación Cliente (Frontend)

El cliente Web (`frontend`) debe implementar una clase Singleton `LegalPixel` que maneje:
1.  **Buffering**: Acumular eventos si la red falla (opcional).
2.  **Contexto Automático**: Inyectar Usuario ID y Sesión ID en cada evento.
3.  **Hooks**:
    *   `usePageCheck`: Trackeo automático de cambios de ruta.
    *   `trackAction()`: Para botones específicos.

## 4. Privacidad y Seguridad
*   Los payloads **nunca** deben contener contraseñas en texto plano ni información financiera sensible (PII) sin hashear.
*   El acceso a los logs crudos está restringido al rol `SUPER_ADMIN` en la `admin-platform`.
