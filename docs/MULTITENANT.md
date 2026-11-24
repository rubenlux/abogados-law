# Arquitectura Multi-Tenant

El sistema está diseñado desde cero como una plataforma **SaaS Multi-tenant**. Esto significa que múltiples organizaciones (estudios jurídicos) comparten la misma infraestructura y base de datos, pero sus datos están lógicamente aislados de manera estricta.

## Estrategia de Aislamiento

1.  **Row-Level Security (Lógico)**:
    *   Todas las tablas críticas (`Expediente`, `Client`, `LegalDraft`, `LegalTemplate`, `JudicialAccount`) tienen una columna `organizationId`.
    *   No existen consultas globales. Cada query a la base de datos *debe* incluir `where: { organizationId }`.

2.  **Contexto de Ejecución**:
    *   El `organizationId` se extrae del JWT del usuario autenticado en cada petición.
    *   Se inyecta en el objeto `Request` mediante un Middleware/Guard global.

3.  **Gestión de Archivos**:
    *   Los archivos en disco/S3 se organizan en carpetas: `/uploads/{organizationId}/{expedienteId}/...` para evitar colisiones y accesos cruzados.

## Seguridad de Datos

*   **Tokens**: Los JWT firmados contienen el `orgId` en su payload inmutable.
*   **Fugas**: Se implementan tests de integración para asegurar que un usuario de la Org A reciba 403 Forbidden al intentar acceder a un recurso de la Org B, incluso si adivina el ID.

## Onboarding de Tenants

*   Proceso automatizado donde al registrarse un nuevo estudio:
    1.  Se crea la `Organization`.
    2.  Se crea el `User` administrador.
    3.  Se asigna el plan `STARTER` por defecto.
