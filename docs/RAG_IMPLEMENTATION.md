# Implementación de IA Jurídica Avanzada (RAG)

## Arquitectura RAG (Retrieval-Augmented Generation)

El sistema implementa un motor de IA jurídica basado en **RAG** que combina:

1. **Base de Conocimiento Vectorial** (pgvector en PostgreSQL)
2. **Embeddings Semánticos** (OpenAI `text-embedding-3-small`)
3. **Generación Contextual** (GPT-4 Turbo)

### Flujo de Consulta

```
Usuario → Query → Embedding → Vector Search → Top K Documentos → Prompt + Context → LLM → Respuesta
```

## Componentes

### 1. EmbeddingService

**Ubicación**: `backend/src/ia/nlu/embedding.service.ts`

- Genera vectores de 1536 dimensiones usando OpenAI.
- Modo degradado: Si no hay API Key, genera vectores aleatorios (desarrollo).

### 2. Ingesta de Normas Legales

**Endpoint**: `POST /ia/ingest`

Permite cargar artículos de códigos, leyes y jurisprudencia:

```json
{
  "titulo": "Código Civil y Comercial",
  "articulo": "Art. 1109",
  "texto": "Todo el que ejecuta un hecho...",
  "jurisdiccion": "NACION",
  "fuero": "CIVIL",
  "tipo": "CODIGO"
}
```

**Proceso**:
1. Genera embedding del texto completo.
2. Almacena metadata en tabla `LegalNorm`.
3. Actualiza columna `embedding` (tipo `vector(1536)`).

### 3. Búsqueda Semántica

**Método**: `searchLegalNorms(query, limit)`

Utiliza **distancia coseno** (`<=>` en pgvector) para encontrar los artículos más relevantes:

```sql
SELECT *, 1 - (embedding <=> $query_vector) as similarity
FROM "LegalNorm"
ORDER BY embedding <=> $query_vector ASC
LIMIT 4;
```

### 4. Chat Jurídico

**Endpoint**: `POST /ia/ask`

```json
{
  "query": "¿Cuál es el plazo para contestar demanda en CABA?",
  "context": "expediente-id-123" // Opcional
}
```

**Respuesta**:
```json
{
  "answer": "Según el Art. 356 del CPCC...",
  "sources": ["Art. 356 CPCC", "Art. 1109 CCyC"]
}
```

**Prompt Engineering**:
- Sistema: Contexto legal recuperado + instrucciones de citación.
- Usuario: Query original.
- Modelo: GPT-4 Turbo (temperatura 0.2 para precisión).

## Configuración

### Variables de Entorno

```env
OPENAI_API_KEY=sk-...
```

### Dependencias

- `@langchain/openai`: Integración con OpenAI.
- `pgvector`: Extensión PostgreSQL (ya habilitada en migración).

## Próximos Pasos

1. **Ingesta Masiva**: Script para cargar Códigos completos (Civil, Penal, Procesal).
2. **Jurisprudencia**: Integración con fallos de CSJN y Cámaras.
3. **Caché Semántica**: Redis para queries frecuentes.
4. **Ranking**: Ponderación por vigencia, jurisdicción y relevancia histórica.
5. **Chat con Memoria**: Persistir conversaciones por expediente.
