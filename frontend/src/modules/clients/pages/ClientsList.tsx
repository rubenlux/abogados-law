import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  User,
  Building2,
  Eye,
  Edit2,
  Archive,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import type { Client } from '../types';

export const ClientsList: React.FC = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [personTypeFilter, setPersonTypeFilter] = useState<string>('');

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.clients.findAll({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        personType: personTypeFilter || undefined,
        page,
        limit: 10,
      });

      if (res && Array.isArray(res.data)) {
        setClients(res.data);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
      } else {
        setClients([]);
      }
    } catch (err: unknown) {
      console.error('Error cargando clientes:', err);
      const msg = err instanceof Error ? err.message : 'Error al cargar clientes';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, personTypeFilter, search]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadClients();
  };

  const handleArchive = async (id: string, name: string) => {
    if (!window.confirm(`¿Está seguro de que desea archivar el cliente "${name}"?`)) {
      return;
    }

    try {
      await apiClient.clients.archive(id);
      loadClients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operación denegada';
      alert(`Error al archivar cliente: ${msg}`);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>
            Clientes
          </h1>
          <p className="text-muted">Gestiona las personas humanas y jurídicas de tu estudio jurídico</p>
        </div>
        <Link to="/clientes/new" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={18} /> Nuevo Cliente
        </Link>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <form onSubmit={handleSearchSubmit} style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search size={18} style={{ position: 'absolute', left: 12, top: 10, color: 'hsl(var(--hsl-secondary))' }} />
          <input
            className="input-field"
            placeholder="Buscar por nombre, razón social, DNI/CUIT o contacto..."
            style={{ paddingLeft: '2.5rem', width: '100%' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        {/* Filtro Tipo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} color="hsl(var(--hsl-secondary))" />
          <select
            className="input-field"
            style={{ width: 'auto' }}
            value={personTypeFilter}
            onChange={(e) => {
              setPersonTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los tipos</option>
            <option value="HUMANA">Persona Humana</option>
            <option value="JURIDICA">Persona Jurídica</option>
          </select>
        </div>

        {/* Filtro Estado */}
        <div>
          <select
            className="input-field"
            style={{ width: 'auto' }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Activos e Inactivos</option>
            <option value="ACTIVO">Solo Activos</option>
            <option value="INACTIVO">Solo Inactivos</option>
            <option value="ARCHIVADO">Archivados</option>
          </select>
        </div>

        <button type="button" onClick={handleSearchSubmit} className="btn btn-outline">
          Buscar
        </button>
      </div>

      {/* Mensaje de Error */}
      {error && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'hsl(var(--hsl-danger))', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabla de Clientes */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'hsl(var(--hsl-secondary))' }}>
            Cargando clientes...
          </div>
        ) : clients.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <User size={48} style={{ color: 'hsl(var(--hsl-secondary))', opacity: 0.5, marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No se encontraron clientes</h3>
            <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
              {search || statusFilter || personTypeFilter
                ? 'No hay resultados para los filtros seleccionados.'
                : 'Comienza creando el primer cliente para tu organización.'}
            </p>
            <Link to="/clientes/new" className="btn btn-primary">
              <Plus size={16} /> Crear Cliente
            </Link>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid hsl(var(--hsl-border))', backgroundColor: 'hsl(var(--hsl-surface-muted))', color: 'hsl(var(--hsl-text-muted))', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '0.75rem 1.5rem' }}>Cliente / Razón Social</th>
                <th style={{ padding: '0.75rem 1rem' }}>Tipo</th>
                <th style={{ padding: '0.75rem 1rem' }}>DNI / CUIT</th>
                <th style={{ padding: '0.75rem 1rem' }}>Contacto</th>
                <th style={{ padding: '0.75rem 1rem' }}>Localidad</th>
                <th style={{ padding: '0.75rem 1rem' }}>Estado</th>
                <th style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const displayName = c.personType === 'HUMANA'
                  ? `${c.lastName || ''}, ${c.firstName}`.trim()
                  : c.firstName;

                return (
                  <tr
                    key={c.id}
                    style={{ borderBottom: '1px solid hsl(var(--hsl-border))', transition: 'background-color 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <Link
                        to={`/clientes/${c.id}`}
                        style={{ fontWeight: 600, color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                      >
                        {displayName}
                      </Link>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          backgroundColor: c.personType === 'HUMANA' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                          color: c.personType === 'HUMANA' ? '#60a5fa' : '#c084fc',
                        }}
                      >
                        {c.personType === 'HUMANA' ? <User size={12} /> : <Building2 size={12} />}
                        {c.personType === 'HUMANA' ? 'Humana' : 'Jurídica'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: 'hsl(var(--hsl-secondary))', fontFamily: 'monospace' }}>
                      {c.dniCuit || '—'}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                      <div>{c.email || '—'}</div>
                      <div style={{ color: 'hsl(var(--hsl-secondary))', fontSize: '0.75rem' }}>{c.phone || ''}</div>
                    </td>
                    <td style={{ padding: '1rem', color: 'hsl(var(--hsl-secondary))' }}>
                      {c.city ? `${c.city}, ${c.province || ''}` : c.province || '—'}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor:
                            c.status === 'ACTIVO'
                              ? 'rgba(34, 197, 94, 0.15)'
                              : c.status === 'INACTIVO'
                              ? 'rgba(234, 179, 8, 0.15)'
                              : 'rgba(107, 114, 128, 0.2)',
                          color:
                            c.status === 'ACTIVO'
                              ? '#4ade80'
                              : c.status === 'INACTIVO'
                              ? '#facc15'
                              : '#9ca3af',
                        }}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          onClick={() => navigate(`/clientes/${c.id}`)}
                          className="btn btn-ghost"
                          style={{ padding: '0.4rem', color: 'hsl(var(--hsl-secondary))' }}
                          title="Ver detalle"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => navigate(`/clientes/${c.id}/edit`)}
                          className="btn btn-ghost"
                          style={{ padding: '0.4rem', color: 'hsl(var(--hsl-secondary))' }}
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        {c.status !== 'ARCHIVADO' && (
                          <button
                            onClick={() => handleArchive(c.id, displayName)}
                            className="btn btn-ghost"
                            style={{ padding: '0.4rem', color: 'hsl(var(--hsl-danger))' }}
                            title="Archivar"
                          >
                            <Archive size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Paginación */}
        {total > 0 && (
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid hsl(var(--hsl-border))',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.875rem',
              color: 'hsl(var(--hsl-secondary))',
            }}
          >
            <span>
              Mostrando {clients.length} de {total} clientes
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn btn-outline"
                style={{ padding: '0.4rem 0.6rem' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                Página {page} de {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="btn btn-outline"
                style={{ padding: '0.4rem 0.6rem' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
