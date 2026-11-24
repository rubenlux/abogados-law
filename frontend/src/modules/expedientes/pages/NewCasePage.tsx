
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Upload } from 'lucide-react';
import { apiClient } from '../../../core/api/client';

export const NewCasePage = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [formData, setFormData] = useState({
        caratula: '',
        numero: '',
        juzgado: '',
        jurisdiccion: 'NACION',
        fuero: 'CIVIL',
        descripcion: ''
    });

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await apiClient.expedientes.create(formData);

            // Simulation of file upload after record creation
            if (files.length > 0) {
                // In a real app we would upload the files here
                console.log('Uploading files:', files.map(f => f.name));
            }

            alert('Expediente creado exitosamente');
            navigate('/expedientes');
        } catch (error) {
            console.error(error);
            alert('Error al crear expediente');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button onClick={() => navigate(-1)} className="btn btn-ghost" style={{ padding: '0.5rem' }}>
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Nuevo Expediente</h1>
                    <p className="text-muted">Dar de alta una nueva causa en el sistema</p>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="card" style={{ padding: '2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="label">Carátula</label>
                        <input
                            required
                            className="input-field"
                            placeholder="Ej: PEREZ, JUAN c/ EMPRESA S.A. s/ DESPIDO"
                            value={formData.caratula}
                            onChange={(e) => setFormData({ ...formData, caratula: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="label">Número de Expediente</label>
                        <input
                            required
                            className="input-field"
                            placeholder="Ej: 12345/2024"
                            value={formData.numero}
                            onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="label">Juzgado / Dependencia</label>
                        <input
                            required
                            className="input-field"
                            placeholder="Ej: Juzgado Civil 1"
                            value={formData.juzgado}
                            onChange={(e) => setFormData({ ...formData, juzgado: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="label">Jurisdicción</label>
                        <select
                            className="input-field"
                            value={formData.jurisdiccion}
                            onChange={(e) => setFormData({ ...formData, jurisdiccion: e.target.value })}
                        >
                            <option value="NACION">Nación (Federal)</option>
                            <option value="CABA">Ciudad Autónoma de Buenos Aires</option>
                            <option value="BUENOS_AIRES">Buenos Aires</option>
                            <option value="CATAMARCA">Catamarca</option>
                            <option value="CHACO">Chaco</option>
                            <option value="CHUBUT">Chubut</option>
                            <option value="CORDOBA">Córdoba</option>
                            <option value="CORRIENTES">Corrientes</option>
                            <option value="ENTRE_RIOS">Entre Ríos</option>
                            <option value="FORMOSA">Formosa</option>
                            <option value="JUJUY">Jujuy</option>
                            <option value="LA_PAMPA">La Pampa</option>
                            <option value="LA_RIOJA">La Rioja</option>
                            <option value="MENDOZA">Mendoza</option>
                            <option value="MISIONES">Misiones</option>
                            <option value="NEUQUEN">Neuquén</option>
                            <option value="RIO_NEGRO">Río Negro</option>
                            <option value="SALTA">Salta</option>
                            <option value="SAN_JUAN">San Juan</option>
                            <option value="SAN_LUIS">San Luis</option>
                            <option value="SANTA_CRUZ">Santa Cruz</option>
                            <option value="SANTA_FE">Santa Fe</option>
                            <option value="SANTIAGO_DEL_ESTERO">Santiago del Estero</option>
                            <option value="TIERRA_DEL_FUEGO">Tierra del Fuego, Antártida e IAS</option>
                            <option value="TUCUMAN">Tucumán</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="label">Fuero</label>
                        <select
                            className="input-field"
                            value={formData.fuero}
                            onChange={(e) => setFormData({ ...formData, fuero: e.target.value })}
                        >
                            <option value="CIVIL">Civil</option>
                            <option value="COMERCIAL">Comercial</option>
                            <option value="LABORAL">Laboral</option>
                            <option value="PENAL">Penal</option>
                            <option value="FAMILIA">Familia</option>
                            <option value="CONTENCIOSO">Contencioso Administrativo</option>
                        </select>
                    </div>

                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="label">Notas / Descripción Inicial</label>
                        <textarea
                            className="input-field"
                            rows={3}
                            placeholder="Detalles adicionales sobre el caso..."
                            value={formData.descripcion}
                            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                        />
                    </div>

                    {/* File Upload Widget */}
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="label">Documentación Inicial (Opcional)</label>

                        <input
                            type="file"
                            multiple
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileSelect}
                        />

                        <div
                            style={{
                                border: '2px dashed hsl(var(--hsl-border))',
                                borderRadius: '0.75rem',
                                padding: '2rem',
                                textAlign: 'center',
                                cursor: 'pointer',
                                backgroundColor: 'hsl(var(--hsl-surface-muted))',
                                transition: 'all 0.2s'
                            }}
                            className="hover:border-primary"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload size={24} style={{ marginBottom: '1rem', color: 'hsl(var(--hsl-text-muted))' }} />
                            <p style={{ fontWeight: 500 }}>Arrastra archivos aquí o haz clic para subir</p>
                            <p className="text-muted" style={{ fontSize: '0.8rem' }}>Soporta PDF, DOCX, JPG (Máx 20MB)</p>
                        </div>

                        {files.length > 0 && (
                            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {files.map((file, index) => (
                                    <div key={index} style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        fontSize: '0.85rem', padding: '0.5rem',
                                        background: 'hsl(var(--hsl-surface))', borderRadius: '4px'
                                    }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'hsl(var(--hsl-success))' }}></div>
                                        <span>{file.name}</span>
                                        <span className="text-muted" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button type="button" onClick={() => navigate(-1)} className="btn btn-ghost">
                        Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isLoading}>
                        <Save size={18} /> {isLoading ? 'Creando...' : 'Crear Expediente'}
                    </button>
                </div>
            </form>
        </div>
    );
}
