import React, { useState } from 'react';
import { Save, User, Building2, AlertCircle } from 'lucide-react';
import type { Client, ClientPersonType, ClientStatus } from '../types';

interface ClientFormProps {
  initialData?: Partial<Client>;
  onSubmit: (data: Partial<Client>) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  isEdit?: boolean;
}

export const ClientForm: React.FC<ClientFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  isEdit = false,
}) => {
  const [personType, setPersonType] = useState<ClientPersonType>(
    initialData?.personType || 'HUMANA',
  );
  const [firstName, setFirstName] = useState(initialData?.firstName || '');
  const [lastName, setLastName] = useState(initialData?.lastName || '');
  const [dniCuit, setDniCuit] = useState(initialData?.dniCuit || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [city, setCity] = useState(initialData?.city || '');
  const [province, setProvince] = useState(initialData?.province || 'Buenos Aires');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [status, setStatus] = useState<ClientStatus>(initialData?.status || 'ACTIVO');

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!firstName.trim()) {
      setValidationError(
        personType === 'HUMANA'
          ? 'El nombre es obligatorio'
          : 'La razón social es obligatoria',
      );
      return;
    }

    if (personType === 'HUMANA' && !lastName.trim()) {
      setValidationError('El apellido es obligatorio para personas humanas');
      return;
    }

    const payload: Partial<Client> = {
      personType,
      firstName: firstName.trim(),
      lastName: personType === 'HUMANA' ? lastName.trim() : null,
      dniCuit: dniCuit.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      province: province.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (isEdit) {
      payload.status = status;
    }

    try {
      await onSubmit(payload);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el cliente';
      setValidationError(msg);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: '2rem' }}>
      {validationError && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid hsl(var(--hsl-danger))',
            color: 'hsl(var(--hsl-danger))',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{validationError}</span>
        </div>
      )}

      {/* Selector de Tipo de Persona */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>
          Tipo de Persona
        </label>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            type="button"
            className={`btn ${personType === 'HUMANA' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            onClick={() => setPersonType('HUMANA')}
          >
            <User size={18} /> Persona Humana
          </button>
          <button
            type="button"
            className={`btn ${personType === 'JURIDICA' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            onClick={() => setPersonType('JURIDICA')}
          >
            <Building2 size={18} /> Persona Jurídica (Empresa)
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Nombre / Razón Social */}
        <div className="form-group" style={{ gridColumn: personType === 'JURIDICA' ? 'span 2' : 'span 1' }}>
          <label className="label">
            {personType === 'HUMANA' ? 'Nombre *' : 'Razón Social / Nombre Comercial *'}
          </label>
          <input
            type="text"
            required
            className="input-field"
            placeholder={personType === 'HUMANA' ? 'Ej: Juan Carlos' : 'Ej: Empresa S.A.'}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>

        {/* Apellido (solo Persona Humana) */}
        {personType === 'HUMANA' && (
          <div className="form-group">
            <label className="label">Apellido *</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="Ej: Pérez"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        )}

        {/* DNI o CUIT */}
        <div className="form-group">
          <label className="label">
            {personType === 'HUMANA' ? 'DNI / CUIL' : 'CUIT'}
          </label>
          <input
            type="text"
            className="input-field"
            placeholder={personType === 'HUMANA' ? 'Ej: 20-30123456-7' : 'Ej: 30-70123456-9'}
            value={dniCuit}
            onChange={(e) => setDniCuit(e.target.value)}
          />
        </div>

        {/* Email */}
        <div className="form-group">
          <label className="label">Correo Electrónico</label>
          <input
            type="email"
            className="input-field"
            placeholder="cliente@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* Teléfono */}
        <div className="form-group">
          <label className="label">Teléfono</label>
          <input
            type="text"
            className="input-field"
            placeholder="+54 11 5555-1234"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        {/* Dirección */}
        <div className="form-group">
          <label className="label">Domicilio</label>
          <input
            type="text"
            className="input-field"
            placeholder="Calle y número, piso, depto"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        {/* Ciudad / Localidad */}
        <div className="form-group">
          <label className="label">Localidad / Ciudad</label>
          <input
            type="text"
            className="input-field"
            placeholder="Ej: CABA, La Plata, Córdoba"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>

        {/* Provincia */}
        <div className="form-group">
          <label className="label">Provincia</label>
          <select
            className="input-field"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
          >
            <option value="Buenos Aires">Buenos Aires</option>
            <option value="CABA">Ciudad Autónoma de Buenos Aires (CABA)</option>
            <option value="Catamarca">Catamarca</option>
            <option value="Chaco">Chaco</option>
            <option value="Chubut">Chubut</option>
            <option value="Córdoba">Córdoba</option>
            <option value="Corrientes">Corrientes</option>
            <option value="Entre Ríos">Entre Ríos</option>
            <option value="Formosa">Formosa</option>
            <option value="Jujuy">Jujuy</option>
            <option value="La Pampa">La Pampa</option>
            <option value="La Rioja">La Rioja</option>
            <option value="Mendoza">Mendoza</option>
            <option value="Misiones">Misiones</option>
            <option value="Neuquén">Neuquén</option>
            <option value="Río Negro">Río Negro</option>
            <option value="Salta">Salta</option>
            <option value="San Juan">San Juan</option>
            <option value="San Luis">San Luis</option>
            <option value="Santa Cruz">Santa Cruz</option>
            <option value="Santa Fe">Santa Fe</option>
            <option value="Santiago del Estero">Santiago del Estero</option>
            <option value="Tierra del Fuego">Tierra del Fuego</option>
            <option value="Tucumán">Tucumán</option>
          </select>
        </div>

        {/* Estado (solo en edición) */}
        {isEdit && (
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="label">Estado del Cliente</label>
            <select
              className="input-field"
              value={status}
              onChange={(e) => setStatus(e.target.value as ClientStatus)}
            >
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
              <option value="ARCHIVADO">Archivado</option>
            </select>
          </div>
        )}

        {/* Observaciones Internas */}
        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label className="label">Observaciones Internas</label>
          <textarea
            rows={3}
            className="input-field"
            placeholder="Anotaciones confidenciales, antecedentes del cliente, personas de contacto..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {/* Botones de Acción */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid hsl(var(--hsl-border))', paddingTop: '1.5rem' }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="btn btn-outline"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Save size={18} />
          {isLoading ? 'Guardando...' : isEdit ? 'Actualizar Cliente' : 'Guardar Cliente'}
        </button>
      </div>
    </form>
  );
};
