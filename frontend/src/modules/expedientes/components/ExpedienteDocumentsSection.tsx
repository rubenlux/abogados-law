import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderOpen,
  Upload,
  Download,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import type {
  DocumentCategory,
  DocumentItem,
} from '../../documents/types';
import {
  ALLOWED_EXTENSIONS,
  DOCUMENT_CATEGORY_LABELS,
  formatFileSize,
  validateClientSideFile,
} from '../../documents/types';

interface Props {
  expedienteId: string;
}

export const ExpedienteDocumentsSection: React.FC<Props> = ({
  expedienteId,
}) => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('ESCRITO_JUDICIAL');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.documents.findAll({
        expedienteId,
        status: 'ACTIVE',
        page: 1,
        limit: 50,
      });
      setDocuments(Array.isArray(res?.data) ? res.data : []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al cargar los documentos del expediente',
      );
    } finally {
      setLoading(false);
    }
  }, [expedienteId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setUploadError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    const validationErr = validateClientSideFile(selected);
    if (validationErr) {
      setUploadError(validationErr);
      setFile(null);
      return;
    }
    setFile(selected);
    if (!title.trim()) {
      setTitle(selected.name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading || !file) return;
    if (!title.trim()) {
      setUploadError('El título es obligatorio.');
      return;
    }

    setUploading(true);
    setProgress(0);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title.trim());
      fd.append('category', category);
      fd.append('expedienteId', expedienteId);
      if (description.trim()) fd.append('description', description.trim());

      await apiClient.documents.create(fd, setProgress);
      setShowUpload(false);
      setFile(null);
      setTitle('');
      setDescription('');
      setProgress(0);
      loadDocuments();
    } catch (err: unknown) {
      setUploadError(
        err instanceof Error ? err.message : 'Error al subir el documento',
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    try {
      const currentVer = doc.versions?.[0];
      await apiClient.documents.download(
        doc.id,
        undefined,
        currentVer?.originalFilename || `${doc.title}.pdf`,
      );
    } catch (err: unknown) {
      alert(
        err instanceof Error
          ? err.message
          : 'No autorizado o error al descargar el archivo',
      );
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
          <FolderOpen size={18} color="hsl(var(--hsl-primary))" />
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
            Documentos del Expediente ({documents.length})
          </h2>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
          onClick={() => {
            setShowUpload((v) => !v);
            setUploadError(null);
          }}
        >
          <Upload size={14} /> {showUpload ? 'Cerrar' : 'Subir Documento'}
        </button>
      </div>

      {showUpload && (
        <form
          onSubmit={handleUpload}
          style={{
            padding: '1rem',
            background: 'hsl(var(--hsl-surface-muted))',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
          }}
        >
          {uploadError && (
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
              <span>{uploadError}</span>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
            }}
          >
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="label">
                Archivo * (PDF, DOCX, DOC, XLSX, XLS, PNG, JPG — máx. 25 MB)
              </label>
              <input
                type="file"
                accept={ALLOWED_EXTENSIONS.join(',')}
                className="input-field"
                onChange={handleFileChange}
              />
            </div>

            <div className="form-group">
              <label className="label">Título *</label>
              <input
                required
                className="input-field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="label">Categoría</label>
              <select
                className="input-field"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as DocumentCategory)
                }
              >
                {(
                  Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]
                ).map((cat) => (
                  <option key={cat} value={cat}>
                    {DOCUMENT_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="label">Descripción (Opcional)</label>
              <input
                className="input-field"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {uploading && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                Subiendo archivo... {progress}%
              </div>
              <div
                style={{
                  height: '6px',
                  background: 'hsl(var(--hsl-border))',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: 'hsl(var(--hsl-primary))',
                    transition: 'width 0.15s',
                  }}
                />
              </div>
            </div>
          )}

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
              onClick={() => setShowUpload(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading || !file}
            >
              {uploading ? 'Subiendo...' : 'Guardar Documento'}
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
          Cargando documentos...
        </p>
      ) : documents.length === 0 ? (
        <p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>
          No hay documentos cargados en este expediente.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {documents.map((doc) => {
            const latestVer = doc.versions?.[0];
            const canDownload = doc.versions !== undefined;
            return (
              <div
                key={doc.id}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Link
                      to={`/documentos/${doc.id}`}
                      style={{
                        fontWeight: 600,
                        color: 'hsl(var(--hsl-text-main))',
                        textDecoration: 'none',
                      }}
                    >
                      {doc.title}
                    </Link>
                    <span className="badge badge-blue">
                      {DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
                    </span>
                    <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                      v{doc.currentVersionNumber}
                    </span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                    {latestVer
                      ? `${latestVer.originalFilename} (${formatFileSize(latestVer.sizeBytes)})`
                      : `Actualizado ${new Date(doc.updatedAt).toLocaleDateString()}`}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                  {canDownload && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      title="Descargar versión vigente"
                      style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem' }}
                      onClick={() => handleDownload(doc)}
                    >
                      <Download size={14} />
                    </button>
                  )}
                  <Link
                    to={`/documentos/${doc.id}`}
                    className="btn btn-ghost"
                    title="Ver historial y detalle"
                    style={{ padding: '0.3rem 0.55rem' }}
                  >
                    <ExternalLink size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

