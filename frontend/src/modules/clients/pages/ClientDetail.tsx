import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  Archive,
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import type { Client } from '../types';

export const ClientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchClient = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.clients.findById(id);
        setClient(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al obtener el cliente';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchClient();
  }, [id]);

  const handleArchive = async () => {
    if (!client || !id) return;
    const name = client.personType === 'HUMANA'
      ? `${client.lastName || ''}, ${client.firstName}`.trim()
      : client.firstName;

    if (!window.confirm(`¿Está seguro de que desea archivar el cliente "${name}"?`)) {
      return;
    }

    try {
      await apiClient.clients.archive(id);
      alert('Cliente archivado exitosamente');
      navigate('/clientes');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operación denegada';
      alert(`Error al archivar cliente: ${msg}`);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem', textAlign: 'center' }}>
        <p className="text-muted">Cargando información del cliente...</p>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ padding: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'hsl(var(--hsl-danger))', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle size={24} />
          <div>
            <h3 style={{ fontWeight: 600 }}>No se encontró el cliente</h3>
            <p>{error || 'El cliente solicitado no existe o pertenece a otra organización.'}</p>
          </div>
        </div>
        <button onClick={() => navigate('/clientes')} className="btn btn-outline" style={{ marginTop: '1rem' }}>
          Volver a Clientes
        </button>
      </div>
    );
  }

  const displayName = client.personType === 'HUMANA'
    ? `${client.lastName || ''}, ${client.firstName}`.trim()
    : client.firstName;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/clientes')} className="btn btn-ghost" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                {displayName}
              </h1>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '4px',
                  backgroundColor:
                    client.status === 'ACTIVO'
                      ? 'rgba(34, 197, 94, 0.15)'
                      : client.status === 'INACTIVO'
                      ? 'rgba(234, 179, 8, 0.15)'
                      : 'rgba(107, 114, 128, 0.2)',
                  color:
                    client.status === 'ACTIVO'
                      ? '#4ade80'
                      : client.status === 'INACTIVO'
                      ? '#facc15'
                      : '#9ca3af',
                  fontWeight: 600,
                }}
              >
                {client.status}
              </span>
            </div>
            <p className="text-muted">
              {client.personType === 'HUMANA' ? 'Persona Humana' : 'Persona Jurídica'} {client.dniCuit ? `• ${client.dniCuit}` : ''}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to={`/clientes/${client.id}/edit`} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Edit2 size={16} /> Editar
          </Link>
          {client.status !== 'ARCHIVADO' && (
            <button
              onClick={handleArchive}
              className="btn btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(var(--hsl-danger))', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            >
              <Archive size={16} /> Archivar
            </button>
          )}
        </div>
      </header>

      {/* Grid de Información Principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Datos de Identificación */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid hsl(var(--hsl-border))', paddingBottom: '0.75rem' }}>
            {client.personType === 'HUMANA' ? <User size={18} color="hsl(var(--hsl-accent))" /> : <Building2 size={18} color="hsl(var(--hsl-accent))" />}
            Identificación
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div>
              <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>Tipo</span>
              <span style={{ fontWeight: 500 }}>{client.personType === 'HUMANA' ? 'Persona Humana' : 'Persona Jurídica'}</span>
            </div>
            <div>
              <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>
                {client.personType === 'HUMANA' ? 'Nombre Completo' : 'Razón Social'}
              </span>
              <span style={{ fontWeight: 500 }}>{displayName}</span>
            </div>
            <div>
              <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>
                {client.personType === 'HUMANA' ? 'DNI / CUIL' : 'CUIT'}
              </span>
              <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>{client.dniCuit || 'No registrado'}</span>
            </div>
            <div>
              <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>Fecha de Registro</span>
              <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={14} color="hsl(var(--hsl-secondary))" />
                {new Date(client.createdAt).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Contacto y Domicilio */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid hsl(var(--hsl-border))', paddingBottom: '0.75rem' }}>
            <MapPin size={18} color="hsl(var(--hsl-accent))" />
            Contacto y Domicilio
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div>
              <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>Correo Electrónico</span>
              <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Mail size={14} color="hsl(var(--hsl-secondary))" />
                {client.email ? <a href={`mailto:${client.email}`} style={{ color: 'hsl(var(--hsl-primary))', textDecoration: 'none' }}>{client.email}</a> : 'No registrado'}
              </span>
            </div>
            <div>
              <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>Teléfono</span>
              <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Phone size={14} color="hsl(var(--hsl-secondary))" />
                {client.phone ? <a href={`tel:${client.phone}`} style={{ color: 'hsl(var(--hsl-primary))', textDecoration: 'none' }}>{client.phone}</a> : 'No registrado'}
              </span>
            </div>
            <div>
              <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>Domicilio</span>
              <span style={{ fontWeight: 500 }}>{client.address || 'No registrado'}</span>
            </div>
            <div>
              <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>Localidad y Provincia</span>
              <span style={{ fontWeight: 500 }}>
                {client.city ? `${client.city}, ${client.province || ''}` : client.province || 'No registrado'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Observaciones Internas (Confidencial del Estudio) */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={18} color="hsl(var(--hsl-accent))" />
          Observaciones Internas
        </h2>
        {client.notes ? (
          <p style={{ fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'hsl(var(--hsl-text-main))' }}>
            {client.notes}
          </p>
        ) : (
          <p className="text-muted" style={{ fontSize: '0.875rem', fontStyle: 'italic' }}>
            Sin observaciones internas registradas para este cliente.
          </p>
        )}
      </div>
    </div>
  );
};
