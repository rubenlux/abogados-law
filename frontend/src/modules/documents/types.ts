export type DocumentCategory =
  | 'DEMANDA'
  | 'CONTESTACION'
  | 'ESCRITO_JUDICIAL'
  | 'RESOLUCION'
  | 'SENTENCIA'
  | 'NOTIFICACION'
  | 'PODER'
  | 'CONTRATO'
  | 'DOCUMENTACION_CLIENTE'
  | 'PRUEBA_DOCUMENTAL'
  | 'INFORME'
  | 'DICTAMEN'
  | 'COMPROBANTE'
  | 'CORRESPONDENCIA'
  | 'OTRO';

export type DocumentStatus = 'ACTIVE' | 'ARCHIVED';

export interface DocumentUserRef {
  id: string;
  fullName?: string | null;
  email?: string;
}

export interface DocumentFileVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedById: string;
  uploadedBy?: DocumentUserRef | null;
  uploadedAt: string;
  changeNote?: string | null;
}

export interface DocumentItem {
  id: string;
  expedienteId?: string | null;
  clientId?: string | null;
  movimientoProcesalId?: string | null;
  title: string;
  description?: string | null;
  category: DocumentCategory;
  documentDate?: string | null;
  status: DocumentStatus;
  currentVersionNumber: number;
  createdById?: string;
  createdBy?: DocumentUserRef | null;
  archivedAt?: string | null;
  archivedById?: string | null;
  archivedBy?: DocumentUserRef | null;
  createdAt: string;
  updatedAt: string;
  expediente?: {
    id: string;
    caratula: string;
    numeroExpediente: string;
  } | null;
  client?: {
    id: string;
    firstName: string;
    lastName?: string | null;
    personType: 'HUMANA' | 'JURIDICA';
  } | null;
  movimientoProcesal?: {
    id: string;
    tipo: string;
    titulo: string;
    fechaActuacion: string;
  } | null;
  versions?: DocumentFileVersion[];
}

export interface PaginatedDocumentsResponse {
  data: DocumentItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  DEMANDA: 'Demanda',
  CONTESTACION: 'Contestación',
  ESCRITO_JUDICIAL: 'Escrito Judicial',
  RESOLUCION: 'Resolución',
  SENTENCIA: 'Sentencia',
  NOTIFICACION: 'Notificación',
  PODER: 'Poder',
  CONTRATO: 'Contrato',
  DOCUMENTACION_CLIENTE: 'Documentación de Cliente',
  PRUEBA_DOCUMENTAL: 'Prueba Documental',
  INFORME: 'Informe',
  DICTAMEN: 'Dictamen',
  COMPROBANTE: 'Comprobante',
  CORRESPONDENCIA: 'Correspondencia',
  OTRO: 'Otro',
};

export const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.doc',
  '.xlsx',
  '.xls',
  '.png',
  '.jpg',
  '.jpeg',
];

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export function validateClientSideFile(file: File): string | null {
  if (file.size <= 0) {
    return 'No se permiten archivos vacíos.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return 'El archivo supera el límite máximo permitido de 25 MB.';
  }
  if (file.name.length > 255) {
    return 'El nombre del archivo excede el máximo de 255 caracteres.';
  }
  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Formato no permitido (${ext || 'sin extensión'}). Permitidos: PDF, DOCX, DOC, XLSX, XLS, PNG, JPG/JPEG.`;
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

