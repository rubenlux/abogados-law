# Legal Risk Scoring Engine

El **Motor de Scoring de Riesgo Jurídico** proporciona una evaluación cuantitativa y cualitativa de la probabilidad de éxito de un expediente, basada en el análisis automático de precedentes, normativa y características del caso.

## Overview

- **Endpoint Analysis**: `POST /ai/risk-score/:expedienteId`
- **Endpoint History**: `GET /ai/risk-score/:expedienteId`
- **Output**: JSON con Score (0-100), Nivel de Riesgo, Factores y Explicación.

## Algoritmo de Scoring

El análisis combina RAG (Retrieval-Augmented Generation) con razonamiento de LLM (GPT-4o).

### Factores Evaluados

1.  **Jurisprudencia Contradictoria (`jurisprudenceScore`)**:
    *   Se buscan fallos similares usando *Vector Search*.
    *   Si los fallos son mayoritariamente negativos o altamente contradictorios, el score sube (mayor riesgo).
    *   Si hay "Plenarios" o fallos de CSJN en contra, el riesgo es CRÍTICO.

2.  **Antigüedad/Inestabilidad Normativa (`normativeScore`)**:
    *   Se verifica si las leyes aplicables son obsoletas o han sufrido modificaciones recientes que generen incertidumbre interpretativa.

3.  **Complejidad Intrínseca (`complexityScore`)**:
    *   Basado en la jurisdicción (e.g., fueros federales suelen ser más complejos) y el tipo de proceso.

4.  **Similitud de Antecedentes**:
    *   Comparación semántica con casos históricos del estudio (si existieran) o base pública.

## Modelo de Datos (`LegalRiskAnalysis`)

- **score**: 0 (Éxito seguro) a 100 (Pérdida segura).
- **riskLevel**: BAJO (<30), MEDIO (30-60), ALTO (60-85), CRITICO (>85).
- **factors**: Objeto JSON detallando hallazgos específicos (e.g., `{"contradiction": true}`).
- **explanation**: Resumen generado por IA para el abogado.

## Flujo de Ejecución

1.  Usuario solicita análisis para Exp. 123.
2.  Sistema recupera carátula y metadatos del Exp. 123.
3.  **RAG Jurisprudencia**: Busca top 5 fallos similares.
4.  **RAG Leyes**: Busca top 3 normas aplicables.
5.  **LLM Reasoning**: Envía todo el contexto al modelo con un System Prompt de "Auditor Legal".
6.  **Persistencia**: Guarda el reporte en la tabla `LegalRiskAnalysis`.
7.  **Respuesta**: Devuelve el análisis JSON.

## Uso

```bash
POST http://localhost:3000/ai/risk-score/uuid-expediente-123
Body: { "userId": "..." }
```
