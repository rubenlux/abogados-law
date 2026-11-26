-- =============================================================================
-- AUTH-09 — Escritos y Redacción Jurídica (Incremental, Idempotent, RLS Strict)
-- =============================================================================

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE "LegalDraftDocumentType" AS ENUM (
    'DEMANDA',
    'CONTESTACION_DEMANDA',
    'CONTESTACION_TRASLADO',
    'RECURSO',
    'EXPRESION_AGRAVIOS',
    'CONTESTACION_AGRAVIOS',
    'SOLICITUD',
    'OFICIO',
    'PRESENTACION_SIMPLE',
    'ALEGATO',
    'INCIDENTE',
    'MEDIDA_CAUTELAR',
    'OTRO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LegalDraftStatus" AS ENUM (
    'DRAFT',
    'IN_REVIEW',
    'CHANGES_REQUESTED',
    'APPROVED',
    'FINALIZED',
    'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LegalContentFormat" AS ENUM ('TIPTAP_JSON');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LegalDraftReviewStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CHANGES_REQUESTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LegalDraftExportFormat" AS ENUM ('DOCX', 'PDF');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LegalDraftExportStatus" AS ENUM ('COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tables
CREATE TABLE IF NOT EXISTS "LegalDraftTemplate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "documentType" "LegalDraftDocumentType" NOT NULL DEFAULT 'OTRO',
  "content" JSONB NOT NULL,
  "contentFormat" "LegalContentFormat" NOT NULL DEFAULT 'TIPTAP_JSON',
  "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "archivedAt" TIMESTAMP(3),
  "archivedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalDraftTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegalDraftTemplate_org_system_chk" CHECK (
    ("isSystemTemplate" = true AND "organizationId" IS NULL)
    OR ("isSystemTemplate" = false AND "organizationId" IS NOT NULL)
  ),
  CONSTRAINT "LegalDraftTemplate_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegalDraftTemplate_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LegalDraftTemplate_archivedById_fkey"
    FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LegalWriting" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "expedienteId" TEXT NOT NULL,
  "clientId" TEXT,
  "sourceTemplateId" TEXT,
  "title" TEXT NOT NULL,
  "documentType" "LegalDraftDocumentType" NOT NULL DEFAULT 'OTRO',
  "jurisdiction" TEXT,
  "courtName" TEXT,
  "caseNumber" TEXT,
  "status" "LegalDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "archivedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalWriting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegalWriting_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegalWriting_expedienteId_fkey"
    FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegalWriting_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LegalWriting_sourceTemplateId_fkey"
    FOREIGN KEY ("sourceTemplateId") REFERENCES "LegalDraftTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LegalWriting_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegalWriting_archivedById_fkey"
    FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LegalDraftVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "legalDraftId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "content" JSONB NOT NULL,
  "contentFormat" "LegalContentFormat" NOT NULL DEFAULT 'TIPTAP_JSON',
  "plainText" TEXT NOT NULL,
  "changeNote" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalDraftVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegalDraftVersion_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegalDraftVersion_legalDraftId_fkey"
    FOREIGN KEY ("legalDraftId") REFERENCES "LegalWriting"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LegalDraftVersion_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LegalDraftReview" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "legalDraftId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "reviewerId" TEXT,
  "status" "LegalDraftReviewStatus" NOT NULL DEFAULT 'PENDING',
  "comments" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "LegalDraftReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegalDraftReview_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegalDraftReview_legalDraftId_fkey"
    FOREIGN KEY ("legalDraftId") REFERENCES "LegalWriting"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LegalDraftReview_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "LegalDraftVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LegalDraftReview_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegalDraftReview_reviewerId_fkey"
    FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LegalDraftExport" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "legalDraftId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "format" "LegalDraftExportFormat" NOT NULL,
  "storageDocumentId" TEXT NOT NULL,
  "generatedById" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sha256" TEXT NOT NULL,
  "status" "LegalDraftExportStatus" NOT NULL DEFAULT 'COMPLETED',
  "idempotencyKey" TEXT,
  "optionsHash" TEXT NOT NULL,
  "exportOptions" JSONB,
  CONSTRAINT "LegalDraftExport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegalDraftExport_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegalDraftExport_legalDraftId_fkey"
    FOREIGN KEY ("legalDraftId") REFERENCES "LegalWriting"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LegalDraftExport_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "LegalDraftVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LegalDraftExport_storageDocumentId_fkey"
    FOREIGN KEY ("storageDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegalDraftExport_generatedById_fkey"
    FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 3. Indexes & Unique Constraints
CREATE INDEX IF NOT EXISTS "LegalDraftTemplate_organizationId_idx" ON "LegalDraftTemplate"("organizationId");
CREATE INDEX IF NOT EXISTS "LegalDraftTemplate_organizationId_isActive_idx" ON "LegalDraftTemplate"("organizationId", "isActive");
CREATE INDEX IF NOT EXISTS "LegalDraftTemplate_isSystemTemplate_isActive_idx" ON "LegalDraftTemplate"("isSystemTemplate", "isActive");
CREATE INDEX IF NOT EXISTS "LegalDraftTemplate_documentType_idx" ON "LegalDraftTemplate"("documentType");

CREATE INDEX IF NOT EXISTS "LegalWriting_organizationId_idx" ON "LegalWriting"("organizationId");
CREATE INDEX IF NOT EXISTS "LegalWriting_organizationId_status_idx" ON "LegalWriting"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "LegalWriting_organizationId_expedienteId_idx" ON "LegalWriting"("organizationId", "expedienteId");
CREATE INDEX IF NOT EXISTS "LegalWriting_organizationId_documentType_idx" ON "LegalWriting"("organizationId", "documentType");
CREATE INDEX IF NOT EXISTS "LegalWriting_organizationId_createdById_idx" ON "LegalWriting"("organizationId", "createdById");

CREATE UNIQUE INDEX IF NOT EXISTS "LegalDraftVersion_legalDraftId_versionNumber_key" ON "LegalDraftVersion"("legalDraftId", "versionNumber");
CREATE INDEX IF NOT EXISTS "LegalDraftVersion_organizationId_idx" ON "LegalDraftVersion"("organizationId");
CREATE INDEX IF NOT EXISTS "LegalDraftVersion_organizationId_legalDraftId_idx" ON "LegalDraftVersion"("organizationId", "legalDraftId");

CREATE INDEX IF NOT EXISTS "LegalDraftReview_organizationId_idx" ON "LegalDraftReview"("organizationId");
CREATE INDEX IF NOT EXISTS "LegalDraftReview_organizationId_legalDraftId_idx" ON "LegalDraftReview"("organizationId", "legalDraftId");
CREATE INDEX IF NOT EXISTS "LegalDraftReview_organizationId_versionId_idx" ON "LegalDraftReview"("organizationId", "versionId");

CREATE UNIQUE INDEX IF NOT EXISTS "LegalDraftExport_organizationId_idempotencyKey_key" ON "LegalDraftExport"("organizationId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "LegalDraftExport_organizationId_idx" ON "LegalDraftExport"("organizationId");
CREATE INDEX IF NOT EXISTS "LegalDraftExport_organizationId_legalDraftId_idx" ON "LegalDraftExport"("organizationId", "legalDraftId");
CREATE INDEX IF NOT EXISTS "LegalDraftExport_organizationId_versionId_format_optionsHash_idx"
  ON "LegalDraftExport"("organizationId", "versionId", "format", "optionsHash");

-- 4. Row-Level Security (ENABLE + FORCE) & Strict Policies
-- 4a. Strict single-tenant tables: LegalWriting, LegalDraftVersion, LegalDraftReview, LegalDraftExport
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'LegalWriting',
    'LegalDraftVersion',
    'LegalDraftReview',
    'LegalDraftExport'
  ]
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

-- 4b. LegalDraftTemplate: tenant templates + read-only system orientative templates (fail-closed without org context)
ALTER TABLE "LegalDraftTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LegalDraftTemplate" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_legaldrafttemplate_select ON "LegalDraftTemplate";
DROP POLICY IF EXISTS rls_legaldrafttemplate_insert ON "LegalDraftTemplate";
DROP POLICY IF EXISTS rls_legaldrafttemplate_update ON "LegalDraftTemplate";
DROP POLICY IF EXISTS rls_legaldrafttemplate_delete ON "LegalDraftTemplate";

CREATE POLICY rls_legaldrafttemplate_select ON "LegalDraftTemplate" FOR SELECT USING (
  current_setting('app.current_organization_id', true) IS NOT NULL
  AND current_setting('app.current_organization_id', true) <> ''
  AND (
    "organizationId" = current_setting('app.current_organization_id', true)
    OR ("isSystemTemplate" = true AND "organizationId" IS NULL)
  )
);

CREATE POLICY rls_legaldrafttemplate_insert ON "LegalDraftTemplate" FOR INSERT WITH CHECK (
  current_setting('app.current_organization_id', true) IS NOT NULL
  AND current_setting('app.current_organization_id', true) <> ''
  AND "isSystemTemplate" = false
  AND "organizationId" = current_setting('app.current_organization_id', true)
);

CREATE POLICY rls_legaldrafttemplate_update ON "LegalDraftTemplate" FOR UPDATE USING (
  current_setting('app.current_organization_id', true) IS NOT NULL
  AND current_setting('app.current_organization_id', true) <> ''
  AND "isSystemTemplate" = false
  AND "organizationId" = current_setting('app.current_organization_id', true)
) WITH CHECK (
  current_setting('app.current_organization_id', true) IS NOT NULL
  AND current_setting('app.current_organization_id', true) <> ''
  AND "isSystemTemplate" = false
  AND "organizationId" = current_setting('app.current_organization_id', true)
);

CREATE POLICY rls_legaldrafttemplate_delete ON "LegalDraftTemplate" FOR DELETE USING (
  current_setting('app.current_organization_id', true) IS NOT NULL
  AND current_setting('app.current_organization_id', true) <> ''
  AND "isSystemTemplate" = false
  AND "organizationId" = current_setting('app.current_organization_id', true)
);

-- 5. Least-Privilege Grants for abogados_app_user (NOBYPASSRLS)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'abogados_app_user') THEN
    REVOKE ALL ON TABLE
      "LegalWriting",
      "LegalDraftVersion",
      "LegalDraftTemplate",
      "LegalDraftReview",
      "LegalDraftExport"
    FROM abogados_app_user;

    -- LegalWriting: logical archive only (no physical DELETE)
    GRANT SELECT, INSERT, UPDATE ON TABLE "LegalWriting" TO abogados_app_user;
    -- LegalDraftVersion: strictly immutable append-only (NO UPDATE, NO DELETE)
    GRANT SELECT, INSERT ON TABLE "LegalDraftVersion" TO abogados_app_user;
    -- LegalDraftTemplate: logical archive only (no physical DELETE)
    GRANT SELECT, INSERT, UPDATE ON TABLE "LegalDraftTemplate" TO abogados_app_user;
    -- LegalDraftReview: create & resolve review decisions (no physical DELETE)
    GRANT SELECT, INSERT, UPDATE ON TABLE "LegalDraftReview" TO abogados_app_user;
    -- LegalDraftExport: immutable export ledger (append-only)
    GRANT SELECT, INSERT ON TABLE "LegalDraftExport" TO abogados_app_user;
  END IF;
END
$$;

-- 6. Seed orientative editable system templates (idempotent; clearly labeled as orientative models)
INSERT INTO "LegalDraftTemplate" (
  "id",
  "organizationId",
  "name",
  "description",
  "documentType",
  "content",
  "contentFormat",
  "isSystemTemplate",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES
(
  '00000000-0000-4000-8000-000000000901',
  NULL,
  'Modelo orientativo — Demanda Judicial (Editable)',
  'Estructura base orientativa y editable para escrito de demanda. Todos los datos procesales y fundamentos jurídicos deben ser completados y verificados por el profesional.',
  'DEMANDA',
  '{
    "type": "doc",
    "content": [
      {"type": "heading", "attrs": {"level": 2, "textAlign": "center"}, "content": [{"type": "text", "text": "PROMUEVE DEMANDA — [COMPLETAR OBJETO]"}]},
      {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "SEÑOR/A JUEZ:"}]},
      {"type": "paragraph", "attrs": {"textAlign": "justify"}, "content": [{"type": "text", "text": "[COMPLETAR NOMBRE Y CARÁCTER DE QUIEN COMPARECE], con domicilio real en [COMPLETAR DOMICILIO REAL] y constituyendo domicilio procesal en [COMPLETAR DOMICILIO PROCESAL], conjuntamente con el/la letrado/a [COMPLETAR NOMBRE Y MATRÍCULA PROFESIONAL], a V.S. respetuosamente me presento y digo:"}]},
      {"type": "heading", "attrs": {"level": 3, "textAlign": "left"}, "content": [{"type": "text", "text": "I. OBJETO"}]},
      {"type": "paragraph", "attrs": {"textAlign": "justify"}, "content": [{"type": "text", "text": "[COMPLETAR OBJETO DE LA DEMANDA Y PRETENSIÓN CONCRETA]."}]},
      {"type": "heading", "attrs": {"level": 3, "textAlign": "left"}, "content": [{"type": "text", "text": "II. HECHOS"}]},
      {"type": "paragraph", "attrs": {"textAlign": "justify"}, "content": [{"type": "text", "text": "[COMPLETAR RELATO CRONOLÓGICO Y VERIFICADO DE LOS HECHOS]."}]},
      {"type": "heading", "attrs": {"level": 3, "textAlign": "left"}, "content": [{"type": "text", "text": "III. DERECHO"}]},
      {"type": "paragraph", "attrs": {"textAlign": "justify"}, "content": [{"type": "text", "text": "[COMPLETAR NORMATIVA, DOCTRINA Y JURISPRUDENCIA APLICABLES VERIFICADAS POR EL PROFESIONAL]."}]},
      {"type": "heading", "attrs": {"level": 3, "textAlign": "left"}, "content": [{"type": "text", "text": "IV. PRUEBA"}]},
      {"type": "orderedList", "content": [
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Documental: [COMPLETAR DETALLE DE DOCUMENTACIÓN ADJUNTA]."}]}]},
        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Otros medios probatorios: [COMPLETAR SEGÚN CORRESPONDA]."}]}]}
      ]},
      {"type": "heading", "attrs": {"level": 3, "textAlign": "left"}, "content": [{"type": "text", "text": "V. PETITORIO"}]},
      {"type": "paragraph", "attrs": {"textAlign": "justify"}, "content": [{"type": "text", "text": "Por todo lo expuesto, a V.S. solicito: [COMPLETAR PETICIONES NUMERADAS]."}]},
      {"type": "horizontalRule"},
      {"type": "paragraph", "attrs": {"textAlign": "right"}, "content": [{"type": "text", "text": "Proveer de conformidad, SERÁ JUSTICIA."}]}
    ]
  }'::jsonb,
  'TIPTAP_JSON',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  '00000000-0000-4000-8000-000000000902',
  NULL,
  'Modelo orientativo — Contestación de Traslado / Escrito de Mero Trámite (Editable)',
  'Modelo editable orientativo para contestación de traslado o presentación simple ante el juzgado. Requiere revisión profesional completa.',
  'CONTESTACION_TRASLADO',
  '{
    "type": "doc",
    "content": [
      {"type": "heading", "attrs": {"level": 2, "textAlign": "center"}, "content": [{"type": "text", "text": "CONTESTA TRASLADO — [COMPLETAR REFERENCIA]"}]},
      {"type": "paragraph", "attrs": {"textAlign": "left"}, "content": [{"type": "text", "marks": [{"type": "bold"}], "text": "SEÑOR/A JUEZ:"}]},
      {"type": "paragraph", "attrs": {"textAlign": "justify"}, "content": [{"type": "text", "text": "[COMPLETAR NOMBRE Y REPRESENTACIÓN], en los autos caratulados \"[COMPLETAR CARÁTULA]\", Expte. N° [COMPLETAR NÚMERO], a V.S. respetuosamente digo:"}]},
      {"type": "heading", "attrs": {"level": 3, "textAlign": "left"}, "content": [{"type": "text", "text": "I. OBJETO"}]},
      {"type": "paragraph", "attrs": {"textAlign": "justify"}, "content": [{"type": "text", "text": "Vengo en legal tiempo y forma a contestar el traslado conferido con fecha [COMPLETAR FECHA], solicitando [COMPLETAR PRETENSIÓN]."}]},
      {"type": "heading", "attrs": {"level": 3, "textAlign": "left"}, "content": [{"type": "text", "text": "II. FUNDAMENTOS"}]},
      {"type": "paragraph", "attrs": {"textAlign": "justify"}, "content": [{"type": "text", "text": "[COMPLETAR ARGUMENTACIÓN FÁCTICA Y JURÍDICA VERIFICADA]."}]},
      {"type": "heading", "attrs": {"level": 3, "textAlign": "left"}, "content": [{"type": "text", "text": "III. PETITORIO"}]},
      {"type": "paragraph", "attrs": {"textAlign": "justify"}, "content": [{"type": "text", "text": "Solicito a V.S. tenga por contestado el traslado en tiempo y forma y resuelva conforme a derecho."}]}
    ]
  }'::jsonb,
  'TIPTAP_JSON',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

