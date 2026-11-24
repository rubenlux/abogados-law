# Modelo de Datos: Base Legal Argentina

## Diagrama Entidad-Relación

```
LegalNorm
├── Clasificación
│   ├── jurisdiccion (ENUM)
│   ├── fuero (ENUM)
│   └── tipoNorma (STRING)
├── Identificación
│   ├── nombre
│   ├── numeroNorma
│   ├── articulo
│   ├── inciso
│   └── apartado
├── Contenido
│   ├── textoCompleto
│   ├── textoNormalizado
│   ├── rawContent
│   └── embedding (vector)
├── Versionado
│   ├── versionNorma
│   ├── fechaVigencia
│   ├── fechaDerogacion
│   ├── estado (ENUM)
│   └── normaModificadoraId
├── Metadatos
│   ├── ambitoAplicacion
│   ├── fuenteOficialUrl
│   └── checksumTexto
├── Ingestion
│   ├── sourceType
│   ├── sourceUrl
│   ├── sourceFileHash
│   ├── parsedAt
│   ├── parsedBy
│   └── parsingVersion
├── Conflictos
│   ├── conflictsWith[]
│   ├── supersedes[]
│   └── supersededBy
├── Clasificación Semántica
│   ├── keywords[]
│   ├── conceptosJuridicos[]
│   └── temas[]
└── Auditoría
    ├── ingestedBy
    ├── verifiedBy
    ├── verifiedAt
    ├── createdAt
    └── updatedAt
```

---

## Enumeraciones

### LegalNormJurisdiccion

```prisma
enum LegalNormJurisdiccion {
  NACION
  CABA
  PBA      // Provincia de Buenos Aires
  CBA      // Córdoba
  SFE      // Santa Fe
}
```

**Extensible**: Agregar más provincias según necesidad.

### LegalNormFuero

```prisma
enum LegalNormFuero {
  CIVIL
  COMERCIAL
  PENAL
  LABORAL
  FAMILIA
  CONTENCIOSO_ADMINISTRATIVO
}
```

### LegalNormEstado

```prisma
enum LegalNormEstado {
  VIGENTE
  DEROGADA
  MODIFICADA
  ANULADA
}
```

---

## Campos Detallados

### 1. Clasificación

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `jurisdiccion` | Enum | Ámbito territorial | `NACION` |
| `fuero` | Enum | Rama del derecho | `CIVIL` |
| `tipoNorma` | String | Tipo de instrumento legal | `CODIGO`, `LEY`, `DECRETO` |

### 2. Identificación

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `nombre` | String | Nombre oficial | "Código Civil y Comercial" |
| `numeroNorma` | String? | Identificador legal | "Ley 26.994" |
| `articulo` | String | Número de artículo | "1109" |
| `inciso` | String? | Subdivisión | "a)" |
| `apartado` | String? | Sub-subdivisión | "1." |

**Unique Constraint**: `(jurisdiccion, numeroNorma, articulo, versionNorma)`

### 3. Contenido

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `textoCompleto` | Text | Texto original con formato |
| `textoNormalizado` | Text? | Texto limpio para embeddings |
| `rawContent` | Text? | Contenido crudo del parser |
| `embedding` | vector(1536)? | Vector semántico (pgvector) |

**Proceso**:
```
rawContent → Parser → textoCompleto → Normalización → textoNormalizado → Embedding → embedding
```

### 4. Versionado

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `versionNorma` | Int | Versión incremental (1, 2, 3...) |
| `fechaVigencia` | DateTime | Desde cuándo rige |
| `fechaDerogacion` | DateTime? | Hasta cuándo rigió |
| `estado` | Enum | Estado actual |
| `normaModificadoraId` | String? | ID de la norma que la reemplaza |

**Reglas**:
- Una norma `VIGENTE` no tiene `fechaDerogacion`
- Una norma `MODIFICADA` tiene `normaModificadoraId`
- Versiones incrementales comparten `numeroNorma` y `articulo`

### 5. Metadatos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `ambitoAplicacion` | String? | "Nacional", "Local", "Federal" |
| `fuenteOficialUrl` | String? | URL del Boletín Oficial, InfoLEG, etc. |
| `checksumTexto` | String? | SHA256 del `textoNormalizado` |

**Checksum**: Usado para deduplicación exacta.

### 6. Ingestion Metadata

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `sourceType` | String? | `PDF`, `HTML`, `API`, `MANUAL` |
| `sourceUrl` | String? | URL original del documento |
| `sourceFileHash` | String? | Hash del archivo fuente |
| `parsedAt` | DateTime? | Cuándo se parseó |
| `parsedBy` | String? | Script o usuario |
| `parsingVersion` | String? | Versión del parser (ej. "1.0.0") |

