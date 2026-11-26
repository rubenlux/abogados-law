import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  Plus,
  Edit2,
  Ban,
  CalendarPlus,
  Clock,
  ArrowUpDown,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import type {
  MovimientoProcesal,
  TipoMovimientoProcesal,
} from '../../agenda/types';
import { TIPO_MOVIMIENTO_LABELS } from '../../agenda/types';

interface Props {
  expedienteId: string;
}

const toLocalDatetimeInput = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const ProceduralTimelineSection: React.FC<Props> = ({
  expedienteId,
}) => {
  const [movimientos, setMovimientos] = useState<MovimientoProcesal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [tipo, setTipo] = useState<TipoMovimientoProcesal>('PRESENTACION');
  const [titulo, setTitulo] = useState('');
  const [fechaActuacion, setFechaActuacion] = useState(() =>
    toLocalDatetimeInput(new Date().toISOString()),
  );
  const [referencia, setReferencia] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const loadMovimientos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.movimientos.findAll({
        expedienteId,
        order,
        page: 1,
        limit: 50,
      });
      setMovimientos(Array.isArray(res?.data) ? res.data : []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al cargar la cronología procesal',
      );
    } finally {
      setLoading(false);
    }
  }, [expedienteId, order]);

  useEffect(() => {
    loadMovimientos();
  }, [loadMovimientos]);

  const resetForm = () => {
    setEditingId(null);
    setTipo('PRESENTACION');
    setTitulo('');
    setFechaActuacion(toLocalDatetimeInput(new Date().toISOString()));
    setReferencia('');
    setDescripcion('');
    setFormError(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (m: MovimientoProcesal) => {
    setEditingId(m.id);
    setTipo(m.tipo);
    setTitulo(m.titulo);
    setFechaActuacion(toLocalDatetimeInput(m.fechaActuacion));
    setReferencia(m.referencia || '');
    setDescripcion(m.descripcion || '');
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!titulo.trim() || !fechaActuacion) {
      setFormError('Título y fecha de actuación son obligatorios.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const isoActuacion = new Date(fechaActuacion).toISOString();
      if (editingId) {
        await apiClient.movimientos.update(editingId, {
          tipo,
          titulo: titulo.trim(),
          fechaActuacion: isoActuacion,
          referencia: referencia.trim() || null,
          descripcion: descripcion.trim() || null,
        });
      } else {
        await apiClient.movimientos.create({
          expedienteId,
          tipo,
          titulo: titulo.trim(),
          fechaActuacion: isoActuacion,
          ...(referencia.trim() ? { referencia: referencia.trim() } : {}),
          ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
        });
      }
      setShowForm(false);
      resetForm();
      loadMovimientos();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el movimiento procesal',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnnul = async (m: MovimientoProcesal) => {
    const motivo = window.prompt(
      `Motivo de anulación del movimiento "${m.titulo}" (opcional):`,
    );
    if (motivo === null) return;
    try {
      await apiClient.movimientos.annul(m.id, motivo.trim() || undefined);
      loadMovimientos();
    } catch (err: unknown) {
      alert(
        err instanceof Error
          ? err.message
          : 'No autorizado o error al anular movimiento',
      );
    }
  };

  return (
    <section className="card" style={{ padding: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={18} color="hsl(var(--hsl-primary))" />
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
            Cronología de Movimientos Procesales ({movimientos.length})
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
            onClick={() => setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
            title="Cambiar orden cronológico"
          >
            <ArrowUpDown size={14} />{' '}
            {order === 'desc' ? 'Más recientes' : 'Más antiguos'}
          </button>
          <Link
            to={`/agenda?expedienteId=${expedienteId}&new=1`}
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
          >
            <CalendarPlus size={14} /> Evento
          </Link>
          <Link
            to={`/vencimientos?expedienteId=${expedienteId}&new=1`}
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
          >
            <Clock size={14} /> Vencimiento
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
            onClick={() => (showForm ? setShowForm(false) : openCreate())}
          >
            <Plus size={14} /> {showForm ? 'Cerrar' : 'Registrar Movimiento'}
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '1rem',
            background: 'hsl(var(--hsl-surface-muted))',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ fontSize: '0.95rem', marginTop: 0, marginBottom: '0.75rem' }}>
            {editingId ? 'Editar Movimiento Procesal' : 'Nuevo Movimiento Procesal'}
          </h3>

          {formError && (
            <div
              style={{
                padding: '0.6rem 0.75rem',
                marginBottom: '0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: 'hsl(var(--hsl-danger))',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
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
              gap: '0.75rem',
            }}
          >
            <div className="form-group">
              <label className="label">Tipo de Movimiento *</label>
              <select
                className="input-field"
                value={tipo}
                onChange={(e) =>
                  setTipo(e.target.value as TipoMovimientoProcesal)
                }
              >
                {(
                  Object.keys(TIPO_MOVIMIENTO_LABELS) as TipoMovimientoProcesal[]
                ).map((t) => (
                  <option key={t} value={t}>
                    {TIPO_MOVIMIENTO_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Fecha y Hora de Actuación *</label>
              <input
                type="datetime-local"
                required
                className="input-field"
                value={fechaActuacion}
                onChange={(e) => setFechaActuacion(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="label">Título *</label>
              <input
                required
                className="input-field"
                placeholder="Ej: Providencia de apertura a prueba"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="label">Referencia / N° Actuación (Opcional)</label>
              <input
                className="input-field"
                placeholder="Ej: Fs. 42 / Escrito N° 1054"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="label">Descripción u Observaciones</label>
              <textarea
                rows={3}
                className="input-field"
                placeholder="Detalle de la actuación judicial ocurrida..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: '0.75rem',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem',
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
                  : 'Registrar Movimiento'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div
          style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'hsl(var(--hsl-danger))',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted" style={{ fontSize: '0.9rem' }}>
          Cargando cronología procesal...
        </p>
      ) : movimientos.length === 0 ? (
        <p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>
          No hay movimientos procesales registrados en este expediente.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {movimientos.map((m) => (
            <div
              key={m.id}
              style={{
                padding: '0.9rem 1rem',
                border: '1px solid hsl(var(--hsl-border))',
                borderLeft: '3px solid hsl(var(--hsl-primary))',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span className="badge badge-blue">
                      {TIPO_MOVIMIENTO_LABELS[m.tipo] || m.tipo}
                    </span>
                    <strong>{m.titulo}</strong>
                    {m.referencia && (
                      <span
                        className="text-muted"
                        style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}
                      >
                        [{m.referencia}]
                      </span>
                    )}
                  </div>
                  <div
                    className="text-muted"
                    style={{ fontSize: '0.8rem', marginTop: '0.3rem' }}
                  >
                    <strong>Actuación:</strong>{' '}
                    {new Date(m.fechaActuacion).toLocaleString()} •{' '}
                    <strong>Registrado:</strong>{' '}
                    {new Date(m.fechaRegistro).toLocaleString()}
                    {m.registradoPor?.fullName
                      ? ` • por ${m.registradoPor.fullName}`
                      : ''}
                  </div>
                  {m.descripcion && (
                    <p
                      style={{
                        margin: '0.45rem 0 0',
                        fontSize: '0.875rem',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {m.descripcion}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    title="Editar movimiento"
                    style={{ padding: '0.3rem' }}
                    onClick={() => openEdit(m)}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    title="Anular movimiento"
                    style={{
                      padding: '0.3rem',
                      color: 'hsl(var(--hsl-danger))',
                    }}
                    onClick={() => handleAnnul(m)}
                  >
                    <Ban size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

