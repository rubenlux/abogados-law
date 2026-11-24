# AI Chat Contextual por Expediente

## 🧠 Arquitectura de Contexto

El sistema utiliza un enfoque de **Contexto Dinámico Híbrido** para alimentar al LLM (GPT-4o) con la información más relevante sin exceder la ventana de tokens.

### Componentes del Contexto

1.  **Datos del Expediente (Hard Context)**
    *   Siempre presentes.
    *   Carátula, Número, Juzgado, Jurisdicción, Estado.
    *   Objetivo: Garantizar que la IA sepa de qué caso se habla.

2.  **Memoria Conversacional (Short-term Memory)**
    *   Últimos 10 intercambios de mensajes.
    *   Persistidos en `AIChatMessage`.
    *   Objetivo: Mantener el hilo de la conversación.

3.  **Base Legal RAG (Retrieval Augmented Generation)**
    *   **Leyes:** Buscadas dinámicamente en `LegalNorm` usando embeddings de la consulta del usuario.
    *   **Jurisprudencia:** Buscada en `Jurisprudence` (Fallos) por similitud semántica.
    *   Threshold de similitud: 0.70 (Alta relevancia requerida).

### 🛡️ Prevención de Alucinaciones

Se implementa un **Protocolo de Verdad Estricto** mediante System Prompts:

1.  **Restricción de Fuente:** La IA tiene prohibido inventar información no presente en el contexto inyectado.
2.  **Advisories de Incertidumbre:** Si la información falta, la IA debe declarar: "No encuentro información suficiente".
3.  **Citas Obligatorias:** Se fuerza a la IA a citar explícitamente Artículos y Fallos recuperados.

## 💾 Persistencia

### Modelo de Datos

- **AIChatSession**: Vincula `User` + `Expediente`.
- **AIChatMessage**: Almacena cada interacción con metadatos:
    - `role`: user/assistant
    - `citation`: fuentes utilizadas (JSON)
    - `isVerified`: flag de auditoría

### Flujo de Datos (Endpoint `POST /ai/chat/:expedienteId`)

1.  **Autenticación**: Validación de JWT.
2.  **Sesión**: Se busca `AIChatSession` activa para el par (Usuario, Expediente). Si no existe, se crea.
3.  **Context Building**: 
    - Se extraen metadatos del expediente.
    - Se vectoriza la consulta del usuario.
    - Se buscan leyes y fallos relevantes en PgVector.
    - Se recuperan los últimos 10 mensajes.
4.  **Inferencia**: Se envía el prompt enriquecido a GPT-4o.
5.  **Persistencia**: Se guardan el input y output en PostgreSQL.
6.  **Respuesta**: Se devuelve el mensaje generado al frontend.

## 🔒 Privacidad y Seguridad

- **Aislamiento**: Las sesiones son privadas por usuario (o compartidas por expediente según configuración futura).
- **Protección de Datos**: Los datos del expediente nunca se usan para entrenar modelos públicos (OpenAI Zero Data Retention policy via API).
- **Contexto Efímero**: El contexto completo se construye en tiempo de ejecución y no se almacena como un bloque monolítico, optimizando storage y privacidad.
