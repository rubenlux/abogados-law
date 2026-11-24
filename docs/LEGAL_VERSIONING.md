# Protocolo de Versionado Legal y Control de Alucinaciones

## 1. Modelo de Datos Extendido: `LegalNorm`

Para cumplir con la trazabilidad histórica y jurisdiccional, extendemos el esquema de la base de conocimientos (`LegalKnowledgeBase`).

### Esquema de Entidad
```typescript
type LegalNormStatus = 'VIGENTE' | 'DEROGADA' | 'MODIFICADA' | 'ANULADA';

interface LegalNorm {
  id: string; // UUID
  
  // Clasificación
  jurisdiccion: 'NACION' | 'CABA' | 'PBA' | 'CBA' | 'SFE' | ...;
  fuero: 'CIVIL' | 'COMERCIAL' | 'PENAL' | 'LABORAL' | 'FAMILIA' | 'CONTENCIOSO';
  tipo_norma: 'LEY' | 'DECRETO' | 'CODIGO' | 'ACORDADA' | 'FALLO_PLENARIO';
  
  // Identificación
  nombre: string; // ej: "Código Procesal Civil y Comercial de la Nación"
  numero_norma: string; // ej: "Ley 17.454"
  articulo: string; // ej: "356"
  inciso?: string;
  
  // Contenido
  texto_completo: string;
  embedding: number[]; // Vector (1536 dim)
  
  // Versionado (CRÍTICO)
  version_norma: number; // 1, 2, 3...
  fecha_vigencia: Date;
  fecha_derogacion?: Date;
  estado: LegalNormStatus;
  norma_modificadora_id?: string; // Link a la ley que la modificó
  
  // Metadatos IA
  keywords: string[];
  conceptos_juridicos: string[]; // ej: ["contestación demanda", "plazos"]
}
```

## 2. Motor Anti-Alucinaciones (Strict Mode)

### Regla de Oro
> "Si la similaridad semántica (cosine similarity) del mejor chunk recuperado es < 0.75, la IA NO debe responder con información legal, sino declarar insuficiencia."

### Estructura de Respuesta Obligatoria
El LLM debe devolver un objeto JSON estructurado, no texto libre.

```json
{
  "respuesta_texto": "El plazo para contestar demanda es de 15 días...",
  "fundamentacion": [
    {
      "norma": "CPCC Nación",
      "articulo": "356",
      "texto_citado": "En el proceso ordinario...",
      "estado_verificado": "VIGENTE",
      "link_fuente": "http://infoleg..."
    }
  ],
  "score_confianza": 0.98, // Calculado en base a similiaridad vectorial
  "advertencias": [] // ej: "Esta norma fue modificada recientemente"
}
```

### Pipeline RAG Estricto
1.  **Query Pre-processing**: Detectar jurisdicción y fuero explícito en la pregunta.
2.  **Filtered Retrieval**: Buscar vectores SOLO dentro de `WHERE jurisdiccion = X AND estado = 'VIGENTE'`.
3.  **Cross-Validation**: Un segundo agente (Evaluator) verifica que el texto generado por el Agente 1 se encuentre realmente en los chunks recuperados. Si alucina un artículo, bloquea la respuesta.

## 3. Detección de Plazos en Documentos (PDF)

### Pipeline de Procesamiento
1.  **Ingesta**: Usuario sube `cedula_notificacion.pdf`.
2.  **OCR Híbrido**: Tesseract (local) para rapidez, Amazon Textract/Google Vision (cloud) para precisión en tablas.
3.  **NER Legal (Named Entity Recognition)**:
    *   Extraer `FECHA_NOTIFICACION` (Regex patterns complejos para formatos argentinos).
    *   Extraer `TIPO_ACTO`: "Traslado de demanda", "Intimación de pago", "Apertura a prueba".
4.  **Inferencia de Plazo**:
    *   Input: `TIPO_ACTO` + `FUERO` + `CODIGO_PROCESAL_APLICABLE`.
    *   Lookup: Tabla de plazos (ej. Traslado Demanda Ordinario Nacion = 15 días).
5.  **Cálculo de Vencimiento**:
    *   `FECHA_NOTIFICACION` + `DIAS_PLAZO` + `FERIADOS` + `FERIA_JUDICIAL` + `GRACE_PERIOD` (2 primeras horas).

## 4. Chat Contextual por Expediente
El chat no es global. Es una instancia aislada que dispone de:
1.  **Memoria del Expediente**: Todos los PDFs y escritos previos del caso.
2.  **Base Legal**: Leyes aplicables a ese caso específico.
3.  **System Prompt**: "Eres un auxiliar letrado asignado al expediente {caratula}. Tu prioridad es la estrategia procesal y el control de plazos."
