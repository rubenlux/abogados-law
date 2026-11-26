import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Send,
  CheckCircle2,
  XCircle,
  Lock,
  Archive,
  Download,
  FileDown,
  History,
  AlertCircle,
  GitCompare,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import { LegalRichEditor } from '../components/LegalRichEditor';
import type {
  AiAssistMode,
  AiAssistResponse,
  LegalDocContent,
  LegalDraftExportFormat,
  LegalDraftExportItem,
  LegalDraftItem,
  LegalDraftVersionItem,
} from '../types';
import {
  DEFAULT_EMPTY_TIPTAP_DOC,
  DRAFT_DOCUMENT_TYPE_LABELS,
  DRAFT_STATUS_BADGE_CLASS,
  DRAFT_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
} from '../types';

export const LegalDraftWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [draft, setDraft] = useState<LegalDraftItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Editor state
  const [editorContent, setEditorContent] = useState<LegalDocContent>(
    DEFAULT_EMPTY_TIPTAP_DOC,
  );
  const [editorKey, setEditorKey] = useState('init');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [changeNote, setChangeNote] = useState('');
  const [savingVersion, setSavingVersion] = useState(false);

  // Version inspection & basic comparison
  const [activeVersionId, setActiveVersionId] = useState<string>('');
  const [compareVersionId, setCompareVersionId] = useState<string>('');

  // Workflow comments
  const [workflowComment, setWorkflowComment] = useState('');
  const [workflowBusy, setWorkflowBusy] = useState(false);

  // Paso 5 — AI Assist actions & explicit proposal review (never silent overwrite)
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProposal, setAiProposal] = useState<AiAssistResponse | null>(null);
  const [missingInfoResult, setMissingInfoResult] = useState<string[] | null>(
    null,
  );

  // Export panel
  const [exportFormat, setExportFormat] =
    useState<LegalDraftExportFormat>('DOCX');
  const [exportVersionId, setExportVersionId] = useState<string>('');
  const [fontFamily, setFontFamily] = useState('Times New Roman');
  const [fontSizePt, setFontSizePt] = useState(12);
  const [lineSpacing, setLineSpacing] = useState(1.5);
  const [marginTopCm, setMarginTopCm] = useState(2.5);
  const [marginBottomCm, setMarginBottomCm] = useState(2.5);
  const [marginLeftCm, setMarginLeftCm] = useState(3.0);
  const [marginRightCm, setMarginRightCm] = useState(2.5);
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [exporting, setExporting] = useState(false);

  const loadDraft = useCallback(
    async (resetEditor = true) => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = (await apiClient.legalDrafts.findById(
          id,
        )) as LegalDraftItem;
        setDraft(data);
        const latestVer = data.versions?.[0];
        if (latestVer) {
          setExportVersionId((prev) => prev || latestVer.id);
          if (resetEditor) {
            setActiveVersionId(latestVer.id);
            setEditorContent(latestVer.content);
            setEditorKey(`v-${latestVer.id}-${Date.now()}`);
            setHasUnsavedChanges(false);
          }
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : 'No se pudo cargar el escrito',
        );
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    loadDraft(true);
  }, [loadDraft]);

  const versions = draft?.versions || [];
  const latestVersion = versions[0] || null;
  const viewingHistorical =
    Boolean(activeVersionId && latestVersion && activeVersionId !== latestVersion.id);
  const isEditorReadOnly =
    viewingHistorical ||
    draft?.status === 'IN_REVIEW' ||
    draft?.status === 'ARCHIVED';

  const handleSaveNewVersion = async () => {
    if (!draft || savingVersion) return;
    setSavingVersion(true);
    setError(null);
    setFeedback(null);
    try {
      const created = (await apiClient.legalDrafts.createVersion(draft.id, {
        content: editorContent as unknown as Record<string, unknown>,
        changeNote: changeNote.trim() || undefined,
      })) as LegalDraftVersionItem;
      setChangeNote('');
      setHasUnsavedChanges(false);
      setExportVersionId(created.id);
      setFeedback(
        `Versión v${created.versionNumber} guardada de forma inmutable.`,
      );
      await loadDraft(true);
    } catch (err: unknown) {
      // Recuperación ante error de guardado: conserva editorContent y hasUnsavedChanges
      setError(
        err instanceof Error
          ? `Error al guardar (sus cambios siguen en el editor): ${err.message}`
          : 'Error al guardar la nueva versión. Sus cambios no se perdieron.',
      );
    } finally {
      setSavingVersion(false);
    }
  };

  const handleSelectVersion = (ver: LegalDraftVersionItem) => {
    if (
      hasUnsavedChanges &&
      !window.confirm(
        'Tiene cambios sin guardar en el editor. ¿Desea cambiar de versión y descartarlos?',
      )
    ) {
      return;
    }
    setActiveVersionId(ver.id);
    setEditorContent(ver.content);
    setEditorKey(`view-${ver.id}-${Date.now()}`);
    setHasUnsavedChanges(false);
  };

  const handleWorkflow = async (
    action: 'submit' | 'changes' | 'approve' | 'finalize' | 'archive',
  ) => {
    if (!draft || workflowBusy) return;
    if (action === 'archive') {
      if (
        !window.confirm(
          '¿Desea archivar lógicamente este escrito? Las versiones y exportaciones permanecerán preservadas.',
        )
      ) {
        return;
      }
    }
    if (action === 'changes' && !workflowComment.trim()) {
      setError('Debe indicar los comentarios de los cambios solicitados.');
      return;
    }

    setWorkflowBusy(true);
    setError(null);
    setFeedback(null);
    try {
      if (action === 'submit') {
        await apiClient.legalDrafts.submitReview(draft.id, {
          comments: workflowComment.trim() || undefined,
        });
        setFeedback('Escrito enviado a revisión.');
      } else if (action === 'changes') {
        await apiClient.legalDrafts.requestChanges(
          draft.id,
          workflowComment.trim(),
        );
        setFeedback('Se solicitaron cambios al autor.');
      } else if (action === 'approve' && latestVersion) {
        await apiClient.legalDrafts.approve(draft.id, {
          versionId: latestVersion.id,
          comments: workflowComment.trim() || undefined,
        });
        setFeedback(`Versión v${latestVersion.versionNumber} aprobada.`);
      } else if (action === 'finalize') {
        await apiClient.legalDrafts.finalize(
          draft.id,
          workflowComment.trim() || undefined,
        );
        setFeedback('Escrito marcado como Finalizado (listo para exportación).');
      } else if (action === 'archive') {
        await apiClient.legalDrafts.archive(draft.id);
        setFeedback('Escrito archivado lógicamente.');
      }
      setWorkflowComment('');
      await loadDraft(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error en transición de estado',
      );
    } finally {
      setWorkflowBusy(false);
    }
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || exporting || !exportVersionId) return;
    setExporting(true);
    setError(null);
    setFeedback(null);

    try {
      const created = (await apiClient.legalDrafts.exportDraft(draft.id, {
        versionId: exportVersionId,
        format: exportFormat,
        options: {
          fontFamily,
          fontSizePt,
          lineSpacing,
          marginTopCm,
          marginBottomCm,
          marginLeftCm,
          marginRightCm,
          headerText: headerText.trim() || undefined,
          footerText: footerText.trim() || undefined,
          includePageNumbers: true,
        },
      })) as LegalDraftExportItem;

      setFeedback(
        `Exportación ${created.format} generada y vinculada en Gestión Documental (AUTH-08).`,
      );
      await loadDraft(false);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error al generar exportación',
      );
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadExport = async (exp: LegalDraftExportItem) => {
    if (!draft) return;
    setError(null);
    try {
      const ext = exp.format.toLowerCase();
      await apiClient.legalDrafts.downloadExport(
        draft.id,
        exp.id,
        `${draft.title}_v${exp.version?.versionNumber || draft.currentVersionNumber}.${ext}`,
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error al descargar el archivo',
      );
    }
  };

  const handleAiAssist = async (mode: AiAssistMode) => {
    if (!draft || aiBusy) return;
    setAiBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const res = (await apiClient.legalDrafts.assistWithAi(draft.id, {
        mode,
        instructions: aiInstructions.trim() || undefined,
        applyAsNewVersion: false,
      })) as AiAssistResponse;

      if (mode === 'MISSING_INFO') {
        setMissingInfoResult(res.missingData || []);
        setFeedback('Análisis de información faltante completado.');
      } else {
        setAiProposal(res);
        setFeedback(
          'Propuesta generada por IA lista para revisión. Acepte explícitamente para guardarla como nueva versión.',
        );
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al ejecutar asistencia IA sobre el escrito',
      );
    } finally {
      setAiBusy(false);
    }
  };

  const handleAcceptProposalAsNewVersion = async () => {
    if (!draft || !aiProposal?.proposedContent || savingVersion) return;
    setSavingVersion(true);
    setError(null);
    setFeedback(null);
    try {
      const created = (await apiClient.legalDrafts.createVersion(draft.id, {
        content: aiProposal.proposedContent as unknown as Record<string, unknown>,
        changeNote: `Propuesta IA aceptada (${aiProposal.mode})`,
      })) as LegalDraftVersionItem;
      setAiProposal(null);
      setAiInstructions('');
      setExportVersionId(created.id);
      setFeedback(
        `Propuesta IA aceptada y guardada como versión inmutable v${created.versionNumber}.`,
      );
      await loadDraft(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al guardar la propuesta como nueva versión',
      );
    } finally {
      setSavingVersion(false);
    }
  };

  if (loading && !draft) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <span className="text-muted">Cargando espacio de redacción...</span>
      </div>
    );
  }

  if (!draft) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Link to="/escritos" className="btn btn-ghost" style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={16} /> Volver a Escritos
        </Link>
        <div className="card" style={{ padding: '1.5rem', color: 'hsl(var(--hsl-danger))' }}>
          {error || 'Escrito jurídico no encontrado.'}
        </div>
      </div>
    );
  }

  const activeVersionObj =
    versions.find((v) => v.id === activeVersionId) || latestVersion;
  const compareVersionObj =
    versions.find((v) => v.id === compareVersionId) || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/escritos" className="btn btn-ghost">
            <ArrowLeft size={16} /> Escritos
          </Link>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontFamily: 'var(--font-heading)' }}>
            {draft.title}
          </h1>
          <span className={`badge ${DRAFT_STATUS_BADGE_CLASS[draft.status]}`}>
            {DRAFT_STATUS_LABELS[draft.status]}
          </span>
          <span className="badge badge-blue">
            {DRAFT_DOCUMENT_TYPE_LABELS[draft.documentType]}
          </span>
          <span className="badge">v{draft.currentVersionNumber}</span>
          {draft.isAiGenerated && (
            <span className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <Sparkles size={12} /> Borrador asistido por IA
            </span>
          )}
          {hasUnsavedChanges && (
            <span className="badge badge-yellow">Cambios sin guardar</span>
          )}
        </div>

        {draft.status !== 'ARCHIVED' && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ color: 'hsl(var(--hsl-danger))' }}
            disabled={workflowBusy}
            onClick={() => handleWorkflow('archive')}
          >
            <Archive size={15} /> Archivar
          </button>
        )}
      </div>

      {/* Professional notice */}
      <div
        style={{
          padding: '0.65rem 1rem',
          borderRadius: 'var(--radius-sm)',
          background: 'hsl(var(--hsl-surface-muted))',
          fontSize: '0.82rem',
          color: 'hsl(var(--hsl-text-muted))',
        }}
      >
        <strong>Aviso profesional:</strong> este módulo asiste la preparación y revisión interna de escritos.
        La exportación DOCX/PDF <strong>no</strong> presenta el escrito ante organismos judiciales ni registra un movimiento procesal automático.
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

      {/* Main 2-column workspace */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        {/* Left: Rich Editor + Save Bar + Diff */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {viewingHistorical && activeVersionObj && (
            <div
              className="card"
              style={{
                padding: '0.75rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(59, 130, 246, 0.08)',
              }}
            >
              <span style={{ fontSize: '0.86rem' }}>
                Visualizando versión histórica inmutable <strong>v{activeVersionObj.versionNumber}</strong> (solo lectura).
              </span>
              {latestVersion && (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                  onClick={() => handleSelectVersion(latestVersion)}
                >
                  Volver a versión vigente (v{latestVersion.versionNumber})
                </button>
              )}
            </div>
          )}

          <LegalRichEditor
            initialContent={editorContent}
            editorKey={editorKey}
            readOnly={isEditorReadOnly}
            onChange={(json) => {
              setEditorContent(json);
              setHasUnsavedChanges(true);
            }}
          />

          {/* Explicit Save Bar */}
          {!isEditorReadOnly && (
            <div
              className="card"
              style={{
                padding: '1rem',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <input
                className="input-field"
                style={{ flex: 1, minWidth: 220 }}
                placeholder="Nota de cambio para esta nueva versión (ej: Ajustes en petitorio)..."
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                disabled={savingVersion}
              />
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingVersion || !hasUnsavedChanges}
                onClick={handleSaveNewVersion}
              >
                <Save size={16} />
                {savingVersion
                  ? 'Guardando versión...'
                  : `Guardar como v${draft.currentVersionNumber + 1}`}
              </button>
            </div>
          )}

          {/* Pending Info / Missing Data indicator */}
          {((draft.aiMetadata?.missingData && draft.aiMetadata.missingData.length > 0) ||
            (missingInfoResult && missingInfoResult.length > 0)) && (
            <section
              className="card"
              style={{
                padding: '1rem 1.25rem',
                border: '1px solid rgba(234, 179, 8, 0.45)',
                background: 'rgba(234, 179, 8, 0.08)',
              }}
            >
              <h3 style={{ margin: '0 0 0.45rem', fontSize: '0.94rem' }}>
                Información pendiente de confirmar
              </h3>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.84rem' }}>
                {Array.from(
                  new Set([
                    ...(draft.aiMetadata?.missingData || []),
                    ...(missingInfoResult || []),
                  ]),
                ).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Paso 5 — AI Refinement Actions & Proposal Review */}
          {draft.status !== 'ARCHIVED' && (
            <section className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Sparkles size={16} color="hsl(var(--hsl-primary))" />
                Asistencia IA sobre este Escrito (Sin sobrescritura)
              </h2>

              <input
                className="input-field"
                placeholder="Instrucciones adicionales opcionales para regenerar o mejorar..."
                value={aiInstructions}
                onChange={(e) => setAiInstructions(e.target.value)}
                disabled={aiBusy}
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {(
                  [
                    ['REGENERATE', 'Regenerar'],
                    ['IMPROVE', 'Mejorar redacción'],
                    ['EXPAND', 'Ampliar fundamentos'],
                    ['SUMMARIZE', 'Resumir'],
                    ['FIX_STRUCTURE', 'Corregir estructura'],
                    ['MISSING_INFO', 'Consultar info faltante'],
                  ] as Array<[AiAssistMode, string]>
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                    disabled={aiBusy}
                    onClick={() => handleAiAssist(mode)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {aiProposal && aiProposal.proposedPlainText && (
                <div
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid hsl(var(--hsl-primary))',
                    background: 'rgba(59, 130, 246, 0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <strong>Propuesta IA ({aiProposal.mode}) — Pendiente de aceptación</strong>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: '0.78rem' }}
                        onClick={() => setAiProposal(null)}
                      >
                        Descartar
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: '0.78rem' }}
                        disabled={savingVersion || isEditorReadOnly}
                        onClick={handleAcceptProposalAsNewVersion}
                      >
                        Aceptar y guardar como v{draft.currentVersionNumber + 1}
                      </button>
                    </div>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                      fontSize: '0.84rem',
                      maxHeight: 260,
                      overflowY: 'auto',
                    }}
                  >
                    {aiProposal.proposedPlainText}
                  </pre>
                </div>
              )}
            </section>
          )}

          {/* Basic Version Comparison */}
          {versions.length >= 2 && (
            <section className="card" style={{ padding: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '0.75rem',
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <GitCompare size={16} color="hsl(var(--hsl-primary))" />
                  Comparación de Versiones (Texto Plano)
                </h2>
                <select
                  className="input-field"
                  style={{ width: 'auto', fontSize: '0.82rem' }}
                  value={compareVersionId}
                  onChange={(e) => setCompareVersionId(e.target.value)}
                >
                  <option value="">Seleccionar versión para comparar...</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.versionNumber} — {new Date(v.createdAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>

              {compareVersionObj && activeVersionObj && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    fontSize: '0.82rem',
                  }}
                >
                  <div
                    style={{
                      padding: '0.75rem',
                      background: 'hsl(var(--hsl-surface-muted))',
                      borderRadius: 'var(--radius-sm)',
                      whiteSpace: 'pre-wrap',
                      maxHeight: 280,
                      overflowY: 'auto',
                    }}
                  >
                    <strong>v{compareVersionObj.versionNumber} (Referencia)</strong>
                    <hr style={{ margin: '0.4rem 0', opacity: 0.25 }} />
                    {compareVersionObj.plainText}
                  </div>
                  <div
                    style={{
                      padding: '0.75rem',
                      background: 'hsl(var(--hsl-surface-muted))',
                      borderRadius: 'var(--radius-sm)',
                      whiteSpace: 'pre-wrap',
                      maxHeight: 280,
                      overflowY: 'auto',
                    }}
                  >
                    <strong>v{activeVersionObj.versionNumber} (Activa)</strong>
                    <hr style={{ margin: '0.4rem 0', opacity: 0.25 }} />
                    {activeVersionObj.plainText}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right Sidebar: Metadata, Review Workflow, Versions, Export */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Context Metadata */}
          <section className="card" style={{ padding: '1.15rem', fontSize: '0.85rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.98rem' }}>
              Datos del Expediente y Origen
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div>
                <span className="text-muted">Expediente: </span>
                {draft.expediente ? (
                  <Link
                    to={`/expedientes/${draft.expediente.id}`}
                    style={{ color: 'hsl(var(--hsl-primary))', fontWeight: 500 }}
                  >
                    {draft.expediente.numeroExpediente} — {draft.expediente.caratula}
                  </Link>
                ) : (
                  '—'
                )}
              </div>
              {draft.courtName && (
                <div>
                  <span className="text-muted">Tribunal: </span>
                  {draft.courtName}
                </div>
              )}
              {draft.jurisdiction && (
                <div>
                  <span className="text-muted">Jurisdicción: </span>
                  {draft.jurisdiction}
                </div>
              )}
              {draft.sourceTemplate && (
                <div>
                  <span className="text-muted">Plantilla origen: </span>
                  {draft.sourceTemplate.name}
                </div>
              )}
              <div>
                <span className="text-muted">Autor: </span>
                {draft.createdBy?.fullName || draft.createdBy?.email || '—'}
              </div>
            </div>
          </section>

          {/* Review Workflow */}
          <section className="card" style={{ padding: '1.15rem', fontSize: '0.85rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.98rem' }}>
              Flujo de Revisión y Aprobación
            </h3>

            {draft.status !== 'ARCHIVED' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.85rem' }}>
                <textarea
                  rows={2}
                  className="input-field"
                  placeholder="Comentarios de revisión o motivo de solicitud de cambios..."
                  value={workflowComment}
                  onChange={(e) => setWorkflowComment(e.target.value)}
                  disabled={workflowBusy}
                />

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {(draft.status === 'DRAFT' || draft.status === 'CHANGES_REQUESTED') && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: '0.8rem' }}
                      disabled={workflowBusy || hasUnsavedChanges}
                      onClick={() => handleWorkflow('submit')}
                    >
                      <Send size={14} /> Enviar a Revisión
                    </button>
                  )}

                  {draft.status === 'IN_REVIEW' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: '0.8rem' }}
                        disabled={workflowBusy}
                        onClick={() => handleWorkflow('approve')}
                      >
                        <CheckCircle2 size={14} /> Aprobar v{draft.currentVersionNumber}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ fontSize: '0.8rem' }}
                        disabled={workflowBusy}
                        onClick={() => handleWorkflow('changes')}
                      >
                        <XCircle size={14} /> Solicitar Cambios
                      </button>
                    </>
                  )}

                  {draft.status === 'APPROVED' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: '0.8rem' }}
                      disabled={workflowBusy}
                      onClick={() => handleWorkflow('finalize')}
                    >
                      <Lock size={14} /> Finalizar Escrito
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Review History */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {(draft.reviews || []).length === 0 ? (
                <span className="text-muted">Sin revisiones registradas aún.</span>
              ) : (
                (draft.reviews || []).map((rev) => (
                  <div
                    key={rev.id}
                    style={{
                      padding: '0.55rem 0.65rem',
                      border: '1px solid hsl(var(--hsl-border))',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{REVIEW_STATUS_LABELS[rev.status]}</strong>
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                        {new Date(rev.reviewedAt || rev.requestedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {rev.reviewer && (
                      <div className="text-muted" style={{ fontSize: '0.76rem' }}>
                        Revisor: {rev.reviewer.fullName || rev.reviewer.email}
                      </div>
                    )}
                    {rev.comments && (
                      <div style={{ marginTop: '0.2rem', fontSize: '0.8rem' }}>
                        {rev.comments}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Export DOCX / PDF */}
          <section className="card" style={{ padding: '1.15rem', fontSize: '0.85rem' }}>
            <h3
              style={{
                margin: '0 0 0.75rem',
                fontSize: '0.98rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <FileDown size={16} color="hsl(var(--hsl-primary))" />
              Exportar DOCX / PDF (AUTH-08)
            </h3>

            {draft.status !== 'ARCHIVED' && (
              <form
                onSubmit={handleExport}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '0.85rem' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label className="label">Versión</label>
                    <select
                      className="input-field"
                      value={exportVersionId}
                      onChange={(e) => setExportVersionId(e.target.value)}
                    >
                      {versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          v{v.versionNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Formato</label>
                    <select
                      className="input-field"
                      value={exportFormat}
                      onChange={(e) =>
                        setExportFormat(e.target.value as LegalDraftExportFormat)
                      }
                    >
                      <option value="DOCX">DOCX (Word)</option>
                      <option value="PDF">PDF</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                  <div>
                    <label className="label">Fuente</label>
                    <select
                      className="input-field"
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                    >
                      <option value="Times New Roman">Times</option>
                      <option value="Arial">Arial</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Tamaño</label>
                    <input
                      type="number"
                      min={9}
                      max={16}
                      className="input-field"
                      value={fontSizePt}
                      onChange={(e) => setFontSizePt(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="label">Interlin.</label>
                    <input
                      type="number"
                      step={0.1}
                      min={1}
                      max={2.5}
                      className="input-field"
                      value={lineSpacing}
                      onChange={(e) => setLineSpacing(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.35rem' }}>
                  <div>
                    <label className="label">Sup cm</label>
                    <input
                      type="number"
                      step={0.5}
                      min={1}
                      max={5}
                      className="input-field"
                      value={marginTopCm}
                      onChange={(e) => setMarginTopCm(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="label">Inf cm</label>
                    <input
                      type="number"
                      step={0.5}
                      min={1}
                      max={5}
                      className="input-field"
                      value={marginBottomCm}
                      onChange={(e) => setMarginBottomCm(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="label">Izq cm</label>
                    <input
                      type="number"
                      step={0.5}
                      min={1}
                      max={5}
                      className="input-field"
                      value={marginLeftCm}
                      onChange={(e) => setMarginLeftCm(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="label">Der cm</label>
                    <input
                      type="number"
                      step={0.5}
                      min={1}
                      max={5}
                      className="input-field"
                      value={marginRightCm}
                      onChange={(e) => setMarginRightCm(Number(e.target.value))}
                    />
                  </div>
                </div>

                <input
                  className="input-field"
                  placeholder="Encabezado opcional..."
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                />
                <input
                  className="input-field"
                  placeholder="Pie de página opcional..."
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                />

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={exporting || !exportVersionId}
                >
                  <FileDown size={15} />
                  {exporting ? 'Generando archivo...' : `Generar ${exportFormat}`}
                </button>
              </form>
            )}

            {/* Exports History */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {(draft.exports || []).length === 0 ? (
                <span className="text-muted">No hay exportaciones generadas.</span>
              ) : (
                (draft.exports || []).map((exp) => (
                  <div
                    key={exp.id}
                    style={{
                      padding: '0.55rem 0.65rem',
                      border: '1px solid hsl(var(--hsl-border))',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <div>
                      <div>
                        <strong>{exp.format}</strong> · v
                        {exp.version?.versionNumber || '?'}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.73rem' }}>
                        {new Date(exp.generatedAt).toLocaleString()}
                      </div>
                      <Link
                        to={`/documentos/${exp.storageDocumentId}`}
                        style={{
                          fontSize: '0.74rem',
                          color: 'hsl(var(--hsl-primary))',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                      >
                        Ver en Documentos <ExternalLink size={11} />
                      </Link>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ padding: '0.3rem 0.5rem' }}
                      title="Descargar exportación"
                      onClick={() => handleDownloadExport(exp)}
                    >
                      <Download size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Version History */}
          <section className="card" style={{ padding: '1.15rem', fontSize: '0.85rem' }}>
            <h3
              style={{
                margin: '0 0 0.75rem',
                fontSize: '0.98rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <History size={16} color="hsl(var(--hsl-primary))" />
              Versiones ({versions.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {versions.map((ver) => {
                const isSelected = ver.id === activeVersionId;
                return (
                  <button
                    key={ver.id}
                    type="button"
                    onClick={() => handleSelectVersion(ver)}
                    style={{
                      textAlign: 'left',
                      padding: '0.55rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected
                        ? '1px solid hsl(var(--hsl-primary))'
                        : '1px solid hsl(var(--hsl-border))',
                      background: isSelected
                        ? 'rgba(59, 130, 246, 0.08)'
                        : 'transparent',
                      cursor: 'pointer',
                      color: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>v{ver.versionNumber}</strong>
                      <span className="text-muted" style={{ fontSize: '0.74rem' }}>
                        {new Date(ver.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.76rem' }}>
                      {ver.createdBy?.fullName || ver.createdBy?.email || '—'}
                    </div>
                    {ver.changeNote && (
                      <div style={{ fontSize: '0.78rem', marginTop: '0.15rem' }}>
                        <em>{ver.changeNote}</em>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

