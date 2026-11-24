# Motor de Jurisprudencia - Implementación RAG

## Fecha: 2026-01-22

## Visión General

El **Motor de Jurisprudencia** es un sistema RAG (Retrieval-Augmented Generation) especializado para fallos judiciales argentinos que combina:

1. **Chunking Inteligente** - División semántica por considerandos y doctrina
2. **Ranking Jerárquico** - Ponderación por tribunal, precedencia y similitud
3. **Búsqueda Multinivel** - Full-text y chunk-level search
4. **Grafo de Citaciones** - Red de precedentes y doctrina

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    JURISPRUDENCE ENGINE                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Ingestion  │  │   Chunking   │  │   Ranking    │     │
│  │   Pipeline   │→ │   Service    │→ │   Service    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │            │
│         ↓                  ↓                  ↓            │
│  ┌──────────────────────────────────────────────────┐     │
│  │           PostgreSQL + pgvector                  │     │
│  │  • Jurisprudence (full-text embeddings)          │     │
│  │  • JurisprudenceChunk (chunk embeddings)         │     │
│  │  • JurisprudenceCitation (citation graph)        │     │
│  └──────────────────────────────────────────────────┘     │
│         │                                                  │
│         ↓                                                  │
│  ┌──────────────┐                                         │
│  │   Search     │  ← Query + Filters                      │
│  │   Service    │  → Ranked Results                       │
│  └──────────────┘                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Componentes Principales

### 1. Jurisprudence Chunking Service

**Responsabilidad**: División inteligente de fallos en chunks semánticos.

**Estrategias de Chunking**:

#### A. Extracción de Considerandos

Detecta múltiples patrones:

```typescript
// Patrón 1: "CONSIDERANDO:" explícito
CONSIDERANDO: Que el demandado...

// Patrón 2: Numeración romana
I.- Que en autos se ha acreditado...
II.- Que la responsabilidad civil...

// Patrón 3: Numeración arábiga
1.- Que corresponde analizar...
2.- Que el nexo causal...
```

**Algoritmo**:
1. Buscar patrón "CONSIDERANDO:"
2. Si no hay, buscar numeración romana (I, II, III...)
3. Si no hay, buscar numeración arábiga (1, 2, 3...)
4. Fallback: dividir por párrafos largos (>100 chars)

#### B. Extracción de Doctrina

Identifica citas de jurisprudencia y doctrina legal:

```typescript
// Patrones detectados:
- "Fallos: 328:1234"
- "CSJN, 'Pérez c/ González', 2020"
- "esta Corte ha sostenido que..."
- "la jurisprudencia pacífica establece..."
```

#### C. Extracción de Resolutivos

Identifica la parte dispositiva del fallo:

```typescript
// Patrones:
- "RESUELVE:"
- "FALLA:"
- "SE RESUELVE:"
- "POR ELLO... RESUELVE:"
```

**Metadata Extraída por Chunk**:
- `keywords`: Top 10 palabras más frecuentes (excluyendo stopwords)
- `conceptosJuridicos`: Términos legales detectados (responsabilidad, culpa, dolo, etc.)

### 2. Jurisprudence Ranking Service

**Responsabilidad**: Calcular score de ranking combinado.

**Fórmula de Ranking**:

```
Score Final = (Similitud × 40%) + (Tribunal × 30%) + (Precedencia × 20%) + (Actualidad × 10%) × (1 - Penalización Vigencia)
```

#### Componentes del Score:

**1. Similitud Semántica (40%)**
- Similitud coseno entre query y embedding
- Rango: 0-1
- Peso: 40% del score total

**2. Jerarquía del Tribunal (30%)**

| Tribunal | Peso |
|----------|------|
| CSJN | 100 |
| TRIBUNAL_SUPERIOR | 80 |
| CAMARA_FEDERAL | 70 |
| CAMARA_NACIONAL | 65 |
| CAMARA_PROVINCIAL | 60 |
| JUZGADO_FEDERAL | 40 |
| JUZGADO_NACIONAL | 35 |
| JUZGADO_PROVINCIAL | 30 |

**3. Precedencia (20%)**

| Precedencia | Peso |
|-------------|------|
| PLENARIO | 100 |
| OBLIGATORIO | 80 |
| PERSUASIVO | 50 |
| REFERENCIAL | 20 |

**4. Actualidad (10%)**

Decaimiento exponencial con el tiempo:

```typescript
actualidadScore = exp(-años / 10)

// Ejemplos:
// Fallo de este año: 1.0
// Fallo de hace 5 años: 0.6
// Fallo de hace 10 años: 0.4
// Fallo de hace 20 años: 0.2
```

**5. Penalización por Vigencia**

