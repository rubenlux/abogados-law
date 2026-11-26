import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Users, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import type { Client } from '../../clients/types';
import type {
  ExpedienteEstado,
  RolParteProcesal,
  TipoParte,
} from '../types';
import {
  ESTADO_LABELS,
  FUERO_OPTIONS,
  JURISDICCION_OPTIONS,
  ROL_PARTE_LABELS,
} from '../types';

interface DraftParte {
  localId: string;
  esCliente: boolean;
  clientId?: string;
  nombre: string;
  tipoParte: TipoParte;
  cuitDni: string;
  rol: RolParteProcesal;
  caracter: string;
  observaciones: string;
}

export const NewCasePage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);

  const [formData, setFormData] = useState({
    caratula: '',
    numeroExpediente: '',
    juzgado: '',
    secretaria: '',
    jurisdiccion: 'NACION',
    provincia: '',
    fuero: 'CIVIL',
    tipoProceso: '',
    materia: '',
    fechaInicio: '',
    estado: 'INICIO' as ExpedienteEstado,
    descripcion: '',
  });

  const [partes, setPartes] = useState<DraftParte[]>([]);
  const [newParteMode, setNewParteMode] = useState<'CLIENT' | 'EXTERNAL'>('CLIENT');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [externalNombre, setExternalNombre] = useState('');
  const [externalTipo, setExternalTipo] = useState<TipoParte>('HUMANA');
  const [externalCuitDni, setExternalCuitDni] = useState('');
  const [parteRol, setParteRol] = useState<RolParteProcesal>('ACTOR');
  const [parteCaracter, setParteCaracter] = useState('');

  useEffect(() => {
    const loadClients = async () => {
      try {
        const res = await apiClient.clients.findAll({ limit: 100 });
        if (res && Array.isArray(res.data)) {
          setClients(res.data);
        }
      } catch (err) {
        console.error('No se pudieron cargar los clientes del estudio:', err);
      }
    };
    loadClients();
  }, []);

  const handleAddParte = () => {
    if (newParteMode === 'CLIENT') {
      const cli = clients.find((c) => c.id === selectedClientId);
      if (!cli) return;
      const displayName =
        cli.personType === 'HUMANA'
          ? `${cli.lastName ? `${cli.lastName}, ` : ''}${cli.firstName}`
          : cli.firstName;
      setPartes((prev) => [
        ...prev,
        {
          localId: crypto.randomUUID(),
          esCliente: true,
          clientId: cli.id,
          nombre: displayName,
          tipoParte: cli.personType,
          cuitDni: cli.dniCuit || '',
          rol: parteRol,
          caracter: parteCaracter.trim(),
          observaciones: '',
        },
      ]);
      setSelectedClientId('');
      setParteCaracter('');
    } else {
      if (!externalNombre.trim()) return;
      setPartes((prev) => [
        ...prev,
        {
          localId: crypto.randomUUID(),
          esCliente: false,
          nombre: externalNombre.trim(),
          tipoParte: externalTipo,
          cuitDni: externalCuitDni.trim(),
          rol: parteRol,
          caracter: parteCaracter.trim(),
          observaciones: '',
        },
      ]);
      setExternalNombre('');
      setExternalCuitDni('');
      setParteCaracter('');
    }
  };

  const handleRemoveParte = (localId: string) => {
    setPartes((prev) => prev.filter((p) => p.localId !== localId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        caratula: formData.caratula.trim(),
        numeroExpediente: formData.numeroExpediente.trim(),
        juzgado: formData.juzgado.trim(),
        jurisdiccion: formData.jurisdiccion,
        estado: formData.estado,
      };

      if (formData.secretaria.trim()) payload.secretaria = formData.secretaria.trim();
      if (formData.provincia.trim()) payload.provincia = formData.provincia.trim();
      if (formData.fuero) payload.fuero = formData.fuero;
      if (formData.tipoProceso.trim()) payload.tipoProceso = formData.tipoProceso.trim();
      if (formData.materia.trim()) payload.materia = formData.materia.trim();
      if (formData.fechaInicio) {
        payload.fechaInicio = new Date(formData.fechaInicio).toISOString();
      }
      if (formData.descripcion.trim()) payload.descripcion = formData.descripcion.trim();

      if (partes.length > 0) {
        payload.partes = partes.map((p) => ({
          ...(p.clientId ? { clientId: p.clientId } : {}),
          nombre: p.nombre,
          tipoParte: p.tipoParte,
          ...(p.cuitDni ? { cuitDni: p.cuitDni } : {}),
          rol: p.rol,
          ...(p.caracter ? { caracter: p.caracter } : {}),
          esCliente: p.esCliente,
        }));
      }

      const created = await apiClient.expedientes.create(payload);
      navigate(`/expedientes/${created.id}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Error al crear expediente';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/expedientes')}
          className="btn btn-ghost"
          style={{ padding: '0.5rem' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              fontFamily: 'var(--font-heading)',
            }}
          >
            Nuevo Expediente
          </h1>
          <p className="text-muted">
            Registrar una causa judicial, sus datos de radicación y partes procesales
          </p>
        </div>
      </header>

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

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Sección 1: Identificación */}
        <section className="card" style={{ padding: '1.75rem' }}>
          <h2 style={{ fontSize: '1.15rem', marginBottom: '1.25rem' }}>
            1. Identificación del Expediente
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="label">Carátula *</label>
              <input
                required
                className="input-field"
                placeholder="Ej: PÉREZ, JUAN c/ EMPRESA S.A. s/ DAÑOS Y PERJUICIOS"
                value={formData.caratula}
                onChange={(e) =>
                  setFormData({ ...formData, caratula: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="label">Número de Expediente *</label>
              <input
                required
                className="input-field"
                placeholder="Ej: 12345/2026"
                value={formData.numeroExpediente}
                onChange={(e) =>
                  setFormData({ ...formData, numeroExpediente: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="label">Estado Procesal</label>
              <select
                className="input-field"
                value={formData.estado}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    estado: e.target.value as ExpedienteEstado,
                  })
                }
              >
                {(Object.keys(ESTADO_LABELS) as ExpedienteEstado[])
                  .filter((st) => st !== 'ARCHIVADO')
                  .map((st) => (
                    <option key={st} value={st}>
                      {ESTADO_LABELS[st]}
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Fecha de Inicio</label>
              <input
                type="date"
                className="input-field"
                value={formData.fechaInicio}
                onChange={(e) =>
                  setFormData({ ...formData, fechaInicio: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="label">Tipo de Proceso</label>
              <input
                className="input-field"
                placeholder="Ej: Ordinario, Sumarísimo, Ejecutivo"
                value={formData.tipoProceso}
                onChange={(e) =>
                  setFormData({ ...formData, tipoProceso: e.target.value })
                }
              />
            </div>
          </div>
        </section>

        {/* Sección 2: Datos Judiciales */}
        <section className="card" style={{ padding: '1.75rem' }}>
          <h2 style={{ fontSize: '1.15rem', marginBottom: '1.25rem' }}>
            2. Datos Judiciales y Radicación
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="label">Jurisdicción *</label>
              <select
                className="input-field"
                value={formData.jurisdiccion}
                onChange={(e) =>
                  setFormData({ ...formData, jurisdiccion: e.target.value })
                }
              >
                {JURISDICCION_OPTIONS.map((j) => (
                  <option key={j.value} value={j.value}>
                    {j.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Provincia / Departamento Judicial</label>
              <input
                className="input-field"
                placeholder="Ej: CABA, San Isidro, Córdoba Capital"
                value={formData.provincia}
                onChange={(e) =>
                  setFormData({ ...formData, provincia: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="label">Fuero</label>
              <select
                className="input-field"
                value={formData.fuero}
                onChange={(e) =>
                  setFormData({ ...formData, fuero: e.target.value })
                }
              >
                {FUERO_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Materia</label>
              <input
                className="input-field"
                placeholder="Ej: Daños y Perjuicios, Despido, Sucesión"
                value={formData.materia}
                onChange={(e) =>
                  setFormData({ ...formData, materia: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="label">Juzgado / Dependencia *</label>
              <input
                required
                className="input-field"
                placeholder="Ej: Juzgado Nacional en lo Civil N° 14"
                value={formData.juzgado}
                onChange={(e) =>
                  setFormData({ ...formData, juzgado: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label className="label">Secretaría</label>
              <input
                className="input-field"
                placeholder="Ej: Secretaría Única / N° 28"
                value={formData.secretaria}
                onChange={(e) =>
                  setFormData({ ...formData, secretaria: e.target.value })
                }
              />
            </div>
          </div>
        </section>

        {/* Sección 3: Clientes y Partes Procesales */}
        <section className="card" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Users size={20} />
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>
              3. Clientes y Partes Procesales
            </h2>
          </div>

          <div
            style={{
              padding: '1rem',
              background: 'hsl(var(--hsl-surface-muted))',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                type="button"
                className={`btn ${newParteMode === 'CLIENT' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setNewParteMode('CLIENT')}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
              >
                Vincular Cliente del Estudio
              </button>
              <button
                type="button"
                className={`btn ${newParteMode === 'EXTERNAL' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setNewParteMode('EXTERNAL')}
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
              >
                Agregar Parte Externa (Contraparte / Tercero)
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {newParteMode === 'CLIENT' ? (
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="label">Seleccionar Cliente</label>
                  <select
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
                    <label className="label">Nombre o Razón Social</label>
                    <input
                      className="input-field"
                      placeholder="Ej: Aseguradora Federal S.A."
                      value={externalNombre}
                      onChange={(e) => setExternalNombre(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">DNI / CUIT (Opcional)</label>
                    <input
                      className="input-field"
                      placeholder="Ej: 30-12345678-9"
                      value={externalCuitDni}
                      onChange={(e) => setExternalCuitDni(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Tipo de Persona</label>
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
                <label className="label">Carácter (Opcional)</label>
                <input
                  className="input-field"
                  placeholder="Ej: Por derecho propio, Citada en garantía"
                  value={parteCaracter}
                  onChange={(e) => setParteCaracter(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleAddParte}
                disabled={
                  newParteMode === 'CLIENT'
                    ? !selectedClientId
                    : !externalNombre.trim()
                }
              >
                <Plus size={16} /> Agregar a la lista
              </button>
            </div>
          </div>

          {partes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {partes.map((p) => (
                <div
                  key={p.localId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    border: '1px solid hsl(var(--hsl-border))',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong>{p.nombre}</strong>
                      <span className="badge badge-blue">
                        {ROL_PARTE_LABELS[p.rol]}
                      </span>
                      {p.esCliente && (
                        <span className="badge badge-green">Cliente</span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'hsl(var(--hsl-text-muted))',
                      }}
                    >
                      {p.cuitDni ? `DNI/CUIT: ${p.cuitDni}` : 'Sin documento'}
                      {p.caracter ? ` • ${p.caracter}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => handleRemoveParte(p.localId)}
                    style={{ color: 'hsl(var(--hsl-danger))', padding: '0.35rem' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sección 4: Notas / Descripción */}
        <section className="card" style={{ padding: '1.75rem' }}>
          <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>
            4. Descripción y Observaciones
          </h2>
          <textarea
            className="input-field"
            rows={4}
            placeholder="Síntesis de hechos, estrategia inicial, observaciones relevantes..."
            value={formData.descripcion}
            onChange={(e) =>
              setFormData({ ...formData, descripcion: e.target.value })
            }
          />
        </section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button
            type="button"
            onClick={() => navigate('/expedientes')}
            className="btn btn-ghost"
          >
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            <Save size={18} /> {isLoading ? 'Creando...' : 'Crear Expediente'}
          </button>
        </div>
      </form>
    </div>
  );
};
