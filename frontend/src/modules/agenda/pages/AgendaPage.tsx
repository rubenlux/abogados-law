import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  XCircle,
  Edit2,
  MapPin,
  AlertTriangle,
  AlertCircle,
  Search,
} from 'lucide-react';
import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { apiClient } from '../../../core/api/client';
import type { Expediente } from '../../expedientes/types';
import type {
  AgendaEvent,
  EstadoEventoAgenda,
  OverlapWarning,
  TipoEventoAgenda,
} from '../types';
import {
  ESTADO_EVENTO_LABELS,
  TIPO_EVENTO_LABELS,
  getEventoEstadoStyle,
} from '../types';

type AgendaViewMode = 'day' | 'week' | 'month' | 'upcoming';

const toLocalDatetimeInput = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const AgendaPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialExpId = searchParams.get('expedienteId') || '';
  const openNewFromQuery = searchParams.get('new') === '1';

  const [viewMode, setViewMode] = useState<AgendaViewMode>('week');
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [tipoFilter, setTipoFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [expedienteFilter, setExpedienteFilter] = useState(initialExpId);
  const [search, setSearch] = useState('');

  // Formulario Crear / Editar
  const [showForm, setShowForm] = useState(openNewFromQuery);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [overlapNotice, setOverlapNotice] = useState<OverlapWarning | null>(
    null,
  );

  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<TipoEventoAgenda>('AUDIENCIA');
  const [expedienteId, setExpedienteId] = useState(initialExpId);
  const [fechaInicio, setFechaInicio] = useState(() =>
    toLocalDatetimeInput(new Date().toISOString()),
  );
  const [fechaFin, setFechaFin] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [estado, setEstado] = useState<EstadoEventoAgenda>('PROGRAMADO');

  // Rango explícito UTC calculado desde la zona horaria local del navegador
  const range = useMemo(() => {
    if (viewMode === 'day') {
      return {
        from: startOfDay(anchorDate).toISOString(),
        to: endOfDay(anchorDate).toISOString(),
        label: format(anchorDate, "EEEE d 'de' MMMM yyyy", { locale: es }),
      };
    }
    if (viewMode === 'week') {
      const s = startOfWeek(anchorDate, { weekStartsOn: 1 });
      const e = endOfWeek(anchorDate, { weekStartsOn: 1 });
      return {
        from: s.toISOString(),
        to: e.toISOString(),
        label: `${format(s, 'd MMM', { locale: es })} – ${format(e, 'd MMM yyyy', { locale: es })}`,
      };
    }
    if (viewMode === 'month') {
      const s = startOfMonth(anchorDate);
      const e = endOfMonth(anchorDate);
      return {
        from: s.toISOString(),
        to: e.toISOString(),
        label: format(anchorDate, 'MMMM yyyy', { locale: es }),
      };
    }
    const now = new Date();
    return {
      from: now.toISOString(),
      to: addDays(now, 30).toISOString(),
      label: 'Próximos 30 días',
    };
  }, [viewMode, anchorDate]);

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
        // Silencioso si no hay permisos para listar expedientes
      }
    };
    loadExps();
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.agendaActividades.findAll({
        from: range.from,
        to: range.to,
        tipo: tipoFilter || undefined,
        estado: estadoFilter || undefined,
        expedienteId: expedienteFilter || undefined,
        search: search.trim() || undefined,
        page: 1,
        limit: 100,
      });
      setEvents(Array.isArray(res?.data) ? res.data : []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar la agenda',
      );
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, tipoFilter, estadoFilter, expedienteFilter, search]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const navigateRange = (direction: -1 | 1) => {
    if (viewMode === 'day') {
      setAnchorDate((d) => addDays(d, direction));
    } else if (viewMode === 'week') {
      setAnchorDate((d) => addDays(d, direction * 7));
    } else if (viewMode === 'month') {
      setAnchorDate((d) => addMonths(d, direction));
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setTitulo('');
    setTipo('AUDIENCIA');
    setExpedienteId(initialExpId);
    setFechaInicio(toLocalDatetimeInput(new Date().toISOString()));
    setFechaFin('');
    setUbicacion('');
    setDescripcion('');
    setEstado('PROGRAMADO');
    setFormError(null);
  };

  const openEdit = (ev: AgendaEvent) => {
    setEditingId(ev.id);
    setTitulo(ev.titulo);
    setTipo(ev.tipo);
    setExpedienteId(ev.expedienteId || '');
    setFechaInicio(toLocalDatetimeInput(ev.fechaInicio));
    setFechaFin(ev.fechaFin ? toLocalDatetimeInput(ev.fechaFin) : '');
    setUbicacion(ev.ubicacion || '');
    setDescripcion(ev.descripcion || '');
    setEstado(ev.estado);
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!titulo.trim() || !fechaInicio) {
      setFormError('Título y fecha de inicio son obligatorios.');
      return;
    }

    const startIso = new Date(fechaInicio).toISOString();
    const endIso = fechaFin ? new Date(fechaFin).toISOString() : undefined;
    if (endIso && new Date(endIso).getTime() < new Date(startIso).getTime()) {
      setFormError('La fecha de finalización no puede ser anterior al inicio.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setOverlapNotice(null);

    try {
      let result: { event: AgendaEvent; overlapWarning?: OverlapWarning };
      if (editingId) {
        result = await apiClient.agendaActividades.update(editingId, {
          titulo: titulo.trim(),
          tipo,
          expedienteId: expedienteId || null,
          fechaInicio: startIso,
          fechaFin: endIso ?? null,
          ubicacion: ubicacion.trim() || null,
          descripcion: descripcion.trim() || null,
          estado,
        });
      } else {
        result = await apiClient.agendaActividades.create({
          titulo: titulo.trim(),
          tipo,
          ...(expedienteId ? { expedienteId } : {}),
          fechaInicio: startIso,
          ...(endIso ? { fechaFin: endIso } : {}),
          ...(ubicacion.trim() ? { ubicacion: ubicacion.trim() } : {}),
          ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
          estado,
        });
      }

      if (result?.overlapWarning?.hasOverlap) {
        setOverlapNotice(result.overlapWarning);
      }

      setShowForm(false);
      resetForm();
      loadEvents();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : 'Error al guardar el evento',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (ev: AgendaEvent) => {
    try {
      await apiClient.agendaActividades.complete(ev.id);
      loadEvents();
    } catch (err: unknown) {
      alert(
        err instanceof Error ? err.message : 'No se pudo completar el evento',
      );
    }
  };

  const handleCancel = async (ev: AgendaEvent) => {
    if (!window.confirm(`¿Cancelar el evento "${ev.titulo}"?`)) return;
    try {
      await apiClient.agendaActividades.cancel(ev.id);
      loadEvents();
    } catch (err: unknown) {
      alert(
        err instanceof Error ? err.message : 'No se pudo cancelar el evento',
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
            Agenda Judicial
          </h1>
          <p className="text-muted">
            Audiencias, diligencias, reuniones y actividades programadas del estudio
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link to="/vencimientos" className="btn btn-outline">
            Ver Vencimientos
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
            <Plus size={18} /> {showForm ? 'Cerrar Formulario' : 'Nuevo Evento'}
          </button>
        </div>
      </header>

      {/* Aviso no bloqueante de superposición */}
      {overlapNotice?.hasOverlap && (
        <div
          style={{
            padding: '0.9rem 1rem',
            marginBottom: '1.25rem',
            backgroundColor: 'rgba(234, 179, 8, 0.15)',
            color: '#facc15',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontSize: '0.9rem',
          }}
        >
          <AlertTriangle size={18} />
          <span>
            Evento registrado correctamente. Advertencia: se superpone con{' '}
            <strong>{overlapNotice.overlappingCount}</strong> actividad(es) del
            mismo responsable en ese horario.
          </span>
        </div>
      )}

      {/* Formulario Crear / Editar */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="card"
          style={{ padding: '1.5rem', marginBottom: '1.5rem' }}
        >
          <h2 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '1rem' }}>
            {editingId ? 'Editar Evento Programado' : 'Programar Nuevo Evento'}
          </h2>

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
                placeholder="Ej: Audiencia art. 360 CPCCN"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="label">Tipo de Evento *</label>
              <select
                className="input-field"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoEventoAgenda)}
              >
                {(Object.keys(TIPO_EVENTO_LABELS) as TipoEventoAgenda[]).map(
                  (t) => (
                    <option key={t} value={t}>
                      {TIPO_EVENTO_LABELS[t]}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Expediente (Opcional)</label>
              <select
                className="input-field"
                value={expedienteId}
                onChange={(e) => setExpedienteId(e.target.value)}
              >
                <option value="">-- Actividad general del estudio --</option>
                {expedientes.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.numeroExpediente} — {exp.caratula}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Inicio (hora local) *</label>
              <input
                type="datetime-local"
                required
                className="input-field"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="label">Finalización (Opcional)</label>
              <input
                type="datetime-local"
                className="input-field"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="label">Ubicación / Modalidad</label>
              <input
                className="input-field"
                placeholder="Ej: Sala 4 / Zoom / Estudio"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="label">Estado</label>
              <select
                className="input-field"
                value={estado}
                onChange={(e) =>
                  setEstado(e.target.value as EstadoEventoAgenda)
                }
              >
                {(
                  Object.keys(ESTADO_EVENTO_LABELS) as EstadoEventoAgenda[]
                ).map((st) => (
                  <option key={st} value={st}>
                    {ESTADO_EVENTO_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="label">Descripción</label>
              <textarea
                rows={3}
                className="input-field"
                placeholder="Detalles, temario o instrucciones previas..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
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
                  : 'Guardar Evento'}
            </button>
          </div>
        </form>
      )}

      {/* Barra de Vistas, Navegación Temporal y Filtros */}
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          {/* Selector de vista */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {(
              [
                ['day', 'Día'],
                ['week', 'Semana'],
                ['month', 'Mes'],
                ['upcoming', 'Próximos'],
              ] as Array<[AgendaViewMode, string]>
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`btn ${viewMode === mode ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                onClick={() => setViewMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Navegación de período */}
          {viewMode !== 'upcoming' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigateRange(-1)}
                style={{ padding: '0.35rem' }}
              >
                <ChevronLeft size={18} />
              </button>
              <span
                style={{
                  fontWeight: 600,
                  minWidth: '200px',
                  textAlign: 'center',
                  textTransform: 'capitalize',
                }}
              >
                {range.label}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => navigateRange(1)}
                style={{ padding: '0.35rem' }}
              >
                <ChevronRight size={18} />
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
                onClick={() => setAnchorDate(new Date())}
              >
                Hoy
              </button>
            </div>
          )}
        </div>

        {/* Filtros */}
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
              placeholder="Buscar por título o ubicación..."
              style={{ paddingLeft: '2.2rem', width: '100%' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="input-field"
            style={{ width: 'auto' }}
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {(Object.keys(TIPO_EVENTO_LABELS) as TipoEventoAgenda[]).map(
              (t) => (
                <option key={t} value={t}>
                  {TIPO_EVENTO_LABELS[t]}
                </option>
              ),
            )}
          </select>

          <select
            className="input-field"
            style={{ width: 'auto' }}
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {(Object.keys(ESTADO_EVENTO_LABELS) as EstadoEventoAgenda[]).map(
              (st) => (
                <option key={st} value={st}>
                  {ESTADO_EVENTO_LABELS[st]}
                </option>
              ),
            )}
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

      {/* Listado de Eventos */}
      <div className="card" style={{ padding: '1.25rem' }}>
        {loading ? (
          <p className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>
            Cargando eventos de agenda...
          </p>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'hsl(var(--hsl-text-muted))' }}>
            <Calendar size={32} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
            <div>No hay eventos programados para el período y filtros seleccionados.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {events.map((ev) => {
              const stStyle = getEventoEstadoStyle(ev.estado);
              return (
                <div
                  key={ev.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid hsl(var(--hsl-border))',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    opacity: ev.estado === 'CANCELADO' ? 0.65 : 1,
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
                      <strong>{ev.titulo}</strong>
                      <span className="badge badge-blue">
                        {TIPO_EVENTO_LABELS[ev.tipo] || ev.tipo}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          backgroundColor: stStyle.bg,
                          color: stStyle.color,
                        }}
                      >
                        {ESTADO_EVENTO_LABELS[ev.estado] || ev.estado}
                      </span>
                    </div>

                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                      {new Date(ev.fechaInicio).toLocaleString()}
                      {ev.fechaFin
                        ? ` → ${new Date(ev.fechaFin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : ''}
                      {ev.responsable?.fullName
                        ? ` • Resp.: ${ev.responsable.fullName}`
                        : ''}
                    </div>

                    {ev.expediente && (
                      <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
                        Expediente:{' '}
                        <Link
                          to={`/expedientes/${ev.expediente.id}`}
                          style={{ color: 'hsl(var(--hsl-primary))' }}
                        >
                          {ev.expediente.numeroExpediente} — {ev.expediente.caratula}
                        </Link>
                      </div>
                    )}

                    {ev.ubicacion && (
                      <div
                        className="text-muted"
                        style={{
                          fontSize: '0.82rem',
                          marginTop: '0.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <MapPin size={13} /> {ev.ubicacion}
                      </div>
                    )}

                    {ev.descripcion && (
                      <p
                        style={{
                          margin: '0.45rem 0 0',
                          fontSize: '0.875rem',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {ev.descripcion}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    {ev.estado !== 'COMPLETADO' && ev.estado !== 'CANCELADO' && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        title="Marcar completado"
                        style={{ padding: '0.35rem', color: '#4ade80' }}
                        onClick={() => handleComplete(ev)}
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      title="Editar evento"
                      style={{ padding: '0.35rem' }}
                      onClick={() => openEdit(ev)}
                    >
                      <Edit2 size={16} />
                    </button>
                    {ev.estado !== 'CANCELADO' && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        title="Cancelar evento"
                        style={{
                          padding: '0.35rem',
                          color: 'hsl(var(--hsl-danger))',
                        }}
                        onClick={() => handleCancel(ev)}
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