**Trazabilidad**: Permite reproducir la ingesta.

### 7. Conflict Detection

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `conflictsWith` | String[] | IDs de normas en conflicto |
| `supersedes` | String[] | IDs de normas que esta reemplaza |
| `supersededBy` | String? | ID de norma que reemplaza a esta |

**Uso**: Detectar contradicciones normativas.

### 8. Clasificación Semántica

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `keywords` | String[] | Top 10 palabras clave |
| `conceptosJuridicos` | String[] | Conceptos detectados (ej. "responsabilidad civil") |
| `temas` | String[] | Clasificación temática (futuro ML) |

**Generación**: Automática en `TextNormalizationService`.

### 9. Auditoría

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `ingestedBy` | String? | User ID que ingresó |
| `verifiedBy` | String? | User ID que verificó |
| `verifiedAt` | DateTime? | Cuándo se verificó |
| `createdAt` | DateTime | Timestamp de creación |
| `updatedAt` | DateTime | Última modificación |

---

## Índices

### Índices Creados

```prisma
@@index([jurisdiccion, fuero, estado])
@@index([tipoNorma, numeroNorma])
@@index([checksumTexto])
@@unique([jurisdiccion, numeroNorma, articulo, versionNorma])
```

### Índice Vectorial (pgvector)

```sql
CREATE INDEX ON "LegalNorm" USING hnsw (embedding vector_cosine_ops);
```

**Parámetros HNSW**:
- `m`: 16 (conexiones por nodo)
- `ef_construction`: 64 (precisión en construcción)

---

## Queries Comunes

### 1. Buscar última versión vigente

```typescript
prisma.legalNorm.findFirst({
    where: {
        numeroNorma: 'Ley 26.994',
        articulo: '1109',
        estado: 'VIGENTE'
    },
    orderBy: { versionNorma: 'desc' }
})
```

### 2. Búsqueda semántica

```sql
SELECT *, 1 - (embedding <=> $query_vector) as similarity
FROM "LegalNorm"
WHERE embedding IS NOT NULL
AND jurisdiccion = 'NACION'
AND estado = 'VIGENTE'
ORDER BY embedding <=> $query_vector ASC
LIMIT 10;
```

### 3. Detectar duplicados

```typescript
prisma.legalNorm.findFirst({
    where: { checksumTexto: hash }
})
```

### 4. Historial de versiones

```typescript
prisma.legalNorm.findMany({
    where: {
        numeroNorma: 'Ley 26.994',
        articulo: '1109'
    },
    orderBy: { versionNorma: 'desc' }
})
```

---

## Migraciones

### Migración Actual

```
20260123_extend_legal_norm_ingestion
```

**Cambios**:
- Agregados campos de ingestion metadata
- Agregados campos de conflict detection
- Agregado `textoNormalizado`
- Agregado `apartado`
- Agregados índices adicionales
- Agregado unique constraint

---

## Tamaño Estimado

### Por Norma

- Metadata: ~500 bytes
- `textoCompleto`: ~2 KB (promedio artículo)
- `textoNormalizado`: ~1.5 KB
- `embedding`: 6 KB (1536 floats × 4 bytes)
- **Total**: ~10 KB por artículo

### Base Completa

| Corpus | Artículos | Tamaño Estimado |
|--------|-----------|-----------------|
| Códigos Principales | ~15,000 | 150 MB |
| Leyes Nacionales | ~50,000 | 500 MB |
| Decretos | ~30,000 | 300 MB |
| Jurisprudencia (seleccionada) | ~10,000 | 100 MB |
| **Total** | **~105,000** | **~1 GB** |

**Con índices**: ~1.5 GB

---

## Extensiones Futuras

### 1. Relaciones entre Normas

```prisma
model NormRelation {
  id          String @id @default(uuid())
  sourceId    String
  targetId    String
  relationType String // "MODIFICA", "DEROGA", "REGLAMENTA", "CITA"
  
  source      LegalNorm @relation("source", fields: [sourceId])
  target      LegalNorm @relation("target", fields: [targetId])
}
```

### 2. Anotaciones de Usuarios

```prisma
model NormAnnotation {
  id        String @id @default(uuid())
  normId    String
  userId    String
  content   String
  isPublic  Boolean
  
  norm      LegalNorm @relation(fields: [normId])
  user      User @relation(fields: [userId])
}
```

### 3. Caché de Embeddings

```prisma
model EmbeddingCache {
  id        String @id @default(uuid())
  textHash  String @unique
  embedding Unsupported("vector(1536)")
  createdAt DateTime @default(now())
}
```
