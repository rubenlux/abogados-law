import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  Archive,
  Scale,
  Building2,
  Calendar,
  Users,
  UserCheck,
  FileText,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import type { Client } from '../../clients/types';
import type {
  Expediente,
  RolParteProcesal,
  TipoParte,
} from '../types';
import {
  ESTADO_LABELS,
  ROL_PARTE_LABELS,
  getEstadoStyle,
} from '../types';
import { ProceduralTimelineSection } from '../components/ProceduralTimelineSection';
import { ExpedienteDocumentsSection } from '../components/ExpedienteDocumentsSection';
import { ExpedienteDraftsSection } from '../components/ExpedienteDraftsSection';

export const CaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado para agregar parte inline
  const [showAddParte, setShowAddParte] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [parteMode, setParteMode] = useState<'CLIENT' | 'EXTERNAL'>('CLIENT');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [externalNombre, setExternalNombre] = useState('');
  const [externalTipo, setExternalTipo] = useState<TipoParte>('HUMANA');
  const [externalCuitDni, setExternalCuitDni] = useState('');
  const [parteRol, setParteRol] = useState<RolParteProcesal>('ACTOR');
  const [parteCaracter, setParteCaracter] = useState('');
  const [parteObservaciones, setParteObservaciones] = useState('');
  const [savingParte, setSavingParte] = useState(false);

  const loadExpediente = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.expedientes.findById(id);
      setExpediente(data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al obtener el expediente';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadExpediente();
  }, [loadExpediente]);

  useEffect(() => {
    if (!showAddParte || clients.length > 0) return;
    const loadClients = async () => {
      try {
        const res = await apiClient.clients.findAll({ limit: 100 });
        if (res && Array.isArray(res.data)) {
          setClients(res.data);
        }
      } catch {
        // Ignorar si el usuario no tiene permiso para listar clientes
      }
    };
    loadClients();
  }, [showAddParte, clients.length]);

  const handleArchive = async () => {
    if (!expediente || !id) return;
    if (
      !window.confirm(
        `¿Está seguro de que desea archivar el expediente "${expediente.caratula}"?`,
      )
    ) {
      return;
    }

    try {
      await apiClient.expedientes.archive(id);
      navigate('/expedientes');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operación denegada';
      alert(`Error al archivar expediente: ${msg}`);
    }
  };

  const handleAddParteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSavingParte(true);
    try {
      const payload: Record<string, unknown> = {
        rol: parteRol,
        ...(parteCaracter.trim() ? { caracter: parteCaracter.trim() } : {}),
        ...(parteObservaciones.trim()
          ? { observaciones: parteObservaciones.trim() }
          : {}),
      };

      if (parteMode === 'CLIENT') {
        const cli = clients.find((c) => c.id === selectedClientId);
        if (!cli) return;
        const displayName =
          cli.personType === 'HUMANA'
            ? `${cli.lastName ? `${cli.lastName}, ` : ''}${cli.firstName}`
            : cli.firstName;
        payload.clientId = cli.id;
        payload.nombre = displayName;
        payload.tipoParte = cli.personType;
        if (cli.dniCuit) payload.cuitDni = cli.dniCuit;
        payload.esCliente = true;
      } else {
        if (!externalNombre.trim()) return;
        payload.nombre = externalNombre.trim();
        payload.tipoParte = externalTipo;
        if (externalCuitDni.trim()) payload.cuitDni = externalCuitDni.trim();
        payload.esCliente = false;
      }

      await apiClient.expedientes.addParte(id, payload);
      setShowAddParte(false);
      setSelectedClientId('');
      setExternalNombre('');
      setExternalCuitDni('');
      setParteCaracter('');
      setParteObservaciones('');
      loadExpediente();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al agregar parte procesal';
      alert(msg);
    } finally {
      setSavingParte(false);
    }
  };

  const handleRemoveParte = async (parteId: string, nombre: string) => {
    if (!id) return;
    if (!window.confirm(`¿Desea quitar a "${nombre}" de las partes procesales?`)) {
      return;
    }
    try {
      await apiClient.expedientes.removeParte(id, parteId);
      loadExpediente();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al eliminar parte procesal';
      alert(msg);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '3rem', textAlign: 'center' }}>
        <p className="text-muted">Cargando información del expediente...</p>
      </div>
    );
  }

  if (error || !expediente) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'hsl(var(--hsl-danger))',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <AlertCircle size={24} />
          <div>
            <h3 style={{ fontWeight: 600 }}>No se encontró el expediente</h3>
            <p>
              {error ||
                'El expediente solicitado no existe o pertenece a otra organización.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/expedientes')}
          className="btn btn-outline"
          style={{ marginTop: '1rem' }}
        >
          Volver a Expedientes
        </button>
      </div>
    );
  }

  const stStyle = getEstadoStyle(expediente.estado);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1050px', margin: '0 auto' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          marginBottom: '2rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1 }}>
          <button
            type="button"
            onClick={() => navigate('/expedientes')}
            className="btn btn-ghost"
            style={{ padding: '0.5rem' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
                marginBottom: '0.35rem',
              }}
            >
              <h1
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 700,
                  margin: 0,
                  fontFamily: 'var(--font-heading)',
                }}
              >
                {expediente.caratula}
              </h1>
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
                {ESTADO_LABELS[expediente.estado] || expediente.estado}
              </span>
            </div>
            <div className="text-muted" style={{ fontSize: '0.9rem' }}>
              Expte. <strong style={{ fontFamily: 'monospace' }}>{expediente.numeroExpediente}</strong>
              {' • '}
              {expediente.juzgado}
              {expediente.secretaria ? ` (${expediente.secretaria})` : ''}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to={`/expedientes/${expediente.id}/edit`} className="btn btn-outline">
            <Edit2 size={16} /> Editar
          </Link>
          {expediente.estado !== 'ARCHIVADO' && (
            <button
              type="button"
              onClick={handleArchive}
              className="btn btn-outline"
              style={{ color: 'hsl(var(--hsl-danger))' }}
            >
              <Archive size={16} /> Archivar
            </button>
          )}
        </div>
      </header>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Datos Judiciales */}
          <section className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Scale size={18} color="hsl(var(--hsl-primary))" />
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Datos Judiciales y Radicación</h2>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                fontSize: '0.9rem',
              }}
            >
              <div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>Jurisdicción</div>
                <div style={{ fontWeight: 500 }}>{expediente.jurisdiccion}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>Provincia / Depto.</div>
                <div style={{ fontWeight: 500 }}>{expediente.provincia || '—'}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>Fuero</div>
                <div style={{ fontWeight: 500 }}>{expediente.fuero || '—'}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>Tipo de Proceso</div>
                <div style={{ fontWeight: 500 }}>{expediente.tipoProceso || '—'}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>Materia</div>
                <div style={{ fontWeight: 500 }}>{expediente.materia || '—'}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>Secretaría</div>
                <div style={{ fontWeight: 500 }}>{expediente.secretaria || '—'}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>Juzgado / Dependencia</div>
                <div style={{ fontWeight: 500 }}>{expediente.juzgado}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>Fecha de Inicio</div>
                <div style={{ fontWeight: 500 }}>
                  {expediente.fechaInicio
                    ? new Date(expediente.fechaInicio).toLocaleDateString()
                    : '—'}
                </div>
              </div>
            </div>
          </section>

          {/* Clientes y Partes Procesales (visible según proyección de rol) */}
          {expediente.partes !== undefined && (
            <section className="card" style={{ padding: '1.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} color="hsl(var(--hsl-primary))" />
                  <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
                    Clientes y Partes Procesales ({expediente.partes.length})
                  </h2>
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
                  onClick={() => setShowAddParte((v) => !v)}
                >
                  <Plus size={14} /> {showAddParte ? 'Cerrar' : 'Agregar Parte'}
                </button>
              </div>

              {showAddParte && (
                <form
                  onSubmit={handleAddParteSubmit}
                  style={{
                    padding: '1rem',
                    background: 'hsl(var(--hsl-surface-muted))',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <button
                      type="button"
                      className={`btn ${parteMode === 'CLIENT' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setParteMode('CLIENT')}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
                    >
                      Cliente existente
                    </button>
                    <button
                      type="button"
                      className={`btn ${parteMode === 'EXTERNAL' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setParteMode('EXTERNAL')}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
                    >
                      Parte externa
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    {parteMode === 'CLIENT' ? (
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="label">Cliente del estudio</label>
                        <select
                          required
                          className="input-field"
                          value={selectedClientId}
                          onChange={(e) => setSelectedClientId(e.target.value)}
                        >
                          <option value="">-- Seleccione un cliente --</option>
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.personType === 'HUMANA'
                                ? `${c.lastName ? `${c.lastName}, ` : ''}${c.firstName}`
                                : c.firstName}
                              {c.dniCuit ? ` (${c.dniCuit})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <>
                        <div className="form-group">
                          <label className="label">Nombre o Razón Social *</label>
                          <input
                            required
                            className="input-field"
                            value={externalNombre}
                            onChange={(e) => setExternalNombre(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="label">DNI / CUIT</label>
                          <input
                            className="input-field"
                            value={externalCuitDni}
                            onChange={(e) => setExternalCuitDni(e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label className="label">Tipo</label>
                          <select
                            className="input-field"
                            value={externalTipo}
                            onChange={(e) =>
                              setExternalTipo(e.target.value as TipoParte)
                            }
                          >
                            <option value="HUMANA">Persona Humana</option>
                            <option value="JURIDICA">Persona Jurídica</option>
                          </select>
                        </div>
                      </>
                    )}

                    <div className="form-group">
                      <label className="label">Rol Procesal</label>
                      <select
                        className="input-field"
                        value={parteRol}
                        onChange={(e) =>
                          setParteRol(e.target.value as RolParteProcesal)
                        }
                      >
                        {(Object.keys(ROL_PARTE_LABELS) as RolParteProcesal[]).map(
                          (rol) => (
                            <option key={rol} value={rol}>
                              {ROL_PARTE_LABELS[rol]}
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="label">Carácter</label>
                      <input
                        className="input-field"
                        placeholder="Ej: Por derecho propio"
                        value={parteCaracter}
                        onChange={(e) => setParteCaracter(e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="label">Observaciones</label>
                      <input
                        className="input-field"
                        value={parteObservaciones}
                        onChange={(e) => setParteObservaciones(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setShowAddParte(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={savingParte}
                    >
                      {savingParte ? 'Guardando...' : 'Guardar Parte'}
                    </button>
                  </div>
                </form>
              )}

              {expediente.partes.length === 0 ? (
                <p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>
                  No hay partes procesales cargadas todavía.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {expediente.partes.map((parte) => (
                    <div
                      key={parte.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        padding: '0.85rem 1rem',
                        border: '1px solid hsl(var(--hsl-border))',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {parte.clientId ? (
                            <Link
                              to={`/clientes/${parte.clientId}`}
                              style={{
                                fontWeight: 600,
                                color: 'hsl(var(--hsl-primary))',
                                textDecoration: 'none',
                              }}
                            >
                              {parte.nombre}
                            </Link>
                          ) : (
                            <strong>{parte.nombre}</strong>
                          )}
                          <span className="badge badge-blue">
                            {ROL_PARTE_LABELS[parte.rol] || parte.rol}
                          </span>
                          {parte.esCliente && (
                            <span className="badge badge-green">Cliente</span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '0.82rem',
                            color: 'hsl(var(--hsl-text-muted))',
                            marginTop: '0.25rem',
                          }}
                        >
                          {parte.cuitDni ? `DNI/CUIT: ${parte.cuitDni}` : ''}
                          {parte.caracter
                            ? `${parte.cuitDni ? ' • ' : ''}${parte.caracter}`
                            : ''}
                        </div>
                        {parte.observaciones && (
                          <div
                            style={{
                              fontSize: '0.82rem',
                              marginTop: '0.25rem',
                              color: 'hsl(var(--hsl-text-main))',
                            }}
                          >
                            {parte.observaciones}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        title="Quitar parte"
                        style={{ color: 'hsl(var(--hsl-danger))', padding: '0.35rem' }}
                        onClick={() => handleRemoveParte(parte.id, parte.nombre)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Cronología de Movimientos Procesales (AUTH-07) */}
          <ProceduralTimelineSection expedienteId={expediente.id} />

          {/* Documentos del Expediente (AUTH-08) */}
          <ExpedienteDocumentsSection expedienteId={expediente.id} />

          {/* Escritos Jurídicos del Expediente (AUTH-09) */}
          <ExpedienteDraftsSection expedienteId={expediente.id} />

          {/* Descripción / Notas */}
          {expediente.descripcion !== undefined && (
            <section className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <FileText size={18} color="hsl(var(--hsl-primary))" />
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Descripción y Observaciones</h2>
              </div>
              <p
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.925rem',
                  color: expediente.descripcion
                    ? 'hsl(var(--hsl-text-main))'
                    : 'hsl(var(--hsl-text-muted))',
                }}
              >
                {expediente.descripcion || 'Sin observaciones registradas.'}
              </p>
            </section>
          )}
        </div>

        {/* Right Column: Equipo Profesional y Metadatos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {(expediente.responsable !== undefined || expediente.users !== undefined) && (
            <section className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <UserCheck size={18} color="hsl(var(--hsl-primary))" />
                <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Equipo Profesional</h2>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  Abogado Responsable
                </div>
                {expediente.responsable ? (
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {expediente.responsable.fullName || expediente.responsable.email}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                      {expediente.responsable.email}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                    Sin responsable asignado
                  </div>
                )}
              </div>

              {expediente.users && expediente.users.length > 0 && (
                <div>
                  <div className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                    Profesionales Asignados ({expediente.users.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {expediente.users.map((u) => (
                      <div
                        key={u.id}
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: 'hsl(var(--hsl-surface-muted))',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div style={{ fontWeight: 500 }}>{u.fullName || u.email}</div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {u.email}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Calendar size={18} color="hsl(var(--hsl-primary))" />
              <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Registro del Sistema</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>Última actualización</div>
                <div>{new Date(expediente.updatedAt).toLocaleString()}</div>
              </div>
              {expediente.createdAt && (
                <div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>Fecha de alta</div>
                  <div>{new Date(expediente.createdAt).toLocaleString()}</div>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'hsl(var(--hsl-text-muted))', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                <Building2 size={14} /> Aislado por organización activa
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
