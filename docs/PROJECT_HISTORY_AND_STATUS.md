# Historial Maestro del Proyecto y Estatus Arquitectónico

Este documento consolida la evolución técnica del proyecto, las decisiones de arquitectura tomadas y el estado actual de cada módulo. Sirve como fuente de verdad para entender la complejidad actual del sistema.

## 1. Fase Fundacional (Core Backend & Frontend)
**Objetivo**: Establecer la infraestructura base segura y escalable.
*   **Backend (NestJS)**:
    *   Configuración de Prisma ORM con PostgreSQL.
    *   Sistema de Autenticación JWT (`AuthModule`) con Guards y decoradores de roles.
    *   Gestión de Expedientes y Eventos de Agenda.
*   **Frontend (React + Vite)**:
    *   Arquitectura modular (`/modules`).
    *   Sistema de diseño base con CSS variables y Tailwind implícito.
    *   Layout principal con Sidebar de navegación.

## 2. Fase de Motores Semánticos (AI & Risk)
**Objetivo**: Diferenciación mediante inteligencia legal.
*   **Motor de Riesgo (`LegalRiskService`)**:
    *   Algoritmo de scoring 0-100 basado en jurisprudencia y normativa.
    *   Integración RAG (Retrieval Augmented Generation) para buscar precedentes.
*   **Asistente IA (`AIChatModule`)**:
    *   Chat contextual sobre expedientes.
    *   Interfaz de chat con streaming (simulado).
*   **Documentación**: `docs/LEGAL_RISK_ENGINE.md`.

## 3. Fase de Gestión Documental y Automatización
**Objetivo**: Eficiencia operativa para el abogado.
*   **Gestor Avanzado**:
    *   Versionado de documentos (`DocumentVersion`).
    *   Hashing SHA256 para integridad forense.
    *   Placeholder para OCR.
*   **Automatización (`TemplatesModule`)**:
    *   Sistema de plantillas con variables dinámicas (`{{cliente}}`).
    *   Generador de borradores.
*   **Interfaz de Redacción**:
    *   `SmartDraftingPage`: Panel dividido para redacción asistida por IA.
*   **Documentación**: `docs/DOCUMENT_MANAGEMENT.md`, `docs/DOCUMENT_AUTOMATION.md`.

## 4. Fase de Integración y Extensión
**Objetivo**: Conexión con el mundo exterior.
*   **Integración Judicial (`JudicialEngineModule`)**:
    *   Scraper simulado para PJN/MEV.
    *   Sincronización de movimientos y alertas.
*   **Portal de Clientes (`ClientPortalModule`)**:
    *   Backend independiente para acceso limitado de clientes.
    *   Sanitización de datos (ocultar notas privadas).
*   **Documentación**: `docs/JUDICIAL_INTEGRATION.md`, `docs/CLIENT_PORTAL.md`.

## 5. Fase SaaS y Gobernanza (Multi-tenant)
**Objetivo**: Scalabilidad comercial y administrativa.
*   **Multi-tenancy**:
    *   Aislamiento lógico por `organizationId`.
    *   Servicio de Planes y Cuotas (`SubscriptionPlan`).
*   **Panel de Administración IA (`AdminModule` Backend)**:
    *   Control de consumo de tokens y costos.
*   **Documentación**: `docs/MULTITENANT.md`, `docs/SUBSCRIPTIONS.md`, `docs/AI_USAGE_CONTROL.md`, `docs/ADMIN_MASTER.md`.

## 6. Fase Actual: Separación de Plataformas y Telemetría (Big Data)
**Objetivo**: Observabilidad total y separación de preocupaciones (God Mode).
*   **Separación Frontend**:
    *   **Legal App**: La herramienta diaria del abogado.
    *   **Admin Platform**: Nueva app React independiente (`/admin-platform`) para los dueños del SaaS.
*   **Legal Pixel™ (Telemetry)**:
    *   Modelo de datos `EventLog` para traza inmutable de acciones.
    *   Métricas de empleados `EmployeeMetric`.
    *   Backend `AnalyticsModule` para ingestión de eventos (`/events/collect`).
*   **Estado**:
    *   Backend de telemetría: **Implementado**.
    *   Admin Platform UI: **Implementado (Versión Alpha)**.
    *   Cliente Pixel (Frontend): **Pendiente de implementación**.

---
**Última Actualización**: 23/01/2026
**Responsable Bot**: Antigravity
