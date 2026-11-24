# Abogado Virtual API Documentation

La API se encuentra documentada interactivamente vía **Swagger (OpenAPI)** en:

`GET http://localhost:3000/api`

## Autenticación

El sistema utiliza **Bearer Tokens (JWT)**.

1. **Login**: `POST /auth/login` con `email` y `password`. Retorna `access_token` y `refresh_token`.
2. **Uso**: Incluir header `Authorization: Bearer <access_token>` en endpoints protegidos.
3. **Refresh**: `POST /auth/refresh` con `{ "refresh_token": "..." }` cuando el access token expire (401).

## Endpoints Principales

### Auth
- `POST /auth/login`: Iniciar sesión.
- `POST /auth/refresh`: Renovar sesión.
- `POST /auth/logout`: Cerrar sesión.

### Expedientes
- `GET /expedientes`: Listar.
- `POST /expedientes`: Crear.
- `GET /expedientes/:id`: Detalles.

### Agenda
- `GET /agenda?expedienteId=...`: Listar eventos.
- `POST /agenda/eventos`: Crear evento.
- `POST /agenda/simular-vencimiento`: Calcular plazos fatales.

### IA & RAG
- `POST /ia/ask`: Chat con asistente jurídico.
- `POST /ia/analyze`: Análisis de documentos PDF/Texto para extracción de fechas.
