# Modelo de Datos - Motor de Jurisprudencia

## Fecha: 2026-01-22

## Visión General

El motor de jurisprudencia implementa un sistema RAG (Retrieval-Augmented Generation) especializado para fallos judiciales argentinos, con soporte para:

- **Chunking inteligente** por considerandos y doctrina
- **Ranking jerárquico** basado en tribunal, precedencia y similitud semántica
- **Grafo de citaciones** para análisis de jurisprudencia relacionada
- **Embeddings multinivel** (fallo completo + chunks individuales)

## Modelos Principales

### 1. Jurisprudence

Representa un fallo judicial completo.

```prisma
model Jurisprudence {
  id                String                    @id @default(uuid())
  
  // Identificación del Fallo
  tribunal          JurisprudenceTribunal
  sala              String?
  nroExpediente     String
  fecha             DateTime
  
  // Clasificación
  jurisdiccion      LegalNormJurisdiccion
  fuero             LegalNormFuero
  tema              String[]
  
  // Contenido
  resumen           String                    @db.Text
  textoCompleto     String                    @db.Text
  
  // Jerarquía y Vinculación
  precedencia       JurisprudencePrecedencia  @default(REFERENCIAL)
  vigencia          JurisprudenceVigencia     @default(VIGENTE)
  
  // Metadatos
  fuenteOficialUrl  String?
  caratula          String?
  magistrados       String[]
  votos             Json?
  
  // Vector Embedding (Full Text)
  embedding         Unsupported("vector(1536)")?
  
  // Relaciones
  chunks            JurisprudenceChunk[]
  citedBy           JurisprudenceCitation[]   @relation("CitingCase")
  cites             JurisprudenceCitation[]   @relation("CitedCase")
  
  @@unique([tribunal, nroExpediente, fecha])
}
```

**Campos Clave:**

- `tribunal`: Jerarquía del tribunal (CSJN, Cámaras, Juzgados)
- `precedencia`: Nivel de vinculación (PLENARIO > OBLIGATORIO > PERSUASIVO > REFERENCIAL)
- `vigencia`: Estado actual (VIGENTE, MODIFICADO, SUPERADO, DEROGADO)
- `embedding`: Vector de 1536 dimensiones del texto completo
- `chunks`: Relación 1:N con chunks (considerandos, doctrina)

### 2. JurisprudenceChunk

Representa un fragmento semántico del fallo (considerando, doctrina, resolutivo).

```prisma
model JurisprudenceChunk {
  id                String                    @id @default(uuid())
  
  jurisprudenceId   String
  jurisprudence     Jurisprudence             @relation(...)
  
  // Chunk Info
  chunkType         String                    // "CONSIDERANDO", "DOCTRINA", "RESOLUTIVO"
  chunkNumber       Int
  texto             String                    @db.Text
  
  // Vector Embedding (Chunk-level)
  embedding         Unsupported("vector(1536)")?
  
  // Metadata
  keywords          String[]
  conceptosJuridicos String[]
}
```

**Ventajas del Chunking:**

1. **Precisión**: Búsqueda granular en considerandos específicos
2. **Contexto**: Extracción de doctrina y conceptos jurídicos por sección
3. **Performance**: Embeddings más pequeños y focalizados
4. **Citación**: Referencia exacta a considerandos específicos

### 3. JurisprudenceCitation

Grafo de citaciones entre fallos.

```prisma
model JurisprudenceCitation {
  id                String                    @id @default(uuid())
  
  citingCaseId      String
  citingCase        Jurisprudence             @relation("CitingCase", ...)
  
  citedCaseId       String
  citedCase         Jurisprudence             @relation("CitedCase", ...)
  
  citationType      String                    // "SIGUE", "DISTINGUE", "CRITICA"
  context           String?                   @db.Text
  
  @@unique([citingCaseId, citedCaseId])
}
```

**Tipos de Citación:**

- `SIGUE`: El fallo citante sigue la doctrina del citado
- `DISTINGUE`: Distingue el caso del precedente
- `CRITICA`: Critica o se aparta del precedente

## Enums

### JurisprudenceTribunal

Jerarquía de tribunales argentinos:

```typescript
enum JurisprudenceTribunal {
  CSJN              // Corte Suprema de Justicia de la Nación (máxima autoridad)
  CAMARA_FEDERAL    // Cámaras Federales de Apelaciones
  CAMARA_NACIONAL   // Cámaras Nacionales de Apelaciones
  CAMARA_PROVINCIAL // Cámaras Provinciales
  TRIBUNAL_SUPERIOR // Tribunales Superiores Provinciales
  JUZGADO_FEDERAL   // Juzgados Federales de Primera Instancia
  JUZGADO_NACIONAL  // Juzgados Nacionales
  JUZGADO_PROVINCIAL // Juzgados Provinciales
}
```

**Peso de Jerarquía** (usado en ranking):
- CSJN: 100
- TRIBUNAL_SUPERIOR: 80
- CAMARA_FEDERAL: 70
- CAMARA_NACIONAL: 65
- CAMARA_PROVINCIAL: 60
- JUZGADO_FEDERAL: 40
- JUZGADO_NACIONAL: 35
- JUZGADO_PROVINCIAL: 30

### JurisprudencePrecedencia

Nivel de vinculación del fallo:

```typescript
enum JurisprudencePrecedencia {
  PLENARIO          // Fallo plenario (máxima vinculación)
  OBLIGATORIO       // Jurisprudencia obligatoria
  PERSUASIVO        // Valor persuasivo
  REFERENCIAL       // Solo referencial
}
```

