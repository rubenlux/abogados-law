
import { useState } from 'react';
import { PenTool, Wand2, Save, Download, FileText, Eraser } from 'lucide-react';

export const SmartDraftingPage = () => {
    const [prompt, setPrompt] = useState('');
    const [context, setContext] = useState('');
    const [editorContent, setEditorContent] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        if (!prompt) return;
        setIsGenerating(true);
        try {
            // Simulation of connection to DraftingService
            // In a real scenario: await apiClient.drafting.generate({ prompt, context });

            // Mock streaming response simulation
            const responseText = `
SEÑOR JUEZ:

Juan Pérez, por derecho propio, con domicilio real en... y constituyendo domicilio procesal en..., conjuntamente con mi letrado patrocinante Dr. Usuario...

I. OBJETO:
Que vengo por la presente a promover formal demanda de...

II. HECHOS:
${prompt}

III. DERECHO:
Fundo el derecho que me asiste en los artículos...
            `.trim();

            setEditorContent(responseText);
        } catch (error) {
            console.error(error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="animate-fade-in" style={{ height: 'calc(100vh - 100px)', display: 'flex', gap: '1.5rem' }}>

            {/* Left Panel: Inputs & Controls */}
            <div className="card" style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <header>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <PenTool size={20} color="hsl(var(--hsl-accent))" /> Asistente de Redacción
                    </h2>
                    <p className="text-muted" style={{ fontSize: '0.9rem' }}>Genera borradores basados en hechos y estrategia.</p>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>1. Instrucciones para la IA</label>
                    <textarea
                        className="input"
                        rows={6}
                        placeholder="Ej: Redactar una demanda de daños y perjuicios por accidente de tránsito. El cliente circulaba por Av. Libertador..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        style={{ resize: 'none' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>2. Contexto Jurídico (Opcional)</label>
                    <textarea
                        className="input"
                        rows={3}
                        placeholder="Ej: Citar el fallo 'García c/ Perez' de la CSJN..."
                        value={context}
                        onChange={(e) => setContext(e.target.value)}
                        style={{ resize: 'none' }}
                    />
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button
                        className="btn btn-primary"
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt}
                        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                    >
                        {isGenerating ? <div className="loading-spinner" style={{ width: 16, height: 16 }} /> : <Wand2 size={18} />}
                        {isGenerating ? 'Redactando...' : 'Generar Borrador con IA'}
                    </button>
                    <button className="btn btn-outline" onClick={() => { setPrompt(''); setContext(''); setEditorContent(''); }}>
                        <Eraser size={16} /> Limpiar Todo
                    </button>
                </div>
            </div>

            {/* Right Panel: Document Editor */}
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                {/* Editor Toolbar */}
                <div style={{
                    padding: '0.75rem 1rem', borderBottom: '1px solid hsl(var(--hsl-border))',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'hsl(var(--hsl-surface-muted))'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                        <FileText size={18} />
                        <span>Nuevo Documento</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-ghost btn-sm">
                            <Save size={16} /> Guardar
                        </button>
                        <button className="btn btn-outline btn-sm">
                            <Download size={16} /> Exportar Word
                        </button>
                    </div>
                </div>

                {/* Editor Area (Textarea for MVP, usually RichText) */}
                <textarea
                    style={{
                        flex: 1, border: 'none', padding: '2rem', fontSize: '1.05rem', lineHeight: '1.6',
                        fontFamily: 'system-ui, sans-serif', resize: 'none', outline: 'none',
                        color: 'hsl(var(--hsl-text))', background: 'transparent'
                    }}
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    placeholder="El documento generado aparecerá aquí..."
                />

                <div style={{
                    padding: '0.5rem 1rem', borderTop: '1px solid hsl(var(--hsl-border))',
                    fontSize: '0.75rem', color: 'hsl(var(--hsl-text-muted))', display: 'flex', justifyContent: 'space-between'
                }}>
                    <span>{editorContent.length} caracteres</span>
                    <span>IA: GPT-4o</span>
                </div>
            </div>
        </div>
    );
};
