export type ClientPersonType = 'HUMANA' | 'JURIDICA';
export type ClientStatus = 'ACTIVO' | 'INACTIVO' | 'ARCHIVADO';

export interface Client {
  id: string;
  personType: ClientPersonType;
  firstName: string;
  lastName?: string | null;
  dniCuit?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  notes?: string | null;
  status: ClientStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface PaginatedClientsResponse {
  data: Client[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

