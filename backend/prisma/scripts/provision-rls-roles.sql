-- =============================================================================
-- AUTH-04 — Idempotent Least-Privilege PostgreSQL Role Provisioning Script
-- Specification: SPEC-AUTH-004 v0.2.0 — APPROVED (§10.4)
--
-- SECURITY:
--   - NEVER hardcode passwords in this script or commit credentials to Git.
--   - Invoke via psql passing credentials from a secret manager / env var:
--       psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 \
--         -v app_password="$APP_DB_PASSWORD" \
--         -v backup_password="$BACKUP_DB_PASSWORD" \
--         -f prisma/scripts/provision-rls-roles.sql
-- =============================================================================

\if :{?app_password}
\else
\echo 'ERROR: Missing required psql variable -v app_password=...'
\quit 1
\endif

SELECT set_config('abogados.provision_app_password', :'app_password', false) IS NOT NULL AS app_password_loaded \gset

DO $$
DECLARE
  v_app_pw TEXT := current_setting('abogados.provision_app_password', true);
BEGIN
  IF v_app_pw IS NULL OR length(trim(v_app_pw)) < 12 THEN
    RAISE EXCEPTION 'app_password must be provided and at least 12 characters long';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'abogados_app_user') THEN
    EXECUTE format(
      'CREATE ROLE abogados_app_user WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD %L',
      v_app_pw
    );
  ELSE
    EXECUTE format(
      'ALTER ROLE abogados_app_user WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD %L',
      v_app_pw
    );
  END IF;
END
$$;

-- Clear session GUC holding password immediately
SELECT set_config('abogados.provision_app_password', '', false) IS NOT NULL AS app_password_cleared \gset

-- Optional backup role provisioning (when backup_password is supplied)
\if :{?backup_password}
SELECT set_config('abogados.provision_backup_password', :'backup_password', false) IS NOT NULL AS backup_password_loaded \gset
DO $$
DECLARE
  v_bkp_pw TEXT := current_setting('abogados.provision_backup_password', true);
BEGIN
  IF v_bkp_pw IS NOT NULL AND length(trim(v_bkp_pw)) >= 12 THEN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'abogados_backup_user') THEN
      EXECUTE format(
        'CREATE ROLE abogados_backup_user WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION BYPASSRLS PASSWORD %L',
        v_bkp_pw
      );
    ELSE
      EXECUTE format(
        'ALTER ROLE abogados_backup_user WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION BYPASSRLS PASSWORD %L',
        v_bkp_pw
      );
    END IF;
    GRANT pg_read_all_data TO abogados_backup_user;
    REVOKE CREATE ON SCHEMA public FROM abogados_backup_user;
  END IF;
END
$$;
SELECT set_config('abogados.provision_backup_password', '', false) IS NOT NULL AS backup_password_cleared \gset
\endif

-- =============================================================================
-- Least-Privilege Grant Matrix for `abogados_app_user` (§10.4)
-- =============================================================================

-- 1. Harden schema public (prevent DDL by non-owners)
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM abogados_app_user;
GRANT USAGE ON SCHEMA public TO abogados_app_user;

-- 2. Baseline clean revoke on all tables & sequences
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM abogados_app_user;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM abogados_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO abogados_app_user;

-- 3. Explicitly revoke internal Prisma migrations table
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON TABLE "_prisma_migrations" FROM abogados_app_user;
  END IF;
END
$$;

-- 4. Category A (Tenant-Scoped Tables): SELECT, INSERT, UPDATE, DELETE only (NO TRUNCATE/REFERENCES/TRIGGER)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "Expediente",
  "ExpedienteParte",
  "MovimientoProcesal",
  "AgendaEvent",
  "Vencimiento",
  "Client",
  "Documento",
  "DocumentVersion",
  "EventoAgenda",
  "LegalTemplate",
  "JudicialAccount",
  "TenantUsage",
  "AIInteraction",
  "AIChatSession",
  "AIChatMessage",
  "LegalDraft",
  "LegalRiskAnalysis",
  "EmployeeMetric"
TO abogados_app_user;

