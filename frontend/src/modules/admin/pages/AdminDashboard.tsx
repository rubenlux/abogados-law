
import { BarChart3, Users, DollarSign, Activity } from 'lucide-react';

export const AdminDashboard = () => {
    // Mock Data
    const stats = {
        tokensUsed: 145000,
        costEstimated: 4.5, // USD
        activeTenants: 1,
        systemHealth: 98 // %
    };

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Panel de Administración de IA</h1>
                <p className="text-muted">Gobernanza de recursos, costos y tenants.</p>
            </header>

            {/* Metrics Grid */}
            <div className="grid grid-cols-4 gap-1" style={{ marginBottom: '2rem' }}>
                <MetricCard
                    title="Consumo Tokens (Mes)"
                    value={stats.tokensUsed.toLocaleString()}
                    icon={<Activity size={20} color="#3B82F6" />}
                    trend="+12% vs mes anterior"
                />
                <MetricCard
                    title="Costo Estimado"
                    value={`US$ ${stats.costEstimated.toFixed(2)}`}
                    icon={<DollarSign size={20} color="#10B981" />}
                    trend="Bajo presupuesto"
                />
                <MetricCard
                    title="Tenants Activos"
                    value={stats.activeTenants}
                    icon={<Users size={20} color="#F59E0B" />}
                />
                <MetricCard
                    title="Salud del Sistema"
                    value={`${stats.systemHealth}%`}
                    icon={<BarChart3 size={20} color="#8B5CF6" />}
                />
            </div>

            {/* Charts Section Placeholder */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                <div className="card" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p className="text-muted">Gráfico de Uso de Tokens (Últimos 30 días)</p>
                    {/* Integrate Chart.js or Recharts here */}
                </div>
                <div className="card" style={{ height: '300px' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Distribución de Modelos</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <ProgressBar label="GPT-4o (Reasoning)" percent={45} color="#3B82F6" />
                        <ProgressBar label="GPT-3.5 (Chat rápido)" percent={30} color="#10B981" />
                        <ProgressBar label="Embedding V3" percent={25} color="#8B5CF6" />
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Tenants Recientes</h3>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'hsl(var(--hsl-surface-muted))', fontSize: '0.85rem', textAlign: 'left' }}>
                            <tr>
                                <th style={{ padding: '0.75rem 1rem' }}>Organización</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Estado</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Plan</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Uso IA</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[1].map((i) => (
                                <tr key={i} style={{ borderBottom: '1px solid hsl(var(--hsl-border))' }}>
                                    <td style={{ padding: '1rem' }}>Estudio Jurídico Demo</td>
                                    <td style={{ padding: '1rem' }}><span className="badge badge-gold">Activo</span></td>
                                    <td style={{ padding: '1rem' }}>PRO</td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ width: 100, height: 6, background: '#eee', borderRadius: 3 }}>
                                                <div style={{ width: '15%', height: '100%', background: '#10B981', borderRadius: 3 }} />
                                            </div>
                                            <span style={{ fontSize: '0.75rem' }}>15%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ title, value, icon, trend }: any) => (
    <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>{title}</span>
            <div style={{ padding: '0.4rem', borderRadius: 8, background: 'hsl(var(--hsl-surface-muted))' }}>
                {icon}
            </div>
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{value}</div>
        {trend && <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '0.25rem' }}>{trend}</div>}
    </div>
);

const ProgressBar = ({ label, percent, color }: any) => (
    <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
            <span>{label}</span>
            <span>{percent}%</span>
        </div>
        <div style={{ height: 6, background: 'hsl(var(--hsl-surface-muted))', borderRadius: 3 }}>
            <div style={{ width: `${percent}%`, height: '100%', background: color, borderRadius: 3 }} />
        </div>
    </div>
);
