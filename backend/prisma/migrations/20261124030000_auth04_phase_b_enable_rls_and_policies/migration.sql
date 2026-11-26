-- AUTH-04 Migration B: Enable & Force PostgreSQL Row-Level Security (RLS) + Tenant Policies
-- Specification: SPEC-AUTH-004 v0.2.0 — APPROVED (§10.1, §10.2, §10.3, DEC-04-01, DEC-04-06)
--
-- Security invariants:
--   - Runtime role `abogados_app_user` MUST have NOBYPASSRLS (provisioned without hardcoded password via provision-rls-roles.sql).
--   - Fail-Closed: missing/empty GUC `app.current_organization_id` yields 0 rows and rejects writes (42501).
--   - Rows with `organizationId IS NULL` are strictly invisible to all tenants under RLS.
--   - Category B (AuditLog, EventLog) is append-only for `abogados_app_user` (UPDATE/DELETE denied).
--   - Category D (_ExpedienteToUser) enforces double EXISTS on INSERT (Expediente + ACTIVE OrganizationMembership).

-- Ensure runtime role identifier exists for policy targets without setting any password or LOGIN credential here.
-- Operational credentials and least-privilege GRANTs are managed strictly via prisma/scripts/provision-rls-roles.sql.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'abogados_app_user') THEN
    CREATE ROLE abogados_app_user NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

-- =============================================================================
-- CATEGORY A: 14 Tenant-Scoped Tables (SELECT, INSERT, UPDATE, DELETE)
-- =============================================================================
DO $$
DECLARE
  tbl TEXT;
  cat_a_tables TEXT[] := ARRAY[
    'Expediente',
    'Client',
    'Documento',
    'DocumentVersion',
    'EventoAgenda',
    'LegalTemplate',
    'JudicialAccount',
    'TenantUsage',
    'AIInteraction',
    'AIChatSession',
    'AIChatMessage',
    'LegalDraft',
    'LegalRiskAnalysis',
    'EmployeeMetric'
  ];
BEGIN
  FOREACH tbl IN ARRAY cat_a_tables
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', lower(tbl) || '_tenant_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', lower(tbl) || '_tenant_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', lower(tbl) || '_tenant_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', lower(tbl) || '_tenant_delete', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO abogados_app_user USING ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting(''app.current_organization_id'', true), ''''))',
      lower(tbl) || '_tenant_select',
      tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO abogados_app_user WITH CHECK ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting(''app.current_organization_id'', true), ''''))',
      lower(tbl) || '_tenant_insert',
      tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO abogados_app_user USING ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting(''app.current_organization_id'', true), '''')) WITH CHECK ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting(''app.current_organization_id'', true), ''''))',
      lower(tbl) || '_tenant_update',
      tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO abogados_app_user USING ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting(''app.current_organization_id'', true), ''''))',
      lower(tbl) || '_tenant_delete',
      tbl
    );
  END LOOP;
END
$$;

-- =============================================================================
-- CATEGORY B: 2 Append-Only Audit / Telemetry Tables (DEC-04-06)
--   - Tenant SELECT & INSERT strictly require non-null active organizationId
--   - Platform events (organizationId IS NULL) remain invisible to all tenants
--   - UPDATE & DELETE forbidden by RLS AND SQL privileges
-- =============================================================================
DO $$
DECLARE
  tbl TEXT;
  cat_b_tables TEXT[] := ARRAY['AuditLog', 'EventLog'];
BEGIN
  FOREACH tbl IN ARRAY cat_b_tables
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', lower(tbl) || '_tenant_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', lower(tbl) || '_tenant_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', lower(tbl) || '_deny_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', lower(tbl) || '_deny_delete', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO abogados_app_user USING ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting(''app.current_organization_id'', true), ''''))',
      lower(tbl) || '_tenant_select',
      tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO abogados_app_user WITH CHECK ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting(''app.current_organization_id'', true), ''''))',
      lower(tbl) || '_tenant_insert',
      tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO abogados_app_user USING (false) WITH CHECK (false)',
      lower(tbl) || '_deny_update',
      tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO abogados_app_user USING (false)',
      lower(tbl) || '_deny_delete',
      tbl
    );
  END LOOP;
END
$$;

-- =============================================================================
-- CATEGORY D: M:N Bridge Table `_ExpedienteToUser` (§10.3)
--   - Column "A" = Expediente.id, Column "B" = User.id
--   - SELECT: Expediente "A" belongs to active org
--   - INSERT: Expediente "A" belongs to active org AND User "B" has ACTIVE OrganizationMembership in active org
--   - DELETE: Expediente "A" belongs to active org
--   - UPDATE: Denied (no GRANT UPDATE + deny policy)
-- =============================================================================
ALTER TABLE "_ExpedienteToUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_ExpedienteToUser" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expediente_to_user_select_policy ON "_ExpedienteToUser";
DROP POLICY IF EXISTS expediente_to_user_insert_policy ON "_ExpedienteToUser";
DROP POLICY IF EXISTS expediente_to_user_delete_policy ON "_ExpedienteToUser";
DROP POLICY IF EXISTS expediente_to_user_deny_update_policy ON "_ExpedienteToUser";

CREATE POLICY expediente_to_user_select_policy ON "_ExpedienteToUser"
  FOR SELECT TO abogados_app_user
  USING (
    EXISTS (
      SELECT 1 FROM "Expediente" e
      WHERE e."id" = "A"
        AND e."organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
    )
  );

CREATE POLICY expediente_to_user_insert_policy ON "_ExpedienteToUser"
  FOR INSERT TO abogados_app_user
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Expediente" e
      WHERE e."id" = "A"
        AND e."organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
    )
    AND EXISTS (
      SELECT 1 FROM "OrganizationMembership" m
      WHERE m."userId" = "B"
        AND m."organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
        AND m."status" = 'ACTIVE'::"MembershipStatus"
    )
  );

CREATE POLICY expediente_to_user_delete_policy ON "_ExpedienteToUser"
  FOR DELETE TO abogados_app_user
  USING (
    EXISTS (
      SELECT 1 FROM "Expediente" e
      WHERE e."id" = "A"
        AND e."organizationId" = NULLIF(current_setting('app.current_organization_id', true), '')
    )
  );

CREATE POLICY expediente_to_user_deny_update_policy ON "_ExpedienteToUser"
  FOR UPDATE TO abogados_app_user
  USING (false)
  WITH CHECK (false);

