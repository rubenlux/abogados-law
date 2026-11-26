import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Upload,
  Edit3,
  Archive,
  RotateCcw,
  ShieldCheck,
  History,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import type {
  DocumentCategory,
  DocumentFileVersion,
  DocumentItem,
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

export const DocumentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Edit metadata state
  const [editing, setEditing] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaCategory, setMetaCategory] = useState<DocumentCategory>('OTRO');
  const [metaDescription, setMetaDescription] = useState('');
  const [metaDocumentDate, setMetaDocumentDate] = useState('');
  const [metaExpedienteId, setMetaExpedienteId] = useState('');
  const [metaClientId, setMetaClientId] = useState('');

  const [expedientes, setExpedientes] = useState<SimpleExpediente[]>([]);
  const [clients, setClients] = useState<SimpleClient[]>([]);

  // Upload new version state
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [versionError, setVersionError] = useState<string | null>(null);

  // Archive / restore state
  const [mutatingStatus, setMutatingStatus] = useState(false);

  // Technical SHA-256 visibility per version
  const [visibleHashes, setVisibleHashes] = useState<Record<string, boolean>>({});

  const loadDocument = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await apiClient.documents.findById(id)) as DocumentItem;
      setDoc(data);
      setMetaTitle(data.title);
      setMetaCategory(data.category);
      setMetaDescription(data.description || '');
      setMetaDocumentDate(
        data.documentDate ? new Date(data.documentDate).toISOString().slice(0, 10) : '',
      );
      setMetaExpedienteId(data.expedienteId || '');
      setMetaClientId(data.clientId || '');
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cargar el documento',
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  useEffect(() => {
    if (!editing) return;
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
        // Ignore non-critical option failures
      }
    };
    loadOptions();
    return () => {
      active = false;
    };
  }, [editing]);

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || savingMeta) return;
    if (!metaTitle.trim()) {
      setError('El título es obligatorio.');
      return;
    }

    setSavingMeta(true);
    setError(null);
    setFeedback(null);
    try {
      await apiClient.documents.updateMetadata(id, {
        title: metaTitle.trim(),
        category: metaCategory,
        description: metaDescription.trim() || null,
        documentDate: metaDocumentDate ? new Date(metaDocumentDate).toISOString() : null,
        expedienteId: metaExpedienteId || null,
        clientId: metaClientId || null,
      });
      setEditing(false);
      setFeedback('Metadatos actualizados correctamente.');
      await loadDocument();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error al actualizar los metadatos',
      );
    } finally {
      setSavingMeta(false);
    }
  };

  const handleVersionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setVersionError(null);
    if (!selected) {
      setVersionFile(null);
      return;
    }
    const validationErr = validateClientSideFile(selected);
    if (validationErr) {
      setVersionError(validationErr);
      setVersionFile(null);
      return;
    }
    setVersionFile(selected);
  };

  const handleUploadVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || uploadingVersion || !versionFile) return;

    setUploadingVersion(true);
    setUploadProgress(0);
    setVersionError(null);
    setFeedback(null);

    try {
      const fd = new FormData();
      fd.append('file', versionFile);
      if (changeNote.trim()) fd.append('changeNote', changeNote.trim());

      await apiClient.documents.uploadVersion(id, fd, setUploadProgress);
      setVersionFile(null);
      setChangeNote('');
      setUploadProgress(0);
      setFeedback('Nueva versión cargada e incorporada al historial.');
      await loadDocument();
    } catch (err: unknown) {
      setVersionError(
        err instanceof Error ? err.message : 'Error al cargar la nueva versión',
      );
    } finally {
      setUploadingVersion(false);
    }
  };

  const handleDownload = async (ver?: DocumentFileVersion) => {
    if (!doc) return;
    setError(null);
    try {
      await apiClient.documents.download(
        doc.id,
        ver?.id,
        ver?.originalFilename || `${doc.title}.pdf`,
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'No autorizado o error al descargar el archivo',
      );
    }
  };

  const handleArchive = async () => {
    if (!doc || mutatingStatus) return;
    const confirmed = window.confirm(
      '¿Desea archivar lógicamente este documento? El historial y archivo físico permanecerán preservados para auditoría.',
    );
    if (!confirmed) return;

    setMutatingStatus(true);
    setError(null);
    setFeedback(null);
    try {
      await apiClient.documents.archive(doc.id);
      setFeedback('Documento archivado lógicamente.');
      await loadDocument();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'No se pudo archivar el documento',
      );
    } finally {
      setMutatingStatus(false);
    }
  };

  const handleRestore = async () => {
    if (!doc || mutatingStatus) return;

    setMutatingStatus(true);
    setError(null);
    setFeedback(null);
    try {
      await apiClient.documents.restore(doc.id);
      setFeedback('Documento restaurado a estado activo.');
      await loadDocument();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'No se pudo restaurar el documento',
      );
    } finally {
      setMutatingStatus(false);
    }
  };

  const toggleHash = (versionId: string) => {
    setVisibleHashes((prev) => ({ ...prev, [versionId]: !prev[versionId] }));
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <span className="text-muted">Cargando detalle del documento...</span>
      </div>
    );
  }

  if (!doc) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Link to="/documentos" className="btn btn-ghost" style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={16} /> Volver a Documentos
        </Link>
        <div
          className="card"
          style={{
            padding: '1.5rem',
            color: 'hsl(var(--hsl-danger))',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{error || 'Documento no encontrado.'}</span>
        </div>
      </div>
    );
  }

  const hasFullAccess = doc.versions !== undefined;
  const versions = doc.versions || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <Link to="/documentos" className="btn btn-ghost">
          <ArrowLeft size={16} /> Volver a Documentos
        </Link>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {hasFullAccess && versions.length > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleDownload(versions[0])}
            >
              <Download size={16} /> Descargar v{doc.currentVersionNumber}
            </button>
          )}

          {hasFullAccess && doc.status === 'ACTIVE' && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setEditing((v) => !v)}
            >
              <Edit3 size={16} /> {editing ? 'Cerrar Edición' : 'Editar Metadatos'}
            </button>
          )}

          {hasFullAccess && doc.status === 'ACTIVE' && (
            <button
              type="button"
              className="btn btn-outline"
              style={{ color: 'hsl(var(--hsl-danger))' }}
              disabled={mutatingStatus}
              onClick={handleArchive}
            >
              <Archive size={16} /> Archivar
            </button>
          )}

          {hasFullAccess && doc.status === 'ARCHIVED' && (
            <button
              type="button"
              className="btn btn-outline"
              disabled={mutatingStatus}
              onClick={handleRestore}
            >
              <RotateCcw size={16} /> Restaurar
            </button>
          )}
        </div>
      </div>

      {/* Feedback / Error banners */}
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

      {/* Metadata Card */}
      <section className="card" style={{ padding: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            flexWrap: 'wrap',
            marginBottom: '0.75rem',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontFamily: 'var(--font-heading)' }}>
            {doc.title}
          </h1>
          <span className="badge badge-blue">
            {DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
          </span>
          <span className="badge">v{doc.currentVersionNumber}</span>
          <span className={`badge ${doc.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}`}>
            {doc.status === 'ACTIVE' ? 'Activo' : 'Archivado'}
          </span>
        </div>

        {doc.description && (
          <p style={{ margin: '0 0 1rem', lineHeight: 1.5 }}>{doc.description}</p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.85rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid hsl(var(--hsl-border))',
            fontSize: '0.88rem',
          }}
        >
          <div>
            <div className="text-muted">Expediente Vinculado</div>
            {doc.expediente ? (
              <Link
                to={`/expedientes/${doc.expediente.id}`}
                style={{ color: 'hsl(var(--hsl-primary))', fontWeight: 500 }}
              >
                {doc.expediente.numeroExpediente} — {doc.expediente.caratula}
              </Link>
            ) : (
              <span>—</span>
            )}
          </div>

          <div>
            <div className="text-muted">Cliente Vinculado</div>
            {doc.client ? (
              <Link
                to={`/clientes/${doc.client.id}`}
                style={{ color: 'hsl(var(--hsl-primary))', fontWeight: 500 }}
              >
                {[doc.client.firstName, doc.client.lastName].filter(Boolean).join(' ')}
              </Link>
            ) : (
              <span>—</span>
            )}
          </div>

          <div>
            <div className="text-muted">Movimiento Procesal</div>
            {doc.movimientoProcesal ? (
              <span>
                {doc.movimientoProcesal.tipo}: {doc.movimientoProcesal.titulo} (
                {new Date(doc.movimientoProcesal.fechaActuacion).toLocaleDateString()})
              </span>
            ) : (
              <span>—</span>
            )}
          </div>

          <div>
            <div className="text-muted">Fecha Documental</div>
            <span>
              {doc.documentDate ? new Date(doc.documentDate).toLocaleDateString() : '—'}
            </span>
          </div>

          <div>
            <div className="text-muted">Creado por</div>
            <span>
              {doc.createdBy?.fullName || doc.createdBy?.email || '—'} ·{' '}
              {new Date(doc.createdAt).toLocaleString()}
            </span>
          </div>

          {doc.archivedAt && (
            <div>
              <div className="text-muted">Archivado</div>
              <span>
                {doc.archivedBy?.fullName || doc.archivedBy?.email || '—'} ·{' '}
                {new Date(doc.archivedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Inline Edit Metadata Form */}
        {editing && (
          <form
            onSubmit={handleSaveMetadata}
            style={{
              marginTop: '1.25rem',
              padding: '1.25rem',
              background: 'hsl(var(--hsl-surface-muted))',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Editar Metadatos</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '0.75rem',
              }}
            >
              <div className="form-group">
                <label className="label">Título *</label>
                <input
                  required
                  className="input-field"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="label">Categoría</label>
                <select
                  className="input-field"
                  value={metaCategory}
                  onChange={(e) => setMetaCategory(e.target.value as DocumentCategory)}
                >
                  {(Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {DOCUMENT_CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Fecha Documental</label>
                <input
                  type="date"
                  className="input-field"
                  value={metaDocumentDate}
                  onChange={(e) => setMetaDocumentDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="label">Expediente</label>
                <select
                  className="input-field"
                  value={metaExpedienteId}
                  onChange={(e) => setMetaExpedienteId(e.target.value)}
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
                <label className="label">Cliente</label>
                <select
                  className="input-field"
                  value={metaClientId}
                  onChange={(e) => setMetaClientId(e.target.value)}
                >
                  <option value="">Sin vincular</option>
                  {clients.map((cli) => (
                    <option key={cli.id} value={cli.id}>
                      {[cli.firstName, cli.lastName].filter(Boolean).join(' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="label">Descripción</label>
                <textarea
                  rows={2}
                  className="input-field"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={savingMeta}
                onClick={() => setEditing(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={savingMeta}>
                {savingMeta ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Upload New Version Section */}
      {hasFullAccess && doc.status === 'ACTIVE' && (
        <section className="card" style={{ padding: '1.5rem' }}>
          <h2
            style={{
              margin: '0 0 0.85rem',
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Upload size={18} color="hsl(var(--hsl-primary))" />
            Cargar Nueva Versión (v{doc.currentVersionNumber + 1})
          </h2>

          {versionError && (
            <div
              style={{
                padding: '0.65rem 0.85rem',
                marginBottom: '0.85rem',
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
              <span>{versionError}</span>
            </div>
          )}

          <form
            onSubmit={handleUploadVersion}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '0.75rem',
              }}
            >
              <div className="form-group">
                <label className="label">
                  Nuevo Archivo * (PDF, DOCX, DOC, XLSX, XLS, PNG, JPG — máx. 25 MB)
                </label>
                <input
                  type="file"
                  accept={ALLOWED_EXTENSIONS.join(',')}
                  className="input-field"
                  onChange={handleVersionFileChange}
                  disabled={uploadingVersion}
                />
                {versionFile && (
                  <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                    {versionFile.name} ({formatFileSize(versionFile.size)})
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="label">Nota de Cambio (Opcional)</label>
                <input
                  className="input-field"
                  placeholder="Ej: Corrección de monto reclamado y firmas"
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  disabled={uploadingVersion}
                />
              </div>
            </div>

            {uploadingVersion && (
              <div>
                <div style={{ fontSize: '0.82rem', marginBottom: '0.25rem' }}>
                  Subiendo nueva versión... {uploadProgress}%
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
                      width: `${uploadProgress}%`,
                      height: '100%',
                      background: 'hsl(var(--hsl-primary))',
                      transition: 'width 0.15s',
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={uploadingVersion || !versionFile}
              >
                {uploadingVersion ? 'Subiendo...' : 'Subir Nueva Versión'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Version History Section */}
      {hasFullAccess ? (
        <section className="card" style={{ padding: '1.5rem' }}>
          <h2
            style={{
              margin: '0 0 1rem',
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <History size={18} color="hsl(var(--hsl-primary))" />
            Historial de Versiones ({versions.length})
          </h2>

          {versions.length === 0 ? (
            <p className="text-muted" style={{ margin: 0 }}>
              No hay versiones registradas.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {versions.map((ver) => {
                const isCurrent = ver.versionNumber === doc.currentVersionNumber;
                const showHash = !!visibleHashes[ver.id];
                return (
                  <div
                    key={ver.id}
                    style={{
                      padding: '1rem',
                      border: '1px solid hsl(var(--hsl-border))',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
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
                          <strong>Versión v{ver.versionNumber}</strong>
                          {isCurrent && <span className="badge badge-green">Vigente</span>}
                          <span style={{ fontSize: '0.88rem' }}>{ver.originalFilename}</span>
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                          {formatFileSize(ver.sizeBytes)} · {ver.mimeType} · Subido por{' '}
                          {ver.uploadedBy?.fullName || ver.uploadedBy?.email || ver.uploadedById}{' '}
                          el {new Date(ver.uploadedAt).toLocaleString()}
                        </div>
                        {ver.changeNote && (
                          <div style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                            <em>Nota: {ver.changeNote}</em>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                          onClick={() => toggleHash(ver.id)}
                          title="Mostrar u ocultar integridad SHA-256"
                        >
                          {showHash ? <EyeOff size={14} /> : <Eye size={14} />}
                          SHA-256
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ fontSize: '0.82rem', padding: '0.35rem 0.7rem' }}
                          onClick={() => handleDownload(ver)}
                        >
                          <Download size={14} /> Descargar
                        </button>
                      </div>
                    </div>

                    {showHash && (
                      <div
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: 'hsl(var(--hsl-surface-muted))',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.78rem',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <ShieldCheck size={14} color="hsl(var(--hsl-primary))" />
                        <span>SHA-256: {ver.sha256}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="card" style={{ padding: '1.25rem' }}>
          <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            Su rol actual permite visualizar los metadatos básicos del documento, pero no
            incluye permisos para consultar el historial técnico ni descargar archivos binarios.
          </p>
        </section>
      )}
    </div>
  );
};

