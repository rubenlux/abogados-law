# Portal del Cliente (Client Portal)

El **Portal del Cliente** es una interfaz simplificada y segura diseñada para que los clientes del estudio jurídico puedan consultar el estado de sus causas en tiempo real, aumentando la transparencia y reduciendo la carga de consultas telefónicas/email al abogado.

## Arquitectura de Seguridad

1.  **Aislamiento**:
    *   El portal opera bajo un path base separado (`/portal` en frontend, `/client-portal` en backend).
    *   Usa un Guard específico (`ClientPortalGuard`) que valida tokens con el rol `CLIENT`.

2.  **Autenticación Simplificada**:
    *   **Acceso**: Email + Contraseña (o Magic Link en el futuro).
    *   **Scope**: Los tokens de cliente *solo* tienen permiso de lectura (`READ`) sobre los expedientes donde están explícitamente vinculados en la tabla `Client`.

3.  **Filtrado de Datos (Sanitization)**:
    *   No pueden ver notas internas privadas de los abogados.
    *   Solo pueden ver eventos de agenda marcados como "Públicos" o "Hitos Relevantes".
    *   Solo pueden descargar documentos que no tengan marca de "Interno/Confidencial".

## Funcionalidades para el Cliente

- **Dashboard Resumen**: Vista rápida de sus causas activas y últimas novedades.
- **Línea de Tiempo**: Visualización amigable de los hitos del expediente.
- **Gestor Documental**: Descarga de sentencias, cédulas y escritos presentados.
- **Pagos (Futuro)**: Visualización de honorarios y estados de cuenta.

## API Endpoints

### Auth
- `POST /client-portal/login`: Autenticación de clientes.

### Expedientes
- `GET /client-portal/cases`: Lista de causas vinculadas al usuario.
- `GET /client-portal/cases/:id`: Detalle sanitizado del expediente (`caratula`, `estado`, `juzgado`).

### Agenda & Novedades
- `GET /client-portal/cases/:id/timeline`: Lista de eventos filtrados.

## Modelo de Datos

Se utiliza la relación existente `Client` y `User` con rol `CLIENT`.
El backend filtra consultas usando `where: { client: { userId: currentUserId } }`.
