-- AUTH-04 Migration A: Phase A (Expand) — Nullable organizationId columns, indexes, FKs & verifiable relational backfill
-- Specification: SPEC-AUTH-004 v0.2.0 — APPROVED (§16.1, §16.2, §16.3)
-- Rules:
--   1. NO deletions or destructive mutations.
--   2. NO reliance on legacy User.organizationId or User.role.
--   3. Ambiguous historical rows remain organizationId = NULL and are confined Fail-Closed by RLS (Migration B).
--   4. NOT NULL contract deferred to Phase B (Migration C) after pre-flight verification.

-- 1. Expand columns (nullable)
ALTER TABLE "Documento" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "EventoAgenda" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "AIChatSession" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "AIChatMessage" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "LegalDraft" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "LegalRiskAnalysis" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "EmployeeMetric" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- 2. Indexes on organizationId
CREATE INDEX IF NOT EXISTS "Documento_organizationId_idx" ON "Documento"("organizationId");
CREATE INDEX IF NOT EXISTS "DocumentVersion_organizationId_idx" ON "DocumentVersion"("organizationId");
CREATE INDEX IF NOT EXISTS "EventoAgenda_organizationId_idx" ON "EventoAgenda"("organizationId");
CREATE INDEX IF NOT EXISTS "AIChatSession_organizationId_idx" ON "AIChatSession"("organizationId");
CREATE INDEX IF NOT EXISTS "AIChatMessage_organizationId_idx" ON "AIChatMessage"("organizationId");
CREATE INDEX IF NOT EXISTS "LegalDraft_organizationId_idx" ON "LegalDraft"("organizationId");
CREATE INDEX IF NOT EXISTS "LegalRiskAnalysis_organizationId_idx" ON "LegalRiskAnalysis"("organizationId");
CREATE INDEX IF NOT EXISTS "EmployeeMetric_organizationId_idx" ON "EmployeeMetric"("organizationId");

-- 3. Deterministic verifiable relational backfill (§16.2)

-- 3.1 Documento <- Expediente
UPDATE "Documento" d
SET "organizationId" = e."organizationId"
FROM "Expediente" e
WHERE d."expedienteId" = e."id"
  AND d."organizationId" IS NULL;

-- 3.2 DocumentVersion <- Documento -> Expediente
UPDATE "DocumentVersion" dv
SET "organizationId" = e."organizationId"
FROM "Documento" d
JOIN "Expediente" e ON e."id" = d."expedienteId"
WHERE dv."documentId" = d."id"
  AND dv."organizationId" IS NULL;

-- 3.3 EventoAgenda <- Expediente
UPDATE "EventoAgenda" ev
SET "organizationId" = e."organizationId"
FROM "Expediente" e
WHERE ev."expedienteId" = e."id"
  AND ev."organizationId" IS NULL;

-- 3.4 LegalRiskAnalysis <- Expediente
UPDATE "LegalRiskAnalysis" r
SET "organizationId" = e."organizationId"
FROM "Expediente" e
WHERE r."expedienteId" = e."id"
  AND r."organizationId" IS NULL;

-- 3.5 AIChatSession: (a) matching Expediente, else (b) unambiguous AuditLog/EventLog evidence; else keep NULL
UPDATE "AIChatSession" s
SET "organizationId" = e."organizationId"
FROM "Expediente" e
WHERE s."expedienteId" = e."id"
  AND s."organizationId" IS NULL;

UPDATE "AIChatSession" s
SET "organizationId" = ev."organizationId"
FROM (
  SELECT "entityId", MIN("organizationId") AS "organizationId"
  FROM (
    SELECT "entityId", "organizationId" FROM "AuditLog" WHERE "entityId" IS NOT NULL AND "organizationId" IS NOT NULL
    UNION ALL
    SELECT "entityId", "organizationId" FROM "EventLog" WHERE "entityId" IS NOT NULL AND "organizationId" IS NOT NULL
  ) evidence
  GROUP BY "entityId"
  HAVING COUNT(DISTINCT "organizationId") = 1
) ev
WHERE s."id" = ev."entityId"
  AND s."organizationId" IS NULL;

-- 3.6 AIChatMessage <- AIChatSession (only where parent session has verified organizationId)
UPDATE "AIChatMessage" m
SET "organizationId" = s."organizationId"
FROM "AIChatSession" s
WHERE m."sessionId" = s."id"
  AND s."organizationId" IS NOT NULL
  AND m."organizationId" IS NULL;

-- 3.7 LegalDraft: (a) non-null expedienteId -> Expediente, else (b) unambiguous AuditLog/EventLog evidence; else keep NULL
UPDATE "LegalDraft" ld
SET "organizationId" = e."organizationId"
FROM "Expediente" e
WHERE ld."expedienteId" = e."id"
  AND ld."organizationId" IS NULL;

UPDATE "LegalDraft" ld
SET "organizationId" = ev."organizationId"
FROM (
  SELECT "entityId", MIN("organizationId") AS "organizationId"
  FROM (
    SELECT "entityId", "organizationId" FROM "AuditLog" WHERE "entityId" IS NOT NULL AND "organizationId" IS NOT NULL
    UNION ALL
    SELECT "entityId", "organizationId" FROM "EventLog" WHERE "entityId" IS NOT NULL AND "organizationId" IS NOT NULL
  ) evidence
  GROUP BY "entityId"
  HAVING COUNT(DISTINCT "organizationId") = 1
) ev
WHERE ld."id" = ev."entityId"
  AND ld."organizationId" IS NULL;

-- 3.8 EmployeeMetric: historical rows intentionally remain NULL (no verifiable org relation; User.organizationId forbidden)

-- 4. Foreign Keys (idempotent; AIInteraction FK added conditionally only if 0 orphans exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Documento_organizationId_fkey') THEN
    ALTER TABLE "Documento" ADD CONSTRAINT "Documento_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentVersion_organizationId_fkey') THEN
    ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventoAgenda_organizationId_fkey') THEN
    ALTER TABLE "EventoAgenda" ADD CONSTRAINT "EventoAgenda_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AIChatSession_organizationId_fkey') THEN
    ALTER TABLE "AIChatSession" ADD CONSTRAINT "AIChatSession_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AIChatMessage_organizationId_fkey') THEN
    ALTER TABLE "AIChatMessage" ADD CONSTRAINT "AIChatMessage_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LegalDraft_organizationId_fkey') THEN
    ALTER TABLE "LegalDraft" ADD CONSTRAINT "LegalDraft_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LegalRiskAnalysis_organizationId_fkey') THEN
    ALTER TABLE "LegalRiskAnalysis" ADD CONSTRAINT "LegalRiskAnalysis_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmployeeMetric_organizationId_fkey') THEN
    ALTER TABLE "EmployeeMetric" ADD CONSTRAINT "EmployeeMetric_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventLog_organizationId_fkey') THEN
    IF NOT EXISTS (
      SELECT 1 FROM "EventLog" el
      WHERE el."organizationId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "Organization" o WHERE o."id" = el."organizationId")
    ) THEN
      ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AIInteraction_organizationId_fkey') THEN
    IF NOT EXISTS (
      SELECT 1 FROM "AIInteraction" ai
      WHERE NOT EXISTS (SELECT 1 FROM "Organization" o WHERE o."id" = ai."organizationId")
    ) THEN
      ALTER TABLE "AIInteraction" ADD CONSTRAINT "AIInteraction_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END IF;
END
$$;

