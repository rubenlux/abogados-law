-- =============================================================================
-- AUTH-08 — Document Management Module Migration
-- Expediente: AUTH08-DOCUMENT-MANAGEMENT-IMPLEMENTATION-001
-- Description: Creates logical Document and immutable DocumentFileVersion
--              tables with strict organizationId scoping, indexes,
--              PostgreSQL RLS (ENABLE + FORCE) and least-privilege grants.
-- =============================================================================

-- 1. Create Enums Idempotently
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentCategory') THEN
    CREATE TYPE "DocumentCategory" AS ENUM (
      'DEMANDA', 'CONTESTACION', 'ESCRITO_JUDICIAL', 'RESOLUCION', 'SENTENCIA',
      'NOTIFICACION', 'PODER', 'CONTRATO', 'DOCUMENTACION_CLIENTE',
      'PRUEBA_DOCUMENTAL', 'INFORME', 'DICTAMEN', 'COMPROBANTE',
      'CORRESPONDENCIA', 'OTRO'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentStatus') THEN
    CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
  END IF;
END $$;

-- 2. Table: Document
CREATE TABLE IF NOT EXISTS "Document" (
  "id"                   TEXT NOT NULL,
  "organizationId"       TEXT NOT NULL,
  "expedienteId"         TEXT,
  "clientId"             TEXT,
  "movimientoProcesalId" TEXT,
  "title"                TEXT NOT NULL,
  "description"          TEXT,
  "category"             "DocumentCategory" NOT NULL DEFAULT 'OTRO'::"DocumentCategory",
  "documentDate"         TIMESTAMP(3),
  "status"               "DocumentStatus" NOT NULL DEFAULT 'ACTIVE'::"DocumentStatus",
  "currentVersionNumber" INTEGER NOT NULL DEFAULT 0,
  "createdById"          TEXT NOT NULL,
  "archivedAt"           TIMESTAMP(3),
  "archivedById"         TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Document_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "Document_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "Document_movimientoProcesalId_fkey" FOREIGN KEY ("movimientoProcesalId") REFERENCES "MovimientoProcesal"("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "Document_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "Document_organizationId_idx" ON "Document"("organizationId");
CREATE INDEX IF NOT EXISTS "Document_organizationId_status_idx" ON "Document"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Document_organizationId_category_idx" ON "Document"("organizationId", "category");
CREATE INDEX IF NOT EXISTS "Document_organizationId_expedienteId_idx" ON "Document"("organizationId", "expedienteId");
CREATE INDEX IF NOT EXISTS "Document_organizationId_clientId_idx" ON "Document"("organizationId", "clientId");
CREATE INDEX IF NOT EXISTS "Document_organizationId_movimientoProcesalId_idx" ON "Document"("organizationId", "movimientoProcesalId");

-- 3. Table: DocumentFileVersion (Immutable versions)
CREATE TABLE IF NOT EXISTS "DocumentFileVersion" (
  "id"               TEXT NOT NULL,
  "organizationId"   TEXT NOT NULL,
  "documentId"       TEXT NOT NULL,
  "versionNumber"    INTEGER NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "storageKey"       TEXT NOT NULL,
  "mimeType"         TEXT NOT NULL,
  "sizeBytes"        INTEGER NOT NULL,
  "sha256"           TEXT NOT NULL,
  "uploadedById"     TEXT NOT NULL,
  "uploadedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changeNote"       TEXT,

  CONSTRAINT "DocumentFileVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentFileVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "DocumentFileVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "DocumentFileVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentFileVersion_storageKey_key" ON "DocumentFileVersion"("storageKey");
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentFileVersion_documentId_versionNumber_key" ON "DocumentFileVersion"("documentId", "versionNumber");
CREATE INDEX IF NOT EXISTS "DocumentFileVersion_organizationId_idx" ON "DocumentFileVersion"("organizationId");
CREATE INDEX IF NOT EXISTS "DocumentFileVersion_organizationId_documentId_idx" ON "DocumentFileVersion"("organizationId", "documentId");

-- 4. Enable and FORCE Row-Level Security
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" FORCE ROW LEVEL SECURITY;

ALTER TABLE "DocumentFileVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentFileVersion" FORCE ROW LEVEL SECURITY;

-- 5. Tenant RLS Policies for abogados_app_user
DO $$
DECLARE
  t TEXT;
  p_prefix TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['Document', 'DocumentFileVersion']
  LOOP
    p_prefix := lower(t);

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = p_prefix || '_tenant_select') THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT TO abogados_app_user USING ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting(''app.current_organization_id'', true), ''''))',
        p_prefix || '_tenant_select', t
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = p_prefix || '_tenant_insert') THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR INSERT TO abogados_app_user WITH CHECK ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting(''app.current_organization_id'', true), ''''))',
        p_prefix || '_tenant_insert', t
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = p_prefix || '_tenant_update') THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR UPDATE TO abogados_app_user USING ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting(''app.current_organization_id'', true), '''')) WITH CHECK ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting(''app.current_organization_id'', true), ''''))',
        p_prefix || '_tenant_update', t
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = p_prefix || '_tenant_delete') THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR DELETE TO abogados_app_user USING ("organizationId" IS NOT NULL AND "organizationId" = NULLIF(current_setting(''app.current_organization_id'', true), ''''))',
        p_prefix || '_tenant_delete', t
      );
    END IF;
  END LOOP;
END $$;

-- 6. Least-Privilege Grants for abogados_app_user
-- Document: SELECT, INSERT, UPDATE (logical archive/restore, never physical DELETE)
-- DocumentFileVersion: SELECT, INSERT only (immutable versions, never UPDATE/DELETE)
GRANT SELECT, INSERT, UPDATE ON TABLE "Document" TO abogados_app_user;
GRANT SELECT, INSERT ON TABLE "DocumentFileVersion" TO abogados_app_user;

