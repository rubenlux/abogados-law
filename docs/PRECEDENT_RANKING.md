# Precedent Ranking System

El sistema de ranking de precedentes judiciales ordena automáticamente los resultados de búsqueda para priorizar los fallos más relevantes, autorizados y útiles para la estrategia legal.

## Algoritmo de Ranking (`precedent_score`)

El puntaje final (0-100) es una composición ponderada de 6 factores clave:

### 1. Similitud Semántica (35%)
Mide qué tan relacionado está el contenido del fallo con la consulta del usuario.
- Fuente: Vector Embeddings (OpenAI ada-002) + Cosine Similarity.
- Rango: 0-100 puntos.

### 2. Jerarquía del Tribunal (20%)
Otorga mayor peso a tribunales superiores.
- **CSJN**: 100%
- **Tribunales Superiores Provinciales**: 85%
- **Cámaras Federales**: 75%
- **Cámaras Nacionales**: 70%
- **Cámaras Provinciales**: 60%
- **Primera Instancia**: 30-40%

### 3. Frecuencia de Citación (15%)
Indicador de influencia. Usa una escala logarítmica.
- Fallos muy citados reciben un boost significativo.
- Fórmula: `log10(citas + 1) * factor`.

### 4. Actualidad (10%)
Prioriza fallos recientes, con un decaimiento suave.
- < 2 años: 100% del puntaje.
- Decaimiento exponencial (-5% anual aprox).

### 5. Coincidencia de Jurisdicción (10%)
Si el abogado busca para "CABA" y el fallo es de "CABA", recibe un bonus.
- Fundamental para litigio local.

### 6. Tipo de Precedencia (10%)
- **Fallos Plenarios**: 100% (Máxima autoridad).
- **Obligatorios**: 90%.
- **Persuasivos**: 60%.

## Penalizaciones
El score final se reduce si el fallo no está vigente:
- **Modificado**: -20%
- **Superado**: -40%
- **Derogado**: -90%

## Integración

### Output API
Cada objeto retornado por el endpoint de búsqueda (`/jurisprudence/search`) incluye ahora:
```json
{
  "id": "...",
  "caratula": "...",
  "precedent_score": 85.5, // Nuevo campo
  "rankingScore": 85.5,    // Alias interno
  "citationCount": 12,     // Metadata
  "similarity": 0.89       // Metadata
}
```

### Uso en Asistente Legal
El `LegalAssistant` utiliza este score para decidir qué fallos citar en las respuestas de chat y en la redacción de escritos.
