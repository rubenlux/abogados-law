# Legal Drafting Engine (Professional Assisted Legal Drafting)

The Legal Drafting Engine is a specialized AI module designed to generate high-quality, professional legal documents based on Argentine law. It combines Large Language Models (LLMs) with Retrieval-Augmented Generation (RAG) to ensure legal accuracy and style consistency.

## Overview

- **Endpoint**: `POST /ai/draft`
- **Goal**: Automate the creation of drafts for lawsuits, answers, appeals, and simple writs.
- **Technologies**: NestJS, LangChain, OpenAI GPT-4o, Prisma (PostgreSQL), pgvector (for RAG).

## Architecture

The engine works in 5 steps:
1.  **Input Analysis**: Receives structured input (Type, Jurisdiction, Facts, etc.).
2.  **RAG Retrieval (Laws)**: Queries the `LegalNorm` vector database for relevant legislation.
3.  **RAG Retrieval (Jurisprudence)**: Queries the `Jurisprudence` vector database for relevant case law.
4.  **Generative Drafting**: Uses extensive prompt engineering to synthesize the input + RAG context into a structured legal document.
5.  **Persistence**: Saves the draft in the `LegalDraft` table for further editing or review.

## Data Model (`LegalDraft`)

- **id**: UUID
- **draftType**: DEMANDA, CONTESTACION, RECURSO, MERO_TRAMITE
- **jurisdiction/fuero**: Context for legal search.
- **facts**: The raw narrative provided by the user.
- **header**: Objects, parties, procedural details.
- **bodyLaw**: Arguments backed by specific laws and retrieved jurisprudence.
- **petitorio**: Formal requests to the court.
- **fullText**: The complete assembled document.

## RAG Integration

The drafting service injects context from:
- **Lex (Leyes)**: Real-time search of Argentine codes and laws.
- **Juris (Fallos)**: Precedent search from the Jurisprudence Engine.

## Usage

```json
POST /ai/draft
{
  "userId": "UserUUID",
  "type": "DEMANDA",
  "jurisdiction": "NACION",
  "fuero": "CIVIL",
  "facts": "Accidente de tránsito en Av. Libertador...",
  "dataContext": { "plaintiff": "Juan Perez", "defendant": "Seguros SA" }
}
```

## Future Improvements
- Iterative refinement (chat with the draft).
- Export to Word/PDF.
- Auto-fill of procedural templates based on specific court rules.
