# Integración con Sistemas Judiciales (Judicial Engine)

Este módulo es el encargado de sincronizar automáticamente los movimientos de los expedientes desde los portales oficiales del Poder Judicial (PJN, SCBA, etc.) hacia el sistema interno.

## Estrategia de Conexión

Dada la falta de APIs públicas estandarizadas en muchas jurisdicciones, el sistema utiliza una estrategia híbrida:

1.  **APIs Oficiales**: Donde estén disponibles (ej. algunos fueros de CSJN).
2.  **Scraping Seguro (Headless Browsers)**: Para portales legacy (PJN/Lex100, MEV).

## Arquitectura

### 1. Gestión de Credenciales (`JudicialAccount`)
*   Las credenciales (CUIT/Contraseña) de los abogados se almacenan **cifradas** (AES-256) en la base de datos.
*   Nunca se exponen en logs ni frontend.

### 2. Motor de Sincronización (`JudicialSyncService`)
*   Job asíncrono (Cron) que corre cada X horas (configurable por plan).
*   **Rate Limiting**: Respeta tiempos de espera para evitar bloqueos de IP por parte del PJ.
*   **Diffing**: Compara el último movimiento guardado con la lista online para insertar solo novedades.

### 3. Notificaciones
*   Cuando se detecta un nuevo despacho/movimiento, se dispara un evento interno.
*   Se puede configurar el envío de emails o alertas al abogado responsable.

## Endpoints

- `POST /judicial/accounts`: Vincular una cuenta del PJN/SCBA.
- `POST /judicial/sync/:expedienteId`: Forzar sincronización manual de un caso.
- `GET /judicial/movements/:expedienteId`: Ver historial sincronizado (vs local).

## Modelo de Datos

- `JudicialAccount`: Credenciales.
- `Expediente`: Campo `lastSyncAt`, `judicialUrl`.
- `EventoAgenda`: Se crean automáticamente eventos para "Despachos" o "Cédulas".

## Seguridad
El proceso de scraping corre en workers aislados para no bloquear el thread principal de Node.js.