| Vigencia | Penalización |
|----------|--------------|
| VIGENTE | 0% |
| MODIFICADO | -20% |
| SUPERADO | -40% |
| DEROGADO | -80% |

#### Ejemplo de Cálculo:

```typescript
// Caso: Fallo de CSJN, PLENARIO, de hace 3 años, VIGENTE
// Query: "responsabilidad civil"

Similitud: 0.85
Tribunal: CSJN = 100/100 = 1.0
Precedencia: PLENARIO = 100/100 = 1.0
Actualidad: exp(-3/10) = 0.74

Score = (0.85 × 40) + (1.0 × 30) + (1.0 × 20) + (0.74 × 10)
      = 34 + 30 + 20 + 7.4
      = 91.4

Penalización: VIGENTE = 0%
Score Final = 91.4 × (1 - 0) = 91.4
```

### 3. Jurisprudence Ingestion Service

**Responsabilidad**: Pipeline completo de ingesta con embeddings.

**Flujo de Ingesta**:

```
1. Validación de Datos
   ↓
2. Detección de Duplicados (tribunal + nroExpediente + fecha)
   ↓
3. Generación de Embedding Full-Text
   ↓
4. Creación del Fallo Principal
   ↓
5. Actualización de Embedding en DB (raw SQL)
   ↓
6. Chunking del Texto
   ↓
7. Para cada Chunk:
   ├─ Generar Embedding
   ├─ Extraer Keywords
   ├─ Detectar Conceptos Jurídicos
   ├─ Crear Chunk en DB
   └─ Actualizar Embedding del Chunk
   ↓
8. Retornar Resultado
```

**Manejo de Duplicados**:
- Unique constraint: `(tribunal, nroExpediente, fecha)`
- Si existe: retorna `{ status: 'duplicate', existingId }`
- Si no existe: procede con ingesta

**Optimizaciones**:
- Pausa de 500ms entre chunks para no saturar OpenAI API
- Transacciones para garantizar consistencia
- Logging detallado en cada paso

### 4. Jurisprudence Search Service

**Responsabilidad**: Búsqueda semántica con ranking y filtros.

**Modos de Búsqueda**:

#### A. Full-Text Search (default)

Busca en el embedding del fallo completo:

```sql
SELECT 
    id, tribunal, nroExpediente, fecha, resumen,
    1 - (embedding <=> $query_vector) as similarity
FROM "Jurisprudence"
WHERE embedding IS NOT NULL
  AND 1 - (embedding <=> $query_vector) > $threshold
  AND [filtros adicionales]
ORDER BY embedding <=> $query_vector ASC
LIMIT $limit
```

**Ventajas**:
- Rápido (1 embedding por fallo)
- Visión general del fallo
- Ideal para búsquedas amplias

#### B. Chunk-Level Search

Busca en embeddings de chunks individuales:

```sql
SELECT 
    c.id, c.texto, c.chunkType, c.chunkNumber,
    j.id as jurisprudenceId, j.tribunal, j.nroExpediente,
    1 - (c.embedding <=> $query_vector) as similarity
FROM "JurisprudenceChunk" c
INNER JOIN "Jurisprudence" j ON c.jurisprudenceId = j.id
WHERE c.embedding IS NOT NULL
  AND 1 - (c.embedding <=> $query_vector) > $threshold
ORDER BY c.embedding <=> $query_vector ASC
LIMIT $limit
```

**Post-procesamiento**:
1. Agrupar chunks por fallo
2. Tomar similitud máxima por fallo
3. Calcular ranking score
4. Ordenar y limitar resultados

**Ventajas**:
- Precisión granular
- Identifica considerandos específicos
- Ideal para búsquedas técnicas

**Filtros Disponibles**:
- `jurisdiccion`: NACION, CABA, PBA, etc.
- `fuero`: CIVIL, PENAL, LABORAL, etc.
- `tribunal`: CSJN, CAMARA_FEDERAL, etc.
- `precedencia`: PLENARIO, OBLIGATORIO, etc.
- `vigencia`: VIGENTE, MODIFICADO, etc.
- `fechaDesde` / `fechaHasta`: Rango de fechas
- `tema`: Tema específico (array)

### 5. Citation Tracking

**Grafo de Citaciones**:

```
Fallo A ──SIGUE──> Fallo B
Fallo C ──DISTINGUE──> Fallo B
Fallo D ──CRITICA──> Fallo A
```

**Tipos de Citación**:
- `SIGUE`: Aplica la misma doctrina
- `DISTINGUE`: Diferencia el caso
- `CRITICA`: Se aparta del precedente

**Consultas de Grafo**:

