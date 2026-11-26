-- =============================================================================
-- AUTH-10 — Asistente IA Jurídico Contextual (Incremental, Idempotent, RLS)
-- =============================================================================

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE "LegalAiConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LegalAiMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LegalAiMessageStatus" AS ENUM ('COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tables
CREATE TABLE IF NOT EXISTS "LegalAiConversation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expedienteId" TEXT,
  "title" TEXT NOT NULL,
  "status" "LegalAiConversationStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastMessageAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalAiConversation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegalAiConversation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegalAiConversation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegalAiConversation_expedienteId_fkey"
    FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LegalAiMessage" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "role" "LegalAiMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "messageStatus" "LegalAiMessageStatus" NOT NULL DEFAULT 'COMPLETED',
  "clientMessageId" TEXT,
  "contextReferences" JSONB,
  "providerMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalAiMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegalAiMessage_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegalAiMessage_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "LegalAiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. Indexes & Unique Constraints
CREATE INDEX IF NOT EXISTS "LegalAiConversation_organizationId_idx"
  ON "LegalAiConversation"("organizationId");
CREATE INDEX IF NOT EXISTS "LegalAiConversation_organizationId_userId_status_idx"
  ON "LegalAiConversation"("organizationId", "userId", "status");
CREATE INDEX IF NOT EXISTS "LegalAiConversation_organizationId_expedienteId_idx"
  ON "LegalAiConversation"("organizationId", "expedienteId");
CREATE INDEX IF NOT EXISTS "LegalAiConversation_organizationId_userId_lastMessageAt_idx"
  ON "LegalAiConversation"("organizationId", "userId", "lastMessageAt");

CREATE UNIQUE INDEX IF NOT EXISTS "LegalAiMessage_conversationId_clientMessageId_key"
  ON "LegalAiMessage"("conversationId", "clientMessageId");
CREATE INDEX IF NOT EXISTS "LegalAiMessage_organizationId_idx"
  ON "LegalAiMessage"("organizationId");
CREATE INDEX IF NOT EXISTS "LegalAiMessage_organizationId_conversationId_createdAt_idx"
  ON "LegalAiMessage"("organizationId", "conversationId", "createdAt");

-- 4. Row-Level Security (ENABLE + FORCE) & Strict Tenant Policies
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['LegalAiConversation', 'LegalAiMessage']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS rls_%s_select ON %I', lower(tbl), tbl);
    EXECUTE format('DROP POLICY IF EXISTS rls_%s_insert ON %I', lower(tbl), tbl);
    EXECUTE format('DROP POLICY IF EXISTS rls_%s_update ON %I', lower(tbl), tbl);
    EXECUTE format('DROP POLICY IF EXISTS rls_%s_delete ON %I', lower(tbl), tbl);

    EXECUTE format(
      'CREATE POLICY rls_%s_select ON %I FOR SELECT USING (
        current_setting(''app.current_organization_id'', true) IS NOT NULL
        AND current_setting(''app.current_organization_id'', true) <> ''''
        AND "organizationId" = current_setting(''app.current_organization_id'', true)
      )',
      lower(tbl), tbl
    );

    EXECUTE format(
      'CREATE POLICY rls_%s_insert ON %I FOR INSERT WITH CHECK (
        current_setting(''app.current_organization_id'', true) IS NOT NULL
        AND current_setting(''app.current_organization_id'', true) <> ''''
        AND "organizationId" = current_setting(''app.current_organization_id'', true)
      )',
      lower(tbl), tbl
    );

    EXECUTE format(
      'CREATE POLICY rls_%s_update ON %I FOR UPDATE USING (
        current_setting(''app.current_organization_id'', true) IS NOT NULL
        AND current_setting(''app.current_organization_id'', true) <> ''''
        AND "organizationId" = current_setting(''app.current_organization_id'', true)
      ) WITH CHECK (
        current_setting(''app.current_organization_id'', true) IS NOT NULL
        AND current_setting(''app.current_organization_id'', true) <> ''''
        AND "organizationId" = current_setting(''app.current_organization_id'', true)
      )',
      lower(tbl), tbl
    );

    EXECUTE format(
      'CREATE POLICY rls_%s_delete ON %I FOR DELETE USING (
        current_setting(''app.current_organization_id'', true) IS NOT NULL
        AND current_setting(''app.current_organization_id'', true) <> ''''
        AND "organizationId" = current_setting(''app.current_organization_id'', true)
      )',
      lower(tbl), tbl
    );
  END LOOP;
END
$$;

-- 5. Least-Privilege Grants for abogados_app_user (NOBYPASSRLS)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'abogados_app_user') THEN
    REVOKE ALL ON TABLE "LegalAiConversation", "LegalAiMessage" FROM abogados_app_user;
    -- LegalAiConversation: logical archive only (no physical DELETE)
    GRANT SELECT, INSERT, UPDATE ON TABLE "LegalAiConversation" TO abogados_app_user;
    -- LegalAiMessage: append-only conversation history (NO UPDATE, NO DELETE)
    GRANT SELECT, INSERT ON TABLE "LegalAiMessage" TO abogados_app_user;
  END IF;
END
$$;

