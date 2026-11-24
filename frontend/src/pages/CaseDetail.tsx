
import {
    ArrowLeft, FileText, Calendar, MessageSquare,
    Paperclip, Send, AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';

export const CaseDetail = () => {
    return (
        <div className="animate-fade-in" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* 1. Header Toolbar */}
            <header style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '0.5rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button className="btn btn-ghost" style={{ padding: '0.5rem' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <h1 style={{ fontSize: '1.25rem', margin: 0 }}>GARCIA c/ PEREZ s/ DAÑOS</h1>
                            <span className="badge badge-gold">PRUEBA</span>
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'hsl(var(--hsl-secondary))' }}>
                            Expte. 12345/2023 • Juzgado Civil 10 • Capital Federal
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline">
                        <Calendar size={16} /> Agenda
                    </button>
                    <button className="btn btn-primary">
                        <Paperclip size={16} /> Subir Escrito
                    </button>
                </div>
            </header>

            {/* 2. Main Split View */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: '1.5rem',
                flex: 1, overflow: 'hidden'
            }}>

                {/* Left Column: Document Viewer / Case Files */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                        padding: '1rem', borderBottom: '1px solid hsl(var(--hsl-border))',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        backgroundColor: 'hsl(var(--hsl-surface-muted))'
                    }}>
                        <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileText size={18} />
                            Cédula de Notificación (Traslado)
                        </span>
                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--hsl-secondary))' }}>
                            Detectado hace 2 horas
                        </div>
                    </div>

                    <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', backgroundColor: '#fdfdfd' }}>
                        {/* Mock PDF Content Viewer */}
                        <div style={{
                            maxWidth: '800px', margin: '0 auto',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                            minHeight: '800px', backgroundColor: 'white', padding: '3rem',
                            border: '1px solid #eee', fontFamily: 'Times New Roman, serif', color: '#111'
                        }}>
                            <h3 style={{ textAlign: 'center', textDecoration: 'underline' }}>CEDULA DE NOTIFICACION</h3>
                            <p>&nbsp;</p>
                            <p><strong>DESTINATARIO:</strong> Dr. Usuario (Tº 100 Fº 123 CPACF)</p>
                            <p><strong>DOMICILIO:</strong> Uruguay 1234, CABA</p>
                            <p>&nbsp;</p>
                            <p>Por medio de la presente, en los autos caratulados <strong>"GARCIA c/ PEREZ s/ DAÑOS"</strong>, se notifica a Ud. la resolución que dice:</p>
                            <div style={{ padding: '1rem', background: 'rgba(255, 255, 0, 0.1)', borderLeft: '3px solid #ffd700' }}>
                                <p>"Buenos Aires, 22 de Enero de 2026. Por presentado, parte y constituido el domicilio. De la demanda instaurada, <strong>TRASLADO</strong> por el término de <strong>QUINCE (15) DIAS</strong>. Notifíquese. Fdo: Juez Nacional."</p>
                            </div>
                            <p>&nbsp;</p>
                            <p>Queda Ud. debidamente notificado.</p>
                        </div>
                    </div>
                </div>

                {/* Right Column: AI Assistant & Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* AI Insight Box (Magic Moment) */}
                    <motion.div
                        className="card"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        style={{ padding: '1rem', borderLeft: '4px solid hsl(var(--hsl-accent))' }}
                    >
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: '50%', background: 'hsl(var(--hsl-accent) / 0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--hsl-accent))'
                            }}>
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>Vencimiento Detectado</h4>
                                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--hsl-secondary))', margin: 0 }}>
                                    La IA detectó un traslado de demanda. <br />
                                    <strong>Plazo:</strong> 15 días (CPCC).
                                </p>
                                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                                    <div style={{ flex: 1, padding: '0.5rem', background: 'hsl(var(--hsl-surface-muted))', borderRadius: 4, textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'hsl(var(--hsl-secondary))' }}>Vence</div>
                                        <div style={{ fontWeight: 700, color: 'hsl(var(--hsl-danger))' }}>12 FEB</div>
                                    </div>
                                    <button className="btn btn-primary" style={{ flex: 1, fontSize: '0.8rem' }}>
                                        Agendar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Chat Interface */}
                    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid hsl(var(--hsl-border))', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <MessageSquare size={16} />
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Asistente del Expediente</span>
                        </div>

                        <div style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
                            {/* Chat Message: System */}
                            <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Abogado IA</span>
                                    <span style={{ fontSize: '0.7rem', color: 'hsl(var(--hsl-secondary))' }}>Recently</span>
                                </div>
                                <div style={{
                                    background: 'hsl(var(--hsl-surface-muted))', padding: '0.75rem', borderRadius: '0 12px 12px 12px',
                                    fontSize: '0.9rem', lineHeight: 1.4
                                }}>
                                    He analizado la cédula. Para contestar la demanda, te sugiero negar categóricamente los hechos invocados, especialmente el lucro cesante, basándonos en el fallo reciente <i>"Gomez c/ Transportes"</i> de la Cámara Civil.
                                    <br /><br />
                                    ¿Quieres que genere un borrador de la contestación?
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '0.75rem', borderTop: '1px solid hsl(var(--hsl-border))' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    className="input-field"
                                    placeholder="Escribe instruccion..."
                                    style={{ fontSize: '0.85rem' }}
                                />
                                <button className="btn btn-primary" style={{ padding: '0.5rem' }}>
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
