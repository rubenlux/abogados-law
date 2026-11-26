export type ExpedienteEstado =
  | 'INICIO'
  | 'EN_TRAMITE'
  | 'PRUEBA'
  | 'ALEGATOS'
  | 'SENTENCIA'
  | 'APELACION'
  | 'PENDIENTE'
  | 'SUSPENDIDO'
  | 'FINALIZADO'
  | 'ARCHIVADO';

export type RolParteProcesal =
  | 'ACTOR'
  | 'DEMANDADO'
  | 'DENUNCIANTE'
  | 'DENUNCIADO'
  | 'QUERELLANTE'
  | 'IMPUTADO'
  | 'SOLICITANTE'
  | 'BENEFICIARIO'
  | 'TERCERO'
  | 'OTRO';

export type TipoParte = 'HUMANA' | 'JURIDICA';

export interface ExpedienteUser {
  id: string;
  fullName: string | null;
  email: string;
}

export interface ExpedienteParteClient {
  id: string;
  firstName: string;
  lastName?: string | null;
  dniCuit?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface ExpedienteParte {
  id: string;
  clientId?: string | null;
  nombre: string;
  tipoParte?: TipoParte;
  cuitDni?: string | null;
  rol: RolParteProcesal;
  caracter?: string | null;
  esCliente: boolean;
  observaciones?: string | null;
  client?: ExpedienteParteClient | null;
}

export interface Expediente {
  id: string;
  caratula: string;
  numeroExpediente: string;
  juzgado: string;
  jurisdiccion: string;
  provincia?: string | null;
  fuero?: string | null;
  secretaria?: string | null;
  tipoProceso?: string | null;
  materia?: string | null;
  fechaInicio?: string | null;
  descripcion?: string | null;
  estado: ExpedienteEstado;
  tags?: string[];
  responsableId?: string | null;
  responsable?: ExpedienteUser | null;
  users?: ExpedienteUser[];
  partes?: ExpedienteParte[];
  createdAt?: string;
  updatedAt: string;
}

export interface PaginatedExpedientesResponse {
  data: Expediente[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const ESTADO_LABELS: Record<ExpedienteEstado, string> = {
  INICIO: 'Inicio',
  EN_TRAMITE: 'En Trámite',
  PRUEBA: 'Prueba',
  ALEGATOS: 'Alegatos',
  SENTENCIA: 'Sentencia',
  APELACION: 'Apelación',
  PENDIENTE: 'Pendiente',
  SUSPENDIDO: 'Suspendido',
  FINALIZADO: 'Finalizado',
  ARCHIVADO: 'Archivado',
};

export const ROL_PARTE_LABELS: Record<RolParteProcesal, string> = {
  ACTOR: 'Actor / Demandante',
  DEMANDADO: 'Demandado',
  DENUNCIANTE: 'Denunciante',
  DENUNCIADO: 'Denunciado',
  QUERELLANTE: 'Querellante',
  IMPUTADO: 'Imputado',
  SOLICITANTE: 'Solicitante',
  BENEFICIARIO: 'Beneficiario',
  TERCERO: 'Tercero',
  OTRO: 'Otro',
};

export const FUERO_OPTIONS = [
  { value: 'CIVIL', label: 'Civil' },
  { value: 'COMERCIAL', label: 'Comercial' },
  { value: 'CIVIL_COMERCIAL', label: 'Civil y Comercial' },
  { value: 'LABORAL', label: 'Laboral' },
  { value: 'PENAL', label: 'Penal' },
  { value: 'FAMILIA', label: 'Familia' },
  { value: 'CONTENCIOSO', label: 'Contencioso Administrativo' },
  { value: 'FEDERAL', label: 'Federal' },
  { value: 'PREVISIONAL', label: 'Seguridad Social / Previsional' },
];

export const JURISDICCION_OPTIONS = [
  { value: 'NACION', label: 'Nación (Federal / Nacional)' },
  { value: 'CABA', label: 'Ciudad Autónoma de Buenos Aires' },
  { value: 'BUENOS_AIRES', label: 'Provincia de Buenos Aires' },
  { value: 'CATAMARCA', label: 'Catamarca' },
  { value: 'CHACO', label: 'Chaco' },
  { value: 'CHUBUT', label: 'Chubut' },
  { value: 'CORDOBA', label: 'Córdoba' },
  { value: 'CORRIENTES', label: 'Corrientes' },
  { value: 'ENTRE_RIOS', label: 'Entre Ríos' },
  { value: 'FORMOSA', label: 'Formosa' },
  { value: 'JUJUY', label: 'Jujuy' },
  { value: 'LA_PAMPA', label: 'La Pampa' },
  { value: 'LA_RIOJA', label: 'La Rioja' },
  { value: 'MENDOZA', label: 'Mendoza' },
  { value: 'MISIONES', label: 'Misiones' },
  { value: 'NEUQUEN', label: 'Neuquén' },
  { value: 'RIO_NEGRO', label: 'Río Negro' },
  { value: 'SALTA', label: 'Salta' },
  { value: 'SAN_JUAN', label: 'San Juan' },
  { value: 'SAN_LUIS', label: 'San Luis' },
  { value: 'SANTA_CRUZ', label: 'Santa Cruz' },
  { value: 'SANTA_FE', label: 'Santa Fe' },
  { value: 'SANTIAGO_DEL_ESTERO', label: 'Santiago del Estero' },
  { value: 'TIERRA_DEL_FUEGO', label: 'Tierra del Fuego' },
  { value: 'TUCUMAN', label: 'Tucumán' },
];

export function getEstadoStyle(estado: ExpedienteEstado): {
  bg: string;
  color: string;
} {
  switch (estado) {
    case 'INICIO':
    case 'EN_TRAMITE':
      return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' };
    case 'PRUEBA':
    case 'ALEGATOS':
      return { bg: 'rgba(234, 179, 8, 0.15)', color: '#facc15' };
    case 'SENTENCIA':
    case 'APELACION':
      return { bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' };
    case 'FINALIZADO':
      return { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' };
    case 'PENDIENTE':
    case 'SUSPENDIDO':
      return { bg: 'rgba(249, 115, 22, 0.15)', color: '#fb923c' };
    case 'ARCHIVADO':
    default:
      return { bg: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af' };
  }
}

