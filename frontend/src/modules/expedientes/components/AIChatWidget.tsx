import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Trash2, RefreshCw } from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import { format } from 'date-fns';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
}

interface AIChatWidgetProps {
    expedienteId: string;
    initialMessage?: string;
}

export const AIChatWidget = ({ expedienteId, initialMessage }: AIChatWidgetProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasSentInitialRef = useRef(false);

    // Fetch history on mount or expedienteId change
    useEffect(() => {
        if (expedienteId) {
            loadHistory();
        }
    }, [expedienteId]);

    // Handle Initial Message
    useEffect(() => {
        // Ejecutar solo si hay mensaje, no se envió antes, no hay historial y no está cargando ya
        if (initialMessage && !hasSentInitialRef.current && messages.length === 0 && !isLoading) {
            hasSentInitialRef.current = true;
            setTimeout(() => {
                // Forzamos el envío usando el initialMessage
                handleSend(initialMessage);
            }, 500);
        }
    }, [initialMessage, messages.length]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadHistory = async () => {
        try {
            const history = await apiClient.aiChat.getHistory(expedienteId);
            setMessages(history);
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    };

    const handleSend = async (textOverride?: string) => {
        const textToSend = typeof textOverride === 'string' ? textOverride : input;

        if (!textToSend.trim() || isLoading) return;

        const tempId = Date.now().toString();
        const userMsg: Message = {
            id: tempId,
            role: 'user',
            content: textToSend,
            createdAt: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await apiClient.aiChat.sendMessage(expedienteId, userMsg.content);

            const assistantMsg: Message = {
                id: response.messageId || Date.now().toString(),
                role: 'assistant',
                content: response.message,
                createdAt: response.createdAt || new Date().toISOString()
            };

            setMessages(prev => [...prev, assistantMsg]);
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMsg: Message = {
                id: 'err-' + Date.now(),
                role: 'assistant',
                content: 'Error de conexión. Intenta nuevamente.',
                createdAt: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearHistory = async () => {
        if (!confirm('¿Estás seguro de borrar la memoria de esta conversación?')) return;
        try {
            await apiClient.aiChat.clearHistory(expedienteId);
            setMessages([]);
            hasSentInitialRef.current = false;
        } catch (error) {
            console.error('Error clearing history:', error);
        }
    };

    return (
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid hsl(var(--hsl-border))',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <MessageSquare size={16} />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Asistente del Expediente</span>
                </div>
                <button
                    onClick={handleClearHistory}
                    className="btn btn-ghost"
                    style={{ padding: '0.25rem', color: 'hsl(var(--hsl-text-muted))' }}
                    title="Borrar Memoria"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Messages Area */}
            <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'hsl(var(--hsl-text-muted))', marginTop: '2rem', fontSize: '0.85rem' }}>
                        <p>No hay mensajes previos.</p>
                        <p>Consulta sobre plazos, leyes o estrategia.</p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div key={msg.id} style={{
                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: msg.role === 'user' ? 'hsl(var(--hsl-primary))' : 'hsl(var(--hsl-accent))' }}>
                                {msg.role === 'user' ? 'Tú' : 'Abogado IA'}
                            </span>
                            <span className="text-muted" style={{ fontSize: '0.65rem' }}>
                                {format(new Date(msg.createdAt), 'HH:mm')}
                            </span>
                        </div>
                        <div style={{
                            background: msg.role === 'user' ? 'hsl(var(--hsl-primary) / 0.1)' : 'hsl(var(--hsl-surface-muted))',
                            padding: '0.75rem',
                            borderRadius: msg.role === 'user' ? '12px 12px 0 12px' : '0 12px 12px 12px',
                            fontSize: '0.9rem',
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap'
                        }}>
                            {msg.content}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="animate-pulse" style={{ alignSelf: 'flex-start', maxWidth: '85%', padding: '0.75rem', background: 'hsl(var(--hsl-surface-muted))', borderRadius: '0 12px 12px 12px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'hsl(var(--hsl-text-muted))' }}>Pensando...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ padding: '0.75rem', borderTop: '1px solid hsl(var(--hsl-border))' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        className="input-field"
                        placeholder="Escribe tu consulta..."
                        style={{ fontSize: '0.85rem' }}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        disabled={isLoading}
                    />
                    <button
                        className="btn btn-primary"
                        style={{ padding: '0.5rem' }}
                        onClick={() => handleSend()}
                        disabled={isLoading || !input.trim()}
                    >
                        {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
};
