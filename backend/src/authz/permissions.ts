/**
 * Matriz Declarativa de Permisos (§8.1) y Proyecciones Mínimas de Columnas (§8.2) — AUTH-04
 * Especificación: SPEC-AUTH-004 v0.2.0 — APPROVED
 */

import * as crypto from "crypto";
import { OrganizationRole, Prisma } from "@prisma/client";

export type OrgPermission =
  | "org:read"
  | "org:manage_status"
  | "org:transfer_ownership"
  | "members:read"
  | "audit:read"
  | "members:manage"
  | "members:change_role"
  | "clients:read"
  | "clients:write"
  | "clients:delete"
  | "cases:read"
  | "cases:write"
  | "cases:delete"
  | "documents:metadata_read"
  | "documents:read"
  | "documents:write"
  | "documents:download"
  | "documents:delete"
  | "documents:sensitive"
  | "agenda:read"
  | "agenda:write"
  | "templates:read"
  | "templates:write"
  | "legal_drafts:read"
  | "legal_drafts:write"
  | "legal_drafts:review"
  | "legal_drafts:approve"
  | "legal_drafts:export"
  | "legal_templates:manage"
  | "legal_ai:read"
  | "legal_ai:write"
  | "legal_ai_analysis:read"
  | "legal_ai_analysis:write"
  | "ai:use"
  | "judicial:sync"
  | "judicial:manage_accounts"
  | "usage:read"
  | "knowledge:read";

const STAFF_PERMISSIONS: ReadonlyArray<OrgPermission> = [
  "org:read",
  "clients:read",
  "cases:read",
  "agenda:read",
  "documents:metadata_read",
  "knowledge:read",
];

const ASSISTANT_PERMISSIONS: ReadonlyArray<OrgPermission> = [
  ...STAFF_PERMISSIONS,
  "clients:write",
  "documents:read",
  "documents:write",
  "documents:download",
  "agenda:write",
  "templates:read",
  "legal_drafts:read",
  "legal_drafts:write",
  "legal_drafts:export",
];

const LAWYER_PERMISSIONS: ReadonlyArray<OrgPermission> = [
  ...ASSISTANT_PERMISSIONS,
  "cases:write",
  "legal_drafts:review",
  "legal_drafts:approve",
  "legal_templates:manage",
  "legal_ai:read",
  "legal_ai:write",
  "legal_ai_analysis:read",
  "legal_ai_analysis:write",
  "ai:use",
  "judicial:sync",
];

const ORG_ADMIN_PERMISSIONS: ReadonlyArray<OrgPermission> = [
  ...LAWYER_PERMISSIONS,
  "members:read",
  "audit:read",
  "members:manage",
  "clients:delete",
  "cases:delete",
  "documents:delete",
  "documents:sensitive",
  "templates:write",
  "judicial:manage_accounts",
  "usage:read",
];

const ORG_OWNER_PERMISSIONS: ReadonlyArray<OrgPermission> = [
  ...ORG_ADMIN_PERMISSIONS,
  "org:manage_status",
  "org:transfer_ownership",
  "members:change_role",
];

export const ROLE_PERMISSIONS: Record<
  OrganizationRole,
  ReadonlySet<OrgPermission>
> = {
  [OrganizationRole.STAFF]: new Set(STAFF_PERMISSIONS),
  [OrganizationRole.ASSISTANT]: new Set(ASSISTANT_PERMISSIONS),
  [OrganizationRole.LAWYER]: new Set(LAWYER_PERMISSIONS),
  [OrganizationRole.ORG_ADMIN]: new Set(ORG_ADMIN_PERMISSIONS),
  [OrganizationRole.ORG_OWNER]: new Set(ORG_OWNER_PERMISSIONS),
};

export function hasOrgPermissions(
  role: OrganizationRole,
  required: ReadonlyArray<OrgPermission>,
): boolean {
  const granted = ROLE_PERMISSIONS[role];
  if (!granted || required.length === 0) {
    return false;
  }
  return required.every((perm) => granted.has(perm));
}

/**
 * Columnas estrictamente prohibidas en toda respuesta HTTP para cualquier rol (§8.2).
 */
