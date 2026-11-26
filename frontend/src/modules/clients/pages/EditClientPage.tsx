import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import { ClientForm } from '../components/ClientForm';
import type { Client } from '../types';

export const EditClientPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchClient = async () => {
      setIsFetching(true);
      try {
        const data = await apiClient.clients.findById(id);
        setClient(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al obtener el cliente';
        setFetchError(msg);
      } finally {
        setIsFetching(false);
      }
    };
    fetchClient();
  }, [id]);

  const handleSubmit = async (data: Partial<Client>) => {
    if (!id) return;
    setIsLoading(true);
    try {
      await apiClient.clients.update(id, data);
      alert('Cliente actualizado exitosamente');
      navigate(`/clientes/${id}`);
    } catch (err: unknown) {
      console.error(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '3rem', textAlign: 'center' }}>
        <p className="text-muted">Cargando datos del cliente...</p>
      </div>
    );
  }

  if (fetchError || !client) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ padding: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'hsl(var(--hsl-danger))', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle size={24} />
          <div>
            <h3 style={{ fontWeight: 600 }}>No se pudo cargar el cliente</h3>
            <p>{fetchError || 'El cliente solicitado no existe o pertenece a otra organización.'}</p>
          </div>
        </div>
        <button onClick={() => navigate('/clientes')} className="btn btn-outline" style={{ marginTop: '1rem' }}>
          Volver a Clientes
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button
          onClick={() => navigate(-1)}
          className="btn btn-ghost"
          style={{ padding: '0.5rem' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
            Editar Cliente
          </h1>
          <p className="text-muted">
            Modificar información de {client.personType === 'HUMANA' ? `${client.firstName} ${client.lastName || ''}` : client.firstName}
          </p>
        </div>
      </header>

      <ClientForm
        initialData={client}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/clientes/${id}`)}
        isLoading={isLoading}
        isEdit={true}
      />
    </div>
  );
};