```typescript
// Obtener todos los fallos que citan a X
GET /jurisprudence/related/:id

// Respuesta:
{
  cites: [/* fallos que X cita */],
  citedBy: [/* fallos que citan a X */]
}
```

## API Endpoints

### POST /jurisprudence/ingest

Ingestar un fallo judicial.

**Request**:
```json
{
  "tribunal": "CSJN",
  "sala": "Sala I",
  "nroExpediente": "CSJ 123/2023",
  "fecha": "2023-05-15",
  "jurisdiccion": "NACION",
  "fuero": "CIVIL",
  "tema": ["Responsabilidad Civil", "Daños"],
  "resumen": "Sumario del fallo...",
  "textoCompleto": "Texto íntegro del fallo...",
  "precedencia": "PLENARIO",
  "vigencia": "VIGENTE",
  "fuenteOficialUrl": "https://...",
  "caratula": "Pérez c/ González s/ Daños",
  "magistrados": ["Dr. Juan Pérez", "Dra. María González"],
  "sourceType": "CSJN_API"
}
```

**Response**:
```json
{
  "status": "success",
  "jurisprudenceId": "uuid",
  "chunksCreated": 8,
  "jurisprudence": { /* objeto completo */ }
}
```

### GET /jurisprudence/search

Búsqueda semántica con ranking.

**Query Params**:
- `query` (required): Texto de búsqueda
- `searchMode`: `full` | `chunks` (default: `full`)
- `jurisdiccion`, `fuero`, `tribunal`, `precedencia`, `vigencia`: Filtros
- `fechaDesde`, `fechaHasta`: Rango de fechas
- `tema`: Tema específico
- `limit`: Número de resultados (default: 10)
- `threshold`: Umbral de similitud (default: 0.7)

**Response**:
```json
[
  {
    "id": "uuid",
    "tribunal": "CSJN",
    "nroExpediente": "CSJ 123/2023",
    "fecha": "2023-05-15",
    "caratula": "Pérez c/ González s/ Daños",
    "resumen": "...",
    "similarity": 0.89,
    "rankingScore": 91.4,
    "matchedChunks": [/* solo en modo chunks */]
  }
]
```

### GET /jurisprudence/expediente/:nroExpediente

Buscar fallo específico por número de expediente.

**Response**:
```json
{
  "id": "uuid",
  "tribunal": "CSJN",
  "nroExpediente": "CSJ 123/2023",
  "chunks": [/* todos los chunks */],
  "citedBy": [/* fallos que citan a este */],
  "cites": [/* fallos citados por este */]
}
```

### GET /jurisprudence/stats

Estadísticas de la base de jurisprudencia.

**Response**:
```json
{
  "total": 1250,
  "withEmbeddings": 1200,
  "embeddingCoverage": "96.00%",
  "totalChunks": 8750,
  "avgChunksPerCase": "7.00",
  "byTribunal": [
    { "tribunal": "CSJN", "_count": 450 },
    { "tribunal": "CAMARA_FEDERAL", "_count": 320 }
  ],
  "byPrecedencia": [
    { "precedencia": "PLENARIO", "_count": 85 },
    { "precedencia": "OBLIGATORIO", "_count": 420 }
  ],
  "byVigencia": [
    { "vigencia": "VIGENTE", "_count": 1100 },
    { "vigencia": "MODIFICADO", "_count": 150 }
  ]
}
```

### GET /jurisprudence/related/:id

Obtener fallos relacionados (citaciones).

**Response**:
```json
{
  "cites": [
    {
      "id": "uuid",
      "citationType": "SIGUE",
      "context": "...",
      "citedCase": { /* fallo citado */ }
    }
  ],
  "citedBy": [
    {
      "id": "uuid",
      "citationType": "SIGUE",
      "context": "...",
      "citingCase": { /* fallo que cita */ }
    }
  ]
}
```

### POST /jurisprudence/citation

Registrar citación entre fallos.

**Request**:
```json
{
  "citingCaseId": "uuid",
  "citedCaseId": "uuid",
  "citationType": "SIGUE",
  "context": "En el considerando III se sigue la doctrina de..."
}
```

## Pipeline de Ingesta

### Fuentes de Datos

#### 1. CSJN (Corte Suprema)
- **URL**: https://sjconsulta.csjn.gov.ar/
- **Formato**: HTML/PDF
- **Estrategia**: Scraping + parsing

#### 2. CIJ (Centro de Información Judicial)
- **URL**: https://www.cij.gov.ar/
- **Formato**: HTML
- **Estrategia**: API + scraping

#### 3. Cámaras Federales
- **Múltiples URLs** por cámara
- **Formato**: PDF/HTML
- **Estrategia**: Scraping específico por cámara