export const FORBIDDEN_RESPONSE_FIELDS: ReadonlyArray<string> = Object.freeze([
  "passwordHash",
  "refreshTokenHash",
  "sessionToken",
  "codeVerifier",
  "tokenHash",
  "encryptedPassword",
  "storagePath",
  "storageKey",
]);

/**
 * Construye clave lógica canónica de almacenamiento prefijada por tenant (§13).
 * Nunca acepta rutas provistas por el cliente.
 */
export function buildCanonicalStoragePath(params: {
  organizationId: string;
  expedienteId: string;
  documentId: string;
  versionNumber: number;
}): string {
  const randomUuid = crypto.randomUUID();
  return `orgs/${params.organizationId}/expedientes/${params.expedienteId}/documents/${params.documentId}/v${params.versionNumber}/${randomUuid}`;
}

// =============================================================================
// Proyecciones Explícitas de Columnas por Rol (§8.2)
// =============================================================================

const EXPEDIENTE_STAFF_SELECT: Prisma.ExpedienteSelect = {
  id: true,
  caratula: true,
  numeroExpediente: true,
  juzgado: true,
  jurisdiccion: true,
  provincia: true,
  fuero: true,
  secretaria: true,
  tipoProceso: true,
  materia: true,
  fechaInicio: true,
  estado: true,
  updatedAt: true,
};

const EXPEDIENTE_ASSISTANT_SELECT: Prisma.ExpedienteSelect = {
  ...EXPEDIENTE_STAFF_SELECT,
  descripcion: true,
  tags: true,
  createdAt: true,
  responsableId: true,
  responsable: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  users: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  partes: {
    select: {
      id: true,
      clientId: true,
      nombre: true,
      tipoParte: true,
      cuitDni: true,
      rol: true,
      caracter: true,
      esCliente: true,
      observaciones: true,
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dniCuit: true,
          email: true,
          phone: true,
        },
      },
    },
  },
};

const EXPEDIENTE_LAWYER_SELECT: Prisma.ExpedienteSelect = {
  ...EXPEDIENTE_ASSISTANT_SELECT,
  organizationId: true,
};

export const EXPEDIENTE_SELECT_BY_ROLE: Record<
  OrganizationRole,
  Prisma.ExpedienteSelect
> = {
  [OrganizationRole.STAFF]: EXPEDIENTE_STAFF_SELECT,
  [OrganizationRole.ASSISTANT]: EXPEDIENTE_ASSISTANT_SELECT,
  [OrganizationRole.LAWYER]: EXPEDIENTE_LAWYER_SELECT,
  [OrganizationRole.ORG_ADMIN]: EXPEDIENTE_LAWYER_SELECT,
  [OrganizationRole.ORG_OWNER]: EXPEDIENTE_LAWYER_SELECT,
};

const CLIENT_STAFF_SELECT: Prisma.ClientSelect = {
  id: true,
  personType: true,
  firstName: true,
  lastName: true,
  dniCuit: true,
  email: true,
  phone: true,
  address: true,
  city: true,
  province: true,
  status: true,
  createdAt: true,
};

const CLIENT_FULL_SELECT: Prisma.ClientSelect = {
  ...CLIENT_STAFF_SELECT,
  notes: true,
  updatedAt: true,
};

export const CLIENT_SELECT_BY_ROLE: Record<
  OrganizationRole,
  Prisma.ClientSelect
> = {
  [OrganizationRole.STAFF]: CLIENT_STAFF_SELECT,
  [OrganizationRole.ASSISTANT]: CLIENT_FULL_SELECT,
  [OrganizationRole.LAWYER]: CLIENT_FULL_SELECT,
  [OrganizationRole.ORG_ADMIN]: CLIENT_FULL_SELECT,
  [OrganizationRole.ORG_OWNER]: CLIENT_FULL_SELECT,
};

const EVENTO_STAFF_SELECT: Prisma.EventoAgendaSelect = {
  id: true,
  expedienteId: true,
  titulo: true,
  fechaVencimiento: true,
  tipoPlazo: true,
  estado: true,
  isCritical: true,
  expediente: {
    select: {
      caratula: true,
      numeroExpediente: true,
      juzgado: true,
    },
  },
};

