-- AUTH-04 Pre-Flight Audit Report (Read-Only)
-- Reports NULL and orphan organizationId counts prior to Phase B (NOT NULL contract).
SELECT 'Documento' AS entity, COUNT(*) FILTER (WHERE "organizationId" IS NULL) AS null_count, COUNT(*) AS total_count FROM "Documento"
UNION ALL
SELECT 'DocumentVersion', COUNT(*) FILTER (WHERE "organizationId" IS NULL), COUNT(*) FROM "DocumentVersion"
UNION ALL
SELECT 'EventoAgenda', COUNT(*) FILTER (WHERE "organizationId" IS NULL), COUNT(*) FROM "EventoAgenda"
UNION ALL
SELECT 'LegalRiskAnalysis', COUNT(*) FILTER (WHERE "organizationId" IS NULL), COUNT(*) FROM "LegalRiskAnalysis"
UNION ALL
SELECT 'AIChatSession', COUNT(*) FILTER (WHERE "organizationId" IS NULL), COUNT(*) FROM "AIChatSession"
UNION ALL
SELECT 'AIChatMessage', COUNT(*) FILTER (WHERE "organizationId" IS NULL), COUNT(*) FROM "AIChatMessage"
UNION ALL
SELECT 'LegalDraft', COUNT(*) FILTER (WHERE "organizationId" IS NULL), COUNT(*) FROM "LegalDraft"
UNION ALL
SELECT 'EmployeeMetric', COUNT(*) FILTER (WHERE "organizationId" IS NULL), COUNT(*) FROM "EmployeeMetric"
UNION ALL
SELECT 'AIInteraction_orphans',
  COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "Organization" o WHERE o."id" = "AIInteraction"."organizationId")),
  COUNT(*)
FROM "AIInteraction"
UNION ALL
SELECT 'EventLog_orphans',
  COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Organization" o WHERE o."id" = "EventLog"."organizationId")),
  COUNT(*)
FROM "EventLog";

