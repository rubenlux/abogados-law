import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderOpen,
  Upload,
  Download,
  Search,
  ExternalLink,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import type {
  DocumentCategory,
  DocumentItem,
  DocumentStatus,
  PaginatedDocumentsResponse,
} from '../types';
import {
  ALLOWED_EXTENSIONS,
  DOCUMENT_CATEGORY_LABELS,
  formatFileSize,
  validateClientSideFile,
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

export const DocumentsListPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [expedienteFilter, setExpedienteFilter] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus>('ACTIVE');

  // Filter / upload dropdown options
  const [expedientes, setExpedientes] = useState<SimpleExpediente[]>([]);
  const [clients, setClients] = useState<SimpleClient[]>([]);

  // Collapsible upload form
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('ESCRITO_JUDICIAL');
  const [description, setDescription] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [expedienteId, setExpedienteId] = useState('');
  const [clientId, setClientId] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadOptions = async () => {
      try {
        const [expRes, cliRes] = await Promise.all([
          apiClient.expedientes.findAll({ page: 1, limit: 100 }).catch(() => ({ data: [] })),
          apiClient.clients.findAll({ page: 1, limit: 100 }).catch(() => ({ data: [] })),
        ]);
        if (!active) return;
        setExpedientes(Array.isArray(expRes?.data) ? expRes.data : []);
        setClients(Array.isArray(cliRes?.data) ? cliRes.data : []);
      } catch {
        // Non-blocking: filters remain usable even if secondary lookup fails
      }
    };
    loadOptions();
    return () => {
      active = false;
    };
  }, []);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await apiClient.documents.findAll({
        search: search || undefined,
        category: categoryFilter || undefined,
        expedienteId: expedienteFilter || undefined,
        clientId: clientFilter || undefined,
        status: statusFilter,
        page,
        limit,
      })) as PaginatedDocumentsResponse;

      setDocuments(Array.isArray(res?.data) ? res.data : []);
      setTotal(typeof res?.total === 'number' ? res.total : 0);
      setTotalPages(typeof res?.totalPages === 'number' && res.totalPages > 0 ? res.totalPages : 1);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar los documentos',
      );
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, expedienteFilter, clientFilter, statusFilter, page]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

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
      if (description.trim()) fd.append('description', description.trim());
      if (documentDate) fd.append('documentDate', new Date(documentDate).toISOString());
      if (expedienteId) fd.append('expedienteId', expedienteId);
      if (clientId) fd.append('clientId', clientId);
      if (changeNote.trim()) fd.append('changeNote', changeNote.trim());

      await apiClient.documents.create(fd, setProgress);

      setShowUpload(false);
      setFile(null);
      setTitle('');
      setDescription('');
      setDocumentDate('');
      setExpedienteId('');
      setClientId('');
      setChangeNote('');
      setProgress(0);
      setPage(1);
      await loadDocuments();
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
      const latest = doc.versions?.[0];
      await apiClient.documents.download(
        doc.id,
        undefined,
        latest?.originalFilename || `${doc.title}.pdf`,
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'No autorizado o error al descargar el documento',
      );
    }
  };

  const formatClientName = (c: { firstName: string; lastName?: string | null }) =>
    [c.firstName, c.lastName].filter(Boolean).join(' ');

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
            <FolderOpen size={26} color="hsl(var(--hsl-primary))" />
            Gestión Documental
          </h1>
          <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>
            Repositorio privado, versionado y auditado del estudio ({total} documento
            {total === 1 ? '' : 's'})
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setShowUpload((v) => !v);
            setUploadError(null);
          }}
        >
          <Upload size={16} />
          {showUpload ? 'Cerrar Formulario' : 'Subir Documento'}
        </button>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <form
          onSubmit={handleUpload}
          className="card"
          style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Nuevo Documento Jurídico</h2>

          {uploadError && (
            <div
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: 'hsl(var(--hsl-danger))',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.875rem',
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '0.9rem',
            }}
          >
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="label">
                Archivo * (PDF, DOCX, DOC, XLSX, XLS, PNG, JPG — máx. 25 MB)
              </label>
              <input
                type="file"
                accept={ALLOWED_EXTENSIONS.join(',')}
                className="input-field"
                onChange={handleFileChange}
                disabled={uploading}
              />
              {file && (
                <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Seleccionado: {file.name} ({formatFileSize(file.size)})
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="label">Título *</label>
              <input
                required
                className="input-field"
                placeholder="Ej: Demanda de daños y perjuicios"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
              />
            </div>

            <div className="form-group">
              <label className="label">Categoría *</label>
              <select
                className="input-field"
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                disabled={uploading}
              >
                {(Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {DOCUMENT_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Fecha Documental (Opcional)</label>
              <input
                type="date"
                className="input-field"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                disabled={uploading}
              />
            </div>

            <div className="form-group">
              <label className="label">Expediente (Opcional)</label>
              <select
                className="input-field"
                value={expedienteId}
                onChange={(e) => setExpedienteId(e.target.value)}
                disabled={uploading}
              >
                <option value="">Sin vincular</option>
                {expedientes.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.numeroExpediente} — {exp.caratula}
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
                disabled={uploading}
              >
                <option value="">Sin vincular</option>
                {clients.map((cli) => (
                  <option key={cli.id} value={cli.id}>
                    {formatClientName(cli)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Nota Inicial de Versión (Opcional)</label>
              <input
                className="input-field"
                placeholder="Ej: Versión presentada en mesa de entradas"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                disabled={uploading}
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="label">Descripción (Opcional)</label>
              <textarea
                rows={2}
                className="input-field"
                placeholder="Resumen o notas internas del documento..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={uploading}
              />
            </div>
          </div>

          {uploading && (
            <div>
              <div style={{ fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                Subiendo archivo de forma segura... {progress}%
              </div>
              <div
                style={{
                  height: '8px',
                  background: 'hsl(var(--hsl-border))',
                  borderRadius: '4px',
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={uploading}
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

      {/* Search & Filters */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <form
          onSubmit={handleSearchSubmit}
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
                placeholder="Título o descripción..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button type="submit" className="btn btn-outline" title="Buscar">
                <Search size={16} />
              </button>
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="label">Categoría</label>
            <select
              className="input-field"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas</option>
              {(Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {DOCUMENT_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
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
            <label className="label">Cliente</label>
            <select
              className="input-field"
              value={clientFilter}
              onChange={(e) => {
                setClientFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {clients.map((cli) => (
                <option key={cli.id} value={cli.id}>
                  {formatClientName(cli)}
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
                setStatusFilter(e.target.value as DocumentStatus);
                setPage(1);
              }}
            >
              <option value="ACTIVE">Activos</option>
              <option value="ARCHIVED">Archivados</option>
            </select>
          </div>
        </form>
      </div>

      {/* Global Error */}
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

      {/* Documents List */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }} className="text-muted">
            Cargando documentos...
          </div>
        ) : documents.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center' }} className="text-muted">
            <FileText size={32} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
            <p style={{ margin: 0 }}>
              No se encontraron documentos con los filtros seleccionados.
            </p>
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
                <th style={{ padding: '0.85rem 1rem' }}>Documento</th>
                <th style={{ padding: '0.85rem 1rem' }}>Categoría</th>
                <th style={{ padding: '0.85rem 1rem' }}>Vínculos</th>
                <th style={{ padding: '0.85rem 1rem' }}>Versión</th>
                <th style={{ padding: '0.85rem 1rem' }}>Autor / Fecha</th>
                <th style={{ padding: '0.85rem 1rem' }}>Estado</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const latestVer = doc.versions?.[0];
                const canDownload = doc.versions !== undefined;
                return (
                  <tr
                    key={doc.id}
                    style={{ borderBottom: '1px solid hsl(var(--hsl-border))' }}
                  >
                    <td style={{ padding: '0.85rem 1rem' }}>
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
                      {latestVer && (
                        <div className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.15rem' }}>
                          {latestVer.originalFilename} ({formatFileSize(latestVer.sizeBytes)})
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className="badge badge-blue">
                        {DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
                      </span>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem' }}>
                      {doc.expediente && (
                        <div>
                          <Link
                            to={`/expedientes/${doc.expediente.id}`}
                            style={{ color: 'hsl(var(--hsl-primary))', textDecoration: 'none' }}
                          >
                            Exp. {doc.expediente.numeroExpediente}
                          </Link>
                        </div>
                      )}
                      {doc.client && (
                        <div>
                          <Link
                            to={`/clientes/${doc.client.id}`}
                            style={{ color: 'hsl(var(--hsl-text-muted))', textDecoration: 'none' }}
                          >
                            {formatClientName(doc.client)}
                          </Link>
                        </div>
                      )}
                      {!doc.expediente && !doc.client && (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className="badge">v{doc.currentVersionNumber}</span>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem' }}>
                      <div>{doc.createdBy?.fullName || doc.createdBy?.email || '—'}</div>
                      <div className="text-muted">
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span
                        className={`badge ${doc.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}`}
                      >
                        {doc.status === 'ACTIVE' ? 'Activo' : 'Archivado'}
                      </span>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        {canDownload && (
                          <button
                            type="button"
                            className="btn btn-outline"
                            title="Descargar versión vigente"
                            style={{ padding: '0.35rem 0.55rem' }}
                            onClick={() => handleDownload(doc)}
                          >
                            <Download size={14} />
                          </button>
                        )}
                        <Link
                          to={`/documentos/${doc.id}`}
                          className="btn btn-ghost"
                          title="Ver detalle e historial"
                          style={{ padding: '0.35rem 0.55rem' }}
                        >
                          <ExternalLink size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
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

