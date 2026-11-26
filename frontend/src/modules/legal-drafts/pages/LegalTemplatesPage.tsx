import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Plus,
  Copy,
  Edit3,
  Archive,
  Eye,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import { LegalRichEditor } from '../components/LegalRichEditor';
import type {
  LegalDocContent,
  LegalDraftCategory,
  LegalDraftDocumentType,
  LegalTemplateItem,
  PaginatedResponse,
} from '../types';
import {
  DEFAULT_EMPTY_TIPTAP_DOC,
  DRAFT_CATEGORY_LABELS,
  DRAFT_DOCUMENT_TYPE_LABELS,
} from '../types';

export const LegalTemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<LegalTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  // Create / Edit modal state
  const [editingTemplate, setEditingTemplate] =
    useState<LegalTemplateItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<LegalDraftCategory>('ESCRITO_JUDICIAL');
  const [documentType, setDocumentType] =
    useState<LegalDraftDocumentType>('DEMANDA');
  const [jurisdiction, setJurisdiction] = useState('');
  const [fuero, setFuero] = useState('');
  const [baseInstructions, setBaseInstructions] = useState('');
  const [variablesText, setVariablesText] = useState('caratula, numero_expediente, tribunal, actor, demandado');
  const [content, setContent] = useState<LegalDocContent>(
    DEFAULT_EMPTY_TIPTAP_DOC,
  );
  const [editorKey, setEditorKey] = useState('new-0');
  const [saving, setSaving] = useState(false);

  // Preview state
  const [previewTemplate, setPreviewTemplate] =
    useState<LegalTemplateItem | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await apiClient.legalTemplates.findAll({
        documentType: typeFilter || undefined,
        search: search.trim() || undefined,
        page: 1,
        limit: 100,
      })) as PaginatedResponse<LegalTemplateItem>;
      setTemplates(Array.isArray(res?.data) ? res.data : []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar plantillas',
      );
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const openNewForm = () => {
    setEditingTemplate(null);
    setName('');
    setDescription('');
    setCategory('ESCRITO_JUDICIAL');
    setDocumentType('DEMANDA');
    setJurisdiction('');
    setFuero('');
    setBaseInstructions('');
    setVariablesText('caratula, numero_expediente, tribunal, actor, demandado');
    setContent(DEFAULT_EMPTY_TIPTAP_DOC);
    setEditorKey(`new-${Date.now()}`);
    setShowForm(true);
    setPreviewTemplate(null);
    setError(null);
    setFeedback(null);
  };

  const openEditForm = (tpl: LegalTemplateItem) => {
    setEditingTemplate(tpl);
    setName(tpl.name);
    setDescription(tpl.description || '');
    setCategory(tpl.category || 'ESCRITO_JUDICIAL');
    setDocumentType(tpl.documentType);
    setJurisdiction(tpl.jurisdiction || '');
    setFuero(tpl.fuero || '');
    setBaseInstructions(tpl.baseInstructions || '');
    setVariablesText(Array.isArray(tpl.variables) ? tpl.variables.join(', ') : '');
    setContent(tpl.content);
    setEditorKey(`edit-${tpl.id}-${Date.now()}`);
    setShowForm(true);
    setPreviewTemplate(null);
    setError(null);
    setFeedback(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !name.trim()) return;
    setSaving(true);
    setError(null);
    setFeedback(null);

    const parsedVars = variablesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (editingTemplate) {
        await apiClient.legalTemplates.update(editingTemplate.id, {
          name: name.trim(),
          description: description.trim() || null,
          category,
          documentType,
          jurisdiction: jurisdiction.trim() || null,
          fuero: fuero.trim() || null,
          baseInstructions: baseInstructions.trim() || null,
          variables: parsedVars,
          content,
        });
        setFeedback('Plantilla actualizada (nueva versión registrada).');
      } else {
        await apiClient.legalTemplates.create({
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          documentType,
          jurisdiction: jurisdiction.trim() || undefined,
          fuero: fuero.trim() || undefined,
          baseInstructions: baseInstructions.trim() || undefined,
          variables: parsedVars,
          content,
        });
        setFeedback('Plantilla creada correctamente.');
      }
      setShowForm(false);
      setEditingTemplate(null);
      await loadTemplates();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error al guardar la plantilla',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (tpl: LegalTemplateItem) => {
    setError(null);
    setFeedback(null);
    try {
      await apiClient.legalTemplates.duplicate(tpl.id);
      setFeedback(`Plantilla "${tpl.name}" duplicada para su estudio.`);
      await loadTemplates();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'No se pudo duplicar la plantilla',
      );
    }
  };

  const handleArchive = async (tpl: LegalTemplateItem) => {
    if (!window.confirm(`¿Desea archivar la plantilla "${tpl.name}"?`)) return;
    setError(null);
    setFeedback(null);
    try {
      await apiClient.legalTemplates.archive(tpl.id);
      setFeedback('Plantilla archivada.');
      await loadTemplates();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'No se pudo archivar la plantilla',
      );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
            <FileText size={26} color="hsl(var(--hsl-primary))" />
            Plantillas Jurídicas
          </h1>
          <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>
            Modelos editables orientativos del sistema y plantillas privadas de su organización.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/escritos" className="btn btn-ghost">
            <ArrowLeft size={16} /> Volver a Escritos
          </Link>
          <button type="button" className="btn btn-primary" onClick={openNewForm}>
            <Plus size={16} /> Nueva Plantilla
          </button>
        </div>
      </div>

      {feedback && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(34, 197, 94, 0.12)',
            color: 'hsl(var(--hsl-success, 142 71% 45%))',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
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
          <span>{error}</span>
        </div>
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSave}
          className="card"
          style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>
            {editingTemplate ? `Editar Plantilla: ${editingTemplate.name}` : 'Nueva Plantilla del Estudio'}
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.85rem',
            }}
          >
            <div className="form-group">
              <label className="label">Nombre *</label>
              <input
                required
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="label">Categoría</label>
              <select
                className="input-field"
                value={category}
                onChange={(e) => setCategory(e.target.value as LegalDraftCategory)}
              >
                {(Object.keys(DRAFT_CATEGORY_LABELS) as LegalDraftCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {DRAFT_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Tipo de Escrito / Contrato</label>
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
              <label className="label">Jurisdicción (Opcional)</label>
              <input
                className="input-field"
                placeholder="Ej: CABA / Nación / PBA"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="label">Fuero (Opcional)</label>
              <input
                className="input-field"
                placeholder="Ej: Civil, Comercial, Laboral"
                value={fuero}
                onChange={(e) => setFuero(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="label">Variables (separadas por coma, ej: caratula, numero_expediente, tribunal)</label>
              <input
                className="input-field"
                value={variablesText}
                onChange={(e) => setVariablesText(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="label">Instrucciones base para IA (configuración de contenido)</label>
              <textarea
                rows={2}
                className="input-field"
                placeholder="Guía de estructura y estilo para el generador asistido..."
                value={baseInstructions}
                onChange={(e) => setBaseInstructions(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="label">Descripción</label>
              <input
                className="input-field"
                placeholder="Modelo orientativo editable para..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label" style={{ marginBottom: '0.4rem', display: 'block' }}>
              Contenido Estructurado de la Plantilla
            </label>
            <LegalRichEditor
              initialContent={content}
              editorKey={editorKey}
              onChange={setContent}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !name.trim()}
            >
              {saving ? 'Guardando...' : 'Guardar Plantilla'}
            </button>
          </div>
        </form>
      )}

      {/* Preview Drawer */}
      {previewTemplate && (
        <section className="card" style={{ padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
                Vista Previa: {previewTemplate.name}
              </h2>
              {previewTemplate.isSystemTemplate && (
                <p className="text-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.82rem' }}>
                  Modelo orientativo editable del sistema. Debe completarse y verificarse por un profesional antes de su uso.
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPreviewTemplate(null)}
            >
              Cerrar Vista Previa
            </button>
          </div>
          <LegalRichEditor
            initialContent={previewTemplate.content}
            editorKey={`preview-${previewTemplate.id}`}
            readOnly
          />
        </section>
      )}

      {/* Filters */}
      <div
        className="card"
        style={{
          padding: '1rem 1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div className="form-group" style={{ margin: 0 }}>
          <label className="label">Buscar plantilla</label>
          <input
            className="input-field"
            placeholder="Nombre o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="label">Tipo de Escrito</label>
          <select
            className="input-field"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
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
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <span className="text-muted">Cargando plantillas...</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <span className="text-muted">No hay plantillas disponibles para estos filtros.</span>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1rem',
          }}
        >
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="card"
              style={{
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                }}
              >
                <span className="badge badge-blue">
                  {DRAFT_DOCUMENT_TYPE_LABELS[tpl.documentType] || tpl.documentType}
                </span>
                <span
                  className={`badge ${tpl.isSystemTemplate ? 'badge-yellow' : 'badge-green'}`}
                >
                  {tpl.isSystemTemplate ? 'Sistema (Orientativa)' : 'Estudio'} · v{tpl.versionNumber || 1}
                </span>
              </div>

              <div>
                <h3 style={{ margin: '0 0 0.3rem', fontSize: '1.02rem' }}>
                  {tpl.name}
                </h3>
                <p className="text-muted" style={{ margin: 0, fontSize: '0.84rem' }}>
                  {tpl.description || 'Modelo editable reutilizable.'}
                </p>
              </div>

              <div
                style={{
                  marginTop: 'auto',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid hsl(var(--hsl-border))',
                  display: 'flex',
                  gap: '0.4rem',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.55rem' }}
                  onClick={() => setPreviewTemplate(tpl)}
                >
                  <Eye size={14} /> Vista previa
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.55rem' }}
                  onClick={() => handleDuplicate(tpl)}
                >
                  <Copy size={14} /> Duplicar
                </button>
                {!tpl.isSystemTemplate && (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ fontSize: '0.78rem', padding: '0.3rem 0.55rem' }}
                      onClick={() => openEditForm(tpl)}
                    >
                      <Edit3 size={14} /> Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{
                        fontSize: '0.78rem',
                        padding: '0.3rem 0.55rem',
                        color: 'hsl(var(--hsl-danger))',
                      }}
                      onClick={() => handleArchive(tpl)}
                    >
                      <Archive size={14} /> Archivar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

