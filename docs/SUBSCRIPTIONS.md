# Sistema de Suscripciones y Planes

Control de acceso y cuotas basado en el plan contratado por la Organización.

## Estructura de Planes

### 1. STARTER (Gratuito / Demo)
*   **Usuarios**: Hasta 2.
*   **Expedientes**: Máx 50.
*   **IA Tokens**: 50k / mes (aprox. 50 consultas).
*   **Almacenamiento**: 1 GB.
*   **Features**: Gestión básica, IA limitada (GPT-3.5).

### 2. PRO (Estudios Pequeños/Medianos)
*   **Usuarios**: Hasta 10.
*   **Expedientes**: Ilimitados.
*   **IA Tokens**: 1M / mes (GPT-4o habilitado).
*   **Almacenamiento**: 50 GB.
*   **Features**: Portal Clientes, Integración Judicial, Automatización Documental.

### 3. ENTERPRISE (Grandes Firmas)
*   **Usuarios**: Ilimitados.
*   **IA Tokens**: Ilimitados (o pago por uso).
*   **Features**: Auditoría avanzada, SSO, SLA garantizado.

## Implementación de Límites (`SubscriptionGuard`)

Cada vez que se intenta crear un recurso (ej: `POST /expedientes`), el sistema verifica:
1.  Obtiene `TenantUsage` actual.
2.  Compara con los límites del `SubscriptionPlan` activo.
3.  Si `current >= max`, lanza `403 Payment Required`.

## Facturación
(Futuro) Integración con Stripe/MercadoPago para gestionar el ciclo de vida de la suscripción (upgrade/downgrade/cancel).
