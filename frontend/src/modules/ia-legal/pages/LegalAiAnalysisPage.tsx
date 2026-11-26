import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSearch,
  Scale,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  History,
  Plus,
  Edit3,
  RotateCcw,
  Archive,
  Send,
  ShieldAlert,
  Search,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import type { DocumentItem } from '../../documents/types';
import type { RecentCaseItem } from '../../legal-drafts/types';
import type {
  AnalysisSourcesPreview,
  AssistantStatus,
  GeneratorPrefillState,
  LegalAiAnalysisItem,
  LegalAiAnalysisResultContent,
  LegalAiAnalysisType,
} from '../types';
import { ANALYSIS_TYPE_META } from '../types';

type WizardStep = 1 | 2 | 3 | 4 | 5;
type TransferScope =
  | 'FULL'
  | 'SUMMARY'
  | 'FACTS'
  | 'CONTROVERSIES'
  | 'RISKS';

const ANALYSIS_TYPES_ORDER: LegalAiAnalysisType[] = [
  'INTEGRAL_CASE',
  'FACTS_AND_CONTROVERSIES',
  'DOCUMENTARY_EVIDENCE',
  'PROCEDURAL_RISKS',
];

function buildTransferText(
  analysis: LegalAiAnalysisItem,
  content: LegalAiAnalysisResultContent,
  scope: TransferScope,
): string {
  const header = `Base analítica tomada del informe "${analysis.title}" (${ANALYSIS_TYPE_META[analysis.analysisType].label}):`;
  if (scope === 'SUMMARY') {
    return `${header}\n\nResumen ejecutivo:\n${content.executiveSummary}`;
  }
  if (scope === 'FACTS') {
    return [
      header,
      '',
      'Hechos relevantes:',
      ...(content.relevantFacts.length ? content.relevantFacts.map((f) => `- ${f}`) : ['- Sin hechos registrados adicionales']),
      ...(content.documentedFacts.length ? ['', 'Hechos documentados:', ...content.documentedFacts.map((f) => `- ${f}`)] : []),
    ].join('\n');
  }
  if (scope === 'CONTROVERSIES') {
    return [
      header,
      '',
      'Cuestiones controvertidas:',
      ...(content.disputedIssues.length ? content.disputedIssues.map((c) => `- ${c}`) : ['- Sin cuestiones controvertidas registradas']),
      ...(content.contradictions.length ? ['', 'Contradicciones detectadas:', ...content.contradictions.map((c) => `- ${c}`)] : []),
    ].join('\n');
  }
  if (scope === 'RISKS') {
    return [
      header,
      '',
      'Riesgos y puntos de atención:',
      ...(content.proceduralRisks.length ? content.proceduralRisks.map((r) => `- ${r}`) : ['- Sin riesgos específicos detectados']),
      ...(content.missingInformation.length ? ['', 'Información faltante:', ...content.missingInformation.map((m) => `- ${m}`)] : []),
    ].join('\n');
  }
  return [
    header,
    '',
    `Resumen ejecutivo:\n${content.executiveSummary}`,
    '',
    `Desarrollo del análisis:\n${content.analysisDevelopment}`,
    content.relevantFacts.length ? `\nHechos relevantes:\n${content.relevantFacts.map((f) => `- ${f}`).join('\n')}` : '',
    content.disputedIssues.length ? `\nCuestiones controvertidas:\n${content.disputedIssues.map((c) => `- ${c}`).join('\n')}` : '',
    content.proceduralRisks.length ? `\nRiesgos o puntos de atención:\n${content.proceduralRisks.map((r) => `- ${r}`).join('\n')}` : '',
    content.missingInformation.length ? `\nInformación faltante:\n${content.missingInformation.map((m) => `- ${m}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 3800);
}

