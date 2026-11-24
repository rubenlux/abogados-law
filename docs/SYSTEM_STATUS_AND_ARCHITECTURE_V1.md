# Abogado Virtual - Estado del Sistema y Arquitectura Final (v1.0-RC)

## 1. Módulos del Sistema (Monorepo Lógico)

### A. Legal Platform (El Cerebro Jurídico)
*   **Path**: `/frontend` (React + Vite)
*   **Puerto**: 5173
*   **Usuarios**: Abogados, Socios.
*   **Features Clave**:
    *   **Gestión de Expedientes**: CRUD completo con estados procesales.
    *   **Agenda Inteligente**: Calendario sincronizado con feriados judiciales.
    *   **Riesgo Legal (IA)**: Widget de semáforo (Rojo/Amarillo/Verde) basado en análisis de documentos.
    *   **Redacción Asistida**: Editor con panel lateral de IA (`/drafting`).
    *   **Chat Jurídico**: Interfaz RAG para interrogar expedientes.

### B. Admin Platform ("God Mode")
*   **Path**: `/admin-platform` (React + Vite + Tailwind v4)
*   **Puerto**: 5174 (automático si 5173 está ocupado)
*   **Usuarios**: Super Admins, Dueños del SaaS.
*   **Features Clave**:
    *   **Dashboard en Tiempo Real**: Gráficos de tráfico y riesgo.
    *   **Legal Pixel™ Viewer**: Feed en vivo de eventos de usuarios (Log de Auditoría).
    *   **System Health**: Estado de los microservicios.

### C. Backend Core (NestJS)
*   **Path**: `/backend`
*   **Puerto**: 3000
*   **Base de Datos**: PostgreSQL (vía Prisma ORM).
*   **Módulos Principales**:
    *   `AuthModule`: JWT con Roles (PARTNER, ASSOCIATE, ADMIN).
    *   `ExpedientesModule`: Lógica de negocio legal.
    *   `JudicialEngine`: (Simulado) Scraper de PJN/MEV.
    *   `AnalyticsModule`: Ingestión de eventos del Pixel.
    *   `SecurityCoreModule`: Criptografía forense (Hashing encadenado).

## 2. Telemetría y Seguridad Forense (Legal Pixel v2)

Implementamos un sistema de auditoría de grado bancario/forense:

1.  **Captura**: El frontend (`LegalPixel.ts`) intercepta navegación y acciones.
2.  **Ingestión**: Envía a `POST /events/collect`.
3.  **Inmutabilidad**:
    *   Cada evento se firma con HMAC (`ForensicService`).
    *   Se calcula un Hash SHA-256 que incluye el Hash del evento *anterior*.
    *   Resultado: Una "Block-chain" privada en la tabla `EventLog`.
4.  **Visualización**: El Admin Platform consume esto vía `/admin-api/logs`.

## 3. Correcciones Recientes y Estabilidad

*   **Fallback "Demo Mode"**: Si el backend cae (`EADDRINUSE` o similar), el Frontend permite entrar con un modo de solo lectura/demo para presentaciones, evitando la "Pantalla Blanca de la Muerte".
*   **CORS**: Configurado para permitir tráfico cruzado entre el puerto 5173 (App) y 5174 (Admin).
*   **Silenciamiento de Errores**: La consola del navegador ya no muestra errores rojos si el servicio de analítica no responde, mejorando la experiencia de desarrollo.

## 4. Guía de Inicio Rápido (Comandos)

**Terminal 1 (Backend)**:
```powershell
cd backend
npm run start:dev
```
*(Nota: Si sale error EADDRINUSE, matar el proceso de Node en Administrador de Tareas o cerrar terminales viejas)*

**Terminal 2 (Frontend Legal)**:
```powershell
cd frontend
npm run dev
```
*Acceso con botón "Ingresar como Socio (Demo)"*

**Terminal 3 (Admin Platform)**:
```powershell
cd admin-platform
npm run dev
```

---
**Próximos Pasos Recomendados**:
1.  **Deploy**: Dockerizar los 3 servicios (Frontend, Admin, Backend).
2.  **CI/CD**: Configurar GitHub Actions.
3.  **Integración Real IA**: Conectar OpenAI API Key real en el backend para reemplazar los mocks de "Redacción Asistida".
