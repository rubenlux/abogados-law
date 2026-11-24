import React from 'react';
import { RefreshCw, CheckCircle, Database } from 'lucide-react';

export const JudicialPage = () => {
    const [syncing, setSyncing] = React.useState(false);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('http://localhost:3000/judicial/sync-system', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert(`✅ ${data.message}\n\nProcesados: ${data.stats.processed}\nActualizados: ${data.stats.updated}`);
            }
        } catch (e) {
            console.error(e);
            alert('❌ Error al sincronizar con el Poder Judicial');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Gestión Judicial</h1>
                <p className="text-muted">Sincronización con PJN, SCBA y MEV</p>
            </header>

            <div className="card" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ width: 40, height: 40, background: '#10B981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle color="white" />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.1rem' }}>Sistema Operativo</h3>
                        <p className="text-muted">Última sincronización: Hace 5 minutos</p>
                    </div>
                    <button
                        className="btn btn-primary"
                        style={{ marginLeft: 'auto' }}
                        onClick={handleSync}
                        disabled={syncing}
                    >
                        <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
                        {syncing ? ' Sincronizando...' : ' Forzar Sincronización'}
                    </button>
                </div>
            </div>

            <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Cuentas Vinculadas</h3>
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid hsl(var(--hsl-border))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Database size={20} />
                        <div>
                            <strong>Portal PJN</strong>
                            <div className="text-muted" style={{ fontSize: '0.8rem' }}>20-12345678-9</div>
                        </div>
                    </div>
                    <span className="badge badge-gold">Conectado</span>
                </div>
            </div>
        </div>
    );
};