const EVENTO_FULL_SELECT: Prisma.EventoAgendaSelect = {
  ...EVENTO_STAFF_SELECT,
  descripcion: true,
  alertConfig: true,
  createdAt: true,
  updatedAt: true,
};

export const EVENTO_AGENDA_SELECT_BY_ROLE: Record<
  OrganizationRole,
  Prisma.EventoAgendaSelect
> = {
  [OrganizationRole.STAFF]: EVENTO_STAFF_SELECT,
  [OrganizationRole.ASSISTANT]: EVENTO_FULL_SELECT,
  [OrganizationRole.LAWYER]: EVENTO_FULL_SELECT,
  [OrganizationRole.ORG_ADMIN]: EVENTO_FULL_SELECT,
  [OrganizationRole.ORG_OWNER]: EVENTO_FULL_SELECT,
};

const DOCUMENTO_ASSISTANT_SELECT: Prisma.DocumentoSelect = {
  id: true,
  expedienteId: true,
  tipo: true,
  fileName: true,
  fileSize: true,
  mimeType: true,
  hashSha256: true,
  isLocked: true,
  legalHold: true,
  createdAt: true,
  updatedAt: true,
};

const DOCUMENTO_LAWYER_SELECT: Prisma.DocumentoSelect = {
  ...DOCUMENTO_ASSISTANT_SELECT,
  ocrContent: true,
  legalHoldReason: true,
  lockExpiresAt: true,
};

export const DOCUMENTO_SELECT_BY_ROLE: Record<
  OrganizationRole,
  Prisma.DocumentoSelect | null
> = {
  [OrganizationRole.STAFF]: null,
  [OrganizationRole.ASSISTANT]: DOCUMENTO_ASSISTANT_SELECT,
  [OrganizationRole.LAWYER]: DOCUMENTO_LAWYER_SELECT,
  [OrganizationRole.ORG_ADMIN]: DOCUMENTO_LAWYER_SELECT,
  [OrganizationRole.ORG_OWNER]: DOCUMENTO_LAWYER_SELECT,
};

const DOC_VERSION_ASSISTANT_SELECT: Prisma.DocumentVersionSelect = {
  id: true,
  documentId: true,
  versionNumber: true,
  fileName: true,
  mimeType: true,
  fileSize: true,
  hashSha256: true,
  uploadedBy: true,
  createdAt: true,
};

const DOC_VERSION_LAWYER_SELECT: Prisma.DocumentVersionSelect = {
  ...DOC_VERSION_ASSISTANT_SELECT,
  ocrContent: true,
  changesSummary: true,
};

export const DOCUMENT_VERSION_SELECT_BY_ROLE: Record<
  OrganizationRole,
  Prisma.DocumentVersionSelect | null
> = {
  [OrganizationRole.STAFF]: null,
  [OrganizationRole.ASSISTANT]: DOC_VERSION_ASSISTANT_SELECT,
  [OrganizationRole.LAWYER]: DOC_VERSION_LAWYER_SELECT,
  [OrganizationRole.ORG_ADMIN]: DOC_VERSION_LAWYER_SELECT,
  [OrganizationRole.ORG_OWNER]: DOC_VERSION_LAWYER_SELECT,
};

const LEGAL_TEMPLATE_ASSISTANT_SELECT: Prisma.LegalTemplateSelect = {
  id: true,
  name: true,
  description: true,
  variables: true,
  category: true,
  isActive: true,
};

const LEGAL_TEMPLATE_LAWYER_SELECT: Prisma.LegalTemplateSelect = {
  ...LEGAL_TEMPLATE_ASSISTANT_SELECT,
  content: true,
  createdAt: true,
  updatedAt: true,
};

export const LEGAL_TEMPLATE_SELECT_BY_ROLE: Record<
  OrganizationRole,
  Prisma.LegalTemplateSelect | null
> = {
  [OrganizationRole.STAFF]: null,
  [OrganizationRole.ASSISTANT]: LEGAL_TEMPLATE_ASSISTANT_SELECT,
  [OrganizationRole.LAWYER]: LEGAL_TEMPLATE_LAWYER_SELECT,
  [OrganizationRole.ORG_ADMIN]: LEGAL_TEMPLATE_LAWYER_SELECT,
  [OrganizationRole.ORG_OWNER]: LEGAL_TEMPLATE_LAWYER_SELECT,
};

