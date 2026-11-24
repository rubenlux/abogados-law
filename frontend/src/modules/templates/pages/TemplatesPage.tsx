import React from 'react';
import { FileText, Plus } from 'lucide-react';

export const TemplatesPage = () => {
    const [generating, setGenerating] = React.useState<string | null>(null);

    const handleGenerate = async (templateName: string) => {
        setGenerating(templateName);
        // Simular llamada al backend
        setTimeout(() => {
            setGenerating(null);
            alert(`✅ Documento generado exitosamente: ${templateName}.docx\n\n(En producción esto descargaría el archivo)`);
        }, 2000);
    };

    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Automatización Documental</h1>
                    <p className="text-muted">Gestión de plantillas y generación masiva de escritos</p>
                </div>
                <button className="btn btn-primary">
                    <Plus size={16} /> Nueva Plantilla
                </button>
            </header>

            <div className="grid grid-cols-3 gap-1">
                {['Demanda Despido', 'Carta Documento', 'Contestación Demanda Genérica'].map((name) => (
                    <div className="card" key={name} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div style={{ padding: '0.5rem', background: 'hsl(var(--hsl-surface-muted))', borderRadius: 8 }}>
                                <FileText size={24} color="hsl(var(--hsl-accent))" />
                            </div>
                            <span className="badge">Activa</span>
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{name}</h3>
                            <p className="text-muted" style={{ fontSize: '0.9rem' }}>Plantilla base para procesos laborales ordinarios.</p>
                        </div>
                        <button
                            className="btn btn-outline"
                            style={{ marginTop: 'auto' }}
                            disabled={generating === name}
                            onClick={() => handleGenerate(name)}
                        >
                            {generating === name ? 'Generando...' : 'Generar Documento'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
