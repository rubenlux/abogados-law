export interface AssistantStatus {
  available: boolean;
  provider: string;
  model: string;
  reason?: string;
}

export interface AssistantExpedienteRef {
  id: string;
  caratula: string;
  numeroExpediente: string;
  juzgado: string;
  jurisdiccion: string;
  fuero?: string | null;
  estado: string;
  partesCount?: number;
}

export interface AssistantContextReferences {
  expediente: AssistantExpedienteRef | null;
  movimientos: Array<{
    id: string;
    tipo: string;
    titulo: string;
    fechaActuacion: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    category: string;
    versionNumber: number;
    textExtracted: boolean;
  }>;
  limitations: string[];
  usedGeneralKnowledge: boolean;
  missingData: string[];
  warnings: string[];
  citedSourceIds: string[];
  professionalDisclaimer?: string;
}

export interface LegalAiMessageItem {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  messageStatus: 'COMPLETED' | 'FAILED';
  clientMessageId?: string | null;
  contextReferences?: AssistantContextReferences | null;
  providerMetadata?: {
    provider?: string;
    model?: string;
    latencyMs?: number;
  } | null;
  createdAt: string;
}

export interface LegalAiConversationItem {
  id: string;
  expedienteId?: string | null;
  title: string;
  status: 'ACTIVE' | 'ARCHIVED';
  lastMessageAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  expediente?: AssistantExpedienteRef | null;
  messages?: LegalAiMessageItem[];
}

export interface SendAssistantMessageResponse {
  deduplicated: boolean;
  userMessage: LegalAiMessageItem;
  assistantMessage: LegalAiMessageItem;
  contextReferences: AssistantContextReferences | null;
}

export interface GeneratorPrefillState {
  prefillInstructions?: string;
  prefillExpedienteId?: string | null;
  sourceConversationId?: string;
  sourceMessageId?: string;
  sourceAnalysisId?: string;
}

export type LegalAiAnalysisType =
  | 'INTEGRAL_CASE'
  | 'FACTS_AND_CONTROVERSIES'
  | 'DOCUMENTARY_EVIDENCE'
  | 'PROCEDURAL_RISKS';

export type LegalAiAnalysisStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ARCHIVED';

export interface LegalAiAnalysisResultContent {
  executiveSummary: string;
  analysisDevelopment: string;
  relevantFacts: string[];
  allegedFacts: string[];
  documentedFacts: string[];
  disputedIssues: string[];
  contradictions: string[];
  proceduralRisks: string[];
  explicitDeadlines: string[];
  documentaryFindings: string[];
  missingInformation: string[];
  limitations: string[];
  professionalWarning: string;
}

export interface LegalAiAnalysisSourceReferences {
  expediente: AssistantExpedienteRef | null;
  movimientos: Array<{
    id: string;
    tipo: string;
    titulo: string;
    fechaActuacion: string;
  }>;
  vencimientos?: Array<{
    id: string;
    titulo: string;
    tipo: string;
    fechaLimite: string;
    prioridad: string;
    estado: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    category: string;
    versionNumber: number;
    textExtracted: boolean;
  }>;
  documentIds?: string[];
  hasAuthorizedNotes?: boolean;
  maxContextChars?: number;
  limitations: string[];
  truncatedSources?: string[];
  usedGeneralKnowledge?: boolean;
  citedSourceIds?: string[];
  capturedAt?: string;
}

export interface AnalysisSourcesPreview {
  expediente: AssistantExpedienteRef | null;
  movimientos: Array<{
    id: string;
    tipo: string;
    titulo: string;
    fechaActuacion: string;
  }>;
  vencimientos: Array<{
    id: string;
    titulo: string;
    tipo: string;
    fechaLimite: string;
    prioridad: string;
    estado: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    category: string;
    versionNumber: number;
    textExtracted: boolean;
  }>;
  unextractableDocuments: Array<{
    id: string;
    title: string;
    versionNumber: number;
  }>;
  hasAuthorizedNotes: boolean;
  maxContextChars: number;
  limitations: string[];
  truncatedSources: string[];
}

export interface LegalAiAnalysisItem {
  id: string;
  expedienteId?: string | null;
  analysisType: LegalAiAnalysisType;
  title: string;
  status: LegalAiAnalysisStatus;
  inputInstructions?: string | null;
  resultContent?: LegalAiAnalysisResultContent | null;
  editedContent?: LegalAiAnalysisResultContent | null;
  editedAt?: string | null;
  sourceReferences?: LegalAiAnalysisSourceReferences | null;
  providerMetadata?: {
    provider?: string;
    model?: string;
    latencyMs?: number;
    errorCode?: string;
  } | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  expediente?: AssistantExpedienteRef | null;
}

export const ANALYSIS_TYPE_META: Record<
  LegalAiAnalysisType,
  { label: string; shortLabel: string; description: string; bullets: string[] }
> = {
  INTEGRAL_CASE: {
    label: 'Análisis integral de expediente',
    shortLabel: 'Integral',
    description:
      'Panorama completo de la causa, partes, actuaciones relevantes, documentación y puntos pendientes.',
    bullets: [
      'Síntesis del caso y partes procesales',
      'Objeto del litigio (si consta) y hechos registrados',
      'Estado procesal, movimientos relevantes y documentación',
      'Cuestiones pendientes de aclaración',
    ],
  },
  FACTS_AND_CONTROVERSIES: {
    label: 'Análisis de hechos y controversias',
    shortLabel: 'Hechos y controversias',
    description:
      'Separación estricta entre hechos alegados, hechos documentados, puntos controvertidos y contradicciones.',
    bullets: [
      'Hechos alegados vs. hechos documentados',
      'Hechos controvertidos',
      'Contradicciones detectadas en fuentes',
      'Información faltante para verificar',
    ],
  },
  DOCUMENTARY_EVIDENCE: {
    label: 'Análisis de prueba documental',
    shortLabel: 'Prueba documental',
    description:
      'Evaluación de documentos seleccionados, contenido efectivamente extraído y limitaciones de lectura.',
    bullets: [
      'Documentos disponibles y contenido relevante extraído',
      'Relación con los hechos registrados',
      'Limitaciones de lectura (PDF sin texto extraíble)',
      'Elementos que requieren verificación profesional',
    ],
  },
  PROCEDURAL_RISKS: {
    label: 'Análisis de riesgos procesales',
    shortLabel: 'Riesgos procesales',
    description:
      'Identificación de riesgos a partir de datos registrados y vencimientos explícitos sin cálculo automático de plazos.',
    bullets: [
      'Riesgos identificables según datos registrados',
      'Vencimientos explícitamente cargados en la causa',
      'Información procesal faltante',
      'Cuestiones que el profesional debería revisar',
    ],
  },
};

