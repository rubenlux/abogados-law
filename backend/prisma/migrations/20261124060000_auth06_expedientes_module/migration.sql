-- =============================================================================
-- AUTH-06 — Expedientes Module Migration
-- Expediente: AUTH06-EXPEDIENTES-IMPLEMENTATION-001
-- Description: Extends Expediente entity with provincia, fuero, secretaria,
--              tipoProceso, materia, fechaInicio, descripcion, responsableId.
--              Adds RolParteProcesal enum and ExpedienteParte table with PostgreSQL RLS.
-- =============================================================================

-- 1. Extend ExpedienteEstado Enum
ALTER TYPE "ExpedienteEstado" ADD VALUE IF NOT EXISTS 'EN_TRAMITE';
ALTER TYPE "ExpedienteEstado" ADD VALUE IF NOT EXISTS 'PENDIENTE';
ALTER TYPE "ExpedienteEstado" ADD VALUE IF NOT EXISTS 'SUSPENDIDO';
ALTER TYPE "ExpedienteEstado" ADD VALUE IF NOT EXISTS 'FINALIZADO';

-- 2. Create RolParteProcesal Enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RolParteProcesal') THEN
    CREATE TYPE "RolParteProcesal" AS ENUM (
      'ACTOR',
      'DEMANDADO',
      'DENUNCIANTE',
      'DENUNCIADO',
      'QUERELLANTE',
      'IMPUTADO',
      'SOLICITANTE',
      'BENEFICIARIO',
      'TERCERO',
      'OTRO'
    );
  END IF;
END $$;

-- 3. Extend Expediente Table
ALTER TABLE "Expediente"
  ADD COLUMN IF NOT EXISTS "provincia" TEXT,
  ADD COLUMN IF NOT EXISTS "fuero" TEXT,
  ADD COLUMN IF NOT EXISTS "secretaria" TEXT,
  ADD COLUMN IF NOT EXISTS "tipoProceso" TEXT,
  ADD COLUMN IF NOT EXISTS "materia" TEXT,
  ADD COLUMN IF NOT EXISTS "fechaInicio" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "descripcion" TEXT,
  ADD COLUMN IF NOT EXISTS "responsableId" TEXT;

-- Foreign key for responsableId -> User(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Expediente_responsableId_fkey'
  ) THEN
    ALTER TABLE "Expediente"
      ADD CONSTRAINT "Expediente_responsableId_fkey"
      FOREIGN KEY ("responsableId") REFERENCES "User"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

-- Update default for estado
ALTER TABLE "Expediente" ALTER COLUMN "estado" SET DEFAULT 'EN_TRAMITE'::"ExpedienteEstado";

-- Indexes on Expediente
CREATE INDEX IF NOT EXISTS "Expediente_organizationId_estado_idx" ON "Expediente"("organizationId", "estado");
CREATE INDEX IF NOT EXISTS "Expediente_organizationId_numeroExpediente_idx" ON "Expediente"("organizationId", "numeroExpediente");

-- 4. Create ExpedienteParte Table
CREATE TABLE IF NOT EXISTS "ExpedienteParte" (
  "id" TEXT NOT NULL,
  "expedienteId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT,
  "tipoParte" "ClientPersonType" NOT NULL DEFAULT 'HUMANA'::"ClientPersonType",
  "nombre" TEXT NOT NULL,
  "cuitDni" TEXT,
  "rol" "RolParteProcesal" NOT NULL DEFAULT 'ACTOR'::"RolParteProcesal",
  "caracter" TEXT,
  "esCliente" BOOLEAN NOT NULL DEFAULT false,
  "observaciones" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExpedienteParte_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExpedienteParte_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "ExpedienteParte_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "ExpedienteParte_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON UPDATE CASCADE ON DELETE SET NULL
);

-- Indexes on ExpedienteParte
CREATE INDEX IF NOT EXISTS "ExpedienteParte_expedienteId_idx" ON "ExpedienteParte"("expedienteId");
CREATE INDEX IF NOT EXISTS "ExpedienteParte_organizationId_idx" ON "ExpedienteParte"("organizationId");
CREATE INDEX IF NOT EXISTS "ExpedienteParte_clientId_idx" ON "ExpedienteParte"("clientId");

-- 5. Row-Level Security (RLS) for ExpedienteParte
ALTER TABLE "ExpedienteParte" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpedienteParte" FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ExpedienteParte' AND policyname = 'expedienteparte_tenant_select'
  ) THEN
    CREATE POLICY "expedienteparte_tenant_select" ON "ExpedienteParte"
      FOR SELECT TO abogados_app_user
      USING ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting('app.current_organization_id', true), ''));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ExpedienteParte' AND policyname = 'expedienteparte_tenant_insert'
  ) THEN
    CREATE POLICY "expedienteparte_tenant_insert" ON "ExpedienteParte"
      FOR INSERT TO abogados_app_user
      WITH CHECK ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting('app.current_organization_id', true), ''));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ExpedienteParte' AND policyname = 'expedienteparte_tenant_update'
  ) THEN
    CREATE POLICY "expedienteparte_tenant_update" ON "ExpedienteParte"
      FOR UPDATE TO abogados_app_user
      USING ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting('app.current_organization_id', true), ''))
      WITH CHECK ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting('app.current_organization_id', true), ''));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ExpedienteParte' AND policyname = 'expedienteparte_tenant_delete'
  ) THEN
    CREATE POLICY "expedienteparte_tenant_delete" ON "ExpedienteParte"
      FOR DELETE TO abogados_app_user
      USING ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting('app.current_organization_id', true), ''));
  END IF;
END $$;

-- 6. Least-Privilege Grants for abogados_app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ExpedienteParte" TO abogados_app_user;

