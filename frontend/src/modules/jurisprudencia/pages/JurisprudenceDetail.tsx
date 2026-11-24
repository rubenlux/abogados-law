
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Building2, ExternalLink, Shield, FileText, MessageSquare, Scale } from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import { format } from 'date-fns';

export const JurisprudenceDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [fallo, setFallo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (id) loadFallo(id);
    }, [id]);

    const loadFallo = async (falloId: string) => {
        setIsLoading(true);
        try {
            const data = await apiClient.jurisprudence.findById(falloId);
            setFallo(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--hsl-text-muted))' }}>
            <div className="animate-spin" style={{ marginRight: '1rem' }}><Scale size={24} /></div>
            Cargando fallo...
        </div>
    );

    if (!fallo) return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>Fallo no encontrado.</div>
    );

    return (
        <div className="animate-fade-in" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', height: '100%', overflowY: 'auto' }}>
            {/* Header Actions */}
            <button
                onClick={() => navigate(-1)}
                className="btn btn-ghost"
                style={{ paddingLeft: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
                <ArrowLeft size={18} /> Volver a búsqueda
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '2rem' }}>
                {/* Main Content */}
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'hsl(var(--hsl-primary))', marginBottom: '0.5rem', lineHeight: 1.2 }}>
                        {fallo.caratula}
                    </h1>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.9rem', color: 'hsl(var(--hsl-text-muted))', marginBottom: '1.5rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Building2 size={16} /> {fallo.tribunal} {fallo.sala ? `- Sala ${fallo.sala}` : ''}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Calendar size={16} /> {fallo.fecha ? format(new Date(fallo.fecha), 'dd/MM/yyyy') : 'N/D'}
                        </span>
                        {fallo.fuenteOficialUrl && (
                            <a
                                href={fallo.fuenteOficialUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(var(--hsl-accent))', textDecoration: 'none', fontWeight: 600 }}
                            >
                                <ExternalLink size={16} /> Fuente Oficial
                            </a>
                        )}
                    </div>

                    {/* Resumen Box */}
                    {fallo.resumen && (
                        <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', backgroundColor: 'hsl(var(--hsl-surface-muted))', borderLeft: '4px solid hsl(var(--hsl-accent))' }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FileText size={16} /> SUMARIO
                            </h3>
                            <p style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>{fallo.resumen}</p>
                        </div>
                    )}

                    {/* Full Text View - Paper-like aesthetics */}
                    <div style={{
                        backgroundColor: 'white',
                        padding: '3rem',
                        borderRadius: '0.5rem',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        color: '#1a1a1a',
                        fontFamily: 'Georgia, serif',
                        fontSize: '1.1rem',
                        lineHeight: '1.8',
                        minHeight: '600px',
                        border: '1px solid #e0e0e0'
                    }}>
                        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                            {(!fallo.textoCompleto || fallo.textoCompleto.includes('simulado')) ? (
                                <div>
                                    <div style={{
                                        backgroundColor: '#fff9c4',
                                        padding: '1rem',
                                        borderRadius: '0.4rem',
                                        marginBottom: '2rem',
                                        fontSize: '0.9rem',
                                        color: '#5d4037',
                                        border: '1px solid #ffeb3b',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem'
                                    }}>
                                        <Shield size={18} />
                                        <strong>Nota:</strong> Texto completo no recolectado todavía. Mostrando sumario oficial disponible.
                                        {fallo.fuenteOficialUrl && <a href={fallo.fuenteOficialUrl} style={{ color: '#007bff' }} target="_blank" rel="noreferrer">Ver fuente oficial</a>}
                                    </div>
                                    <p style={{ whiteSpace: 'pre-wrap' }}>{fallo.resumen || 'No hay contenido disponible para este fallo.'}</p>
                                </div>
                            ) : (
                                <div dangerouslySetInnerHTML={{ __html: fallo.textoCompleto.replace(/\n/g, '<br/>') }} />
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar Metadata */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    <div className="card" style={{ padding: '1.25rem' }}>
                        <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--hsl-text-muted))', marginBottom: '1rem', letterSpacing: '0.05em' }}>
                            Acciones Rápidas
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button className="btn btn-primary" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                <ExternalLink size={16} /> Usar en Redacción
                            </button>
                            <button
                                className="btn btn-outline"
                                style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
                                onClick={() => navigate('/ia', { state: { fallo } })}
                            >
                                <MessageSquare size={16} /> Consultar con IA
                            </button>
                        </div>
                    </div>

                    <div className="card" style={{ padding: '1.25rem' }}>
                        <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--hsl-text-muted))', marginBottom: '1rem', letterSpacing: '0.05em' }}>
                            Ficha Técnica
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--hsl-text-muted))', marginBottom: '0.25rem' }}>Jurisdicción</label>
                                <div style={{ fontWeight: 500 }}>{fallo.jurisdiccion}</div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--hsl-text-muted))', marginBottom: '0.25rem' }}>Fuero</label>
                                <div style={{ fontWeight: 500 }}>{fallo.fuero}</div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--hsl-text-muted))', marginBottom: '0.25rem' }}>Expediente</label>
                                <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{fallo.nroExpediente}</div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--hsl-text-muted))', marginBottom: '0.25rem' }}>Precedencia</label>
                                <span className="badge badge-primary">{fallo.precedencia || 'No def.'}</span>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--hsl-text-muted))', marginBottom: '0.25rem' }}>Vigencia</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: fallo.vigencia === 'VIGENTE' ? 'hsl(var(--hsl-success))' : 'hsl(var(--hsl-danger))' }}>
                                    <Shield size={16} />
                                    {fallo.vigencia || 'N/D'}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