**Peso de Precedencia** (usado en ranking):
- PLENARIO: 100
- OBLIGATORIO: 80
- PERSUASIVO: 50
- REFERENCIAL: 20

### JurisprudenceVigencia

Estado de vigencia del fallo:

```typescript
enum JurisprudenceVigencia {
  VIGENTE           // Vigente y aplicable
  MODIFICADO        // Modificado por fallo posterior
  SUPERADO          // Superado por nueva jurisprudencia
  DEROGADO          // Derogado o sin efecto
}
```

**Penalización en Ranking**:
- VIGENTE: 0% (sin penalización)
- MODIFICADO: -20%
- SUPERADO: -40%
- DEROGADO: -80%

## Índices y Optimizaciones

### Índices Principales

```prisma
@@unique([tribunal, nroExpediente, fecha])  // Prevenir duplicados
@@index([tribunal, fecha])                   // Búsqueda por tribunal y fecha
@@index([jurisdiccion, fuero])               // Filtrado por clasificación
@@index([precedencia, vigencia])             // Filtrado por jerarquía
@@index([tema])                              // Búsqueda por tema
```

### Índices de Chunks

```prisma
@@index([jurisprudenceId])  // Join con fallo principal
@@index([chunkType])        // Filtrado por tipo de chunk
```

### Índices de Citaciones

```prisma
@@unique([citingCaseId, citedCaseId])  // Prevenir citaciones duplicadas
@@index([citedCaseId])                 // Búsqueda inversa (quién me cita)
```

## Estrategia de Embeddings

### Doble Nivel de Embeddings

1. **Full-Text Embedding** (en `Jurisprudence.embedding`):
   - Embedding del resumen + texto completo
   - Usado para búsqueda general de fallos
   - Dimensión: 1536 (OpenAI text-embedding-3-small)

2. **Chunk-Level Embeddings** (en `JurisprudenceChunk.embedding`):
   - Embedding de cada considerando/doctrina/resolutivo
   - Usado para búsqueda granular
   - Permite citar considerandos específicos
   - Dimensión: 1536

### Ventajas del Doble Nivel

- **Flexibilidad**: Búsqueda general o granular según necesidad
- **Precisión**: Chunks permiten identificar secciones exactas
- **Performance**: Búsqueda en chunks es más rápida para queries específicas
- **Contexto**: Mantener el fallo completo para contexto general

## Relaciones y Cardinalidad

```
Jurisprudence (1) ----< (N) JurisprudenceChunk
    |
    |
    +----< (N) JurisprudenceCitation (citingCase)
    |
    +----< (N) JurisprudenceCitation (citedCase)
```

## Metadata de Ingesta

Todos los modelos incluyen metadata de trazabilidad:

- `sourceType`: Origen del dato (CSJN_API, SCRAPING, MANUAL)
- `sourceUrl`: URL original
- `sourceFileHash`: Hash del archivo fuente
- `parsedAt`: Fecha de parsing
- `parsedBy`: Usuario/sistema que ingresó
- `parsingVersion`: Versión del parser

## Auditoría

- `ingestedBy`: Usuario que ingresó el fallo
- `verifiedBy`: Usuario que verificó (opcional)
- `verifiedAt`: Fecha de verificación
- `createdAt`: Timestamp de creación
- `updatedAt`: Timestamp de última actualización

## Casos de Uso

### 1. Búsqueda Semántica General

```typescript
// Buscar fallos sobre "responsabilidad civil"
GET /jurisprudence/search?query=responsabilidad civil&searchMode=full
```

Usa `Jurisprudence.embedding` para encontrar fallos similares.

### 2. Búsqueda Granular en Considerandos

```typescript
// Buscar considerandos específicos sobre "nexo causal"
GET /jurisprudence/search?query=nexo causal&searchMode=chunks
```

Usa `JurisprudenceChunk.embedding` y agrupa por fallo.

### 3. Análisis de Precedentes

```typescript
// Obtener todos los fallos que citan a un precedente
GET /jurisprudence/related/:id
```

Usa `JurisprudenceCitation` para construir el grafo.

### 4. Filtrado por Jerarquía

```typescript
// Solo fallos de CSJN con precedencia PLENARIO
GET /jurisprudence/search?query=...&tribunal=CSJN&precedencia=PLENARIO
```

Combina búsqueda semántica con filtros estrictos.

## Consideraciones de Performance

### Tamaño de Vectores

- **1 fallo** = 1 embedding full-text + N embeddings de chunks
- **Promedio**: ~5-10 chunks por fallo
- **Storage**: ~6-12 KB por fallo (vectores)

### Optimizaciones

1. **Índices pgvector**: Usar HNSW para búsqueda rápida
2. **Chunking inteligente**: Evitar chunks muy pequeños (<50 palabras)
3. **Caching**: Cachear resultados de búsquedas frecuentes
4. **Lazy loading**: Cargar chunks solo cuando se necesitan

## Extensibilidad

El modelo está diseñado para soportar:

- ✅ Múltiples jurisdicciones
- ✅ Diferentes tipos de tribunales
- ✅ Versionado de fallos (modificaciones)
- ✅ Grafo de citaciones complejo
- ✅ Metadata extensible (JSON en `votos`)
- ✅ Auditoría completa

## Próximos Pasos

1. **Ingesta Automática**: Scrapers para CSJN, CIJ, etc.
2. **Análisis de Citaciones**: Detección automática de citas en texto
3. **Visualización de Grafo**: Frontend para explorar red de citaciones
4. **Sugerencias Inteligentes**: Recomendar precedentes relevantes
5. **Alertas**: Notificar cuando un precedente es modificado/superado