#### 4. Tribunales Provinciales
- **URLs variables** por provincia
- **Formato**: Heterogéneo
- **Estrategia**: Parsers específicos

### Proceso de Ingesta

```typescript
// 1. Obtener fallo de fuente
const rawData = await scraper.fetchCase(url);

// 2. Parsear estructura
const parsed = parser.parse(rawData);

// 3. Normalizar datos
const normalized = normalizer.normalize(parsed);

// 4. Ingestar con embeddings
const result = await ingestionService.ingestJurisprudence(normalized);

// 5. Detectar citaciones (opcional)
const citations = citationDetector.detect(normalized.textoCompleto);
for (const citation of citations) {
  await ingestionService.registerCitation(citation);
}
```

## Integración con Legal Assistant

El motor de jurisprudencia se integra con el asistente legal para:

### 1. Búsqueda Contextual

```typescript
// Usuario pregunta: "¿Qué dice la jurisprudencia sobre responsabilidad médica?"

// 1. LegalAssistant extrae query
const query = "responsabilidad médica";

// 2. Busca en jurisprudencia
const cases = await jurisprudenceSearch.search({
  query,
  fuero: 'CIVIL',
  limit: 5
});

// 3. Genera respuesta con contexto
const response = await openai.chat({
  messages: [
    { role: 'system', content: 'Eres un asistente legal...' },
    { role: 'user', content: query },
    { role: 'assistant', content: `Contexto: ${cases.map(c => c.resumen).join('\n')}` }
  ]
});
```

### 2. Sugerencia de Precedentes

```typescript
// Al analizar un caso, sugerir precedentes relevantes
const relevantCases = await jurisprudenceSearch.search({
  query: caseDescription,
  tribunal: 'CSJN',
  precedencia: 'PLENARIO',
  vigencia: 'VIGENTE',
  limit: 3
});
```

### 3. Alertas de Jurisprudencia

```typescript
// Notificar cuando un precedente usado es modificado
const watchedCases = await getWatchedCases(userId);
for (const caseId of watchedCases) {
  const related = await jurisprudenceSearch.getRelatedCases(caseId);
  const modifications = related.citedBy.filter(c => 
    c.citationType === 'CRITICA' || 
    c.citingCase.precedencia === 'PLENARIO'
  );
  
  if (modifications.length > 0) {
    await notifyUser(userId, modifications);
  }
}
```

## Performance y Escalabilidad

### Métricas Esperadas

| Métrica | Valor |
|---------|-------|
| Tiempo de ingesta (1 fallo) | ~5-10 segundos |
| Tiempo de búsqueda | <500ms |
| Chunks por fallo | 5-10 promedio |
| Storage por fallo | ~10-15 KB (vectores) |

### Optimizaciones

1. **Índices pgvector**: HNSW para búsqueda rápida
2. **Batch ingestion**: Procesar múltiples fallos en paralelo
3. **Caching**: Redis para queries frecuentes
4. **Lazy loading**: Cargar chunks solo cuando se necesitan

### Escalabilidad

- **Horizontal**: Múltiples workers de ingesta
- **Vertical**: Índices optimizados en PostgreSQL
- **Caching**: Redis para resultados frecuentes
- **CDN**: Archivos PDF/HTML en S3 + CloudFront

## Próximos Pasos

### Fase 1: Ingesta Automática (Próxima)
- [ ] Scraper para CSJN
- [ ] Scraper para CIJ
- [ ] Scheduler para ingesta periódica

### Fase 2: Análisis Avanzado
- [ ] Detección automática de citaciones en texto
- [ ] Análisis de tendencias jurisprudenciales
- [ ] Sugerencias inteligentes de precedentes

### Fase 3: Visualización
- [ ] Grafo interactivo de citaciones
- [ ] Timeline de jurisprudencia
- [ ] Dashboard de estadísticas

### Fase 4: Alertas y Monitoreo
- [ ] Alertas de nuevos fallos relevantes
- [ ] Notificaciones de modificaciones de precedentes
- [ ] Reportes periódicos de jurisprudencia

## Conclusión

El Motor de Jurisprudencia implementa un sistema RAG completo y profesional para fallos judiciales argentinos, con:

✅ **Chunking inteligente** por considerandos y doctrina  
✅ **Ranking jerárquico** basado en tribunal, precedencia y similitud  
✅ **Búsqueda multinivel** (full-text y chunks)  
✅ **Grafo de citaciones** para análisis de precedentes  
✅ **Embeddings multinivel** para máxima precisión  
✅ **API REST completa** con filtros avanzados  
✅ **Integración con Legal Assistant** para consultas contextuales  

El sistema está listo para ingesta de datos reales y puede escalar a miles de fallos manteniendo performance óptima.
