export type TipoMovimientoProcesal =
  | 'PRESENTACION'
  | 'NOTIFICACION'
  | 'PROVIDENCIA'
  | 'RESOLUCION'
  | 'SENTENCIA'
  | 'AUDIENCIA'
  | 'DILIGENCIA'
  | 'TRASLADO'
  | 'CONTESTACION'
  | 'RECURSO'
  | 'OTRO';

export type OrigenMovimiento = 'MANUAL' | 'SISTEMA' | 'IMPORTACION';

export interface SimpleUserRef {
  id: string;
  fullName?: string | null;
  email?: string;
}

export interface SimpleExpedienteRef {
  id: string;
  caratula: string;
  numeroExpediente: string;
}

export interface MovimientoProcesal {
  id: string;
  expedienteId: string;
  tipo: TipoMovimientoProcesal;
  titulo: string;
  descripcion?: string | null;
  fechaActuacion: string;
  fechaRegistro: string;
  origen: OrigenMovimiento;
  referencia?: string | null;
  metadatos?: Record<string, unknown> | null;
  registradoPorId?: string;
  registradoPor?: SimpleUserRef | null;
  anuladoAt?: string | null;
  anuladoPorId?: string | null;
  anuladoPor?: SimpleUserRef | null;
  anuladoMotivo?: string | null;
  expediente?: SimpleExpedienteRef | null;
}

export type TipoEventoAgenda =
  | 'AUDIENCIA'
  | 'REUNION_CLIENTE'
  | 'REUNION_INTERNA'
  | 'DILIGENCIA'
  | 'PRESENTACION_PROGRAMADA'
  | 'LLAMADA'
  | 'TRAMITE'
  | 'OTRO';

export type EstadoEventoAgenda =
  | 'PROGRAMADO'
  | 'CONFIRMADO'
  | 'COMPLETADO'
  | 'CANCELADO';

export interface AgendaEvent {
  id: string;
  expedienteId?: string | null;
  titulo: string;
  descripcion?: string | null;
  tipo: TipoEventoAgenda;
  fechaInicio: string;
  fechaFin?: string | null;
  ubicacion?: string | null;
  estado: EstadoEventoAgenda;
  responsableId?: string | null;
  responsable?: SimpleUserRef | null;
  creadoPorId?: string;
  creadoPor?: SimpleUserRef | null;
  expediente?: SimpleExpedienteRef | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OverlapWarning {
  hasOverlap: boolean;
  overlappingCount: number;
  overlappingEventIds: string[];
}

export type TipoVencimiento =
  | 'PROCESAL'
  | 'DOCUMENTACION'
  | 'PRESENTACION'
  | 'ADMINISTRATIVO'
  | 'INTERNO'
  | 'OTRO';

export type PrioridadVencimiento = 'BAJA' | 'NORMAL' | 'ALTA' | 'CRITICA';

export type EstadoVencimiento =
  | 'PENDIENTE'
  | 'EN_CURSO'
  | 'CUMPLIDO'
  | 'CANCELADO';

export interface Vencimiento {
  id: string;
  expedienteId?: string | null;
  titulo: string;
  descripcion?: string | null;
  tipo: TipoVencimiento;
  fechaLimite: string;
  origenFechaLimite: 'MANUAL';
  prioridad: PrioridadVencimiento;
  estado: EstadoVencimiento;
  estaVencido: boolean;
  observaciones?: string | null;
  responsableId?: string | null;
  responsable?: SimpleUserRef | null;
  creadoPorId?: string;
  creadoPor?: SimpleUserRef | null;
  cumplidoAt?: string | null;
  cumplidoPorId?: string | null;
  cumplidoPor?: SimpleUserRef | null;
  expediente?: SimpleExpedienteRef | null;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const TIPO_MOVIMIENTO_LABELS: Record<TipoMovimientoProcesal, string> = {
  PRESENTACION: 'Presentación',
  NOTIFICACION: 'Notificación',
  PROVIDENCIA: 'Providencia',
  RESOLUCION: 'Resolución',
  SENTENCIA: 'Sentencia',
  AUDIENCIA: 'Audiencia',
  DILIGENCIA: 'Diligencia',
  TRASLADO: 'Traslado',
  CONTESTACION: 'Contestación',
  RECURSO: 'Recurso',
  OTRO: 'Otro',
};

export const TIPO_EVENTO_LABELS: Record<TipoEventoAgenda, string> = {
  AUDIENCIA: 'Audiencia',
  REUNION_CLIENTE: 'Reunión con Cliente',
  REUNION_INTERNA: 'Reunión Interna',
  DILIGENCIA: 'Diligencia',
  PRESENTACION_PROGRAMADA: 'Presentación Programada',
  LLAMADA: 'Llamada',
  TRAMITE: 'Trámite',
  OTRO: 'Otro',
};

export const ESTADO_EVENTO_LABELS: Record<EstadoEventoAgenda, string> = {
  PROGRAMADO: 'Programado',
  CONFIRMADO: 'Confirmado',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
};

export const TIPO_VENCIMIENTO_LABELS: Record<TipoVencimiento, string> = {
  PROCESAL: 'Procesal',
  DOCUMENTACION: 'Documentación',
  PRESENTACION: 'Presentación',
  ADMINISTRATIVO: 'Administrativo',
  INTERNO: 'Interno',
  OTRO: 'Otro',
};

export const PRIORIDAD_VENCIMIENTO_LABELS: Record<PrioridadVencimiento, string> = {
  BAJA: 'Baja',
  NORMAL: 'Normal',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
};

export const ESTADO_VENCIMIENTO_LABELS: Record<EstadoVencimiento, string> = {
  PENDIENTE: 'Pendiente',
  EN_CURSO: 'En Curso',
  CUMPLIDO: 'Cumplido',
  CANCELADO: 'Cancelado',
};

export function getPrioridadStyle(prioridad: PrioridadVencimiento): {
  bg: string;
  color: string;
} {
  switch (prioridad) {
    case 'CRITICA':
      return { bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171' };
    case 'ALTA':
      return { bg: 'rgba(249, 115, 22, 0.2)', color: '#fb923c' };
    case 'NORMAL':
      return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' };
    case 'BAJA':
    default:
      return { bg: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af' };
  }
}

export function getEventoEstadoStyle(estado: EstadoEventoAgenda): {
  bg: string;
  color: string;
} {
  switch (estado) {
    case 'PROGRAMADO':
      return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' };
    case 'CONFIRMADO':
      return { bg: 'rgba(234, 179, 8, 0.15)', color: '#facc15' };
    case 'COMPLETADO':
      return { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' };
    case 'CANCELADO':
    default:
      return { bg: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af' };
  }
}

export function getVencimientoEstadoStyle(estado: EstadoVencimiento): {
  bg: string;
  color: string;
} {
  switch (estado) {
    case 'PENDIENTE':
      return { bg: 'rgba(234, 179, 8, 0.15)', color: '#facc15' };
    case 'EN_CURSO':
      return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' };
    case 'CUMPLIDO':
      return { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' };
    case 'CANCELADO':
    default:
      return { bg: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af' };
  }
}

