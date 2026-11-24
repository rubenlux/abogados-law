import {
    ArrowLeft, FileText, Calendar, Paperclip, AlertTriangle, Play, Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { useLegalAssistant } from '../../../core/hooks/useLegalAssistant';
import { apiClient } from '../../../core/api/client';
import { format } from 'date-fns';
import { AIChatWidget } from '../components/AIChatWidget';
import { LegalRiskWidget } from '../components/LegalRiskWidget';

export const CaseDetail = () => {
    const { id } = useParams();
    const { analyzeText, analysisResult, isLoading } = useLegalAssistant();

    // Mock initial document content
    const mockDocText = `
CEDULA DE NOTIFICACION
DESTINATARIO: Dr. Usuario (Tº 100 Fº 123 CPACF)
DOMICILIO: Uruguay 1234, CABA

Por medio de la presente, en los autos caratulados "GARCIA c/ PEREZ s/ DAÑOS", se notifica a Ud. la resolución que dice:
"Buenos Aires, 22 de Enero de 2026. Por presentado, parte y constituido el domicilio. De la demanda instaurada, TRASLADO por el término de QUINCE (15) DIAS. Notifíquese. Fdo: Juez Nacional."

Queda Ud. debidamente notificado.
  `;

    const handleAnalyze = () => {
        analyzeText(mockDocText);
    };

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
                        <div className="text-muted" style={{ fontSize: '0.875rem' }}>
                            Expte. 12345/2023 • Juzgado Civil 10 • Capital Federal
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline">
                        <Calendar size={16} /> Agenda
                    </button>
                    <button className="btn btn-primary" onClick={handleAnalyze} disabled={isLoading}>
                        {isLoading ? 'Analizando...' : <><Paperclip size={16} /> Analizar Doc</>}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FileText size={18} />
                                Cédula de Notificación (Traslado)
                            </span>
                            <span className="badge badge-blue">PDF</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                Hace 2 horas
                            </div>
                            <button
                                className="btn btn-ghost"
                                style={{ padding: '0.25rem 0.5rem', height: 'auto', fontSize: '0.75rem', gap: '0.25rem' }}
                                onClick={() => alert('Simulación: Se abriría el selector de archivos del sistema.\n\nEl archivo seleccionado se subiría al servidor S3/MinIO y se procesaría con OCR para extraer texto.')}
                            >
                                <Upload size={14} /> Importar PDF
                            </button>
                        </div>
                    </div>

                    <div style={{ flex: 1, padding: '2rem', overflowY: 'auto', backgroundColor: '#e2e8f0' /* Paper contrast */ }}>
                        {/* Mock PDF Content Viewer - Paper Look */}
                        <div style={{
                            maxWidth: '800px', margin: '0 auto',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                            minHeight: '800px', backgroundColor: 'white', padding: '3rem',
                            border: 'none', fontFamily: 'Times New Roman, serif', color: '#111'
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

                    {/* RISK WIDGET */}
                    <LegalRiskWidget expedienteId={id || 'mock-id'} />

                    <AnimatePresence>
                        {analysisResult && (
                            <motion.div
                                className="card"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                style={{ padding: '1rem', borderLeft: '4px solid hsl(var(--hsl-accent))' }}
                            >
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '50%', background: 'hsl(var(--hsl-accent) / 0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--hsl-accent))'
                                    }}>
                                        <AlertTriangle size={20} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>IA: Vencimiento Detectado</h4>
                                        <p style={{ fontSize: '0.8rem', color: 'hsl(var(--hsl-text-muted))', margin: 0 }}>
                                            He analizado la cédula.<br />
                                            <strong>Plazo:</strong> {analysisResult.plazo_detectado}
                                        </p>
                                        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                                            <div style={{ flex: 1, padding: '0.5rem', background: 'hsl(var(--hsl-surface-muted))', borderRadius: 4, textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'hsl(var(--hsl-text-muted))' }}>Vence</div>
                                                <div style={{ fontWeight: 700, color: 'hsl(var(--hsl-danger))' }}>
                                                    {format(new Date(analysisResult.vencimiento_sugerido), 'dd MMM yyyy')}
                                                </div>
                                            </div>
                                            <button
                                                className="btn btn-primary"
                                                style={{ flex: 1, fontSize: '0.8rem' }}
                                                onClick={async () => {
                                                    if (confirm(`¿Agendar vencimiento para el ${format(new Date(analysisResult.vencimiento_sugerido), 'dd/MM/yyyy')}?`)) {
                                                        // Auto-create event
                                                        await apiClient.agenda.createEvent({
                                                            titulo: 'Vencimiento Detectado por IA',
                                                            fechaVencimiento: analysisResult.vencimiento_sugerido,
                                                            tipoPlazo: 'FATAL',
                                                            expedienteId: 'mock-id-123', // In real app use url param
                                                            isCritical: true,
                                                            descripcion: analysisResult.explicacion_legal
                                                        });
                                                        alert('Evento agendado exitosamente en Agenda Judicial');
                                                    }
                                                }}
                                            >
                                                Confirmar Agenda
                                            </button>
                                        </div>
                                        {/* Legal Explanation */}
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'hsl(var(--hsl-text-muted))' }}>
                                            {analysisResult.explicacion_legal}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {!analysisResult && !isLoading && (
                        <div className="card" style={{ padding: '2rem', textAlign: 'center', borderStyle: 'dashed', borderColor: 'hsl(var(--hsl-border))', color: 'hsl(var(--hsl-text-muted))' }}>
                            <Play size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                            <p>Presiona "Analizar Doc" para que la IA detecte plazos automáticamente.</p>
                        </div>
                    )}

                    {/* Chat Interface */}
                    <div style={{ flex: 1, minHeight: '400px' }}>
                        <AIChatWidget expedienteId={id || 'mock-case-1'} />
                    </div>

                </div>
            </div>
        </div>
    );
};
