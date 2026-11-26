import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
  Edit2,
  AlertTriangle,
  AlertCircle,
  Search,
} from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import type { Expediente } from '../../expedientes/types';
import type {
  EstadoVencimiento,
  PrioridadVencimiento,
  TipoVencimiento,
  Vencimiento,
} from '../../agenda/types';
import {
  ESTADO_VENCIMIENTO_LABELS,
  PRIORIDAD_VENCIMIENTO_LABELS,
  TIPO_VENCIMIENTO_LABELS,
  getPrioridadStyle,
  getVencimientoEstadoStyle,
} from '../../agenda/types';

type VencimientoScope =
  | 'all'
  | 'pendientes'
  | 'proximos'
  | 'vencidos'
  | 'cumplidos';

const toLocalDatetimeInput = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const VencimientosPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialExpId = searchParams.get('expedienteId') || '';
  const openNewFromQuery = searchParams.get('new') === '1';

  const [scope, setScope] = useState<VencimientoScope>('pendientes');
  const [vencimientos, setVencimientos] = useState<Vencimiento[]>([]);
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [prioridadFilter, setPrioridadFilter] = useState('');
  const [expedienteFilter, setExpedienteFilter] = useState(initialExpId);
  const [search, setSearch] = useState('');

  // Formulario
  const [showForm, setShowForm] = useState(openNewFromQuery);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<TipoVencimiento>('PROCESAL');
  const [prioridad, setPrioridad] = useState<PrioridadVencimiento>('NORMAL');
  const [estado, setEstado] = useState<EstadoVencimiento>('PENDIENTE');
  const [expedienteId, setExpedienteId] = useState(initialExpId);
  const [fechaLimite, setFechaLimite] = useState(() =>
    toLocalDatetimeInput(
      new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
    ),
  );
  const [descripcion, setDescripcion] = useState('');
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    const loadExps = async () => {
      try {
        const res = await apiClient.expedientes.findAll({ page: 1, limit: 100 });
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
            ? res
            : [];
        setExpedientes(list);
      } catch {
        // Ignorar si el rol no tiene acceso a listado de expedientes
      }
    };
    loadExps();
  }, []);

  const loadVencimientos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.vencimientos.findAll({
        scope,
        upcomingDays: 7,
        prioridad: prioridadFilter || undefined,
        expedienteId: expedienteFilter || undefined,
        search: search.trim() || undefined,
        page: 1,
        limit: 100,
      });
      setVencimientos(Array.isArray(res?.data) ? res.data : []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar vencimientos',
      );
    } finally {
      setLoading(false);
    }
  }, [scope, prioridadFilter, expedienteFilter, search]);

  useEffect(() => {
    loadVencimientos();
  }, [loadVencimientos]);

  const resetForm = () => {
    setEditingId(null);
    setTitulo('');
    setTipo('PROCESAL');
    setPrioridad('NORMAL');
    setEstado('PENDIENTE');
    setExpedienteId(initialExpId);
    setFechaLimite(
      toLocalDatetimeInput(
        new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
      ),
    );
    setDescripcion('');
    setObservaciones('');
    setFormError(null);
  };

  const openEdit = (v: Vencimiento) => {
    setEditingId(v.id);
    setTitulo(v.titulo);
    setTipo(v.tipo);
    setPrioridad(v.prioridad);
    setEstado(v.estado);
    setExpedienteId(v.expedienteId || '');
    setFechaLimite(toLocalDatetimeInput(v.fechaLimite));
    setDescripcion(v.descripcion || '');
    setObservaciones(v.observaciones || '');
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!titulo.trim() || !fechaLimite) {
      setFormError('Título y fecha límite son obligatorios.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const isoLimit = new Date(fechaLimite).toISOString();
      if (editingId) {
        await apiClient.vencimientos.update(editingId, {
          titulo: titulo.trim(),
          tipo,
          prioridad,
          estado,
          expedienteId: expedienteId || null,
          fechaLimite: isoLimit,
          descripcion: descripcion.trim() || null,
          observaciones: observaciones.trim() || null,
        });
      } else {
        await apiClient.vencimientos.create({
          titulo: titulo.trim(),
          tipo,
          prioridad,
          estado,
          ...(expedienteId ? { expedienteId } : {}),
          fechaLimite: isoLimit,
          ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
          ...(observaciones.trim()
            ? { observaciones: observaciones.trim() }
            : {}),
        });
      }
      setShowForm(false);
      resetForm();
      loadVencimientos();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : 'Error al guardar vencimiento',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (v: Vencimiento) => {
    const obs = window.prompt(
      `Confirmar cumplimiento de "${v.titulo}". Observaciones (opcional):`,
      '',
    );
    if (obs === null) return;
    try {
      await apiClient.vencimientos.complete(v.id, obs.trim() || undefined);
      loadVencimientos();
    } catch (err: unknown) {
      alert(
        err instanceof Error
          ? err.message
          : 'No se pudo marcar como cumplido',
      );
    }
  };

  const handleCancel = async (v: Vencimiento) => {
    if (!window.confirm(`¿Cancelar el vencimiento "${v.titulo}"?`)) return;
    try {
      await apiClient.vencimientos.cancel(v.id);
      loadVencimientos();
    } catch (err: unknown) {
      alert(
        err instanceof Error
          ? err.message
          : 'No se pudo cancelar el vencimiento',
      );
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.875rem',
              marginBottom: '0.35rem',
              fontFamily: 'var(--font-heading)',
            }}
          >
            Vencimientos
          </h1>
          <p className="text-muted">
            Seguimiento de fechas límite ingresadas y confirmadas manualmente por el estudio
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/agenda" className="btn btn-outline">
            Ver Agenda
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (showForm) {
                setShowForm(false);
              } else {
                resetForm();
                setShowForm(true);
              }
            }}
          >
            <Plus size={18} />{' '}
            {showForm ? 'Cerrar Formulario' : 'Nuevo Vencimiento'}
          </button>
        </div>
      </header>

      {/* Formulario */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="card"
          style={{ padding: '1.5rem', marginBottom: '1.5rem' }}
        >
          <h2 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '0.35rem' }}>
            {editingId ? 'Editar Vencimiento' : 'Registrar Vencimiento Manual'}
          </h2>
          <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: 0, marginBottom: '1rem' }}>
            La fecha límite es ingresada y confirmada manualmente por el usuario (sin cálculo automático de plazos jurídicos).
          </p>

          {formError && (
            <div
              style={{
                padding: '0.75rem',
                marginBottom: '1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: 'hsl(var(--hsl-danger))',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
              }}
            >
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
            }}
          >
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="label">Título *</label>
              <input
                required
                className="input-field"
                placeholder="Ej: Contestar traslado de demanda"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="label">
                Fecha y Hora Límite (ingresada por usuario) *
              </label>
              <input
                type="datetime-local"
                required
                className="input-field"
                value={fechaLimite}
                onChange={(e) => setFechaLimite(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="label">Expediente (Opcional)</label>
              <select
                className="input-field"
                value={expedienteId}
                onChange={(e) => setExpedienteId(e.target.value)}
              >
                <option value="">-- Sin expediente asociado --</option>
                {expedientes.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.numeroExpediente} — {exp.caratula}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Tipo</label>
              <select
                className="input-field"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoVencimiento)}
              >
                {(Object.keys(TIPO_VENCIMIENTO_LABELS) as TipoVencimiento[]).map(
                  (t) => (
                    <option key={t} value={t}>
                      {TIPO_VENCIMIENTO_LABELS[t]}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Prioridad</label>
              <select
                className="input-field"
                value={prioridad}
                onChange={(e) =>
                  setPrioridad(e.target.value as PrioridadVencimiento)
                }
              >
                {(
                  Object.keys(
                    PRIORIDAD_VENCIMIENTO_LABELS,
                  ) as PrioridadVencimiento[]
                ).map((p) => (
                  <option key={p} value={p}>
                    {PRIORIDAD_VENCIMIENTO_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="label">Descripción</label>
              <textarea
                rows={2}
                className="input-field"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="label">Observaciones</label>
              <input
                className="input-field"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: '1rem',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting
                ? 'Guardando...'
                : editingId
                  ? 'Guardar Cambios'
                  : 'Registrar Vencimiento'}
            </button>
          </div>
        </form>
      )}

      {/* Tabs de Vista y Filtros */}
      <div
        className="card"
        style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {(
            [
              ['all', 'Todos'],
              ['pendientes', 'Pendientes'],
              ['proximos', 'Próximos (7 días)'],
              ['vencidos', 'Vencidos'],
              ['cumplidos', 'Cumplidos'],
            ] as Array<[VencimientoScope, string]>
          ).map(([s, label]) => (
            <button
              key={s}
              type="button"
              className={`btn ${scope === s ? 'btn-primary' : 'btn-outline'}`}
              style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
              onClick={() => setScope(s)}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 10,
                top: 11,
                color: 'hsl(var(--hsl-secondary))',
              }}
            />
            <input
              className="input-field"
              placeholder="Buscar por título o descripción..."
              style={{ paddingLeft: '2.2rem', width: '100%' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="input-field"
            style={{ width: 'auto' }}
            value={prioridadFilter}
            onChange={(e) => setPrioridadFilter(e.target.value)}
          >
            <option value="">Todas las prioridades</option>
            {(
              Object.keys(
                PRIORIDAD_VENCIMIENTO_LABELS,
              ) as PrioridadVencimiento[]
            ).map((p) => (
              <option key={p} value={p}>
                {PRIORIDAD_VENCIMIENTO_LABELS[p]}
              </option>
            ))}
          </select>

          <select
            className="input-field"
            style={{ width: 'auto', maxWidth: '260px' }}
            value={expedienteFilter}
            onChange={(e) => setExpedienteFilter(e.target.value)}
          >
            <option value="">Todos los expedientes</option>
            {expedientes.map((exp) => (
              <option key={exp.id} value={exp.id}>
                {exp.numeroExpediente} — {exp.caratula}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1.25rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'hsl(var(--hsl-danger))',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {error}
        </div>
      )}

      {/* Listado */}
      <div className="card" style={{ padding: '1.25rem' }}>
        {loading ? (
          <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>
            Cargando vencimientos...
          </p>
        ) : vencimientos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'hsl(var(--hsl-text-muted))' }}>
            <Clock size={32} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
            <div>No se encontraron vencimientos para el filtro seleccionado.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {vencimientos.map((v) => {
              const prioStyle = getPrioridadStyle(v.prioridad);
              const estStyle = getVencimientoEstadoStyle(v.estado);
              return (
                <div
                  key={v.id}
                  style={{
                    padding: '1rem',
                    border: v.estaVencido
                      ? '1px solid rgba(239, 68, 68, 0.55)'
                      : '1px solid hsl(var(--hsl-border))',
                    borderLeft: v.estaVencido
                      ? '4px solid #ef4444'
                      : `4px solid ${prioStyle.color}`,
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    opacity: v.estado === 'CANCELADO' ? 0.65 : 1,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        marginBottom: '0.35rem',
                      }}
                    >
                      <strong>{v.titulo}</strong>
                      {v.estaVencido && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <AlertTriangle size={12} /> VENCIDO
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          backgroundColor: prioStyle.bg,
                          color: prioStyle.color,
                        }}
                      >
                        Prioridad {PRIORIDAD_VENCIMIENTO_LABELS[v.prioridad]}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          backgroundColor: estStyle.bg,
                          color: estStyle.color,
                        }}
                      >
                        {ESTADO_VENCIMIENTO_LABELS[v.estado]}
                      </span>
                      <span className="badge badge-blue">
                        {TIPO_VENCIMIENTO_LABELS[v.tipo]}
                      </span>
                    </div>

                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                      <strong>Fecha límite manual:</strong>{' '}
                      {new Date(v.fechaLimite).toLocaleString()}
                      {v.responsable?.fullName
                        ? ` • Resp.: ${v.responsable.fullName}`
                        : ''}
                    </div>

                    {v.expediente && (
                      <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
                        Expediente:{' '}
                        <Link
                          to={`/expedientes/${v.expediente.id}`}
                          style={{ color: 'hsl(var(--hsl-primary))' }}
                        >
                          {v.expediente.numeroExpediente} — {v.expediente.caratula}
                        </Link>
                      </div>
                    )}

                    {v.estado === 'CUMPLIDO' && v.cumplidoAt && (
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: '#4ade80',
                          marginTop: '0.25rem',
                        }}
                      >
                        Cumplido el {new Date(v.cumplidoAt).toLocaleString()}
                        {v.cumplidoPor?.fullName
                          ? ` por ${v.cumplidoPor.fullName}`
                          : ''}
                      </div>
                    )}

                    {v.descripcion && (
                      <p style={{ margin: '0.4rem 0 0', fontSize: '0.875rem' }}>
                        {v.descripcion}
                      </p>
                    )}

                    {v.observaciones && (
                      <div
                        className="text-muted"
                        style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}
                      >
                        Obs.: {v.observaciones}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    {v.estado !== 'CUMPLIDO' && v.estado !== 'CANCELADO' && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        title="Marcar cumplido"
                        style={{ padding: '0.35rem', color: '#4ade80' }}
                        onClick={() => handleComplete(v)}
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      title="Editar vencimiento"
                      style={{ padding: '0.35rem' }}
                      onClick={() => openEdit(v)}
                    >
                      <Edit2 size={16} />
                    </button>
                    {v.estado !== 'CANCELADO' && v.estado !== 'CUMPLIDO' && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        title="Cancelar vencimiento"
                        style={{
                          padding: '0.35rem',
                          color: 'hsl(var(--hsl-danger))',
                        }}
                        onClick={() => handleCancel(v)}
                      >
                        <XCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

