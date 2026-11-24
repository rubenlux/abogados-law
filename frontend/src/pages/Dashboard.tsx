
import { Clock, AlertCircle, FileCheck, Brain } from 'lucide-react';
import { motion } from 'framer-motion';

const StatCard = ({ title, value, sub, icon: Icon, delay }: any) => (
    <motion.div
        className="card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <span style={{ color: 'hsl(var(--color-text-muted))', fontSize: '0.875rem' }}>{title}</span>
            <Icon className="icon" style={{ opacity: 0.5 }} />
        </div>
        <div style={{ fontSize: '2rem', fontWeight: 700 }}>{value}</div>
        <div style={{ fontSize: '0.875rem', color: 'hsl(var(--color-success))' }}>{sub}</div>
    </motion.div>
);

export const Dashboard = () => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Search / AI Bar */}
            <div className="card glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Brain className="icon" style={{ color: 'hsl(var(--color-accent))' }} />
                <input
                    type="text"
                    placeholder="Pregunta a la IA sobre tus expedientes o leyes..."
                    style={{ border: 'none', background: 'transparent', flex: 1, fontSize: '1rem', outline: 'none' }}
                />
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <StatCard title="Vencimientos Hoy" value="3" sub="2 urgentes" icon={Clock} delay={0.1} />
                <StatCard title="Expedientes Activos" value="142" sub="+5 este mes" icon={FileCheck} delay={0.2} />
                <StatCard title="Alertas Judiciales" value="12" sub="Revisar Cédulas" icon={AlertCircle} delay={0.3} />
                <StatCard title="Escritos por IA" value="8" sub="Pendientes de revisión" icon={Brain} delay={0.4} />
            </div>

            {/* Recent Activity */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginTop: 0 }}>Movimientos Recientes</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: 'hsl(var(--color-text-muted))', borderBottom: '1px solid hsl(var(--color-border))' }}>
                                <th style={{ padding: '0.5rem 0' }}>Expediente</th>
                                <th>Carátula</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { id: '12345', car: 'GARCIA vs PEREZ', st: 'Despacho' },
                                { id: '54321', car: 'SUCESION LOPEZ', st: 'Sentencia' },
                                { id: '98765', car: 'BANCO vs TORRES', st: 'Prueba' },
                            ].map((row, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid hsl(var(--color-border))' }}>
                                    <td style={{ padding: '1rem 0' }}>{row.id}</td>
                                    <td>{row.car}</td>
                                    <td><span style={{ background: 'hsl(var(--color-background))', padding: '0.25rem 0.5rem', borderRadius: 4 }}>{row.st}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginTop: 0 }}>Agenda Hoy</h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0 0' }}>
                        {[
                            { time: '09:00', text: 'Audiencia Garcia' },
                            { time: '11:30', text: 'Call con Cliente' },
                            { time: '15:00', text: 'Revisión Escrito IA' },
                        ].map((ev, i) => (
                            <li key={i} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                <span style={{ fontWeight: 600, color: 'hsl(var(--color-primary))' }}>{ev.time}</span>
                                <span>{ev.text}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};
