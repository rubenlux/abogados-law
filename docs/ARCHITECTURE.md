# Arquitectura General: Abogado Virtual / Sistema Jurídico Inteligente

## 1. Visión General
Sistema SaaS multi-tenant diseñado para estudios jurídicos en Argentina.
Enfoque: Automatización, IA (RAG), Seguridad y Gestión de Expedientes.

## 2. Arquitectura de Alto Nivel
La arquitectura sigue un patrón de microservicios modulares (o monolito modular inicialmente) sobre una infraestructura cloud.

### Componentes Principales:
1.  **Frontend SPA (React + TypeScript)**: Interfaz de usuario responsiva y "Premium".
2.  **API Gateway / Backend (NestJS)**: Gestiona autenticación, lógica de negocio y orquestación de IA.
3.  **Gestor de IA (RAG Engine)**: Servicio dedicado a la indexación vectorial y recuperación de contexto legal.
4.  **Base de Datos (PostgreSQL + pgvector)**: Almacenamiento híbrido para datos relacionales (expedientes, clientes) y vectores (embeddings de leyes/docs).
5.  **Almacenamiento de Archivos (S3/MinIO)**: Para documentos legales encriptados.

### Diagrama de Flujo (Texto):
[Web Client] <--> [HTTPS/WSS] <--> [API Gateway]
                                      |
              +-----------------------+-----------------------+
              |                       |                       |
        [Auth Service]        [Core Service]          [AI Service]
              |                       |                       |
        [PostgreSQL]            [PostgreSQL]          [Vector DB]
                                      |
                                [File Storage]

## 3. Stack Tecnológico

### Backend
*   **Lenguaje**: TypeScript (Node.js)
*   **Framework**: NestJS (Arquitectura modular, inyección de dependencias)
*   **ORM**: Prisma o TypeORM (Prisma recomendado por tipado fuerte)
*   **Validación**: Zod / Class-validator
*   **Docs**: Swagger / OpenAPI

### Frontend
*   **Framework**: React (Vite)
*   **Lenguaje**: TypeScript
*   **Estilos**: TailwindCSS + Framer Motion (para animaciones premium)
*   **Estado**: TanStack Query (React Query) + Zustand
*   **UI Components**: Shadcn/ui (basado en Radix UI) para accesibilidad y diseño

### Base de Datos
*   **Motor**: PostgreSQL 16+
*   **Extensiones**: `pgvector` (Búsqueda semántica), `pg_trgm` (Búsqueda texto)

### IA & RAG
*   **LLM**: OpenAI GPT-4o o Anthropic Claude 3.5 Sonnet (vía API segura)
*   **Embeddings**: OpenAI text-embedding-3-small
*   **Framework IA**: LangChain.js
*   **OCR**: Tesseract.js (local simple) o Google Cloud Vision (prod)

### Infraestructura & DevOps
*   **Container**: Docker
*   **CI/CD**: GitHub Actions
*   **Hosting**: AWS (ECS/EKS) o Render/Railway para MVP escalable.

## 4. Seguridad (Crítico)
*   **Autenticación**: JWT con rotación de tokens. MFA opcional.
*   **RBAC**: Sistema de permisos granular (Socio, Asociado, Admin, Cliente).
*   **Encriptación**: 
    *   En tránsito: TLS 1.3
    *   En reposo: AES-256 para documentos sensibles.
*   **Auditoría**: Tabla inmutable de logs (`audit_logs`) firmada criptográficamente (hash chain).

