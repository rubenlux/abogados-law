# Modelo de Datos (Esquema Relacional)

## Entidades Principales

### 1. Organización (Tenant)
*   `id`: UUID
*   `name`: String
*   `cuit`: String
*   `plan`: Enum (STARTER, PRO, ENTERPRISE)
*   `settings`: JSONB (configuraciones visuales, notificaciones)

### 2. Usuario
*   `id`: UUID
*   `organization_id`: UUID (FK)
*   `email`: String (Unique)
*   `password_hash`: String
*   `role`: Enum (ADMIN, ABOGADO, PARALEGAL, CLIENTE)
*   `permissions`: JSONB (overrides específicos)
*   `log_audit`: Boolean

### 3. Expediente (CaseFile)
*   `id`: UUID
*   `caratula`: String
*   `numero_expediente`: String
*   `juzgado`: String
*   `jurisdiccion`: String
*   `estado`: Enum (INICIO, PRUEBA, ALEGATOS, SENTENCIA, ARCHIVADO)
*   `tags`: String[]
*   `created_at`: Datetime
*   `updated_at`: Datetime

### 4. Documento
*   `id`: UUID
*   `expediente_id`: UUID (FK)
*   `tipo`: Enum (ESCRITO, CEDULA, SENTENCIA, PRUEBA)
*   `storage_path`: String
*   `hash_sha256`: String (Integridad)
*   `ocr_content`: Text (Contenido extraído para búsqueda)
*   `version`: Int

### 5. EventoAgenda (Calendar)
*   `id`: UUID
*   `expediente_id`: UUID (FK)
*   `titulo`: String
*   `fecha_vencimiento`: Datetime
*   `tipo_plazo`: Enum (FATAL, ORDINARIO)
*   `alertas_config`: JSONB (cuando avisar)

### 6. LegalKnowledgeBase (RAG)
*   `id`: UUID
*   `tipo`: Enum (CODIGO_CIVIL, CODIGO_PENAL, JURISPRUDENCIA)
*   `articulo`: String
*   `texto`: Text
*   `embedding`: Vector(1536)  -- pgvector
*   `metadata`: JSONB (fuente, fecha_vigencia, rama_derecho)
*   `last_updated`: Datetime

### 7. AuditLog (Seguridad Forense)
*   `id`: UUID
*   `user_id`: UUID
*   `action`: String
*   `entity_id`: UUID
*   `entity_table`: String
*   `old_values`: JSONB
*   `new_values`: JSONB
*   `ip_address`: String
*   `user_agent`: String
*   `prev_hash`: String (Cadena de custodia)
*   `timestamp`: Datetime

## SQL Script (Ejemplo Breve)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE legal_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB
);

-- Indices para búsqueda rápida
CREATE INDEX ON legal_embeddings USING hnsw (embedding vector_cosine_ops);
```
