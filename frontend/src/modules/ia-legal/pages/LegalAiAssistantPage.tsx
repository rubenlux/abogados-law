import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Plus,
  Send,
  Scale,
  Archive,
  AlertCircle,
  Paperclip,
  CheckCircle2,
  Sparkles,
  X,
  Edit3,
  BookOpen,
  FileText,
} from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import type { DocumentItem, PaginatedDocumentsResponse } from '../../documents/types';
import type { PaginatedResponse, RecentCaseItem } from '../../legal-drafts/types';
import type {
  AssistantStatus,
  GeneratorPrefillState,
  LegalAiConversationItem,
  LegalAiMessageItem,
  SendAssistantMessageResponse,
} from '../types';

export const LegalAiAssistantPage: React.FC = () => {
  const navigate = useNavigate();

  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [conversations, setConversations] = useState<LegalAiConversationItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeConv, setActiveConv] = useState<LegalAiConversationItem | null>(null);
  const [messages, setMessages] = useState<LegalAiMessageItem[]>([]);
  const [loadingConv, setLoadingConv] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Case selector modal/panel
  const [showCasePicker, setShowCasePicker] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [cases, setCases] = useState<RecentCaseItem[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);

  // Title edit
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  // Composer & authorized AUTH-08 documents
  const [queryText, setQueryText] = useState('');
  const [pendingClientMsgId, setPendingClientMsgId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [availableDocs, setAvailableDocs] = useState<DocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [showDocsPicker, setShowDocsPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = useCallback(async (selectId?: string) => {
    setLoadingList(true);
    try {
      const res = (await apiClient.legalAi.listConversations({
        status: 'ACTIVE',
        page: 1,
        limit: 50,
      })) as PaginatedResponse<LegalAiConversationItem>;
      const list = Array.isArray(res?.data) ? res.data : [];
      setConversations(list);
      if (selectId) {
        const target = list.find((c) => c.id === selectId);
        if (target) {
          setActiveConv(target);
        }
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'No autorizado o error al cargar conversaciones',
      );
    } finally {
      setLoadingList(false);
    }
  }, []);

  const openConversation = useCallback(async (id: string) => {
    setLoadingConv(true);
    setError(null);
    setEditingTitle(false);
    setSelectedDocIds([]);
    try {
      const full = (await apiClient.legalAi.getConversation(
        id,
      )) as LegalAiConversationItem;
      setActiveConv(full);
      setTitleInput(full.title);
      setMessages(Array.isArray(full.messages) ? full.messages : []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'No se pudo abrir la conversación',
      );
    } finally {
      setLoadingConv(false);
    }
  }, []);

  // Init: status + conversations
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const [stRes, listRes] = await Promise.all([
          apiClient.legalAi.getStatus(),
          apiClient.legalAi.listConversations({ status: 'ACTIVE', page: 1, limit: 50 }),
        ]);
        if (!mounted) return;
        setStatus(stRes as AssistantStatus);
        const list = Array.isArray((listRes as PaginatedResponse<LegalAiConversationItem>)?.data)
          ? (listRes as PaginatedResponse<LegalAiConversationItem>).data
          : [];
        setConversations(list);
        if (list.length > 0) {
          void openConversation(list[0].id);
        }
      } catch (err: unknown) {
        if (!mounted) return;
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo inicializar el Asistente IA',
        );
      } finally {
        if (mounted) setLoadingList(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [openConversation]);

  // Load recent cases when picker opens or search changes
  useEffect(() => {
    if (!showCasePicker) return;
    let active = true;
    const fetchCases = async () => {
      setLoadingCases(true);
      try {
        const res = (await apiClient.legalDrafts.getRecentCases(caseSearch)) as {
          data: RecentCaseItem[];
        };
        if (!active) return;
        setCases(Array.isArray(res?.data) ? res.data : []);
      } catch {
        if (!active) return;
        setCases([]);
      } finally {
        if (active) setLoadingCases(false);
      }
    };
    fetchCases();
    return () => {
      active = false;
    };
  }, [showCasePicker, caseSearch]);

  // Load authorized AUTH-08 documents for active case or org when picker opens
  useEffect(() => {
    if (!showDocsPicker) return;
    let active = true;
    const fetchDocs = async () => {
      try {
        const res = (await apiClient.documents.findAll({
          expedienteId: activeConv?.expedienteId || undefined,
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
    fetchDocs();
    return () => {
      active = false;
    };
  }, [showDocsPicker, activeConv?.expedienteId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleNewConversation = async (expedienteId?: string) => {
    setError(null);
    try {
      const created = (await apiClient.legalAi.createConversation(
        expedienteId ? { expedienteId } : {},
      )) as LegalAiConversationItem;
      await loadConversations(created.id);
      setActiveConv(created);
      setTitleInput(created.title);
      setMessages([]);
      setSelectedDocIds([]);
      setShowCasePicker(false);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error al crear la conversación',
      );
    }
  };

  const handleChangeCase = async (expedienteId: string | null) => {
    if (!activeConv) {
      if (expedienteId) {
        await handleNewConversation(expedienteId);
      }
      return;
    }
    setError(null);
    try {
      const updated = (await apiClient.legalAi.updateConversation(activeConv.id, {
        expedienteId,
      })) as LegalAiConversationItem;
      setActiveConv(updated);
      setSelectedDocIds([]);
      setShowCasePicker(false);
      await loadConversations();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'No se pudo actualizar la causa activa',
      );
    }
  };

  const handleSaveTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || !titleInput.trim()) return;
    setError(null);
    try {
      const updated = (await apiClient.legalAi.updateConversation(activeConv.id, {
        title: titleInput.trim(),
      })) as LegalAiConversationItem;
      setActiveConv(updated);
      setEditingTitle(false);
      await loadConversations();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error al renombrar la conversación',
      );
    }
  };

  const handleArchiveConversation = async (convId: string) => {
    if (!window.confirm('¿Desea archivar esta conversación jurídica?')) return;
    setError(null);
    try {
      await apiClient.legalAi.archiveConversation(convId);
      if (activeConv?.id === convId) {
        setActiveConv(null);
        setMessages([]);
      }
      await loadConversations();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'No se pudo archivar la conversación',
      );
    }
  };

  const toggleDoc = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : prev.length < 8
          ? [...prev, docId]
          : prev,
    );
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || !queryText.trim()) return;

    setSending(true);
    setError(null);

    try {
      let targetConv = activeConv;
      if (!targetConv) {
        targetConv = (await apiClient.legalAi.createConversation(
          {},
        )) as LegalAiConversationItem;
        setActiveConv(targetConv);
        setTitleInput(targetConv.title);
      }

      const clientMessageId =
        pendingClientMsgId ||
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `msg-${Date.now()}`);
      setPendingClientMsgId(clientMessageId);

      const res = (await apiClient.legalAi.sendMessage(targetConv.id, {
        content: queryText.trim(),
        ...(selectedDocIds.length > 0 ? { documentIds: selectedDocIds } : {}),
        clientMessageId,
      })) as SendAssistantMessageResponse;

      setMessages((prev) => {
        const exists = prev.some((m) => m.id === res.assistantMessage.id);
        if (exists) return prev;
        return [...prev, res.userMessage, res.assistantMessage];
      });
      setQueryText('');
      setPendingClientMsgId(null);
      await loadConversations();
    } catch (err: unknown) {
      // Error recuperable: conserva queryText y pendingClientMsgId para reintento seguro sin duplicar
      setError(
        err instanceof Error
          ? err.message
          : 'Error al consultar al Asistente IA. Su mensaje fue conservado para reintentar.',
      );
    } finally {
      setSending(false);
    }
  };

  const handleUseInGenerator = (msg: LegalAiMessageItem) => {
    const state: GeneratorPrefillState = {
      prefillInstructions: msg.content,
      prefillExpedienteId: activeConv?.expedienteId ?? null,
      sourceConversationId: activeConv?.id,
      sourceMessageId: msg.id,
    };
    navigate('/ia-legal/generador-escritos', { state });
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(240px, 290px) minmax(0, 1fr)',
        gap: '1rem',
        minHeight: 'calc(100vh - 110px)',
      }}
    >
      {/* Left Sidebar: Conversations */}
      <aside
        className="card"
        style={{
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxHeight: 'calc(100vh - 110px)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Bot size={18} color="hsl(var(--hsl-primary))" />
            Conversaciones
          </h2>
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: '0.76rem', padding: '0.35rem 0.6rem' }}
            onClick={() => handleNewConversation()}
          >
            <Plus size={14} /> Nueva
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {loadingList ? (
            <p className="text-muted" style={{ fontSize: '0.84rem' }}>
              Cargando conversaciones...
            </p>
          ) : conversations.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.84rem' }}>
              No hay conversaciones activas. Creá una nueva para comenzar.
            </p>
          ) : (
            conversations.map((conv) => {
              const isSelected = activeConv?.id === conv.id;
              return (
                <div
                  key={conv.id}
                  style={{
                    padding: '0.65rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected
                      ? '1px solid hsl(var(--hsl-primary))'
                      : '1px solid hsl(var(--hsl-border))',
                    background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => openConversation(conv.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: 'inherit',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        flex: 1,
                      }}
                    >
                      {conv.title}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      title="Archivar conversación"
                      style={{ padding: '0.15rem', color: 'hsl(var(--hsl-text-muted))' }}
                      onClick={() => handleArchiveConversation(conv.id)}
                    >
                      <Archive size={13} />
                    </button>
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                    {conv.expediente
                      ? `Expte. ${conv.expediente.numeroExpediente}`
                      : 'Sin causa asociada'}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Chat Panel */}
      <section
        className="card"
        style={{
          padding: '1.15rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          maxHeight: 'calc(100vh - 110px)',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.6rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid hsl(var(--hsl-border))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {editingTitle && activeConv ? (
              <form onSubmit={handleSaveTitle} style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  className="input-field"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  style={{ minWidth: 220 }}
                />
                <button type="submit" className="btn btn-primary" style={{ fontSize: '0.78rem' }}>
                  Guardar
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.78rem' }}
                  onClick={() => setEditingTitle(false)}
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <>
                <h1 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'var(--font-heading)' }}>
                  {activeConv ? activeConv.title : 'Asistente IA Jurídico Contextual'}
                </h1>
                {activeConv && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    title="Editar título"
                    style={{ padding: '0.2rem' }}
                    onClick={() => setEditingTitle(true)}
                  >
                    <Edit3 size={14} />
                  </button>
                )}
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            {activeConv?.expediente ? (
              <span className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Scale size={12} />
                {activeConv.expediente.numeroExpediente} — {activeConv.expediente.caratula.slice(0, 32)}
              </span>
            ) : (
              <span className="badge badge-gray">Modo general (sin causa)</span>
            )}

            <button
              type="button"
              className="btn btn-outline"
              style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
              onClick={() => setShowCasePicker((v) => !v)}
            >
              <Scale size={14} /> {activeConv?.expediente ? 'Cambiar causa' : 'Seleccionar causa'}
            </button>

            {activeConv?.expediente && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}
                onClick={() => handleChangeCase(null)}
              >
                <X size={14} /> Quitar causa
              </button>
            )}
          </div>
        </div>

        {/* Provider unavailable banner */}
        {status && !status.available && (
          <div
            style={{
              padding: '0.7rem 0.9rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={16} />
            <span>
              <strong>Proveedor IA no configurado:</strong>{' '}
              {status.reason || 'El proveedor de IA no está configurado en el servidor backend. Su conversación se conserva.'}
            </span>
          </div>
        )}

        {/* Case Selector Panel */}
        {showCasePicker && (
          <div
            style={{
              padding: '0.85rem',
              borderRadius: 'var(--radius-sm)',
              background: 'hsl(var(--hsl-surface-muted))',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                className="input-field"
                placeholder="Buscar causa por carátula, número, fuero o tribunal..."
                value={caseSearch}
                onChange={(e) => setCaseSearch(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowCasePicker(false)}
              >
                Cerrar
              </button>
            </div>
            {loadingCases ? (
              <span className="text-muted" style={{ fontSize: '0.82rem' }}>
                Buscando causas autorizadas...
              </span>
            ) : cases.length === 0 ? (
              <span className="text-muted" style={{ fontSize: '0.82rem' }}>
                No se encontraron expedientes.
              </span>
            ) : (
              <div style={{ maxHeight: 170, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {cases.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="btn btn-outline"
                    style={{ justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.45rem 0.65rem' }}
                    onClick={() => handleChangeCase(c.id)}
                  >
                    <span>
                      <strong>{c.numeroExpediente}</strong> — {c.caratula} ({c.juzgado})
                    </span>
                    <span className="text-muted">
                      {c.partesCount} partes · {c.movimientosCount} mov.
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div
            style={{
              padding: '0.7rem 0.9rem',
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
            <span>{error}</span>
          </div>
        )}

        {/* Messages Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            paddingRight: '0.25rem',
          }}
        >
          {loadingConv ? (
            <div className="text-muted" style={{ padding: '2rem', textAlign: 'center' }}>
              Cargando historial de la conversación...
            </div>
          ) : messages.length === 0 ? (
            <div
              className="text-muted"
              style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                fontSize: '0.9rem',
                lineHeight: 1.6,
              }}
            >
              <Bot size={30} style={{ opacity: 0.45, marginBottom: '0.5rem' }} />
              <p style={{ margin: '0 0 0.4rem' }}>
                Iniciá una consulta jurídica o procesal.
              </p>
              <p style={{ margin: 0, fontSize: '0.82rem' }}>
                Podés seleccionar una causa para analizar sus partes, movimientos activos, notas y documentos AUTH-08, o consultar en modo general sin causa.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'USER';
              const refs = msg.contextReferences;
              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '88%',
                    padding: '0.9rem 1.05rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid hsl(var(--hsl-border))',
                    background: isUser
                      ? 'rgba(59, 130, 246, 0.12)'
                      : 'hsl(var(--hsl-surface-muted))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem' }}>
                    <strong>{isUser ? 'Profesional' : 'Asistente IA Jurídico'}</strong>
                    <span className="text-muted">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55, fontSize: '0.9rem' }}>
                    {msg.content}
                  </div>

                  {/* Verified Context References for Assistant responses */}
                  {!isUser && refs && (
                    <div
                      style={{
                        paddingTop: '0.6rem',
                        borderTop: '1px solid hsl(var(--hsl-border))',
                        fontSize: '0.78rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                      }}
                    >
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                        {refs.expediente && (
                          <span className="badge badge-blue">
                            <Scale size={11} /> Expediente: {refs.expediente.caratula} ({refs.expediente.numeroExpediente})
                          </span>
                        )}
                        {refs.movimientos?.length > 0 && (
                          <span className="badge">
                            {refs.movimientos.length} mov. procesal(es)
                          </span>
                        )}
                        {refs.documents?.map((d) => (
                          <span key={d.id} className="badge badge-green">
                            <FileText size={11} /> {d.title} (v{d.versionNumber})
                          </span>
                        ))}
                        {refs.usedGeneralKnowledge && (
                          <span className="badge badge-yellow">
                            <BookOpen size={11} /> Incluye conocimiento jurídico general
                          </span>
                        )}
                      </div>

                      {refs.movimientos && refs.movimientos.length > 0 && (
                        <div className="text-muted">
                          Movimientos consultados:{' '}
                          {refs.movimientos
                            .slice(0, 3)
                            .map((m) => `${m.fechaActuacion} (${m.titulo})`)
                            .join('; ')}
                        </div>
                      )}

                      {refs.missingData && refs.missingData.length > 0 && (
                        <div style={{ color: 'hsl(var(--hsl-warning, 38 92% 45%))' }}>
                          <strong>Datos pendientes:</strong> {refs.missingData.join(' · ')}
                        </div>
                      )}

                      {refs.limitations && refs.limitations.length > 0 && (
                        <div className="text-muted">
                          <strong>Limitaciones de contexto:</strong> {refs.limitations.join(' ')}
                        </div>
                      )}

                      <div className="text-muted" style={{ fontStyle: 'italic' }}>
                        {refs.professionalDisclaimer ||
                          'Respuesta asistida por IA — requiere verificación profesional.'}
                      </div>

                      <div style={{ paddingTop: '0.25rem' }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ fontSize: '0.76rem', padding: '0.3rem 0.65rem' }}
                          onClick={() => handleUseInGenerator(msg)}
                        >
                          <Sparkles size={13} /> Usar en Generador de Escritos
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Optional Authorized Documents Picker */}
        {showDocsPicker && (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              background: 'hsl(var(--hsl-surface-muted))',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <strong>Documentos autorizados AUTH-08 a consultar (máx. 8)</strong>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem' }}
                onClick={() => setShowDocsPicker(false)}
              >
                Cerrar
              </button>
            </div>
            {availableDocs.length === 0 ? (
              <span className="text-muted">No hay documentos activos disponibles.</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {availableDocs.map((doc) => {
                  const sel = selectedDocIds.includes(doc.id);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      className={`btn ${sel ? 'btn-primary' : 'btn-outline'}`}
                      style={{ fontSize: '0.74rem', padding: '0.25rem 0.55rem' }}
                      onClick={() => toggleDoc(doc.id)}
                    >
                      {sel && <CheckCircle2 size={12} />} {doc.title} (v{doc.currentVersionNumber})
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={handleSendMessage}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            paddingTop: '0.6rem',
            borderTop: '1px solid hsl(var(--hsl-border))',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <textarea
              rows={2}
              className="input-field"
              style={{ flex: 1, resize: 'vertical' }}
              placeholder="Escribí tu consulta jurídica o procesal..."
              value={queryText}
              onChange={(e) => {
                setQueryText(e.target.value);
                setPendingClientMsgId(null);
              }}
              disabled={sending}
            />
            <button
              type="button"
              className="btn btn-outline"
              title="Adjuntar documentos AUTH-08 al contexto"
              onClick={() => setShowDocsPicker((v) => !v)}
              disabled={sending}
            >
              <Paperclip size={16} />
              {selectedDocIds.length > 0 && <span>{selectedDocIds.length}</span>}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={sending || !queryText.trim() || (status !== null && !status.available)}
            >
              <Send size={16} />
              {sending ? 'Consultando...' : 'Enviar'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