const JUDICIAL_ACCOUNT_ADMIN_SELECT: Prisma.JudicialAccountSelect = {
  id: true,
  organizationId: true,
  jurisdiction: true,
  username: true,
  status: true,
  lastSyncAt: true,
  createdAt: true,
  updatedAt: true,
};

export const JUDICIAL_ACCOUNT_SELECT_BY_ROLE: Record<
  OrganizationRole,
  Prisma.JudicialAccountSelect | null
> = {
  [OrganizationRole.STAFF]: null,
  [OrganizationRole.ASSISTANT]: null,
  [OrganizationRole.LAWYER]: null,
  [OrganizationRole.ORG_ADMIN]: JUDICIAL_ACCOUNT_ADMIN_SELECT,
  [OrganizationRole.ORG_OWNER]: JUDICIAL_ACCOUNT_ADMIN_SELECT,
};

// =============================================================================
// AUTH-07: Proyecciones de Movimientos Procesales, Eventos de Agenda y Vencimientos
// =============================================================================

const MOVIMIENTO_STAFF_SELECT: Prisma.MovimientoProcesalSelect = {
  id: true,
  expedienteId: true,
  tipo: true,
  titulo: true,
  fechaActuacion: true,
  fechaRegistro: true,
  origen: true,
  referencia: true,
  anuladoAt: true,
  expediente: {
    select: {
      id: true,
      caratula: true,
      numeroExpediente: true,
    },
  },
};

const MOVIMIENTO_FULL_SELECT: Prisma.MovimientoProcesalSelect = {
  ...MOVIMIENTO_STAFF_SELECT,
  descripcion: true,
  metadatos: true,
  registradoPorId: true,
  registradoPor: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  anuladoPorId: true,
  anuladoPor: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  anuladoMotivo: true,
  createdAt: true,
  updatedAt: true,
};

export const MOVIMIENTO_SELECT_BY_ROLE: Record<
  OrganizationRole,
  Prisma.MovimientoProcesalSelect
> = {
  [OrganizationRole.STAFF]: MOVIMIENTO_STAFF_SELECT,
  [OrganizationRole.ASSISTANT]: MOVIMIENTO_FULL_SELECT,
  [OrganizationRole.LAWYER]: MOVIMIENTO_FULL_SELECT,
  [OrganizationRole.ORG_ADMIN]: MOVIMIENTO_FULL_SELECT,
  [OrganizationRole.ORG_OWNER]: MOVIMIENTO_FULL_SELECT,
};

const AGENDA_EVENT_STAFF_SELECT: Prisma.AgendaEventSelect = {
  id: true,
  expedienteId: true,
  titulo: true,
  tipo: true,
  fechaInicio: true,
  fechaFin: true,
  estado: true,
  responsableId: true,
  responsable: {
    select: {
      id: true,
      fullName: true,
    },
  },
  expediente: {
    select: {
      id: true,
      caratula: true,
      numeroExpediente: true,
    },
  },
};

const AGENDA_EVENT_FULL_SELECT: Prisma.AgendaEventSelect = {
  ...AGENDA_EVENT_STAFF_SELECT,
  descripcion: true,
  ubicacion: true,
  responsable: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  creadoPorId: true,
  creadoPor: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  createdAt: true,
  updatedAt: true,
};

export const AGENDA_EVENT_SELECT_BY_ROLE: Record<
  OrganizationRole,
  Prisma.AgendaEventSelect
> = {
  [OrganizationRole.STAFF]: AGENDA_EVENT_STAFF_SELECT,
  [OrganizationRole.ASSISTANT]: AGENDA_EVENT_FULL_SELECT,
  [OrganizationRole.LAWYER]: AGENDA_EVENT_FULL_SELECT,
  [OrganizationRole.ORG_ADMIN]: AGENDA_EVENT_FULL_SELECT,
  [OrganizationRole.ORG_OWNER]: AGENDA_EVENT_FULL_SELECT,
};

