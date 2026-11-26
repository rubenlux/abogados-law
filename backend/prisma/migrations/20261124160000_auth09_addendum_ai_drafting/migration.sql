-- =============================================================================
-- AUTH-09 ADDENDUM — Generador de Escritos con IA, Catálogo de Contratos y
-- Plantillas Versionadas con Variables (Incremental, Idempotent, Non-Destructive)
-- =============================================================================

-- 1. New Enum: LegalDraftCategory
DO $$ BEGIN
  CREATE TYPE "LegalDraftCategory" AS ENUM ('ESCRITO_JUDICIAL', 'CONTRATO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Extend LegalDraftDocumentType enum additively
ALTER TYPE "LegalDraftDocumentType" ADD VALUE IF NOT EXISTS 'EXCEPCION';
ALTER TYPE "LegalDraftDocumentType" ADD VALUE IF NOT EXISTS 'APERTURA_PRUEBA';
ALTER TYPE "LegalDraftDocumentType" ADD VALUE IF NOT EXISTS 'APELACION';
ALTER TYPE "LegalDraftDocumentType" ADD VALUE IF NOT EXISTS 'PRONTO_DESPACHO';
ALTER TYPE "LegalDraftDocumentType" ADD VALUE IF NOT EXISTS 'ESCRITO_LIBRE';
ALTER TYPE "LegalDraftDocumentType" ADD VALUE IF NOT EXISTS 'CONTRATO_LOCACION';
ALTER TYPE "LegalDraftDocumentType" ADD VALUE IF NOT EXISTS 'CONTRATO_SERVICIOS';
ALTER TYPE "LegalDraftDocumentType" ADD VALUE IF NOT EXISTS 'CONTRATO_NDA';
ALTER TYPE "LegalDraftDocumentType" ADD VALUE IF NOT EXISTS 'CONTRATO_COMPRAVENTA';
ALTER TYPE "LegalDraftDocumentType" ADD VALUE IF NOT EXISTS 'CONTRATO_MUTUO';
ALTER TYPE "LegalDraftDocumentType" ADD VALUE IF NOT EXISTS 'OTRO_CONTRATO';

-- 3. LegalDraftTemplate additive columns (versioning, variables, instructions, jurisdiction/fuero)
ALTER TABLE "LegalDraftTemplate"
  ADD COLUMN IF NOT EXISTS "category" "LegalDraftCategory" NOT NULL DEFAULT 'ESCRITO_JUDICIAL',
  ADD COLUMN IF NOT EXISTS "versionNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "baseInstructions" TEXT,
  ADD COLUMN IF NOT EXISTS "variables" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "requiredInfo" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "jurisdiction" TEXT,
  ADD COLUMN IF NOT EXISTS "fuero" TEXT;

CREATE INDEX IF NOT EXISTS "LegalDraftTemplate_category_idx" ON "LegalDraftTemplate"("category");

-- 4. LegalWriting additive columns & optional expedienteId (contracts / sin causa)
ALTER TABLE "LegalWriting"
  ALTER COLUMN "expedienteId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "category" "LegalDraftCategory" NOT NULL DEFAULT 'ESCRITO_JUDICIAL',
  ADD COLUMN IF NOT EXISTS "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "aiMetadata" JSONB;

CREATE INDEX IF NOT EXISTS "LegalWriting_organizationId_category_idx"
  ON "LegalWriting"("organizationId", "category");

-- 5. LegalDraftVersion additive AI trace columns
ALTER TABLE "LegalDraftVersion"
  ADD COLUMN IF NOT EXISTS "generatedByAi" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "aiMetadata" JSONB;

-- 6. Enrich existing seeded system templates & add orientative contract templates (idempotent)
UPDATE "LegalDraftTemplate"
SET
  "category" = 'ESCRITO_JUDICIAL',
  "baseInstructions" = 'Redactar demanda judicial completa con estructura formal argentina (encabezado, comparecencia, objeto, hechos, derecho, prueba y petitorio) usando solo datos verificados.',
  "variables" = '["caratula","numero_expediente","tribunal","actor","demandado","objeto","hechos","derecho","prueba","petitorio"]'::jsonb,
  "requiredInfo" = '["Identificación de actor y demandado","Relato de hechos verificados","Pretensión concreta","Documentación de respaldo"]'::jsonb
WHERE "id" = '00000000-0000-4000-8000-000000000901';

UPDATE "LegalDraftTemplate"
SET
  "category" = 'ESCRITO_JUDICIAL',
  "baseInstructions" = 'Responder el traslado conferido respetando el expediente y sus actuaciones sin inventar hechos ni citas normativas.',
  "variables" = '["caratula","numero_expediente","tribunal","actor","demandado","objeto","hechos","derecho","petitorio"]'::jsonb,
  "requiredInfo" = '["Fecha y objeto del traslado","Argumentos de respuesta verificados"]'::jsonb
WHERE "id" = '00000000-0000-4000-8000-000000000902';

INSERT INTO "LegalDraftTemplate" (
  "id",
  "organizationId",
  "name",
  "description",
  "category",
  "documentType",
  "versionNumber",
  "baseInstructions",
  "variables",
  "requiredInfo",
  "content",
  "contentFormat",
  "isSystemTemplate",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES
(
  '00000000-0000-4000-8000-000000000903',
  NULL,
  'Modelo orientativo — Contrato de Locación de Inmueble (Editable)',
  'Estructura orientativa editable para contrato de locación de inmueble. No constituye modelo oficial ni reemplaza revisión profesional.',
  'CONTRATO',
  'CONTRATO_LOCACION',
  1,
  'Redactar contrato de locación de inmueble con cláusulas típicas (objeto, plazo, precio, ajustes, destino, obligaciones, garantía y jurisdicción), dejando pendientes todos los datos no provistos.',
  '["locador","locatario","inmueble","plazo","canon_mensual","domicilio_inmueble","jurisdiccion"]'::jsonb,
  '["Datos de locador y locatario","Ubicación del inmueble","Plazo y canon mensual","Garantía convenida"]'::jsonb,
  '{
    "type": "doc",
    "content": [
      {"type": "heading", "attrs": {"level": 2, "textAlign": "center"}, "content": [{"type": "text", "text": "CONTRATO DE LOCACIÓN DE INMUEBLE"}]},
      {"type": "paragraph", "attrs": {"textAlign": "justify"}, "content": [{"type": "text", "text": "Entre {{locador}} (en adelante, el LOCADOR) y {{locatario}} (en adelante, el LOCATARIO), celebran el presente Contrato de Locación sujeto a las siguientes cláusulas:"}]},
      {"type": "heading", "attrs": {"level": 3, "textAlign": "left"}, "content": [{"type": "text", "text": "PRIMERA — OBJETO"}]},
      {"type": "paragraph", "attrs": {"textAlign": "justify"}, "content": [{"type": "text", "text": "El LOCADOR cede en locación al LOCATARIO el inmueble ubicado en {{domicilio_inmueble}}, destinado exclusivamente a [DATO PENDIENTE DE CONFIRMAR: destino]."}]},
      {"type": "heading", "attrs": {"level": 3, "textAlign": "left"}, "content": [{"type": "text", "text": "SEGUNDA — PLAZO Y CANON"}]},
      {"type": "paragraph", "attrs": {"textAlign": "justify"}, "content": [{"type": "text", "text": "El plazo de vigencia se fija en {{plazo}}, pactándose un canon mensual de {{canon_mensual}}."}]}
    ]
  }'::jsonb,
  'TIPTAP_JSON',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  '00000000-0000-4000-8000-000000000904',
  NULL,
  'Modelo orientativo — Acuerdo de Confidencialidad / NDA (Editable)',
  'Modelo orientativo editable para acuerdo de confidencialidad bilateral o unilateral. Requiere validación legal específica.',
  'CONTRATO',
  'CONTRATO_NDA',
  1,
  'Redactar acuerdo de confidencialidad (NDA) definiendo información confidencial, exclusiones, obligaciones de resguardo, vigencia y jurisdicción aplicable.',
  '["parte_divulgadora","parte_receptora","objeto","vigencia","jurisdiccion"]'::jsonb,
  '["Identificación de partes","Alcance de la información confidencial","Plazo de confidencialidad"]'::jsonb,
  '{
    "type": "doc",
    "content": [
      {"type": "heading", "attrs": {"level": 2, "textAlign": "center"}, "content": [{"type": "text", "text": "ACUERDO DE CONFIDENCIALIDAD (NDA)"}]},
      {"type": "paragraph", "attrs": {"textAlign": "justify"}, "content": [{"type": "text", "text": "Entre {{parte_divulgadora}} y {{parte_receptora}}, en relación con {{objeto}}, las partes acuerdan las siguientes cláusulas de confidencialidad:"}]},
      {"type": "heading", "attrs": {"level": 3, "textAlign": "left"}, "content": [{"type": "text", "text": "PRIMERA — INFORMACIÓN CONFIDENCIAL"}]},
      {"type": "paragraph", "attrs": {"textAlign": "justify"}, "content": [{"type": "text", "text": "[DATO PENDIENTE DE CONFIRMAR: alcance específico de la información protegida]."}]},
      {"type": "heading", "attrs": {"level": 3, "textAlign": "left"}, "content": [{"type": "text", "text": "SEGUNDA — VIGENCIA"}]},
      {"type": "paragraph", "attrs": {"textAlign": "justify"}, "content": [{"type": "text", "text": "Las obligaciones de reserva regirán por un plazo de {{vigencia}}."}]}
    ]
  }'::jsonb,
  'TIPTAP_JSON',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