-- 5. Category D (M:N Bridge `_ExpedienteToUser`): SELECT, INSERT, DELETE only (NO UPDATE/TRUNCATE)
GRANT SELECT, INSERT, DELETE ON TABLE "_ExpedienteToUser" TO abogados_app_user;

-- 6. Category B (Append-Only Audit & Telemetry): SELECT, INSERT only (NO UPDATE/DELETE/TRUNCATE)
GRANT SELECT, INSERT ON TABLE "AuditLog", "EventLog" TO abogados_app_user;

-- 6b. AUTH-08 Document Management (logical archive on Document, immutable append-only on DocumentFileVersion)
GRANT SELECT, INSERT, UPDATE ON TABLE "Document" TO abogados_app_user;
GRANT SELECT, INSERT ON TABLE "DocumentFileVersion" TO abogados_app_user;

-- 6c. AUTH-09 Legal Drafting (logical archive on Writing/Template, immutable append-only on Version/Export)
GRANT SELECT, INSERT, UPDATE ON TABLE "LegalWriting" TO abogados_app_user;
GRANT SELECT, INSERT ON TABLE "LegalDraftVersion" TO abogados_app_user;
GRANT SELECT, INSERT, UPDATE ON TABLE "LegalDraftTemplate" TO abogados_app_user;
GRANT SELECT, INSERT, UPDATE ON TABLE "LegalDraftReview" TO abogados_app_user;
GRANT SELECT, INSERT ON TABLE "LegalDraftExport" TO abogados_app_user;

-- 6d. AUTH-10 Contextual Legal AI Assistant (logical archive on Conversation, immutable append-only on Message)
GRANT SELECT, INSERT, UPDATE ON TABLE "LegalAiConversation" TO abogados_app_user;
GRANT SELECT, INSERT ON TABLE "LegalAiMessage" TO abogados_app_user;

-- 7. Category C (Pre-Auth Identity, Sessions & Memberships): fine-grained least-privilege
--    per SPEC-AUTH-004 §10.4 and AUTH04-POST-IMPLEMENTATION-RECONCILIATION-001.
--
--    SELECT: all 7 tables
GRANT SELECT ON TABLE
  "Organization",
  "User",
  "UserIdentity",
  "UserSession",
  "OrganizationMembership",
  "OrganizationInvitation",
  "OidcTransaction"
TO abogados_app_user;

--    INSERT: Organization, UserSession, OrganizationMembership, OrganizationInvitation, OidcTransaction
--    (NOT User — no self-registration path; NOT UserIdentity — identities are managed by Auth0 integration only)
GRANT INSERT ON TABLE
  "Organization",
  "UserSession",
  "OrganizationMembership",
  "OrganizationInvitation",
  "OidcTransaction"
TO abogados_app_user;

--    UPDATE: Organization, OrganizationMembership, OrganizationInvitation (full table-level)
GRANT UPDATE ON TABLE
  "Organization",
  "OrganizationMembership",
  "OrganizationInvitation"
TO abogados_app_user;

--    UPDATE: UserSession — column-level, mutable columns only
--    (revokedAt: logical revocation; lastActiveAt/idleExpiresAt: session sliding window;
--     activeOrganizationId: org context switch)
GRANT UPDATE ("revokedAt", "lastActiveAt", "idleExpiresAt", "activeOrganizationId")
  ON TABLE "UserSession" TO abogados_app_user;

--    UPDATE: User — column-level, refreshTokenHash + updatedAt only
--    (AuthService.logout: Prisma sends SET refreshTokenHash = ?, updatedAt = NOW(); BffSessionService uses SELECT only)
GRANT UPDATE ("refreshTokenHash", "updatedAt") ON TABLE "User" TO abogados_app_user;

--    DELETE: OidcTransaction only (atomic DELETE...RETURNING for PKCE flow consumption)
--    UserSession uses logical revocation (revokedAt UPDATE), never physical DELETE.
GRANT DELETE ON TABLE "OidcTransaction" TO abogados_app_user;

-- 8. Category E (Global Read-Only Knowledge & Plans): SELECT ONLY
GRANT SELECT ON TABLE
  "CalendarioJudicial",
  "LegalNorm",
  "Jurisprudence",
  "JurisprudenceChunk",
  "JurisprudenceCitation",
  "SubscriptionPlan"
TO abogados_app_user;