const VENCIMIENTO_STAFF_SELECT: Prisma.VencimientoSelect = {
  id: true,
  expedienteId: true,
  titulo: true,
  tipo: true,
  fechaLimite: true,
  origenFechaLimite: true,
  prioridad: true,
  estado: true,
  responsableId: true,
  responsable: {
    select: {
      id: true,
      fullName: true,
    },
  },
  cumplidoAt: true,
  expediente: {
    select: {
      id: true,
      caratula: true,
      numeroExpediente: true,
    },
  },
};

const VENCIMIENTO_FULL_SELECT: Prisma.VencimientoSelect = {
  ...VENCIMIENTO_STAFF_SELECT,
  descripcion: true,
  observaciones: true,
  responsable: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  creadoPorId: true,
  creadoPor: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  cumplidoPorId: true,
  cumplidoPor: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  createdAt: true,
  updatedAt: true,
};

export const VENCIMIENTO_SELECT_BY_ROLE: Record<
  OrganizationRole,
  Prisma.VencimientoSelect
> = {
  [OrganizationRole.STAFF]: VENCIMIENTO_STAFF_SELECT,
  [OrganizationRole.ASSISTANT]: VENCIMIENTO_FULL_SELECT,
  [OrganizationRole.LAWYER]: VENCIMIENTO_FULL_SELECT,
  [OrganizationRole.ORG_ADMIN]: VENCIMIENTO_FULL_SELECT,
  [OrganizationRole.ORG_OWNER]: VENCIMIENTO_FULL_SELECT,
};

// =============================================================================
// AUTH-08: Proyecciones de Gestión Documental (nunca exponer storageKey)
// =============================================================================

const DOC_VERSION_PUBLIC_SELECT: Prisma.DocumentFileVersionSelect = {
  id: true,
  documentId: true,
  versionNumber: true,
  originalFilename: true,
  mimeType: true,
  sizeBytes: true,
  sha256: true,
  uploadedById: true,
  uploadedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  uploadedAt: true,
  changeNote: true,
};

export const DOCUMENT_FILE_VERSION_SELECT_BY_ROLE: Record<
  OrganizationRole,
  Prisma.DocumentFileVersionSelect | null
> = {
  [OrganizationRole.STAFF]: null,
  [OrganizationRole.ASSISTANT]: DOC_VERSION_PUBLIC_SELECT,
  [OrganizationRole.LAWYER]: DOC_VERSION_PUBLIC_SELECT,
  [OrganizationRole.ORG_ADMIN]: DOC_VERSION_PUBLIC_SELECT,
  [OrganizationRole.ORG_OWNER]: DOC_VERSION_PUBLIC_SELECT,
};

const DOCUMENT_STAFF_SELECT: Prisma.DocumentSelect = {
  id: true,
  expedienteId: true,
  clientId: true,
  movimientoProcesalId: true,
  title: true,
  category: true,
  documentDate: true,
  status: true,
  currentVersionNumber: true,
  createdAt: true,
  updatedAt: true,
  expediente: {
    select: {
      id: true,
      caratula: true,
      numeroExpediente: true,
    },
  },
  client: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      personType: true,
    },
  },
};

const DOCUMENT_FULL_SELECT: Prisma.DocumentSelect = {
  ...DOCUMENT_STAFF_SELECT,
  description: true,
  createdById: true,
  createdBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  archivedAt: true,
  archivedById: true,
  archivedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  movimientoProcesal: {
    select: {
      id: true,
      tipo: true,
      titulo: true,
      fechaActuacion: true,
    },
  },
  versions: {
    orderBy: { versionNumber: "desc" },
    select: DOC_VERSION_PUBLIC_SELECT,
  },
};

export const DOCUMENT_SELECT_BY_ROLE: Record<
  OrganizationRole,
  Prisma.DocumentSelect
> = {
  [OrganizationRole.STAFF]: DOCUMENT_STAFF_SELECT,
  [OrganizationRole.ASSISTANT]: DOCUMENT_FULL_SELECT,
  [OrganizationRole.LAWYER]: DOCUMENT_FULL_SELECT,
  [OrganizationRole.ORG_ADMIN]: DOCUMENT_FULL_SELECT,
  [OrganizationRole.ORG_OWNER]: DOCUMENT_FULL_SELECT,
};
