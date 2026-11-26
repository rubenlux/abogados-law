-- =============================================================================
-- AUTH-11 — Análisis IA de Expedientes y Documentos (Incremental, Idempotent, RLS)
-- =============================================================================

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE "LegalAiAnalysisType" AS ENUM (
    'INTEGRAL_CASE',
    'FACTS_AND_CONTROVERSIES',
    'DOCUMENTARY_EVIDENCE',
    'PROCEDURAL_RISKS'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LegalAiAnalysisStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Table
CREATE TABLE IF NOT EXISTS "LegalAiAnalysis" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expedienteId" TEXT,
  "analysisType" "LegalAiAnalysisType" NOT NULL,
  "title" TEXT NOT NULL,
  "status" "LegalAiAnalysisStatus" NOT NULL DEFAULT 'PENDING',
  "inputInstructions" TEXT,
  "resultContent" JSONB,
  "editedContent" JSONB,
  "editedAt" TIMESTAMP(3),
  "sourceReferences" JSONB,
  "providerMetadata" JSONB,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalAiAnalysis_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegalAiAnalysis_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegalAiAnalysis_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegalAiAnalysis_expedienteId_fkey"
    FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS "LegalAiAnalysis_organizationId_idx"
  ON "LegalAiAnalysis"("organizationId");
CREATE INDEX IF NOT EXISTS "LegalAiAnalysis_organizationId_userId_status_idx"
  ON "LegalAiAnalysis"("organizationId", "userId", "status");
CREATE INDEX IF NOT EXISTS "LegalAiAnalysis_organizationId_expedienteId_createdAt_idx"
  ON "LegalAiAnalysis"("organizationId", "expedienteId", "createdAt");
CREATE INDEX IF NOT EXISTS "LegalAiAnalysis_organizationId_analysisType_idx"
  ON "LegalAiAnalysis"("organizationId", "analysisType");

-- 4. Row-Level Security (ENABLE + FORCE) & Strict Tenant Policies
ALTER TABLE "LegalAiAnalysis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LegalAiAnalysis" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_legalaianalysis_select ON "LegalAiAnalysis";
DROP POLICY IF EXISTS rls_legalaianalysis_insert ON "LegalAiAnalysis";
DROP POLICY IF EXISTS rls_legalaianalysis_update ON "LegalAiAnalysis";
DROP POLICY IF EXISTS rls_legalaianalysis_delete ON "LegalAiAnalysis";

CREATE POLICY rls_legalaianalysis_select ON "LegalAiAnalysis" FOR SELECT USING (
  current_setting('app.current_organization_id', true) IS NOT NULL
  AND current_setting('app.current_organization_id', true) <> ''
  AND "organizationId" = current_setting('app.current_organization_id', true)
);

CREATE POLICY rls_legalaianalysis_insert ON "LegalAiAnalysis" FOR INSERT WITH CHECK (
  current_setting('app.current_organization_id', true) IS NOT NULL
  AND current_setting('app.current_organization_id', true) <> ''
  AND "organizationId" = current_setting('app.current_organization_id', true)
);

CREATE POLICY rls_legalaianalysis_update ON "LegalAiAnalysis" FOR UPDATE USING (
  current_setting('app.current_organization_id', true) IS NOT NULL
  AND current_setting('app.current_organization_id', true) <> ''
  AND "organizationId" = current_setting('app.current_organization_id', true)
) WITH CHECK (
  current_setting('app.current_organization_id', true) IS NOT NULL
  AND current_setting('app.current_organization_id', true) <> ''
  AND "organizationId" = current_setting('app.current_organization_id', true)
);

CREATE POLICY rls_legalaianalysis_delete ON "LegalAiAnalysis" FOR DELETE USING (
  current_setting('app.current_organization_id', true) IS NOT NULL
  AND current_setting('app.current_organization_id', true) <> ''
  AND "organizationId" = current_setting('app.current_organization_id', true)
);

-- 5. Least-Privilege Grants for abogados_app_user (NOBYPASSRLS)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'abogados_app_user') THEN
    REVOKE ALL ON TABLE "LegalAiAnalysis" FROM abogados_app_user;
    -- Logical archive only (no physical DELETE)
    GRANT SELECT, INSERT, UPDATE ON TABLE "LegalAiAnalysis" TO abogados_app_user;
  END IF;
END
$$;

