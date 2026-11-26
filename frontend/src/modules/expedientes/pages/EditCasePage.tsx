import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../core/api/client';
import type { Expediente, ExpedienteEstado } from '../types';
import {
  ESTADO_LABELS,
  FUERO_OPTIONS,
  JURISDICCION_OPTIONS,
} from '../types';

export const EditCasePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    caratula: '',
    numeroExpediente: '',
    juzgado: '',
    secretaria: '',
    jurisdiccion: 'NACION',
    provincia: '',
    fuero: '',
    tipoProceso: '',
    materia: '',
    fechaInicio: '',
    estado: 'INICIO' as ExpedienteEstado,
    descripcion: '',
  });

  useEffect(() => {
    if (!id) return;
    const fetchExpediente = async () => {
      setLoading(true);
      setError(null);
      try {
        const exp: Expediente = await apiClient.expedientes.findById(id);
        setFormData({
          caratula: exp.caratula || '',
          numeroExpediente: exp.numeroExpediente || '',
          juzgado: exp.juzgado || '',
          secretaria: exp.secretaria || '',
          jurisdiccion: exp.jurisdiccion || 'NACION',
          provincia: exp.provincia || '',
          fuero: exp.fuero || '',
          tipoProceso: exp.tipoProceso || '',
          materia: exp.materia || '',
          fechaInicio: exp.fechaInicio
            ? new Date(exp.fechaInicio).toISOString().slice(0, 10)
            : '',
          estado: exp.estado || 'INICIO',
          descripcion: exp.descripcion || '',
        });
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Error al cargar el expediente';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchExpediente();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        caratula: formData.caratula.trim(),
        numeroExpediente: formData.numeroExpediente.trim(),
        juzgado: formData.juzgado.trim(),
        jurisdiccion: formData.jurisdiccion,
        estado: formData.estado,
        secretaria: formData.secretaria.trim() || null,
        provincia: formData.provincia.trim() || null,
        fuero: formData.fuero || null,
        tipoProceso: formData.tipoProceso.trim() || null,
        materia: formData.materia.trim() || null,
        fechaInicio: formData.fechaInicio
          ? new Date(formData.fechaInicio).toISOString()
          : null,
        descripcion: formData.descripcion.trim() || null,
      };

      await apiClient.expedientes.update(id, payload);
      navigate(`/expedientes/${id}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error al actualizar el expediente';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '850px', margin: '0 auto', padding: '3rem', textAlign: 'center' }}>
        <p className="text-muted">Cargando expediente...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '850px', margin: '0 auto' }}>
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
          onClick={() => navigate(`/expedientes/${id}`)}
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
            Editar Expediente
          </h1>
          <p className="text-muted">
            Actualizar los datos generales, radicación y estado procesal
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

      <form onSubmit={handleSubmit} className="card" style={{ padding: '2rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="label">Carátula *</label>
            <input
              required
              className="input-field"
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
              {(Object.keys(ESTADO_LABELS) as ExpedienteEstado[]).map((st) => (
                <option key={st} value={st}>
                  {ESTADO_LABELS[st]}
                </option>
              ))}
            </select>
          </div>

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
            <label className="label">Provincia / Depto. Judicial</label>
            <input
              className="input-field"
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
              <option value="">-- Sin especificar --</option>
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
              value={formData.secretaria}
              onChange={(e) =>
                setFormData({ ...formData, secretaria: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label className="label">Tipo de Proceso</label>
            <input
              className="input-field"
              value={formData.tipoProceso}
              onChange={(e) =>
                setFormData({ ...formData, tipoProceso: e.target.value })
              }
            />
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

          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="label">Descripción / Observaciones</label>
            <textarea
              className="input-field"
              rows={4}
              value={formData.descripcion}
              onChange={(e) =>
                setFormData({ ...formData, descripcion: e.target.value })
              }
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button
            type="button"
            onClick={() => navigate(`/expedientes/${id}`)}
            className="btn btn-ghost"
          >
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
};

