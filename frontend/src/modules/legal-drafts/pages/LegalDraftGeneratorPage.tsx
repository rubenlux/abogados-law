import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Scale,
  FileSignature,
  Search,
  FileText,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  Eye,
  Paperclip,
  PenTool,
} from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import { LegalRichEditor } from '../components/LegalRichEditor';
import type { DocumentItem, PaginatedDocumentsResponse } from '../../documents/types';
import type {
  AiProviderStatus,
  LegalCatalogItem,
  LegalCatalogResponse,
  LegalDraftCategory,
  LegalDraftItem,
  LegalTemplateItem,
  PaginatedResponse,
  RecentCaseItem,
} from '../types';
import {
  DRAFT_CATEGORY_LABELS,
  DRAFT_DOCUMENT_TYPE_LABELS,
} from '../types';

const EXAMPLE_INSTRUCTIONS = [
  'Redactar una demanda por daños y perjuicios con base en los hechos y prueba verificados.',
  'Contestar la demanda negando los hechos que no están reconocidos y ofreciendo prueba.',
  'Solicitar una medida cautelar urgente fundamentando verosimilitud del derecho y peligro en la demora.',
  'Preparar una expresión de agravios crítica y razonada respecto de la resolución indicada.',
  'Redactar un contrato de locación de inmueble por 24 meses con cláusulas habituales.',
];

import type { GeneratorPrefillState } from '../../ia-legal/types';

