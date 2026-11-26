export type LegalDraftCategory = 'ESCRITO_JUDICIAL' | 'CONTRATO';

export type LegalDraftDocumentType =
  | 'DEMANDA'
  | 'CONTESTACION_DEMANDA'
  | 'CONTESTACION_TRASLADO'
  | 'EXCEPCION'
  | 'APERTURA_PRUEBA'
  | 'ALEGATO'
  | 'APELACION'
  | 'RECURSO'
  | 'EXPRESION_AGRAVIOS'
  | 'CONTESTACION_AGRAVIOS'
  | 'PRONTO_DESPACHO'
  | 'MEDIDA_CAUTELAR'
  | 'ESCRITO_LIBRE'
  | 'SOLICITUD'
  | 'OFICIO'
  | 'PRESENTACION_SIMPLE'
  | 'INCIDENTE'
  | 'CONTRATO_LOCACION'
  | 'CONTRATO_SERVICIOS'
  | 'CONTRATO_NDA'
  | 'CONTRATO_COMPRAVENTA'
  | 'CONTRATO_MUTUO'
  | 'OTRO_CONTRATO'
  | 'OTRO';

export type LegalDraftStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'FINALIZED'
  | 'ARCHIVED';

export type LegalDraftReviewStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED';

export type LegalDraftExportFormat = 'DOCX' | 'PDF';

export type AiAssistMode =
  | 'REGENERATE'
  | 'IMPROVE'
  | 'EXPAND'
  | 'SUMMARIZE'
  | 'FIX_STRUCTURE'
  | 'MISSING_INFO';

export interface LegalUserSummary {
  id: string;
  fullName?: string | null;
  email?: string;
}

export interface LegalDocContent {
  type: 'doc';
  content: Array<Record<string, unknown>>;
}

export interface LegalCatalogItem {
  category: LegalDraftCategory;
  documentType: LegalDraftDocumentType;
  label: string;
  baseInstructions: string;
  caseOptional: boolean;
}

export interface LegalCatalogResponse {
  judicial: LegalCatalogItem[];
  contracts: LegalCatalogItem[];
}

export interface AiProviderStatus {
  available: boolean;
  provider: string;
  model: string;
  reason?: string;
}

export interface RecentCaseItem {
  id: string;
  caratula: string;
  numeroExpediente: string;
  juzgado: string;
  jurisdiccion: string;
  fuero?: string | null;
  estado: string;
  updatedAt: string;
  movimientosCount: number;
  partesCount: number;
}

export interface AiDraftMetadata {
  correlationId?: string;
  mode?: string;
  provider?: string;
  model?: string;
  generatedAt?: string;
  missingData?: string[];
  warnings?: string[];
  citationsUsed?: string[];
  contextSummary?: {
    hasExpediente?: boolean;
    partesCount?: number;
    movimientosCount?: number;
    hasInternalNotes?: boolean;
    referenceDocumentsCount?: number;
    referenceDocumentIds?: string[];
    sourceTemplateId?: string | null;
    unresolvedTemplateVars?: string[];
  };
}

export interface AiAssistResponse {
  mode: AiAssistMode;
  applied: boolean;
  proposedContent?: LegalDocContent;
  proposedPlainText?: string;
  version?: LegalDraftVersionItem;
  missingData: string[];
  warnings: string[];
  aiMetadata?: AiDraftMetadata;
}

export interface LegalDraftVersionItem {
  id: string;
  legalDraftId: string;
  versionNumber: number;
  content: LegalDocContent;
  contentFormat: 'TIPTAP_JSON';
  plainText: string;
  changeNote?: string | null;
  generatedByAi?: boolean;
  aiMetadata?: AiDraftMetadata | null;
  createdById: string;
  createdBy?: LegalUserSummary | null;
  createdAt: string;
}

export interface LegalDraftReviewItem {
  id: string;
  legalDraftId: string;
  versionId: string;
  requestedById: string;
  requestedBy?: LegalUserSummary | null;
  reviewerId?: string | null;
  reviewer?: LegalUserSummary | null;
  status: LegalDraftReviewStatus;
  comments?: string | null;
  requestedAt: string;
  reviewedAt?: string | null;
}

export interface LegalDraftExportItem {
  id: string;
  legalDraftId: string;
  versionId: string;
  format: LegalDraftExportFormat;
  storageDocumentId: string;
  generatedById: string;
  generatedBy?: LegalUserSummary | null;
  generatedAt: string;
  sha256: string;
  status: 'COMPLETED' | 'FAILED';
  idempotencyKey?: string | null;
  exportOptions?: Record<string, unknown> | null;
  version?: {
    id: string;
    versionNumber: number;
  };
}

