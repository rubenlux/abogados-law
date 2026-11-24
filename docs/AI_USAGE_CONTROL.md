# Control de Consumo de IA (AI Usage Governance)

Sistema para monitorear, limitar y auditar el uso de los modelos de Lenguaje (LLMs) para controlar costos y asegurar el uso justo (Fair Use).

## Arquitectura de Control

1.  **Tracking por Request**:
    *   Cada llamada a `AIChatService` o `LegalRiskService` calcula los tokens de entrada (prompt) y salida (completion).
    *   Se registra en la tabla `AIInteraction` (granular) y se acumula en `TenantUsage` (agregado mensual).

2.  **Rate Limiting Semántico**:
    *   Límites de peticiones por minuto para evitar abusos de un solo usuario.

3.  **Alertas de Presupuesto**:
    *   Notificación automática al admin del estudio cuando se alcanza el 80% y 100% de la cuota de IA del mes.

4.  **Hard Cap**:
    *   Si se supera el 100% de la cuota del plan, las features de IA se deshabilitan o pasan a modo "Pay-as-you-go".

## Estimación de Costos
*   Se utiliza un tarifario interno actualizado para convertir tokens a USD estimado en tiempo real.
*   Permite a los estudios refacturar costos de IA a sus clientes si lo desean.
