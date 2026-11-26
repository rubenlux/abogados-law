import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PenTool,
  Plus,
  Search,
  ExternalLink,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import type {
  LegalDraftDocumentType,
  LegalDraftItem,
  LegalDraftStatus,
  LegalTemplateItem,
  PaginatedResponse,
} from '../types';
import {
  DRAFT_DOCUMENT_TYPE_LABELS,
  DRAFT_STATUS_BADGE_CLASS,
  DRAFT_STATUS_LABELS,
} from '../types';

interface SimpleExpediente {
  id: string;
  numeroExpediente: string;
  caratula: string;
}

interface SimpleClient {
  id: string;
  firstName: string;
  lastName?: string | null;
}

export const LegalDraftsListPage: React.FC = () => {
  const navigate = useNavigate();

  const [drafts, setDrafts] = useState<LegalDraftItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [expedienteFilter, setExpedienteFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Reference lists
  const [expedientes, setExpedientes] = useState<SimpleExpediente[]>([]);
  const [clients, setClients] = useState<SimpleClient[]>([]);
  const [templates, setTemplates] = useState<LegalTemplateItem[]>([]);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [expedienteId, setExpedienteId] = useState('');
  const [clientId, setClientId] = useState('');
  const [documentType, setDocumentType] =
    useState<LegalDraftDocumentType>('DEMANDA');
  const [sourceTemplateId, setSourceTemplateId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadRefs = async () => {
      try {
        const [expRes, cliRes, tplRes] = await Promise.all([
          apiClient.expedientes.findAll({ page: 1, limit: 100 }).catch(() => ({ data: [] })),
          apiClient.clients.findAll({ page: 1, limit: 100 }).catch(() => ({ data: [] })),
          apiClient.legalTemplates.findAll({ page: 1, limit: 100 }).catch(() => ({ data: [] })),
        ]);
        if (!active) return;
        setExpedientes(Array.isArray(expRes?.data) ? expRes.data : []);
        setClients(Array.isArray(cliRes?.data) ? cliRes.data : []);
        setTemplates(Array.isArray(tplRes?.data) ? tplRes.data : []);
      } catch {
        // Non-blocking
      }
    };
    loadRefs();
    return () => {
      active = false;
    };
  }, []);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await apiClient.legalDrafts.findAll({
        search: search || undefined,
        expedienteId: expedienteFilter || undefined,
        documentType: typeFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit,
      })) as PaginatedResponse<LegalDraftItem>;

      setDrafts(Array.isArray(res?.data) ? res.data : []);
      setTotal(typeof res?.total === 'number' ? res.total : 0);
      setTotalPages(
        typeof res?.totalPages === 'number' && res.totalPages > 0
          ? res.totalPages
          : 1,
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar los escritos',
      );
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, [search, expedienteFilter, typeFilter, statusFilter, page]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    if (!expedienteId || !title.trim()) {
      setCreateError('El expediente y el título son obligatorios.');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const created = (await apiClient.legalDrafts.create({
        expedienteId,
        title: title.trim(),
        documentType,
        ...(clientId ? { clientId } : {}),
        ...(sourceTemplateId ? { sourceTemplateId } : {}),
      })) as LegalDraftItem;
      navigate(`/escritos/${created.id}`);
    } catch (err: unknown) {
      setCreateError(
        err instanceof Error ? err.message : 'Error al crear el escrito',
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '1.75rem',
              fontFamily: 'var(--font-heading)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            <PenTool size={26} color="hsl(var(--hsl-primary))" />
            Escritos Jurídicos
          </h1>
          <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>
            Redacción, versionado inmutable, revisión profesional y exportación DOCX/PDF ({total})
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/plantillas" className="btn btn-outline">
            <FileText size={16} /> Plantillas
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setShowCreate((v) => !v);
              setCreateError(null);
            }}
          >
            <Plus size={16} />
            {showCreate ? 'Cerrar Formulario' : 'Nuevo Escrito'}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="card"
          style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Crear Nuevo Escrito Jurídico</h2>

          {createError && (
            <div
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: 'hsl(var(--hsl-danger))',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={16} />
              <span>{createError}</span>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.85rem',
            }}
          >
            <div className="form-group">
              <label className="label">Expediente *</label>
              <select
                required
                className="input-field"
                value={expedienteId}
                onChange={(e) => setExpedienteId(e.target.value)}
              >
                <option value="">Seleccionar expediente...</option>
                {expedientes.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.numeroExpediente} — {exp.caratula}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Título *</label>
              <input
                required
                className="input-field"
                placeholder="Ej: Promueve demanda de daños y perjuicios"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="label">Tipo de Escrito</label>
              <select
                className="input-field"
                value={documentType}
                onChange={(e) =>
                  setDocumentType(e.target.value as LegalDraftDocumentType)
                }
              >
                {(
                  Object.keys(
                    DRAFT_DOCUMENT_TYPE_LABELS,
                  ) as LegalDraftDocumentType[]
                ).map((t) => (
                  <option key={t} value={t}>
                    {DRAFT_DOCUMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Plantilla Base (Opcional)</label>
              <select
                className="input-field"
                value={sourceTemplateId}
                onChange={(e) => setSourceTemplateId(e.target.value)}
              >
                <option value="">Estructura jurídica base editable</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.isSystemTemplate ? '[Sistema] ' : ''}
                    {tpl.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Cliente (Opcional)</label>
              <select
                className="input-field"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Sin vincular</option>
                {clients.map((cli) => (
                  <option key={cli.id} value={cli.id}>
                    {[cli.firstName, cli.lastName].filter(Boolean).join(' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowCreate(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creating || !expedienteId || !title.trim()}
            >
              {creating ? 'Creando...' : 'Crear y Abrir Editor'}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <form
          onSubmit={handleSearch}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            alignItems: 'end',
          }}
        >
          <div className="form-group" style={{ margin: 0 }}>
            <label className="label">Buscar</label>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <input
                className="input-field"
                placeholder="Título, tribunal o n° expte..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button type="submit" className="btn btn-outline" title="Buscar">
                <Search size={16} />
              </button>
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="label">Expediente</label>
            <select
              className="input-field"
              value={expedienteFilter}
              onChange={(e) => {
                setExpedienteFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {expedientes.map((exp) => (
                <option key={exp.id} value={exp.id}>
                  {exp.numeroExpediente} — {exp.caratula}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="label">Tipo</label>
            <select
              className="input-field"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {(
                Object.keys(
                  DRAFT_DOCUMENT_TYPE_LABELS,
                ) as LegalDraftDocumentType[]
              ).map((t) => (
                <option key={t} value={t}>
                  {DRAFT_DOCUMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="label">Estado</label>
            <select
              className="input-field"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Activos (no archivados)</option>
              {(Object.keys(DRAFT_STATUS_LABELS) as LegalDraftStatus[]).map(
                (st) => (
                  <option key={st} value={st}>
                    {DRAFT_STATUS_LABELS[st]}
                  </option>
                ),
              )}
            </select>
          </div>
        </form>
      </div>

      {error && (
        <div
          style={{
            padding: '0.85rem 1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            color: 'hsl(var(--hsl-danger))',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }} className="text-muted">
            Cargando escritos...
          </div>
        ) : drafts.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center' }} className="text-muted">
            No se encontraron escritos jurídicos con los filtros seleccionados.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid hsl(var(--hsl-border))',
                  textAlign: 'left',
                  background: 'hsl(var(--hsl-surface-muted))',
                }}
              >
                <th style={{ padding: '0.85rem 1rem' }}>Título</th>
                <th style={{ padding: '0.85rem 1rem' }}>Expediente</th>
                <th style={{ padding: '0.85rem 1rem' }}>Tipo</th>
                <th style={{ padding: '0.85rem 1rem' }}>Autor</th>
                <th style={{ padding: '0.85rem 1rem' }}>Estado / Ver.</th>
                <th style={{ padding: '0.85rem 1rem' }}>Modificación</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Editor</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((dr) => (
                <tr
                  key={dr.id}
                  style={{ borderBottom: '1px solid hsl(var(--hsl-border))' }}
                >
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <Link
                      to={`/escritos/${dr.id}`}
                      style={{
                        fontWeight: 600,
                        color: 'hsl(var(--hsl-text-main))',
                        textDecoration: 'none',
                      }}
                    >
                      {dr.title}
                    </Link>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.83rem' }}>
                    {dr.expediente ? (
                      <Link
                        to={`/expedientes/${dr.expediente.id}`}
                        style={{ color: 'hsl(var(--hsl-primary))', textDecoration: 'none' }}
                      >
                        {dr.expediente.numeroExpediente} — {dr.expediente.caratula}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span className="badge badge-blue">
                      {DRAFT_DOCUMENT_TYPE_LABELS[dr.documentType] || dr.documentType}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.83rem' }}>
                    {dr.createdBy?.fullName || dr.createdBy?.email || '—'}
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <span className={`badge ${DRAFT_STATUS_BADGE_CLASS[dr.status]}`}>
                        {DRAFT_STATUS_LABELS[dr.status]}
                      </span>
                      <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                        v{dr.currentVersionNumber}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem' }}>
                    {new Date(dr.updatedAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    <Link
                      to={`/escritos/${dr.id}`}
                      className="btn btn-outline"
                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}
                    >
                      <ExternalLink size={14} /> Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.85rem 1rem',
              borderTop: '1px solid hsl(var(--hsl-border))',
            }}
          >
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>
              Página {page} de {totalPages} ({total} resultados)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

