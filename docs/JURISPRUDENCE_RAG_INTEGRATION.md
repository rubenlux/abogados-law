
# Integración RAG de Jurisprudencia

Este documento describe cómo el motor de jurisprudencia se integra con el Asistente Legal (Chat IA) mediante técnicas de RAG (Retrieval Augmented Generation).

## Arquitectura de Recuperación

El flujo de integración es el siguiente:

1.  **Input del Usuario**: El abogado hace una pregunta (ej. "¿Cuál es el plazo para... según la Cámara Civil?").
2.  **Vectorización**: `EmbeddingService` convierte la pregunta en un vector (OpenAI text-embedding-3-small).
3.  **Búsqueda Híbrida**:
    *   **Semántica**: Se buscan chunks de jurisprudencia similares en PostgreSQL (`pgvector`).
    *   **Filtros**: Si la query menciona "Civil", se filtra por `fuero='CIVIL'`.
4.  **Ranking**: `JurisprudenceRankingService` reordena los resultados priorizando CSJN y fallos recientes (Fórmula de Jerarquía).
5.  **Inyección de Contexto**:
    *   `ChatContextService` selecciona los Top 2-3 hallazgos.
    *   Se inyectan en el System Prompt del LLM.

## Prompt Engineering (Anti-Alucinaciones)

Para evitar que la IA invente fallos, utilizamos Strict Prompting:

```
[INSTRUCCIÓN DE SEGURIDAD]
Usted es un asistente legal. Su conocimiento sobre jurisprudencia específica se limita
ESTRICTAMENTE a la sección [JURISPRUDENCIA SUGERIDA] provista abajo.

SI LA INFORMACIÓN NO ESTÁ AHÍ:
- No invente nombres de autos, fechas ni tribunales.
- Diga "No tengo acceso a ese fallo específico en mi contexto actual".

[JURISPRUDENCIA SUGERIDA]
- Autos "Gomez c/ Dia" (CNCiv, Sala A, 2024): ...
- Autos "Perez c/ Estado" (CSJN, 2023): ...
```

## Estructura de Datos de Citaciones

Actualmente, las citas se manejan como texto dentro del mensaje. Para lograr la estructuración completa en `AIChatMessage.citations`, se planea la migración a **JSON Mode** o **Tool Calling**:

### Modelo de Datos Objetivo
```json
{
  "citations": [
    {
      "type": "JURISPRUDENCIA",
      "caratula": "García c/ Pérez",
      "tribunal": "CSJN",
      "fecha": "2023-05-12",
      "id": "uuid-del-fallo",
      "fragmento_relevante": "..."
    }
  ]
}
```

## "Forced Context" (Próxima Fase)

El frontend permitirá seleccionar un fallo desde el Explorador y "Enviar al Chat". Esto inyectará el ID del fallo en la sesión de chat, forzando al `ChatContextService` a cargar ese fallo específico con prioridad máxima, ignorando el umbral de similitud vectorial para ese ítem.
