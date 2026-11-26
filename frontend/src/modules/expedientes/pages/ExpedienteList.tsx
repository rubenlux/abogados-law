import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Archive,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Briefcase,
} from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import type { Expediente, ExpedienteEstado } from '../types';
import {
  ESTADO_LABELS,
  FUERO_OPTIONS,
  getEstadoStyle,
} from '../types';

export const ExpedienteList: React.FC = () => {
  const navigate = useNavigate();
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('');
  const [fueroFilter, setFueroFilter] = useState<string>('');

  const loadExpedientes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.expedientes.findAll({
        search: search.trim() || undefined,
        estado: estadoFilter || undefined,
        fuero: fueroFilter || undefined,
        page,
        limit: 10,
      });

      if (res && Array.isArray(res.data)) {
        setExpedientes(res.data);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
      } else if (Array.isArray(res)) {
        setExpedientes(res);
        setTotal(res.length);
        setTotalPages(1);
      } else {
        setExpedientes([]);
      }
    } catch (err: unknown) {
      console.error('Error cargando expedientes:', err);
      const msg =
        err instanceof Error ? err.message : 'Error al cargar expedientes';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, estadoFilter, fueroFilter, search]);

  useEffect(() => {
    loadExpedientes();
  }, [loadExpedientes]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadExpedientes();
  };

  const handleArchive = async (id: string, caratula: string) => {
    if (
      !window.confirm(
        `¿Está seguro de que desea archivar el expediente "${caratula}"?`,
      )
    ) {
      return;
    }

    try {
      await apiClient.expedientes.archive(id);
      loadExpedientes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operación denegada';
      alert(`Error al archivar expediente: ${msg}`);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Encabezado */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.875rem',
              marginBottom: '0.5rem',
              fontFamily: 'var(--font-heading)',
            }}
          >
            Expedientes
          </h1>
          <p className="text-muted">
            Gestiona las causas judiciales, clientes vinculados y partes procesales
          </p>
        </div>
        <Link
          to="/expedientes/new"
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={18} /> Nuevo Expediente
        </Link>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div
        className="card"
        style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        <form
          onSubmit={handleSearchSubmit}
          style={{ position: 'relative', flex: '1 1 300px' }}
        >
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: 12,
              top: 10,
              color: 'hsl(var(--hsl-secondary))',
            }}
          />
          <input
            className="input-field"
            placeholder="Buscar por carátula, número de expediente, juzgado o cliente..."
            style={{ paddingLeft: '2.5rem', width: '100%' }}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </form>

        {/* Filtro Estado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} color="hsl(var(--hsl-secondary))" />
          <select
            className="input-field"
            style={{ width: 'auto' }}
            value={estadoFilter}
            onChange={(e) => {
              setEstadoFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Activos (sin archivados)</option>
            {(Object.keys(ESTADO_LABELS) as ExpedienteEstado[]).map((st) => (
              <option key={st} value={st}>
                {ESTADO_LABELS[st]}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro Fuero */}
        <div>
          <select
            className="input-field"
            style={{ width: 'auto' }}
            value={fueroFilter}
            onChange={(e) => {
              setFueroFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los fueros</option>
            {FUERO_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mensaje de Error */}
      {error && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1.5rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'hsl(var(--hsl-danger))',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabla */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.925rem',
          }}
        >
          <thead>
            <tr
              style={{
                background: 'hsl(var(--hsl-surface-muted))',
                textAlign: 'left',
                color: 'hsl(var(--hsl-secondary))',
              }}
            >
              <th style={{ padding: '1rem' }}>Carátula / Autos</th>
              <th style={{ padding: '1rem' }}>Número</th>
              <th style={{ padding: '1rem' }}>Juzgado / Fuero</th>
              <th style={{ padding: '1rem' }}>Estado</th>
              <th style={{ padding: '1rem' }}>Actualizado</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center' }}>
                  Cargando expedientes...
                </td>
              </tr>
            ) : expedientes.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: '3rem',
                    textAlign: 'center',
                    color: 'hsl(var(--hsl-text-muted))',
                  }}
                >
                  <Briefcase
                    size={32}
                    style={{ marginBottom: '0.75rem', opacity: 0.4 }}
                  />
                  <div>No se encontraron expedientes con los criterios seleccionados.</div>
                </td>
              </tr>
            ) : (
              expedientes.map((exp) => {
                const stStyle = getEstadoStyle(exp.estado);
                return (
                  <tr
                    key={exp.id}
                    style={{
                      borderBottom: '1px solid hsl(var(--hsl-border))',
                      transition: 'background 0.2s',
                    }}
                  >
                    <td style={{ padding: '1rem' }}>
                      <Link
                        to={`/expedientes/${exp.id}`}
                        style={{
                          fontWeight: 600,
                          color: 'hsl(var(--hsl-text-main))',
                          textDecoration: 'none',
                          display: 'block',
                        }}
                      >
                        {exp.caratula}
                      </Link>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'hsl(var(--hsl-text-muted))',
                        }}
                      >
                        {exp.jurisdiccion}
                        {exp.provincia ? ` • ${exp.provincia}` : ''}
                        {exp.materia ? ` • ${exp.materia}` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', fontFamily: 'monospace' }}>
                      {exp.numeroExpediente}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div>{exp.juzgado}</div>
                      {exp.fuero && (
                        <div
                          style={{
                            fontSize: '0.8rem',
                            color: 'hsl(var(--hsl-text-muted))',
                          }}
                        >
                          Fuero {exp.fuero}
                          {exp.secretaria ? ` • ${exp.secretaria}` : ''}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.25rem 0.6rem',
                          borderRadius: '4px',
                          backgroundColor: stStyle.bg,
                          color: stStyle.color,
                        }}
                      >
                        {ESTADO_LABELS[exp.estado] || exp.estado}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '1rem',
                        color: 'hsl(var(--hsl-text-muted))',
                      }}
                    >
                      {new Date(exp.updatedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          gap: '0.25rem',
                          alignItems: 'center',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => navigate(`/expedientes/${exp.id}`)}
                          className="btn btn-ghost"
                          title="Ver detalle"
                          style={{ padding: '0.4rem' }}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/expedientes/${exp.id}/edit`)}
                          className="btn btn-ghost"
                          title="Editar"
                          style={{ padding: '0.4rem' }}
                        >
                          <Edit2 size={16} />
                        </button>
                        {exp.estado !== 'ARCHIVADO' && (
                          <button
                            type="button"
                            onClick={() => handleArchive(exp.id, exp.caratula)}
                            className="btn btn-ghost"
                            title="Archivar"
                            style={{
                              padding: '0.4rem',
                              color: 'hsl(var(--hsl-danger))',
                            }}
                          >
                            <Archive size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Paginación */}
        {!loading && total > 0 && (
          <div
            style={{
              padding: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid hsl(var(--hsl-border))',
              fontSize: '0.875rem',
            }}
          >
            <span className="text-muted">
              Mostrando {expedientes.length} de {total} expedientes (Página{' '}
              {page} de {totalPages})
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ padding: '0.35rem 0.75rem' }}
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{ padding: '0.35rem 0.75rem' }}
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
