# Deployment Guide

## Infrastructure Overview
The system is containerized using Docker.
*   **Frontend**: React (Vite) -> Served via Nginx (Prod) or Dev Server.
*   **Backend**: NestJS -> Node.js Runtime.
*   **Database**: PostgreSQL 16 + pgvector.
*   **Storage**: AWS S3 or MinIO (Self-hosted).

## Prerequisites
*   Docker & Docker Compose
*   Node.js 20+ (for local logic)

## Local Development Setup

1.  **Clone & Install**
    ```bash
    git clone repo
    cd backend && npm install
    cd ../frontend && npm install
    ```

2.  **Start Infrastructure (DB + MinIO)**
    ```bash
    docker-compose up -d
    ```

3.  **Environment Variables**
    Configure `backend/.env`:
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/abogados_db?schema=public"
    JWT_SECRET="complex_secret"
    OPENAI_API_KEY="sk-..."
    ```

4.  **Database Migration & Seeding**
    ```bash
    cd backend
    npx prisma migrate dev
    npx prisma db seed
    ```

5.  **Run Services**
    *   Backend: `npm run start:dev`
    *   Frontend: `npm run dev`

## Production Deployment (AWS/Render)

### Docker Build
Use the provided `Dockerfile` (to be created) for multi-stage builds.

**Backend Dockerfile (Draft)**:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:20-alpine
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/main"]
```

### CICD Pipeline
GitHub Actions workflow is recommended to:
1.  Run Tests (`npm test`).
2.  Build Images.
3.  Push to ECR/Registry.
4.  Deploy to ECS/Kubernetes.
