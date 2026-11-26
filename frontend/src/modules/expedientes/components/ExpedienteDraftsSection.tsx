import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PenTool, Plus, ExternalLink, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import type {
  LegalDraftDocumentType,
  LegalDraftItem,
  LegalTemplateItem,
  PaginatedResponse,
} from '../../legal-drafts/types';
import {
  DRAFT_DOCUMENT_TYPE_LABELS,
  DRAFT_STATUS_BADGE_CLASS,
  DRAFT_STATUS_LABELS,
} from '../../legal-drafts/types';

interface Props {
  expedienteId: string;
}

export const ExpedienteDraftsSection: React.FC<Props> = ({ expedienteId }) => {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<LegalDraftItem[]>([]);
  const [templates, setTemplates] = useState<LegalTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] =
    useState<LegalDraftDocumentType>('DEMANDA');
  const [sourceTemplateId, setSourceTemplateId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [drRes, tplRes] = await Promise.all([
        apiClient.legalDrafts.findAll({ expedienteId, page: 1, limit: 50 }),
        apiClient.legalTemplates.findAll({ page: 1, limit: 50 }).catch(() => ({ data: [] })),
      ]);
      const pagedDrafts = drRes as PaginatedResponse<LegalDraftItem>;
      const pagedTpls = tplRes as PaginatedResponse<LegalTemplateItem>;
      setDrafts(Array.isArray(pagedDrafts?.data) ? pagedDrafts.data : []);
      setTemplates(Array.isArray(pagedTpls?.data) ? pagedTpls.data : []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'No autorizado o error al cargar escritos del expediente',
      );
    } finally {
      setLoading(false);
    }
  }, [expedienteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating || !title.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = (await apiClient.legalDrafts.create({
        expedienteId,
        title: title.trim(),
        documentType,
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
    <section className="card" style={{ padding: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <PenTool size={18} color="hsl(var(--hsl-primary))" />
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
            Escritos Jurídicos ({drafts.length})
          </h2>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
          onClick={() => {
            setShowCreate((v) => !v);
            setCreateError(null);
          }}
        >
          <Plus size={14} /> {showCreate ? 'Cerrar' : 'Nuevo Escrito'}
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          style={{
            padding: '1rem',
            background: 'hsl(var(--hsl-surface-muted))',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
          }}
        >
          {createError && (
            <div
              style={{
                padding: '0.6rem 0.75rem',
                marginBottom: '0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: 'hsl(var(--hsl-danger))',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem',
            }}
          >
            <div className="form-group">
              <label className="label">Título del Escrito *</label>
              <input
                required
                className="input-field"
                placeholder="Ej: Contestación de traslado"
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
              <label className="label">Crear desde Plantilla (Opcional)</label>
              <select
                className="input-field"
                value={sourceTemplateId}
                onChange={(e) => setSourceTemplateId(e.target.value)}
              >
                <option value="">Estructura base editable</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.isSystemTemplate ? '[Sistema] ' : ''}
                    {tpl.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              marginTop: '0.75rem',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem',
            }}
          >
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
              disabled={creating || !title.trim()}
            >
              {creating ? 'Creando...' : 'Crear y Abrir Editor'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div
          style={{
            padding: '0.75rem',
            marginBottom: '0.75rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'hsl(var(--hsl-danger))',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted" style={{ fontSize: '0.9rem' }}>
          Cargando escritos...
        </p>
      ) : drafts.length === 0 ? (
        <p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>
          No hay escritos redactados en este expediente.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {drafts.map((dr) => (
            <div
              key={dr.id}
              style={{
                padding: '0.85rem 1rem',
                border: '1px solid hsl(var(--hsl-border))',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                  }}
                >
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
                  <span className="badge badge-blue">
                    {DRAFT_DOCUMENT_TYPE_LABELS[dr.documentType] || dr.documentType}
                  </span>
                  <span className={`badge ${DRAFT_STATUS_BADGE_CLASS[dr.status]}`}>
                    {DRAFT_STATUS_LABELS[dr.status]}
                  </span>
                  <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                    v{dr.currentVersionNumber}
                  </span>
                </div>
                <div
                  className="text-muted"
                  style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}
                >
                  Autor: {dr.createdBy?.fullName || dr.createdBy?.email || '—'} ·
                  Actualizado {new Date(dr.updatedAt).toLocaleDateString()}
                </div>
              </div>

              <Link
                to={`/escritos/${dr.id}`}
                className="btn btn-outline"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', flexShrink: 0 }}
              >
                <ExternalLink size={14} /> Abrir
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

