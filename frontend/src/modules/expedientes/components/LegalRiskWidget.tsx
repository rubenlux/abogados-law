
import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, BookOpen, Scale, FileText } from 'lucide-react';

export const LegalRiskWidget = ({ expedienteId }: { expedienteId: string }) => {
    const [riskData, setRiskData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const analyzeRisk = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Using localhost explicit for demo
            const res = await fetch(`http://localhost:3000/ai/risk-score/${expedienteId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: 'demo-user' })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Error ${res.status}: ${text}`);
            }
            const data = await res.json();
            setRiskData(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!riskData && !isLoading) {
        return (
            <div className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Scale size={18} /> Auditoría de Riesgo
                    </h3>
                    <button className="btn btn-outline btn-sm" onClick={analyzeRisk}>
                        <TrendingUp size={14} /> Calcular Riesgo
                    </button>
                </div>
                <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    Analiza la viabilidad del caso usando IA y 100+ precedentes.
                </p>
                {error && (
                    <div style={{ marginTop: '0.5rem', color: '#EF4444', fontSize: '0.8rem' }}>
                        Error: {error}
                    </div>
                )}
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <div className="loading-spinner" />
                <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>Auditando Jurisprudencia y Leyes...</p>
            </div>
        );
    }

    // Determine color based on risk level
    const getRiskColor = (level: string) => {
        switch (level) {
            case 'BAJO': return '#10B981'; // Green
            case 'MEDIO': return '#F59E0B'; // Yellow
            case 'ALTO': return '#F97316'; // Orange
            case 'CRITICO': return '#EF4444'; // Red
            default: return '#6B7280';
        }
    };

    const color = getRiskColor(riskData?.riskLevel);

    return (
        <motion.div
            className="card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ padding: 0, overflow: 'hidden', border: `1px solid ${color}40` }}
        >
            <div style={{ padding: '1rem', background: `linear-gradient(to right, ${color}10, transparent)` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h3 style={{ fontSize: '0.9rem', color: 'hsl(var(--hsl-text-muted))', textTransform: 'uppercase' }}>
                            Nivel de Riesgo
                        </h3>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: color }}>
                            {riskData?.riskLevel}
                        </div>
                    </div>
                    <div style={{
                        width: 50, height: 50, borderRadius: '50%',
                        border: `4px solid ${color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', fontSize: '1.1rem'
                    }}>
                        {riskData?.score}
                    </div>
                </div>
            </div>

            <div style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'hsl(var(--hsl-text))', marginBottom: '1rem', fontStyle: 'italic' }}>
                    "{riskData?.explanation}"
                </div>

                {/* Sub-metrics */}
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <MetricBar label="Jurisprudencia Adversa" score={riskData?.jurisprudenceScore} icon={<Scale size={14} />} />
                    <MetricBar label="Complejidad Normativa" score={riskData?.normativeScore} icon={<BookOpen size={14} />} />
                    <MetricBar label="Complejidad del Caso" score={riskData?.complexityScore} icon={<FileText size={14} />} />
                </div>
            </div>
        </motion.div>
    );
};

const MetricBar = ({ label, score, icon }: any) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
        <div style={{ color: 'hsl(var(--hsl-text-muted))', width: 20 }}>{icon}</div>
        <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span>{label}</span>
                <span>{score}%</span>
            </div>
            <div style={{ height: 4, background: 'hsl(var(--hsl-surface-highlight))', borderRadius: 2 }}>
                <div style={{
                    height: '100%', width: `${score}%`,
                    background: score > 70 ? '#EF4444' : score > 40 ? '#F59E0B' : '#10B981',
                    borderRadius: 2
                }} />
            </div>
        </div>
    </div>
);