export const LegalAiAnalysisPage: React.FC = () => {
  const navigate = useNavigate();

  // Provider status & feedback
  const [aiStatus, setAiStatus] = useState<AssistantStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // History sidebar
  const [historyItems, setHistoryItems] = useState<LegalAiAnalysisItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filterBySelectedCase, setFilterBySelectedCase] = useState(false);

  // Step wizard state
  const [step, setStep] = useState<WizardStep>(1);
  const [caseSearch, setCaseSearch] = useState('');
  const [cases, setCases] = useState<RecentCaseItem[]>([]);
  const [selectedCase, setSelectedCase] = useState<RecentCaseItem | null>(null);
  const [availableDocs, setAvailableDocs] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [analysisType, setAnalysisType] = useState<LegalAiAnalysisType>('INTEGRAL_CASE');
  const [titleInput, setTitleInput] = useState('');
  const [instructions, setInstructions] = useState('');

  // Step 4 preview & Step 5 generation
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sourcesPreview, setSourcesPreview] = useState<AnalysisSourcesPreview | null>(null);
  const [generating, setGenerating] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState<LegalAiAnalysisItem | null>(null);

  // Non-destructive edit mode (preserves resultContent original!)
  const [viewMode, setViewMode] = useState<'EDITED' | 'ORIGINAL'>('EDITED');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editDevelopment, setEditDevelopment] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Controlled AUTH-09 transfer modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferScope, setTransferScope] = useState<TransferScope>('FULL');

  const loadHistory = useCallback(async (expedienteId?: string) => {
    setHistoryLoading(true);
    try {
      const res = (await apiClient.legalAiAnalyses.list({
        ...(expedienteId ? { expedienteId } : {}),
        limit: 30,
      })) as { data: LegalAiAnalysisItem[] };
      setHistoryItems(res.data || []);
    } catch {
      // Non-blocking
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadCases = useCallback(async (search?: string) => {
    try {
      const res = (await apiClient.expedientes.findAll({
        ...(search?.trim() ? { search: search.trim() } : {}),
        limit: 25,
      })) as { data?: RecentCaseItem[] } | RecentCaseItem[];
      const list = Array.isArray(res) ? res : res.data || [];
      setCases(list);
    } catch {
      setCases([]);
    }
  }, []);

  const loadDocuments = useCallback(async (expedienteId?: string) => {
    try {
      const res = (await apiClient.documents.findAll({
        ...(expedienteId ? { expedienteId } : {}),
        status: 'ACTIVE',
        limit: 40,
      })) as { data?: DocumentItem[] };
      setAvailableDocs(res.data || []);
    } catch {
      setAvailableDocs([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const st = (await apiClient.legalAiAnalyses.getStatus()) as AssistantStatus;
        if (active) setAiStatus(st);
      } catch {
        // Non-blocking
      }
      await Promise.all([loadCases(), loadDocuments(), loadHistory()]);
    };
    init();
    return () => {
      active = false;
    };
  }, [loadCases, loadDocuments, loadHistory]);

  useEffect(() => {
    loadDocuments(selectedCase?.id);
  }, [selectedCase?.id, loadDocuments]);

  useEffect(() => {
    loadHistory(filterBySelectedCase ? selectedCase?.id : undefined);
  }, [filterBySelectedCase, selectedCase?.id, loadHistory]);

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId],
    );
  };

  const canProceedFromStep1 = Boolean(selectedCase) || selectedDocIds.length > 0;

  const goToStep4Preview = async () => {
    setError(null);
    setPreviewLoading(true);
    setStep(4);
    try {
      const preview = (await apiClient.legalAiAnalyses.previewSources({
        ...(selectedCase ? { expedienteId: selectedCase.id } : {}),
        ...(selectedDocIds.length ? { documentIds: selectedDocIds } : {}),
      })) as AnalysisSourcesPreview;
      setSourcesPreview(preview);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo verificar el resumen de fuentes autorizadas.',
      );
      setSourcesPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGenerateAnalysis = async () => {
    setError(null);
    setInfoMessage(null);
    setGenerating(true);
    try {
      const created = (await apiClient.legalAiAnalyses.create({
        analysisType,
        ...(selectedCase ? { expedienteId: selectedCase.id } : {}),
        ...(selectedDocIds.length ? { documentIds: selectedDocIds } : {}),
        ...(titleInput.trim() ? { title: titleInput.trim() } : {}),
        ...(instructions.trim() ? { inputInstructions: instructions.trim() } : {}),
      })) as LegalAiAnalysisItem;

      setActiveAnalysis(created);
      setViewMode('ORIGINAL');
      setIsEditing(false);
      setStep(5);
      setInfoMessage('Informe de análisis generado y persistido correctamente.');
      await loadHistory(filterBySelectedCase ? selectedCase?.id : undefined);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo completar el análisis IA. Su selección fue conservada para reintentar.',
      );
      await loadHistory(filterBySelectedCase ? selectedCase?.id : undefined);
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenAnalysis = async (id: string) => {
    setError(null);
    setInfoMessage(null);
    try {
      const full = (await apiClient.legalAiAnalyses.getById(id)) as LegalAiAnalysisItem;
      setActiveAnalysis(full);
      setViewMode(full.editedContent ? 'EDITED' : 'ORIGINAL');
      setIsEditing(false);
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el análisis.');
    }
  };

  const handleStartNewAnalysis = () => {
    setError(null);
    setInfoMessage(null);
    setActiveAnalysis(null);
    setSourcesPreview(null);
    setIsEditing(false);
    setTitleInput('');
    setInstructions('');
    setStep(1);
  };

  const handleBeginEdit = () => {
    if (!activeAnalysis) return;
    const base = activeAnalysis.editedContent || activeAnalysis.resultContent;
    if (!base) return;
    setEditTitle(activeAnalysis.title);
    setEditSummary(base.executiveSummary || '');
    setEditDevelopment(base.analysisDevelopment || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!activeAnalysis) return;
    const base = activeAnalysis.editedContent || activeAnalysis.resultContent;
    if (!base) return;
    setSavingEdit(true);
    setError(null);
    try {
      const updated = (await apiClient.legalAiAnalyses.update(activeAnalysis.id, {
        title: editTitle.trim() || activeAnalysis.title,
        editedContent: {
          ...base,
          executiveSummary: editSummary.trim(),
          analysisDevelopment: editDevelopment.trim(),
        },
      })) as LegalAiAnalysisItem;
      setActiveAnalysis(updated);
      setViewMode('EDITED');
      setIsEditing(false);
      setInfoMessage(
        'Copia editada guardada. El informe original generado por IA permanece intacto.',
      );
      await loadHistory(filterBySelectedCase ? selectedCase?.id : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar edición.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRetryFailed = async (id: string) => {
    setError(null);
    setGenerating(true);
    try {
      const retried = (await apiClient.legalAiAnalyses.retry(id)) as LegalAiAnalysisItem;
      setActiveAnalysis(retried);
      setViewMode('ORIGINAL');
      setStep(5);
      setInfoMessage('Reintento ejecutado como un nuevo análisis sin sobrescribir el historial.');
      await loadHistory(filterBySelectedCase ? selectedCase?.id : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reintentar análisis.');
    } finally {
      setGenerating(false);
    }
  };

  const handleArchiveAnalysis = async (id: string) => {
    setError(null);
    try {
      await apiClient.legalAiAnalyses.archive(id);
      if (activeAnalysis?.id === id) {
        setActiveAnalysis(null);
        setStep(1);
      }
      setInfoMessage('Análisis archivado lógicamente.');
      await loadHistory(filterBySelectedCase ? selectedCase?.id : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo archivar el análisis.');
    }
  };

  const displayedContent: LegalAiAnalysisResultContent | null = activeAnalysis
    ? viewMode === 'EDITED' && activeAnalysis.editedContent
      ? activeAnalysis.editedContent
      : activeAnalysis.resultContent || null
    : null;

  const handleConfirmTransferToGenerator = () => {
    if (!activeAnalysis || !displayedContent) return;
    const prefillState: GeneratorPrefillState = {
      prefillInstructions: buildTransferText(activeAnalysis, displayedContent, transferScope),
      prefillExpedienteId: activeAnalysis.expedienteId ?? null,
      sourceAnalysisId: activeAnalysis.id,
    };
    setShowTransferModal(false);
    navigate('/ia-legal/generador-escritos', { state: prefillState });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileSearch size={24} style={{ color: 'hsl(var(--hsl-accent))' }} />
            <h1 style={{ fontSize: '1.65rem', margin: 0 }}>Análisis IA Jurídico</h1>
          </div>
          <p className="text-muted" style={{ marginTop: '0.35rem', fontSize: '0.92rem' }}>
            Informes jurídicos estructurados, persistentes y trazables sobre causas y documentos autorizados.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleStartNewAnalysis}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
        >
          <Plus size={16} /> Nuevo análisis
        </button>
      </div>

      {/* Provider unavailable banner */}
      {aiStatus && !aiStatus.available && (
        <div
          className="card"
          style={{
            padding: '0.9rem 1.1rem',
            borderColor: 'rgba(245, 158, 11, 0.4)',
            background: 'rgba(245, 158, 11, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <AlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <div style={{ fontSize: '0.88rem' }}>
            <strong>Análisis IA no disponible:</strong>{' '}
            {aiStatus.reason ||
              'El proveedor IA no está configurado en el backend. Puede revisar informes históricos y conservar su selección para reintentar.'}
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: 8,
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: 'hsl(var(--hsl-danger))',
            fontSize: '0.9rem',
          }}
        >
          {error}
        </div>
      )}

      {infoMessage && (
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: 8,
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            color: '#4ade80',
            fontSize: '0.9rem',
          }}
        >
          {infoMessage}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 310px',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        {/* Main Panel */}
        <div className="card" style={{ padding: '1.5rem' }}>
          {/* Stepper */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              marginBottom: '1.4rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {[
              { id: 1 as WizardStep, label: '1. Fuentes' },
              { id: 2 as WizardStep, label: '2. Tipo' },
              { id: 3 as WizardStep, label: '3. Instrucciones' },
              { id: 4 as WizardStep, label: '4. Confirmar' },
              { id: 5 as WizardStep, label: '5. Informe' },
            ].map((s) => (
              <span
                key={s.id}
                className="badge"
                style={{
                  padding: '0.35rem 0.7rem',
                  background:
                    step === s.id
                      ? 'hsl(var(--hsl-accent))'
                      : step > s.id
                        ? 'rgba(34, 197, 94, 0.18)'
                        : 'rgba(255,255,255,0.06)',
                  color:
                    step === s.id
                      ? '#0b1120'
                      : step > s.id
                        ? '#4ade80'
                        : 'hsl(var(--hsl-text-muted))',
                  fontWeight: step === s.id ? 700 : 500,
                }}
              >
                {s.label}
              </span>
            ))}
          </div>

          {/* PASO 1: SELECCIONAR CAUSA O DOCUMENTOS */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', marginBottom: '0.3rem' }}>
                  Paso 1 — Seleccionar causa y/o documentos autorizados
                </h2>
                <p className="text-muted" style={{ fontSize: '0.88rem' }}>
                  Puede analizar una causa completa, combinar causa + documentos AUTH-08, o analizar documentos seleccionados sin causa asociada.
                </p>
              </div>

              {/* Case selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, marginBottom: '0.45rem' }}>
                  Causa / Expediente (opcional si selecciona documentos)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', left: 10, top: 11, opacity: 0.6 }} />
                    <input
                      className="input-field"
                      style={{ paddingLeft: '2.1rem' }}
                      placeholder="Buscar por carátula o número de expediente..."
                      value={caseSearch}
                      onChange={(e) => setCaseSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') loadCases(caseSearch);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => loadCases(caseSearch)}
                  >
                    Buscar
                  </button>
                  {selectedCase && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setSelectedCase(null)}
                    >
                      Sin causa
                    </button>
                  )}
                </div>

                <div
                  style={{
                    maxHeight: 200,
                    overflowY: 'auto',
                    display: 'grid',
                    gap: '0.45rem',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    padding: '0.6rem',
                  }}
                >
                  {cases.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: '0.84rem', margin: 0 }}>
                      No se encontraron causas activas. Puede continuar seleccionando documentos o crear un expediente primero.
                    </p>
                  ) : (
                    cases.map((c) => {
                      const isSel = selectedCase?.id === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCase(isSel ? null : c)}
                          style={{
                            textAlign: 'left',
                            padding: '0.6rem 0.8rem',
                            borderRadius: 6,
                            border: isSel
                              ? '1px solid hsl(var(--hsl-accent))'
                              : '1px solid rgba(255,255,255,0.08)',
                            background: isSel
                              ? 'rgba(245, 158, 11, 0.12)'
                              : 'rgba(255,255,255,0.02)',
                            color: 'inherit',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.caratula}</div>
                            <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                              Exp. {c.numeroExpediente} · {c.juzgado} · {c.estado}
                            </div>
                          </div>
                          {isSel && <CheckCircle2 size={18} style={{ color: 'hsl(var(--hsl-accent))' }} />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Documents selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 600, marginBottom: '0.45rem' }}>
                  Documentos AUTH-08 autorizados ({selectedDocIds.length} seleccionados)
                </label>
                <div
                  style={{
                    maxHeight: 200,
                    overflowY: 'auto',
                    display: 'grid',
                    gap: '0.4rem',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    padding: '0.6rem',
                  }}
                >
                  {availableDocs.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: '0.84rem', margin: 0 }}>
                      No hay documentos activos disponibles para este filtro. Puede continuar solo con los datos estructurados de la causa.
                    </p>
                  ) : (
                    availableDocs.map((d) => {
                      const checked = selectedDocIds.includes(d.id);
                      return (
                        <label
                          key={d.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.65rem',
                            padding: '0.5rem 0.7rem',
                            borderRadius: 6,
                            background: checked
                              ? 'rgba(59, 130, 246, 0.12)'
                              : 'rgba(255,255,255,0.02)',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDocSelection(d.id)}
                          />
                          <FileText size={15} style={{ opacity: 0.75 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{d.title}</div>
                            <div className="text-muted" style={{ fontSize: '0.76rem' }}>
                              {d.category} · v{d.currentVersionNumber}
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Selected sources summary bar */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  fontSize: '0.84rem',
                }}
              >
                <strong>Fuentes a utilizar:</strong>{' '}
                {selectedCase
                  ? `Causa "${selectedCase.caratula}" (${selectedCase.numeroExpediente})`
                  : 'Sin causa asociada'}{' '}
                · {selectedDocIds.length} documento(s) seleccionado(s).
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canProceedFromStep1}
                  onClick={() => setStep(2)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  Continuar al tipo de análisis <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* PASO 2: ELEGIR TIPO DE ANÁLISIS */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', marginBottom: '0.3rem' }}>
                  Paso 2 — Elegir tipo de análisis jurídico
                </h2>
                <p className="text-muted" style={{ fontSize: '0.88rem' }}>
                  Cada enfoque estructura el informe con reglas estrictas de separación entre hechos registrados, alegados, documental e inferencias.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.9rem' }}>
                {ANALYSIS_TYPES_ORDER.map((typeKey) => {
                  const meta = ANALYSIS_TYPE_META[typeKey];
                  const selected = analysisType === typeKey;
                  return (
                    <button
                      key={typeKey}
                      type="button"
                      onClick={() => setAnalysisType(typeKey)}
                      style={{
                        textAlign: 'left',
                        padding: '1rem',
                        borderRadius: 10,
                        border: selected
                          ? '2px solid hsl(var(--hsl-accent))'
                          : '1px solid rgba(255,255,255,0.1)',
                        background: selected
                          ? 'rgba(245, 158, 11, 0.1)'
                          : 'rgba(255,255,255,0.02)',
                        color: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.96rem', marginBottom: '0.35rem' }}>
                        {meta.label}
                      </div>
                      <p className="text-muted" style={{ fontSize: '0.82rem', margin: '0 0 0.6rem' }}>
                        {meta.description}
                      </p>
                      <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', opacity: 0.85 }}>
                        {meta.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              {analysisType === 'PROCEDURAL_RISKS' && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 8,
                    background: 'rgba(59, 130, 246, 0.1)',
                    fontSize: '0.83rem',
                  }}
                >
                  <strong>Regla procesal:</strong> El sistema no calcula plazos legales automáticamente ni declara un plazo vencido sin datos explícitos y verificados.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>
                  <ChevronLeft size={16} /> Volver
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
                  Continuar a instrucciones <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: INSTRUCCIONES ADICIONALES */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', marginBottom: '0.3rem' }}>
                  Paso 3 — Instrucciones adicionales (opcional)
                </h2>
                <p className="text-muted" style={{ fontSize: '0.88rem' }}>
                  Indique aspectos prioritarios, hechos relevantes, preguntas concretas o qué documentos priorizar en el informe.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Título del informe (opcional)
                </label>
                <input
                  className="input-field"
                  placeholder={`Ej.: ${ANALYSIS_TYPE_META[analysisType].label}`}
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Instrucciones y preguntas del profesional
                </label>
                <textarea
                  className="input-field"
                  rows={5}
                  placeholder="Ej.: Priorizar las contradicciones entre el contrato acompañado y los últimos movimientos procesales. Indicar qué prueba falta producir."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  maxLength={4000}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="btn btn-outline" onClick={() => setStep(2)}>
                  <ChevronLeft size={16} /> Volver
                </button>
                <button type="button" className="btn btn-primary" onClick={goToStep4Preview}>
                  Verificar fuentes antes de ejecutar <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* PASO 4: CONFIRMAR FUENTES */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', marginBottom: '0.3rem' }}>
                  Paso 4 — Confirmación de fuentes verificadas
                </h2>
                <p className="text-muted" style={{ fontSize: '0.88rem' }}>
                  Revise exactamente qué información autorizada se enviará al análisis antes de ejecutarlo.
                </p>
              </div>

              {previewLoading ? (
                <p className="text-muted">Verificando fuentes autorizadas y extracción documental...</p>
              ) : sourcesPreview ? (
                <div style={{ display: 'grid', gap: '0.85rem', fontSize: '0.88rem' }}>
                  <div className="card" style={{ padding: '0.9rem', background: 'rgba(255,255,255,0.03)' }}>
                    <strong>Tipo seleccionado:</strong> {ANALYSIS_TYPE_META[analysisType].label}
                    <br />
                    <strong>Causa:</strong>{' '}
                    {sourcesPreview.expediente
                      ? `${sourcesPreview.expediente.caratula} (Exp. ${sourcesPreview.expediente.numeroExpediente}, ${sourcesPreview.expediente.partesCount ?? 0} partes)`
                      : 'Sin causa asociada (análisis documental puro)'}
                    <br />
                    <strong>Movimientos activos incluidos:</strong> {sourcesPreview.movimientos.length} (movimientos anulados excluidos automáticamente)
                    <br />
                    <strong>Vencimientos explícitos registrados:</strong> {sourcesPreview.vencimientos.length}
                    <br />
                    <strong>Notas internas autorizadas:</strong>{' '}
                    {sourcesPreview.hasAuthorizedNotes ? 'Incluidas' : 'Sin notas internas'}
                    <br />
                    <strong>Límite de contexto aplicable:</strong> {sourcesPreview.maxContextChars.toLocaleString('es-AR')} caracteres
                  </div>

                  {sourcesPreview.documents.length > 0 && (
                    <div className="card" style={{ padding: '0.9rem', background: 'rgba(255,255,255,0.03)' }}>
                      <strong style={{ display: 'block', marginBottom: '0.4rem' }}>
                        Documentos seleccionados ({sourcesPreview.documents.length}):
                      </strong>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                        {sourcesPreview.documents.map((doc) => (
                          <li key={doc.id}>
                            {doc.title} (v{doc.versionNumber}) —{' '}
                            {doc.textExtracted ? (
                              <span style={{ color: '#4ade80' }}>Texto extraído</span>
                            ) : (
                              <span style={{ color: '#f59e0b' }}>
                                Solo metadatos (contenido no extraíble localmente)
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {sourcesPreview.limitations.length > 0 && (
                    <div
                      style={{
                        padding: '0.85rem',
                        borderRadius: 8,
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                      }}
                    >
                      <strong style={{ display: 'block', marginBottom: '0.3rem' }}>
                        Limitaciones y fuentes no extraídas:
                      </strong>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.83rem' }}>
                        {sourcesPreview.limitations.map((lim, i) => (
                          <li key={i}>{lim}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>
                    Modificar fuentes
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setStep(3)}>
                    <ChevronLeft size={16} /> Instrucciones
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={generating || previewLoading || (aiStatus !== null && !aiStatus.available)}
                  onClick={handleGenerateAnalysis}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <Sparkles size={16} />
                  {generating ? 'Generando informe de análisis...' : 'Confirmar y generar informe'}
                </button>
              </div>
            </div>
          )}

          {/* PASO 5: INFORME ESTRUCTURADO PERSISTENTE */}
          {step === 5 && activeAnalysis && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.16)', color: 'hsl(var(--hsl-accent))' }}>
                      {ANALYSIS_TYPE_META[activeAnalysis.analysisType].label}
                    </span>
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      {activeAnalysis.status}
                    </span>
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                      {new Date(activeAnalysis.createdAt).toLocaleString('es-AR')}
                    </span>
                  </div>
                  <h2 style={{ fontSize: '1.3rem', margin: '0.5rem 0 0.2rem' }}>{activeAnalysis.title}</h2>
                  {activeAnalysis.sourceReferences?.expediente && (
                    <div className="text-muted" style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Scale size={14} />
                      {activeAnalysis.sourceReferences.expediente.caratula} · Exp.{' '}
                      {activeAnalysis.sourceReferences.expediente.numeroExpediente}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  {activeAnalysis.status === 'FAILED' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={generating}
                      onClick={() => handleRetryFailed(activeAnalysis.id)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <RefreshCw size={15} /> Reintentar análisis
                    </button>
                  )}

                  {activeAnalysis.status === 'COMPLETED' && displayedContent && !isEditing && (
                    <>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={handleBeginEdit}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <Edit3 size={15} /> Editar copia
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setShowTransferModal(true)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <Send size={15} /> Usar en Generador de Escritos
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => handleArchiveAnalysis(activeAnalysis.id)}
                    title="Archivar análisis"
                  >
                    <Archive size={15} />
                  </button>
                </div>
              </div>

              {/* Original vs Edited toggle */}
              {activeAnalysis.editedContent && !isEditing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
                  <button
                    type="button"
                    className={viewMode === 'EDITED' ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                    onClick={() => setViewMode('EDITED')}
                  >
                    Versión editada
                  </button>
                  <button
                    type="button"
                    className={viewMode === 'ORIGINAL' ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                    onClick={() => setViewMode('ORIGINAL')}
                  >
                    <RotateCcw size={13} /> Original generado por IA
                  </button>
                  <span className="text-muted">
                    El resultado original generado permanece preservado sin sobrescritura.
                  </span>
                </div>
              )}

              {/* Edit form (non-destructive) */}
              {isEditing ? (
                <div className="card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', display: 'grid', gap: '0.85rem' }}>
                  <div style={{ fontSize: '0.84rem', color: 'hsl(var(--hsl-accent))' }}>
                    Editando copia de trabajo (el resultado original generado por IA permanecerá intacto).
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.3rem' }}>Título</label>
                    <input className="input-field" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.3rem' }}>Resumen ejecutivo</label>
                    <textarea className="input-field" rows={4} value={editSummary} onChange={(e) => setEditSummary(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.3rem' }}>Desarrollo del análisis</label>
                    <textarea className="input-field" rows={7} value={editDevelopment} onChange={(e) => setEditDevelopment(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button type="button" className="btn btn-outline" onClick={() => setIsEditing(false)}>
                      Cancelar
                    </button>
                    <button type="button" className="btn btn-primary" disabled={savingEdit} onClick={handleSaveEdit}>
                      {savingEdit ? 'Guardando...' : 'Guardar copia editada'}
                    </button>
                  </div>
                </div>
              ) : displayedContent ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Disclaimer banner */}
                  <div
                    style={{
                      padding: '0.8rem 1rem',
                      borderRadius: 8,
                      background: 'rgba(245, 158, 11, 0.09)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      fontSize: '0.83rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.6rem',
                    }}
                  >
                    <ShieldAlert size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
                    <span>{displayedContent.professionalWarning}</span>
                  </div>

                  <section>
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>Resumen ejecutivo</h3>
                    <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {displayedContent.executiveSummary}
                    </p>
                  </section>

                  <section>
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>Desarrollo del análisis</h3>
                    <div style={{ lineHeight: 1.65, whiteSpace: 'pre-wrap', fontSize: '0.93rem' }}>
                      {displayedContent.analysisDevelopment}
                    </div>
                  </section>

                  {displayedContent.relevantFacts.length > 0 && (
                    <section>
                      <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>Hechos relevantes</h3>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.55 }}>
                        {displayedContent.relevantFacts.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {(displayedContent.allegedFacts.length > 0 || displayedContent.documentedFacts.length > 0) && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.9rem' }}>
                      {displayedContent.allegedFacts.length > 0 && (
                        <div className="card" style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.02)' }}>
                          <h4 style={{ fontSize: '0.9rem', marginTop: 0 }}>Hechos alegados</h4>
                          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.86rem' }}>
                            {displayedContent.allegedFacts.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {displayedContent.documentedFacts.length > 0 && (
                        <div className="card" style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.02)' }}>
                          <h4 style={{ fontSize: '0.9rem', marginTop: 0 }}>Hechos documentados</h4>
                          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.86rem' }}>
                            {displayedContent.documentedFacts.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {(displayedContent.disputedIssues.length > 0 || displayedContent.contradictions.length > 0) && (
                    <section>
                      <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>Cuestiones controvertidas y contradicciones</h3>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.55 }}>
                        {[...displayedContent.disputedIssues, ...displayedContent.contradictions].map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {(displayedContent.proceduralRisks.length > 0 || displayedContent.explicitDeadlines.length > 0) && (
                    <section>
                      <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>Riesgos procesales y puntos de atención</h3>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.55 }}>
                        {[...displayedContent.proceduralRisks, ...displayedContent.explicitDeadlines].map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {displayedContent.documentaryFindings.length > 0 && (
                    <section>
                      <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>Hallazgos sobre prueba documental</h3>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.55 }}>
                        {displayedContent.documentaryFindings.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {displayedContent.missingInformation.length > 0 && (
                    <section
                      style={{
                        padding: '0.9rem',
                        borderRadius: 8,
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                      }}
                    >
                      <h3 style={{ fontSize: '0.96rem', margin: '0 0 0.35rem' }}>Información faltante o pendiente</h3>
                      <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.88rem' }}>
                        {displayedContent.missingInformation.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {/* Fotografía verificable de fuentes utilizadas */}
                  {activeAnalysis.sourceReferences && (
                    <section
                      className="card"
                      style={{ padding: '0.95rem', background: 'rgba(255,255,255,0.03)', fontSize: '0.84rem' }}
                    >
                      <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem' }}>
                        Fuentes verificadas utilizadas (fotografía histórica)
                      </h3>
                      <div>
                        <strong>Movimientos procesales incluidos:</strong>{' '}
                        {activeAnalysis.sourceReferences.movimientos.length}
                      </div>
                      <div>
                        <strong>Documentos incluidos:</strong>{' '}
                        {activeAnalysis.sourceReferences.documents.length > 0
                          ? activeAnalysis.sourceReferences.documents
                              .map(
                                (d) =>
                                  `${d.title} (v${d.versionNumber}, ${d.textExtracted ? 'texto extraído' : 'solo metadatos'})`,
                              )
                              .join(' · ')
                          : 'Ninguno'}
                      </div>
                      {displayedContent.limitations.length > 0 && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <strong>Limitaciones del análisis:</strong>
                          <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.15rem' }}>
                            {displayedContent.limitations.map((lim, idx) => (
                              <li key={idx}>{lim}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </section>
                  )}
                </div>
              ) : (
                <div style={{ padding: '1rem', borderRadius: 8, background: 'rgba(239, 68, 68, 0.08)' }}>
                  Este análisis se encuentra en estado <strong>{activeAnalysis.status}</strong> y no contiene resultado generado. Puede reintentarlo con el botón superior.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Historial lateral */}
        <aside className="card" style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
              <History size={17} style={{ color: 'hsl(var(--hsl-accent))' }} />
              <span>Historial de análisis</span>
            </div>
          </div>

          {selectedCase && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filterBySelectedCase}
                onChange={(e) => setFilterBySelectedCase(e.target.checked)}
              />
              Solo causa seleccionada
            </label>
          )}

          {historyLoading ? (
            <p className="text-muted" style={{ fontSize: '0.83rem', margin: 0 }}>
              Cargando historial...
            </p>
          ) : historyItems.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.83rem', margin: 0 }}>
              Todavía no hay informes guardados.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 560, overflowY: 'auto' }}>
              {historyItems.map((item) => {
                const isSelected = activeAnalysis?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenAnalysis(item.id)}
                    style={{
                      textAlign: 'left',
                      padding: '0.65rem 0.75rem',
                      borderRadius: 8,
                      border: isSelected
                        ? '1px solid hsl(var(--hsl-accent))'
                        : '1px solid rgba(255,255,255,0.08)',
                      background: isSelected
                        ? 'rgba(245, 158, 11, 0.12)'
                        : 'rgba(255,255,255,0.02)',
                      color: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                      {item.title}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                      {ANALYSIS_TYPE_META[item.analysisType].shortLabel} · {item.status}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                      {new Date(item.createdAt).toLocaleDateString('es-AR')}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {/* Modal de confirmación explícita para transferir a AUTH-09 */}
      {showTransferModal && activeAnalysis && displayedContent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 520, padding: '1.5rem', display: 'grid', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
              Usar análisis en Generador de Escritos (AUTH-09)
            </h3>
            <p className="text-muted" style={{ margin: 0, fontSize: '0.88rem' }}>
              Esta acción precargará el contenido seleccionado como instrucciones en el Generador de Escritos manteniendo la causa asociada. No crea escritos automáticamente, no sobrescribe versiones ni aprueba borradores.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Seleccione qué contenido transferir
              </label>
              <select
                className="input-field"
                value={transferScope}
                onChange={(e) => setTransferScope(e.target.value as TransferScope)}
              >
                <option value="FULL">Informe completo estructurado</option>
                <option value="SUMMARY">Solo resumen ejecutivo</option>
                <option value="FACTS">Hechos relevantes y documentados</option>
                <option value="CONTROVERSIES">Cuestiones controvertidas y contradicciones</option>
                <option value="RISKS">Riesgos procesales e información faltante</option>
              </select>
            </div>

            <div style={{ fontSize: '0.82rem', color: 'hsl(var(--hsl-text-muted))' }}>
              Causa que se mantendrá seleccionada:{' '}
              <strong>
                {activeAnalysis.sourceReferences?.expediente?.caratula || 'Ninguna (análisis sin causa)'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowTransferModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmTransferToGenerator}
              >
                Confirmar y abrir Generador
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

