-- =============================================================================
-- AUTH-05 — Clients Module Migration
-- Expediente: AUTH05-CLIENTS-IMPLEMENTATION-001
-- Description: Extends Client entity with personType, dniCuit, address, city,
--              province, notes, status and organization-isolated unique index.
-- =============================================================================

-- 1. Create Enums if not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClientPersonType') THEN
    CREATE TYPE "ClientPersonType" AS ENUM ('HUMANA', 'JURIDICA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClientStatus') THEN
    CREATE TYPE "ClientStatus" AS ENUM ('ACTIVO', 'INACTIVO', 'ARCHIVADO');
  END IF;
END $$;

-- 2. Alter Table Client
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "personType" "ClientPersonType" NOT NULL DEFAULT 'HUMANA',
  ADD COLUMN IF NOT EXISTS "dniCuit" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "province" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVO';

-- Make lastName nullable to accommodate Personas Jurídicas
ALTER TABLE "Client" ALTER COLUMN "lastName" DROP NOT NULL;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS "Client_organizationId_idx" ON "Client"("organizationId");
CREATE INDEX IF NOT EXISTS "Client_organizationId_status_idx" ON "Client"("organizationId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "Client_organizationId_dniCuit_key" ON "Client"("organizationId", "dniCuit");

