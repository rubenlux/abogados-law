# Diseño de IA Jurídica y RAG

## Estrategia RAG (Retrieval Augmented Generation)

La IA no "inventará" leyes porque estará restringida estrictamente al contexto recuperado de nuestra Base Vectorial Legal.

### Flujo Técnico Completo

1.  **Ingesta de Bases Legales**:
    *   **Fuente**: Textos oficiales de InfoLeg (Código Civil y Comercial, Código Penal, etc.).
    *   **Chunking**: División inteligente por "Artículo". Cada artículo es un chunk atómico. No dividir a mitad de artículo.
    *   **Embedding**: Generación de vectores usando `text-embedding-3-small` (OpenAI).
    *   **Almacenamiento**: PostgreSQL con `pgvector`.

2.  **Consulta del Usuario (Query)**:
    *   El abogado pregunta: "¿Cuál es el plazo para contestar demanda en provincia de Buenos Aires en un daños y perjuicios?"
    *   **Reformulación**: La IA optimiza la query para búsqueda semántica.

3.  **Retrieval (Recuperación)**:
    *   Búsqueda de vector de similitud (Cosine Similarity) en la tabla `legal_embeddings`.
    *   Búsqueda híbrida: Filtros por metadatos (ej: `jurisdiccion: 'Provincia de Buenos Aires'`, `rama: 'Civil'`).
    *   Top K resultados (ej. 5 artículos más relevantes) seleccionados.

4.  **Generation (Generación)**:
    *   Prompt de Sistema Estricto: "Eres un asistente legal experto. Responde SOLO basándote en el contexto legal proporcionado abajo. SIEMPRE cita el artículo y la fuente. Si la información no está en el contexto, di 'No tengo información suficiente en mi base legal actual'."
    *   Input: Query Usuario + Contexto Recuperado.
    *   Output: Respuesta fundamentada.

### Prevención de Alusinaciones
1.  **Temperature**: 0 o muy baja (0.1).
2.  **Citas Obligatorias**: Instrucción de prompt para incluir `[Fuente: Art. X CPCC]` en cada afirmación.
3.  **Verificación**: Un segundo paso de LLM que compara la respuesta generada con el contexto fuente para verificar consistencia (Self-Reflexion opcional).

## Funcionalidades IA

### 1. Asistente Redactor
*   Autocompletado de escritos rutinarios (Mero trámite, Cédulas).
*   Input: Datos del expediente (Caratula, Nro) + Template.
*   Output: Documento Word/PDF generado.

### 2. Detección de Plazos (Agenda)
*   **Trigger**: Se sube un PDF (Cédula de notificación).
*   **Proceso**:
    1. OCR del documento.
    2. LLM extrae: "Fecha de notificación", "Tipo de plazo" (ej. 5 días hábiles), "Acción requerida".
    3. Cálculo de días hábiles (feriados CABA/Nacion/Provincia).
    4. Sugerencia de evento en calendario.

### 3. Resumen de Expediente
*   Recorre documentos cronológicos del expediente.
*   Genera línea de tiempo y estado actual.