export const LegalDraftGeneratorPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as GeneratorPrefillState | null) || null;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [error, setError] = useState<string | null>(null);
  const [prefillBanner, setPrefillBanner] = useState<boolean>(
    Boolean(prefill?.prefillInstructions),
  );

  // Backend data
  const [catalog, setCatalog] = useState<LegalCatalogResponse>({
    judicial: [],
    contracts: [],
  });
  const [aiStatus, setAiStatus] = useState<AiProviderStatus | null>(null);
  const [recentCases, setRecentCases] = useState<RecentCaseItem[]>([]);
  const [hasCasesWithMovements, setHasCasesWithMovements] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [loadingCases, setLoadingCases] = useState(false);

  const [templates, setTemplates] = useState<LegalTemplateItem[]>([]);
  const [previewTemplate, setPreviewTemplate] =
    useState<LegalTemplateItem | null>(null);
  const [availableDocs, setAvailableDocs] = useState<DocumentItem[]>([]);

  // Wizard selections
  const [selectedCategory, setSelectedCategory] =
    useState<LegalDraftCategory>('ESCRITO_JUDICIAL');
  const [selectedType, setSelectedType] = useState<LegalCatalogItem | null>(
    null,
  );
  const [selectedCase, setSelectedCase] = useState<RecentCaseItem | null>(null);
  const [selectedTemplate, setSelectedTemplate] =
    useState<LegalTemplateItem | null>(null);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState(
    prefill?.prefillInstructions || '',
  );
  const [selectedRefDocIds, setSelectedRefDocIds] = useState<string[]>([]);

  // Si viene pre-seleccionada una causa desde Asistente IA (AUTH-10), precargarla sin crear nada automáticamente
  useEffect(() => {
    if (!prefill?.prefillExpedienteId) return;
    let active = true;
    const preselectCase = async () => {
      try {
        const res = (await apiClient.legalDrafts.getRecentCases()) as {
          data: RecentCaseItem[];
        };
        if (!active) return;
        const found = (res?.data || []).find(
          (c) => c.id === prefill.prefillExpedienteId,
        );
        if (found) setSelectedCase(found);
      } catch {
        // Non-blocking
      }
    };
    preselectCase();
    return () => {
      active = false;
    };
  }, [prefill?.prefillExpedienteId]);

  const [generating, setGenerating] = useState(false);

  // Initial load: catalog + AI status
  useEffect(() => {
    let active = true;
    const loadInit = async () => {
      try {
        const [catRes, stRes] = await Promise.all([
          apiClient.legalDrafts.getCatalog(),
          apiClient.legalDrafts.getAiStatus(),
        ]);
        if (!active) return;
        const cat = catRes as LegalCatalogResponse;
        setCatalog(cat);
        setAiStatus(stRes as AiProviderStatus);
        if (cat.judicial.length > 0) {
          setSelectedType((prev) => prev || cat.judicial[0]);
        }
      } catch (err: unknown) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo cargar el catálogo del generador',
        );
      }
    };
    loadInit();
    return () => {
      active = false;
    };
  }, []);

  // Load cases for Step 2
  const loadCases = useCallback(async (query?: string) => {
    setLoadingCases(true);
    try {
      const res = (await apiClient.legalDrafts.getRecentCases(query)) as {
        data: RecentCaseItem[];
        hasCasesWithMovements: boolean;
      };
      setRecentCases(Array.isArray(res?.data) ? res.data : []);
      setHasCasesWithMovements(Boolean(res?.hasCasesWithMovements));
    } catch {
      setRecentCases([]);
    } finally {
      setLoadingCases(false);
    }
  }, []);

  useEffect(() => {
    if (step === 2) {
      loadCases(caseSearch);
    }
  }, [step, caseSearch, loadCases]);

  // Load compatible templates for Step 3
  useEffect(() => {
    if (step !== 3 || !selectedType) return;
    let active = true;
    const loadTpls = async () => {
      try {
        const res = (await apiClient.legalTemplates.findAll({
          documentType: selectedType.documentType,
          page: 1,
          limit: 50,
        })) as PaginatedResponse<LegalTemplateItem>;
        if (!active) return;
        setTemplates(Array.isArray(res?.data) ? res.data : []);
      } catch {
        if (!active) return;
        setTemplates([]);
      }
    };
    loadTpls();
    return () => {
      active = false;
    };
  }, [step, selectedType]);

  // Load authorized AUTH-08 reference documents for Step 4
  useEffect(() => {
    if (step !== 4) return;
    let active = true;
    const loadDocs = async () => {
      try {
        const res = (await apiClient.documents.findAll({
          expedienteId: selectedCase?.id || undefined,
          status: 'ACTIVE',
          page: 1,
          limit: 30,
        })) as PaginatedDocumentsResponse;
        if (!active) return;
        setAvailableDocs(Array.isArray(res?.data) ? res.data : []);
      } catch {
        if (!active) return;
        setAvailableDocs([]);
      }
    };
    loadDocs();
    return () => {
      active = false;
    };
  }, [step, selectedCase]);

  const toggleRefDoc = (docId: string) => {
    setSelectedRefDocIds((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : prev.length < 10
          ? [...prev, docId]
          : prev,
    );
  };

  const handleGenerateWithAi = async () => {
    if (!selectedType || generating) return;
    if (!instructions.trim()) {
      setError('Describa qué necesita redactar antes de confirmar.');
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const created = (await apiClient.legalDrafts.generateWithAi({
        category: selectedType.category,
        documentType: selectedType.documentType,
        ...(selectedCase ? { expedienteId: selectedCase.id } : {}),
        ...(selectedTemplate ? { sourceTemplateId: selectedTemplate.id } : {}),
        ...(title.trim() ? { title: title.trim() } : {}),
        instructions: instructions.trim(),
        ...(selectedRefDocIds.length > 0
          ? { referenceDocumentIds: selectedRefDocIds }
          : {}),
      })) as LegalDraftItem;

      // Paso 5: abrir el documento generado directamente en el espacio de trabajo editable
      navigate(`/escritos/${created.id}`);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al generar el escrito asistido por IA',
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleManualFallback = async () => {
    if (!selectedType || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const created = (await apiClient.legalDrafts.create({
        category: selectedType.category,
        documentType: selectedType.documentType,
        ...(selectedCase ? { expedienteId: selectedCase.id } : {}),
        ...(selectedTemplate ? { sourceTemplateId: selectedTemplate.id } : {}),
        title:
          title.trim() ||
          `${selectedType.label}${selectedCase ? ` — ${selectedCase.numeroExpediente}` : ''}`,
      })) as LegalDraftItem;
      navigate(`/escritos/${created.id}`);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo crear el borrador manual',
      );
    } finally {
      setGenerating(false);
    }
  };

  const currentItems =
    selectedCategory === 'ESCRITO_JUDICIAL'
      ? catalog.judicial
      : catalog.contracts;

  const stepLabels = [
    { num: 1, label: '1. Tipo de escrito' },
    { num: 2, label: '2. Causa' },
    { num: 3, label: '3. Plantilla' },
    { num: 4, label: '4. Instrucciones' },
    { num: 5, label: '5. Escrito' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
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
          <h1
            style={{
              margin: 0,
              fontSize: '1.7rem',
              fontFamily: 'var(--font-heading)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            <Sparkles size={24} color="hsl(var(--hsl-primary))" />
            Generador de Escritos (IA Legal)
          </h1>
          <p className="text-muted" style={{ margin: '0.2rem 0 0', fontSize: '0.9rem' }}>
            Asistente jurídico guiado en 5 pasos. Todo resultado es un borrador editable que requiere control profesional.
          </p>
        </div>

        <Link to="/escritos" className="btn btn-outline">
          <PenTool size={15} /> Ver Escritos Guardados
        </Link>
      </div>

      {/* Stepper */}
      <div
        className="card"
        style={{
          padding: '0.85rem 1.15rem',
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {stepLabels.map((s) => {
          const isCurrent = step === s.num;
          const isDone = step > s.num;
          return (
            <button
              key={s.num}
              type="button"
              disabled={s.num === 5 || (s.num > 1 && !selectedType)}
              onClick={() => {
                if (s.num <= 4) setStep(s.num as 1 | 2 | 3 | 4);
              }}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '999px',
                border: '1px solid hsl(var(--hsl-border))',
                background: isCurrent
                  ? 'hsl(var(--hsl-primary))'
                  : isDone
                    ? 'rgba(34, 197, 94, 0.14)'
                    : 'transparent',
                color: isCurrent ? '#fff' : 'hsl(var(--hsl-text-main))',
                fontWeight: isCurrent ? 600 : 500,
                fontSize: '0.82rem',
                cursor: s.num === 5 ? 'default' : 'pointer',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Transfer banner from AUTH-10 Asistente IA */}
      {prefillBanner && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            fontSize: '0.85rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <span>
            <strong>Contenido transferido desde Asistente IA:</strong> las instrucciones (y causa si correspondía) fueron precargadas para su revisión. No se creó ni sobrescribió ningún escrito automáticamente.
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
            onClick={() => setPrefillBanner(false)}
          >
            Entendido
          </button>
        </div>
      )}

      {/* AI Provider availability warning */}
      {aiStatus && !aiStatus.available && (
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(234, 179, 8, 0.12)',
            border: '1px solid rgba(234, 179, 8, 0.35)',
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <AlertCircle size={18} />
          <span>
            <strong>IA no configurada en este entorno:</strong>{' '}
            {aiStatus.reason ||
              'Puede completar el flujo y abrir el borrador en el editor jurídico manual.'}
          </span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '0.8rem 1rem',
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

      {/* PASO 1 — TIPO DE ESCRITO */}
      {step === 1 && (
        <section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
            ¿Qué documento querés generar?
          </h2>

          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn ${selectedCategory === 'ESCRITO_JUDICIAL' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => {
                setSelectedCategory('ESCRITO_JUDICIAL');
                if (catalog.judicial[0]) setSelectedType(catalog.judicial[0]);
                setSelectedTemplate(null);
              }}
            >
              <Scale size={16} /> Escritos judiciales ({catalog.judicial.length})
            </button>
            <button
              type="button"
              className={`btn ${selectedCategory === 'CONTRATO' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => {
                setSelectedCategory('CONTRATO');
                if (catalog.contracts[0]) setSelectedType(catalog.contracts[0]);
                setSelectedTemplate(null);
              }}
            >
              <FileSignature size={16} /> Contratos ({catalog.contracts.length})
            </button>
          </div>

          {/* Document Types Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '0.85rem',
            }}
          >
            {currentItems.map((item) => {
              const isSelected = selectedType?.documentType === item.documentType;
              return (
                <button
                  key={item.documentType}
                  type="button"
                  onClick={() => {
                    setSelectedType(item);
                    setSelectedTemplate(null);
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: isSelected
                      ? '2px solid hsl(var(--hsl-primary))'
                      : '1px solid hsl(var(--hsl-border))',
                    background: isSelected
                      ? 'rgba(59, 130, 246, 0.08)'
                      : 'hsl(var(--hsl-surface))',
                    cursor: 'pointer',
                    color: 'inherit',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.96rem', marginBottom: '0.35rem' }}>
                    {item.label}
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.8rem', lineHeight: 1.45 }}>
                    {item.baseInstructions}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedType}
              onClick={() => setStep(2)}
            >
              Siguiente: Causa <ChevronRight size={16} />
            </button>
          </div>
        </section>
      )}

      {/* PASO 2 — CAUSA */}
      {step === 2 && (
        <section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>¿Para qué causa?</h2>
            <p className="text-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
              Con una causa, la IA usa sus partes, movimientos y notas.
              {selectedCategory === 'CONTRATO' &&
                ' Para contratos, seleccionar una causa es opcional.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240, display: 'flex', gap: '0.4rem' }}>
              <input
                className="input-field"
                placeholder="Buscar por carátula, número de expediente, fuero o tribunal..."
                value={caseSearch}
                onChange={(e) => setCaseSearch(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => loadCases(caseSearch)}
              >
                <Search size={16} />
              </button>
            </div>
            <button
              type="button"
              className={`btn ${!selectedCase ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => {
                setSelectedCase(null);
                setStep(3);
              }}
            >
              Continuar sin causa
            </button>
          </div>

          <div>
            <h3 style={{ margin: '0 0 0.6rem', fontSize: '0.96rem' }}>
              Últimas que abriste
            </h3>

            {!loadingCases && !hasCasesWithMovements && (
              <div
                style={{
                  padding: '0.85rem 1rem',
                  background: 'hsl(var(--hsl-surface-muted))',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.86rem',
                  marginBottom: '0.75rem',
                }}
              >
                Todavía no hay causas con movimientos: buscá una por carátula o número, o seguí sin causa.
              </div>
            )}

            {loadingCases ? (
              <p className="text-muted">Buscando causas autorizadas...</p>
            ) : recentCases.length === 0 ? (
              <p className="text-muted" style={{ margin: 0 }}>
                No se encontraron causas que coincidan con la búsqueda.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {recentCases.map((c) => {
                  const isSel = selectedCase?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCase(c)}
                      style={{
                        textAlign: 'left',
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        border: isSel
                          ? '2px solid hsl(var(--hsl-primary))'
                          : '1px solid hsl(var(--hsl-border))',
                        background: isSel
                          ? 'rgba(59, 130, 246, 0.08)'
                          : 'transparent',
                        cursor: 'pointer',
                        color: 'inherit',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.75rem',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{c.caratula}</div>
                        <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.15rem' }}>
                          Expte. {c.numeroExpediente} · {c.juzgado}
                          {c.fuero ? ` · Fuero ${c.fuero}` : ''} · {c.jurisdiccion}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                        <span className="badge">{c.partesCount} partes</span>
                        <span className="badge badge-blue">
                          {c.movimientosCount} mov.
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
              <ChevronLeft size={16} /> Volver
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
              Siguiente: Plantilla <ChevronRight size={16} />
            </button>
          </div>
        </section>
      )}

      {/* PASO 3 — PLANTILLA */}
      {step === 3 && (
        <section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Elegí una plantilla</h2>
              <p className="text-muted" style={{ margin: '0.2rem 0 0', fontSize: '0.88rem' }}>
                Plantillas compatibles con{' '}
                <strong>{selectedType?.label}</strong>. Las plantillas de sistema son modelos editables orientativos.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link to="/plantillas" className="btn btn-outline">
                <FileText size={15} /> Crear / Gestionar Plantillas
              </Link>
              <button
                type="button"
                className={`btn ${!selectedTemplate ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => {
                  setSelectedTemplate(null);
                  setStep(4);
                }}
              >
                Continuar sin plantilla
              </button>
            </div>
          </div>

          {templates.length === 0 ? (
            <div
              style={{
                padding: '1rem',
                background: 'hsl(var(--hsl-surface-muted))',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.88rem',
              }}
            >
              No hay plantillas específicas para este tipo documental todavía. Podés crear una en Plantillas o continuar sin plantilla.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: '0.85rem',
              }}
            >
              {templates.map((tpl) => {
                const isSel = selectedTemplate?.id === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: isSel
                        ? '2px solid hsl(var(--hsl-primary))'
                        : '1px solid hsl(var(--hsl-border))',
                      background: isSel
                        ? 'rgba(59, 130, 246, 0.08)'
                        : 'hsl(var(--hsl-surface))',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
                      <span
                        className={`badge ${tpl.isSystemTemplate ? 'badge-yellow' : 'badge-green'}`}
                      >
                        {tpl.isSystemTemplate ? 'Sistema (Orientativa)' : 'Estudio'}
                      </span>
                      <span className="badge">v{tpl.versionNumber || 1}</span>
                    </div>
                    <strong style={{ fontSize: '0.96rem' }}>{tpl.name}</strong>
                    <p className="text-muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                      {tpl.description || 'Modelo editable.'}
                    </p>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {tpl.jurisdiction ? `Jurisd.: ${tpl.jurisdiction} · ` : ''}
                      Actualizada: {new Date(tpl.updatedAt).toLocaleDateString()} ·{' '}
                      {tpl.createdBy?.fullName || (tpl.isSystemTemplate ? 'Sistema' : 'Estudio')}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: 'auto', paddingTop: '0.4rem' }}>
                      <button
                        type="button"
                        className={`btn ${isSel ? 'btn-primary' : 'btn-outline'}`}
                        style={{ flex: 1, fontSize: '0.8rem' }}
                        onClick={() => setSelectedTemplate(tpl)}
                      >
                        {isSel ? 'Seleccionada' : 'Seleccionar'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => setPreviewTemplate(tpl)}
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {previewTemplate && (
            <div style={{ borderTop: '1px solid hsl(var(--hsl-border))', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong>Vista previa: {previewTemplate.name}</strong>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setPreviewTemplate(null)}
                >
                  Cerrar
                </button>
              </div>
              <LegalRichEditor
                initialContent={previewTemplate.content}
                editorKey={`gen-prev-${previewTemplate.id}`}
                readOnly
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>
              <ChevronLeft size={16} /> Volver
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setStep(4)}>
              Siguiente: Instrucciones <ChevronRight size={16} />
            </button>
          </div>
        </section>
      )}

      {/* PASO 4 — INSTRUCCIONES Y CONFIRMACIÓN */}
      {step === 4 && (
        <section className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
            ¿Qué necesitás que redacte?
          </h2>

          <div className="form-group">
            <label className="label">Título del documento (Opcional)</label>
            <input
              className="input-field"
              placeholder={`Ej: ${selectedType?.label || 'Escrito jurídico'}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="label">Instrucciones específicas del profesional *</label>
            <textarea
              rows={5}
              className="input-field"
              placeholder="Explicá el objetivo concreto del escrito, puntos esenciales a incluir y alcance deseado..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              {EXAMPLE_INSTRUCTIONS.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="btn btn-ghost"
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.55rem',
                    border: '1px solid hsl(var(--hsl-border))',
                  }}
                  onClick={() => setInstructions(ex)}
                >
                  {ex.slice(0, 48)}...
                </button>
              ))}
            </div>
          </div>

          {/* Reference Documents (AUTH-08) */}
          <div>
            <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
              <Paperclip size={14} /> Documentos de referencia autorizados (AUTH-08, opcional — máx. 10)
            </label>
            {availableDocs.length === 0 ? (
              <p className="text-muted" style={{ margin: 0, fontSize: '0.82rem' }}>
                No hay documentos activos disponibles en este contexto.
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                {availableDocs.map((doc) => {
                  const checked = selectedRefDocIds.includes(doc.id);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => toggleRefDoc(doc.id)}
                      className={`btn ${checked ? 'btn-primary' : 'btn-outline'}`}
                      style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
                    >
                      {checked && <CheckCircle2 size={13} />} {doc.title} (v
                      {doc.currentVersionNumber})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pre-generation Context Summary */}
          <div
            style={{
              padding: '1rem 1.25rem',
              background: 'hsl(var(--hsl-surface-muted))',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.86rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            <strong>Resumen de contexto a utilizar</strong>
            <div>
              • <strong>Categoría / Tipo:</strong>{' '}
              {selectedType
                ? `${DRAFT_CATEGORY_LABELS[selectedType.category]} — ${DRAFT_DOCUMENT_TYPE_LABELS[selectedType.documentType]}`
                : '—'}
            </div>
            <div>
              • <strong>Causa:</strong>{' '}
              {selectedCase
                ? `${selectedCase.numeroExpediente} — ${selectedCase.caratula} (${selectedCase.partesCount} partes, ${selectedCase.movimientosCount} mov.)`
                : 'Sin causa asociada'}
            </div>
            <div>
              • <strong>Plantilla:</strong>{' '}
              {selectedTemplate
                ? `${selectedTemplate.name} (v${selectedTemplate.versionNumber || 1})`
                : 'Sin plantilla'}
            </div>
            <div>
              • <strong>Documentos de referencia AUTH-08:</strong>{' '}
              {selectedRefDocIds.length} seleccionado(s)
            </div>
            <div>
              • <strong>Instrucciones:</strong>{' '}
              {instructions.trim()
                ? `${instructions.trim().slice(0, 140)}${instructions.trim().length > 140 ? '...' : ''}`
                : 'Pendiente de completar'}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setStep(3)}>
              <ChevronLeft size={16} /> Volver
            </button>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={generating}
                onClick={handleManualFallback}
              >
                <PenTool size={15} /> Crear Borrador Manual
              </button>

              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  generating ||
                  !instructions.trim() ||
                  (aiStatus !== null && !aiStatus.available)
                }
                onClick={handleGenerateWithAi}
              >
                <Sparkles size={16} />
                {generating
                  ? 'Generando borrador con IA...'
                  : 'Confirmar y Generar Borrador IA'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

