# Panel de Administración Master (Super Admin)

Herramienta interna para los administradores de la plataforma SaaS (no visible para los abogados clientes).

## Capacidades

1.  **Gestión de Tenants**:
    *   Listar todas las organizaciones registradas.
    *   Ver métricas de uso (usuarios, espacio, tokens IA).
    *   **Suspender** acceso (soft-ban) por falta de pago o abuso.
    *   **Impersonate**: Iniciar sesión como un usuario de un tenant para soporte técnico.

2.  **Métricas Globales de Salud**:
    *   Errores de sistema.
    *   Tiempos de respuesta de integraciones judiciales.
    *   Costos acumulados de OpenAI API.

## Seguridad

*   Ruta protegida por rol `SUPER_ADMIN` (definido a nivel sistema, fuera de la tabla normal de roles de usuario o mediante flag especial).
*   Requiere autenticación de doble factor (2FA) idealmente.

## Endpoints

*   `GET /admin/tenants`
*   `GET /admin/stats`
*   `POST /admin/tenants/:id/suspend`
