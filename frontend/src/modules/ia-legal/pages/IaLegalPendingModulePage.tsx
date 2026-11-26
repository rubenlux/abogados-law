import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Sparkles, ArrowRight } from 'lucide-react';

interface PendingModuleProps {
  title: string;
  subtitle: string;
  plannedCapabilities: string[];
  disclaimer: string;
}

/**
 * Vista honesta para módulos futuros de IA Legal (AUTH-09 Addendum §7).
 * No simula funcionalidad inexistente ni expone enlaces externos ficticios.
 */
export const IaLegalPendingModulePage: React.FC<PendingModuleProps> = ({
  title,
  subtitle,
  plannedCapabilities,
  disclaimer,
}) => {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Sparkles size={24} color="hsl(var(--hsl-primary))" />
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontFamily: 'var(--font-heading)' }}>
            {title}
          </h1>
          <span className="badge badge-yellow" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Clock size={12} /> Módulo pendiente de implementación
          </span>
        </div>

        <p className="text-muted" style={{ margin: 0, lineHeight: 1.6 }}>
          {subtitle}
        </p>

        <div
          style={{
            padding: '1rem 1.25rem',
            background: 'hsl(var(--hsl-surface-muted))',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <h2 style={{ margin: '0 0 0.6rem', fontSize: '0.98rem' }}>
            Alcance planificado para fases futuras
          </h2>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
            {plannedCapabilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <p className="text-muted" style={{ margin: 0, fontSize: '0.84rem' }}>
          {disclaimer}
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem', flexWrap: 'wrap' }}>
          <Link to="/ia-legal/generador-escritos" className="btn btn-primary">
            Ir al Generador de Escritos <ArrowRight size={15} />
          </Link>
          <Link to="/escritos" className="btn btn-outline">
            Ver Escritos del Estudio
          </Link>
        </div>
      </div>
    </div>
  );
};

