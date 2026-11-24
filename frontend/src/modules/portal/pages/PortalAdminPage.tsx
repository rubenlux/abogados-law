
import { Users, ExternalLink } from 'lucide-react';

export const PortalAdminPage = () => {
    return (
        <div className="animate-fade-in">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Portal de Clientes</h1>
                    <p className="text-muted">Administración de accesos externos</p>
                </div>
                <button className="btn btn-outline">
                    <ExternalLink size={16} /> Ver Portal como Cliente
                </button>
            </header>

            <div className="grid grid-cols-2 gap-1">
                <div className="card">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users size={20} /> Usuarios Activos
                    </h3>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, margin: '1rem 0' }}>24</div>
                    <p className="text-muted">Clientes consultaron sus causas hoy</p>
                </div>

                <div className="card">
                    <h3>Configuración de Seguridad</h3>
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ display: 'flex', gap: '0.5rem' }}>
                            <input type="checkbox" checked readOnly /> Permitir descarga de sentencias
                        </label>
                        <label style={{ display: 'flex', gap: '0.5rem' }}>
                            <input type="checkbox" /> Permitir ver borradores
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};
