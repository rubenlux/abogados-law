-- =============================================================================
-- AUTH-07 — Procedural Movements, Agenda Events & Deadlines Module Migration
-- Expediente: AUTH07-PROCEDURAL-MOVEMENTS-AGENDA-IMPLEMENTATION-001
-- Description: Creates separated domain models MovimientoProcesal, AgendaEvent,
--              and Vencimiento with strict organizationId scoping, indexes,
--              PostgreSQL RLS (ENABLE + FORCE) and least-privilege grants.
-- =============================================================================

-- 1. Create Enums Idempotently
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoMovimientoProcesal') THEN
    CREATE TYPE "TipoMovimientoProcesal" AS ENUM (
      'PRESENTACION', 'NOTIFICACION', 'PROVIDENCIA', 'RESOLUCION', 'SENTENCIA',
      'AUDIENCIA', 'DILIGENCIA', 'TRASLADO', 'CONTESTACION', 'RECURSO', 'OTRO'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrigenMovimiento') THEN
    CREATE TYPE "OrigenMovimiento" AS ENUM ('MANUAL', 'SISTEMA', 'IMPORTACION');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoEventoAgenda') THEN
    CREATE TYPE "TipoEventoAgenda" AS ENUM (
      'AUDIENCIA', 'REUNION_CLIENTE', 'REUNION_INTERNA', 'DILIGENCIA',
      'PRESENTACION_PROGRAMADA', 'LLAMADA', 'TRAMITE', 'OTRO'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoEventoAgenda') THEN
    CREATE TYPE "EstadoEventoAgenda" AS ENUM (
      'PROGRAMADO', 'CONFIRMADO', 'COMPLETADO', 'CANCELADO'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoVencimiento') THEN
    CREATE TYPE "TipoVencimiento" AS ENUM (
      'PROCESAL', 'DOCUMENTACION', 'PRESENTACION', 'ADMINISTRATIVO', 'INTERNO', 'OTRO'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PrioridadVencimiento') THEN
    CREATE TYPE "PrioridadVencimiento" AS ENUM ('BAJA', 'NORMAL', 'ALTA', 'CRITICA');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoVencimiento') THEN
    CREATE TYPE "EstadoVencimiento" AS ENUM ('PENDIENTE', 'EN_CURSO', 'CUMPLIDO', 'CANCELADO');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrigenFechaLimite') THEN
    CREATE TYPE "OrigenFechaLimite" AS ENUM ('MANUAL');
  END IF;
END $$;

-- 2. Table: MovimientoProcesal
CREATE TABLE IF NOT EXISTS "MovimientoProcesal" (
  "id"              TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "expedienteId"    TEXT NOT NULL,
  "tipo"            "TipoMovimientoProcesal" NOT NULL DEFAULT 'OTRO'::"TipoMovimientoProcesal",
  "titulo"          TEXT NOT NULL,
  "descripcion"     TEXT,
  "fechaActuacion"  TIMESTAMP(3) NOT NULL,
  "fechaRegistro"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "registradoPorId" TEXT NOT NULL,
  "origen"          "OrigenMovimiento" NOT NULL DEFAULT 'MANUAL'::"OrigenMovimiento",
  "referencia"      TEXT,
  "metadatos"       JSONB,
  "anuladoAt"       TIMESTAMP(3),
  "anuladoPorId"    TEXT,
  "anuladoMotivo"   TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MovimientoProcesal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MovimientoProcesal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "MovimientoProcesal_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "MovimientoProcesal_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "MovimientoProcesal_anuladoPorId_fkey" FOREIGN KEY ("anuladoPorId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "MovimientoProcesal_organizationId_idx" ON "MovimientoProcesal"("organizationId");
CREATE INDEX IF NOT EXISTS "MovimientoProcesal_organizationId_expedienteId_fechaActuacion_idx" ON "MovimientoProcesal"("organizationId", "expedienteId", "fechaActuacion");
CREATE INDEX IF NOT EXISTS "MovimientoProcesal_expedienteId_fechaActuacion_idx" ON "MovimientoProcesal"("expedienteId", "fechaActuacion");

-- 3. Table: AgendaEvent
CREATE TABLE IF NOT EXISTS "AgendaEvent" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "expedienteId"   TEXT,
  "titulo"         TEXT NOT NULL,
  "descripcion"    TEXT,
  "tipo"           "TipoEventoAgenda" NOT NULL DEFAULT 'OTRO'::"TipoEventoAgenda",
  "fechaInicio"    TIMESTAMP(3) NOT NULL,
  "fechaFin"       TIMESTAMP(3),
  "ubicacion"      TEXT,
  "estado"         "EstadoEventoAgenda" NOT NULL DEFAULT 'PROGRAMADO'::"EstadoEventoAgenda",
  "responsableId"  TEXT,
  "creadoPorId"    TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AgendaEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AgendaEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "AgendaEvent_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "AgendaEvent_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "AgendaEvent_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "AgendaEvent_organizationId_idx" ON "AgendaEvent"("organizationId");
CREATE INDEX IF NOT EXISTS "AgendaEvent_organizationId_fechaInicio_idx" ON "AgendaEvent"("organizationId", "fechaInicio");
CREATE INDEX IF NOT EXISTS "AgendaEvent_organizationId_estado_idx" ON "AgendaEvent"("organizationId", "estado");
CREATE INDEX IF NOT EXISTS "AgendaEvent_organizationId_responsableId_idx" ON "AgendaEvent"("organizationId", "responsableId");
CREATE INDEX IF NOT EXISTS "AgendaEvent_expedienteId_idx" ON "AgendaEvent"("expedienteId");

-- 4. Table: Vencimiento
CREATE TABLE IF NOT EXISTS "Vencimiento" (
  "id"                TEXT NOT NULL,
  "organizationId"    TEXT NOT NULL,
  "expedienteId"      TEXT,
  "titulo"            TEXT NOT NULL,
  "descripcion"       TEXT,
  "tipo"              "TipoVencimiento" NOT NULL DEFAULT 'PROCESAL'::"TipoVencimiento",
  "fechaLimite"       TIMESTAMP(3) NOT NULL,
  "origenFechaLimite" "OrigenFechaLimite" NOT NULL DEFAULT 'MANUAL'::"OrigenFechaLimite",
  "prioridad"         "PrioridadVencimiento" NOT NULL DEFAULT 'NORMAL'::"PrioridadVencimiento",
  "estado"            "EstadoVencimiento" NOT NULL DEFAULT 'PENDIENTE'::"EstadoVencimiento",
  "observaciones"     TEXT,
  "responsableId"     TEXT,
  "creadoPorId"       TEXT NOT NULL,
  "cumplidoAt"        TIMESTAMP(3),
  "cumplidoPorId"     TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Vencimiento_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Vencimiento_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "Vencimiento_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "Expediente"("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "Vencimiento_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "Vencimiento_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "Vencimiento_cumplidoPorId_fkey" FOREIGN KEY ("cumplidoPorId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "Vencimiento_organizationId_idx" ON "Vencimiento"("organizationId");
CREATE INDEX IF NOT EXISTS "Vencimiento_organizationId_fechaLimite_idx" ON "Vencimiento"("organizationId", "fechaLimite");
CREATE INDEX IF NOT EXISTS "Vencimiento_organizationId_estado_idx" ON "Vencimiento"("organizationId", "estado");
CREATE INDEX IF NOT EXISTS "Vencimiento_organizationId_prioridad_idx" ON "Vencimiento"("organizationId", "prioridad");
CREATE INDEX IF NOT EXISTS "Vencimiento_organizationId_responsableId_idx" ON "Vencimiento"("organizationId", "responsableId");
CREATE INDEX IF NOT EXISTS "Vencimiento_expedienteId_idx" ON "Vencimiento"("expedienteId");

-- 5. Enable and FORCE Row-Level Security on all 3 tables
ALTER TABLE "MovimientoProcesal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MovimientoProcesal" FORCE ROW LEVEL SECURITY;

ALTER TABLE "AgendaEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgendaEvent" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Vencimiento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vencimiento" FORCE ROW LEVEL SECURITY;

-- 6. Tenant RLS Policies for abogados_app_user
DO $$
DECLARE
  t TEXT;
  p_prefix TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['MovimientoProcesal', 'AgendaEvent', 'Vencimiento']
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

-- 7. Least-Privilege Grants for abogados_app_user (Category A Tenant Tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "MovimientoProcesal",
  "AgendaEvent",
  "Vencimiento"
TO abogados_app_user;

