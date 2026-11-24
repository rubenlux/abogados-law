import { useEffect, useState } from 'react';
import { apiClient } from '../../../core/api/client';
import { Plus, Search, Filter, MoreHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ExpedienteList = () => {
    const [expedientes, setExpedientes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // Check connectivity first or mock
            // const data = await apiClient.expedientes.findAll();
            // For Demo purposes if backend is empty (it has seeds but no expedientes yet ideally)
            // Let's try to fetch real data
            const data = await apiClient.expedientes.findAll();
            if (Array.isArray(data)) {
                setExpedientes(data);
            } else {
                console.error("Data received is not an array:", data);
                setExpedientes([]);
            }
        } catch (e) {
            console.error("Failed to load expedientes", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Expedientes</h1>
                    <p className="text-muted">Gestiona tus causas activas y archivadas</p>
                </div>
                <Link to="/expedientes/new" className="btn btn-primary">
                    <Plus size={18} /> Nuevo Expediente
                </Link>
            </div>

            {/* Filters Bar */}
            <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: 12, top: 10, color: 'hsl(var(--hsl-secondary))' }} />
                    <input
                        className="input-field"
                        placeholder="Buscar por carátula, actor o demandado..."
                        style={{ paddingLeft: '2.5rem' }}
                    />
                </div>
                <button className="btn btn-outline">
                    <Filter size={18} /> Estado
                </button>
            </div>

            {/* Table */}
            <div className="card">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.925rem' }}>
                    <thead>
                        <tr style={{ background: 'hsl(var(--hsl-surface-muted))', textAlign: 'left', color: 'hsl(var(--hsl-secondary))' }}>
                            <th style={{ padding: '1rem', borderRadius: '8px 0 0 0' }}>Carátula / Autos</th>
                            <th style={{ padding: '1rem' }}>Número</th>
                            <th style={{ padding: '1rem' }}>Juzgado</th>
                            <th style={{ padding: '1rem' }}>Estado</th>
                            <th style={{ padding: '1rem' }}>Último Mov.</th>
                            <th style={{ padding: '1rem', borderRadius: '0 8px 0 0' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }}>Cargando expedientes...</td></tr>
                        ) : expedientes.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'hsl(var(--hsl-text-muted))' }}>No hay expedientes registrados.</td></tr>
                        ) : (
                            expedientes.map((exp: any) => (
                                <tr key={exp.id} style={{ borderBottom: '1px solid hsl(var(--hsl-border))', transition: 'background 0.2s' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: 600, color: 'hsl(var(--hsl-text-main))' }}>{exp.caratula}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'hsl(var(--hsl-text-muted))' }}>{exp.jurisdiccion}</div>
                                    </td>
                                    <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{exp.numeroExpediente}</td>
                                    <td style={{ padding: '1rem' }}>{exp.juzgado}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span className="badge badge-green">ACTIVO</span>
                                    </td>
                                    <td style={{ padding: '1rem', color: 'hsl(var(--hsl-text-muted))' }}>
                                        {new Date(exp.updatedAt).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                        <Link to={`/expedientes/${exp.id}`} className="btn btn-ghost" style={{ padding: '0.4rem' }}>
                                            <MoreHorizontal size={18} />
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