export interface LegalDraftItem {
  id: string;
  expedienteId?: string | null;
  clientId?: string | null;
  sourceTemplateId?: string | null;
  title: string;
  category?: LegalDraftCategory;
  documentType: LegalDraftDocumentType;
  jurisdiction?: string | null;
  courtName?: string | null;
  caseNumber?: string | null;
  status: LegalDraftStatus;
  currentVersionNumber: number;
  isAiGenerated?: boolean;
  aiMetadata?: AiDraftMetadata | null;
  createdById: string;
  createdBy?: LegalUserSummary | null;
  archivedAt?: string | null;
  archivedById?: string | null;
  createdAt: string;
  updatedAt: string;
  expediente?: {
    id: string;
    caratula: string;
    numeroExpediente: string;
    juzgado?: string | null;
    jurisdiccion?: string | null;
    fuero?: string | null;
  } | null;
  client?: {
    id: string;
    firstName: string;
    lastName?: string | null;
    personType: 'HUMANA' | 'JURIDICA';
  } | null;
  sourceTemplate?: {
    id: string;
    name: string;
    versionNumber?: number;
    isSystemTemplate: boolean;
  } | null;
  versions?: LegalDraftVersionItem[];
  reviews?: LegalDraftReviewItem[];
  exports?: LegalDraftExportItem[];
}

export interface LegalTemplateItem {
  id: string;
  organizationId?: string | null;
  name: string;
  description?: string | null;
  category?: LegalDraftCategory;
  documentType: LegalDraftDocumentType;
  versionNumber?: number;
  baseInstructions?: string | null;
  variables?: string[];
  requiredInfo?: string[];
  jurisdiction?: string | null;
  fuero?: string | null;
  content: LegalDocContent;
  contentFormat: 'TIPTAP_JSON';
  isSystemTemplate: boolean;
  isActive: boolean;
  createdById?: string | null;
  createdBy?: LegalUserSummary | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const DRAFT_CATEGORY_LABELS: Record<LegalDraftCategory, string> = {
  ESCRITO_JUDICIAL: 'Escritos judiciales',
  CONTRATO: 'Contratos',
};

export const DRAFT_DOCUMENT_TYPE_LABELS: Record<LegalDraftDocumentType, string> = {
  DEMANDA: 'Demanda',
  CONTESTACION_DEMANDA: 'Contestación de Demanda',
  CONTESTACION_TRASLADO: 'Contesta Traslado',
  EXCEPCION: 'Excepción',
  APERTURA_PRUEBA: 'Apertura a Prueba',
  ALEGATO: 'Alegato',
  APELACION: 'Apelación',
  RECURSO: 'Recurso',
  EXPRESION_AGRAVIOS: 'Expresión de Agravios',
  CONTESTACION_AGRAVIOS: 'Contestación de Agravios',
  PRONTO_DESPACHO: 'Pronto Despacho',
  MEDIDA_CAUTELAR: 'Medida Cautelar',
  ESCRITO_LIBRE: 'Escrito Libre',
  SOLICITUD: 'Solicitud',
  OFICIO: 'Oficio',
  PRESENTACION_SIMPLE: 'Presentación Simple',
  INCIDENTE: 'Incidente',
  CONTRATO_LOCACION: 'Contrato de Locación',
  CONTRATO_SERVICIOS: 'Contrato de Servicios',
  CONTRATO_NDA: 'Confidencialidad (NDA)',
  CONTRATO_COMPRAVENTA: 'Contrato de Compraventa',
  CONTRATO_MUTUO: 'Contrato de Mutuo',
  OTRO_CONTRATO: 'Otro Contrato',
  OTRO: 'Otro',
};

export const DRAFT_STATUS_LABELS: Record<LegalDraftStatus, string> = {
  DRAFT: 'Borrador',
  IN_REVIEW: 'En revisión',
  CHANGES_REQUESTED: 'Cambios solicitados',
  APPROVED: 'Aprobado',
  FINALIZED: 'Finalizado',
  ARCHIVED: 'Archivado',
};

export const DRAFT_STATUS_BADGE_CLASS: Record<LegalDraftStatus, string> = {
  DRAFT: 'badge-gray',
  IN_REVIEW: 'badge-blue',
  CHANGES_REQUESTED: 'badge-yellow',
  APPROVED: 'badge-green',
  FINALIZED: 'badge-green',
  ARCHIVED: 'badge-gray',
};

export const REVIEW_STATUS_LABELS: Record<LegalDraftReviewStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  CHANGES_REQUESTED: 'Cambios solicitados',
};

export const DEFAULT_EMPTY_TIPTAP_DOC: LegalDocContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2, textAlign: 'center' },
      content: [{ type: 'text', text: '[COMPLETAR TÍTULO DEL ESCRITO]' }],
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'left' },
      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'SEÑOR/A JUEZ:' }],
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'justify' },
      content: [
        {
          type: 'text',
          text: '[DATO PENDIENTE DE CONFIRMAR: comparecencia y datos verificados].',
        },
      ],
    },
  ],
};
