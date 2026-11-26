import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import { ClientForm } from '../components/ClientForm';
import type { Client } from '../types';

export const NewClientPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: Partial<Client>) => {
    setIsLoading(true);
    try {
      await apiClient.clients.create(data);
      alert('Cliente creado exitosamente');
      navigate('/clientes');
    } catch (err: unknown) {
      console.error(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

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
            Nuevo Cliente
          </h1>
          <p className="text-muted">Dar de alta una persona humana o jurídica en la organización activa</p>
        </div>
      </header>

      <ClientForm
        onSubmit={handleSubmit}
        onCancel={() => navigate('/clientes')}
        isLoading={isLoading}
      />
    </div>
  );
};
