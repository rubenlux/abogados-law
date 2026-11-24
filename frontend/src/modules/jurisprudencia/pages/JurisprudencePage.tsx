
import { useState, useEffect } from 'react';
import { PencilLoader } from '../../../components/ui/PencilLoader';
import { Search, Filter, BookOpen, Layers, Gavel, Calendar, ChevronRight, Scale, Award, FileText, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../core/api/client';
import { format } from 'date-fns';

export const JurisprudencePage = () => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [selectedSource, setSelectedSource] = useState<'CSJN' | 'FORMOSA'>('CSJN');
    const [filters, setFilters] = useState({ anio: '', tribunal: '', fuero: '' });

    const [results, setResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const data = await apiClient.jurisprudence.getStats();
            setStats(data);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const handleSearch = async () => {
        setIsLoading(true);
        setHasSearched(true);
        try {
            const data = await apiClient.jurisprudence.search({
                query,
                ...filters,
                limit: 20
            });
            // Handle both array and object responses for robustness
            const finalResults = Array.isArray(data) ? data : (data.results || []);
            setResults(finalResults);
        } catch (error) {
            console.error(error);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async () => {
        if (!query || query.length < 3) {
            alert('Por favor ingrese un tema de al menos 3 caracteres para buscar.');
            return;
        }
        setIsImporting(true);
        try {
            const result = await apiClient.jurisprudence.importJurisprudence(query, selectedSource);
            if (result.success > 0) {
                alert(`¡Éxito! Se han importado ${result.success} fallos sobre "${query}" desde ${selectedSource === 'FORMOSA' ? 'Formosa' : 'la CSJN'}.`);
                handleSearch(); // Refresh results
                loadStats();    // Refresh stats
            } else if (result.duplicates > 0) {
                alert('No se encontraron fallos nuevos. Los resultados ya existen en la base de datos.');
                handleSearch();
            } else {
                alert(`No se encontraron resultados para ese tema en la web de ${selectedSource === 'FORMOSA' ? 'Formosa' : 'la CSJN'}.`);
            }
        } catch (error) {
            console.error('Error importing:', error);
            alert(`Hubo un error al conectar con el servidor de ${selectedSource === 'FORMOSA' ? 'Formosa' : 'la CSJN'}.`);
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="animate-fade-in" style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'hsl(var(--hsl-foreground))' }}>
                        <BookOpen className="text-primary" size={28} />
                        Explorador de Jurisprudencia
                    </h1>
                    <p className="text-muted" style={{ marginTop: '0.25rem' }}>
                        Búsqueda semántica inteligente en base de fallos nacional y federal.
                    </p>
                </div>

                {stats && (
                    <div style={{ display: 'flex', gap: '2rem' }}>
                        <div>
                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--hsl-text-muted))' }}>Total Fallos</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'hsl(var(--hsl-primary))' }}>{stats.total.toLocaleString()}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--hsl-text-muted))' }}>Cobertura AI</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'hsl(var(--hsl-accent))' }}>{stats.embeddingCoverage}</div>
                        </div>
                    </div>
                )}
            </header>

            {/* Search Bar */}
            <div className="card" style={{
                padding: '1.25rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                boxShadow: 'var(--shadow-lg)',
                backgroundColor: 'hsl(var(--hsl-surface))',
                zIndex: 10
            }}>
                <div style={{ width: '200px' }}>
                    <select
                        className="input-field"
                        style={{ height: '3.5rem', borderRadius: '0.75rem', fontWeight: 600 }}
                        value={selectedSource}
                        onChange={(e) => setSelectedSource(e.target.value as any)}
                    >
                        <option value="CSJN">Nación (CSJN)</option>
                        <option value="FORMOSA">Formosa</option>
                    </select>
                </div>

                <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                    <div style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--hsl-text-muted))', pointerEvents: 'none' }}>
                        <Search size={22} />
                    </div>
                    <input
                        className="input-field"
                        style={{
                            paddingLeft: '3.5rem',
                            height: '3.5rem',
                            fontSize: '1.1rem',
                            borderRadius: '0.75rem',
                            width: '100%',
                            boxSizing: 'border-box'
                        }}
                        placeholder="Buscar por tema, carátula, concepto jurídico..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        autoFocus
                    />
                </div>
                <button
                    className="btn btn-primary"
                    style={{
                        height: '3.5rem',
                        padding: '0 2rem',
                        fontSize: '1.1rem',
                        borderRadius: '0.75rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap'
                    }}
                    onClick={handleSearch}
                    disabled={isLoading || isImporting}
                >
                    {isLoading ? 'Buscando...' : 'Buscar'}
                </button>

                <button
                    className="btn btn-outline"
                    style={{
                        height: '3.5rem',
                        padding: '0 1.5rem',
                        fontSize: '0.95rem',
                        borderRadius: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        whiteSpace: 'nowrap',
                        color: 'hsl(var(--hsl-accent))',
                        borderColor: 'hsl(var(--hsl-accent))'
                    }}
                    onClick={handleImport}
                    disabled={isLoading || isImporting}
                    title={`Busca fallos reales en la web de ${selectedSource === 'FORMOSA' ? 'Formosa' : 'la CSJN'} e impórtalos`}
                >
                    <Layers size={18} /> {isImporting ? `Importando de ${selectedSource}...` : `Búsqueda Profunda (${selectedSource})`}
                </button>
            </div>

            <div style={{ display: 'flex', gap: '2rem', flex: 1, minHeight: 0 }}>
                {/* Filters Sidebar */}
                <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Filter size={18} /> Filtros
                        </h3>

                        <div className="form-group mb-4">
                            <label className="label" style={{ fontSize: '0.85rem' }}>Fuero</label>
                            <select
                                className="input-field"
                                value={filters.fuero}
                                onChange={(e) => setFilters({ ...filters, fuero: e.target.value })}
                            >
                                <option value="">Todos los Fueros</option>
                                <option value="CIVIL">Civil</option>
                                <option value="COMERCIAL">Comercial</option>
                                <option value="PENAL">Penal</option>
                                <option value="LABORAL">Laboral</option>
                                <option value="FAMILIA">Familia</option>
                                <option value="CONTENCIOSO">Contencioso Adm.</option>
                            </select>
                        </div>

                        <div className="form-group mb-4">
                            <label className="label" style={{ fontSize: '0.85rem' }}>Año</label>
                            <input
                                className="input-field"
                                placeholder="Ej: 2024"
                                value={filters.anio}
                                onChange={(e) => setFilters({ ...filters, anio: e.target.value })}
                            />
                        </div>

                        <div className="form-group mb-4">
                            <label className="label" style={{ fontSize: '0.85rem' }}>Tribunal</label>
                            <input
                                className="input-field"
                                placeholder="Ej: CSJN, Sala A..."
                                value={filters.tribunal}
                                onChange={(e) => setFilters({ ...filters, tribunal: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* Results List */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>

                    {(isLoading || isImporting) && (
                        <div className="card" style={{ height: '100%', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'hsl(var(--hsl-surface))' }}>
                            <PencilLoader />
                        </div>
                    )}

                    {!hasSearched && !isLoading && !isImporting && (
                        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'hsl(var(--hsl-text-muted))', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }}>
                            <Layers size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Comienza tu investigación</h3>
                            <p>Utiliza la barra de búsqueda para encontrar precedentes relevantes.</p>
                        </div>
                    )}

                    {hasSearched && results.length === 0 && !isLoading && !isImporting && (
                        <div className="card shadow-lg" style={{ padding: '4rem', textAlign: 'center', backgroundColor: 'hsl(var(--hsl-surface-muted))', border: '1px dashed hsl(var(--hsl-border))' }}>
                            <div style={{ marginBottom: '1.5rem', color: 'hsl(var(--hsl-text-muted))' }}>
                                <Search size={48} style={{ opacity: 0.3 }} />
                            </div>
                            <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1rem' }}>No se encontraron resultados locales</h3>
                            <p style={{ color: 'hsl(var(--hsl-text-muted))', marginBottom: '2rem', maxWidth: '500px', margin: '0 auto 2rem' }}>
                                No tenemos fallos sobre <strong>"{query}"</strong> en nuestra base de datos inteligente todavía.
                            </p>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                <button
                                    className="btn btn-primary"
                                    style={{ padding: '0.75rem 2rem' }}
                                    onClick={handleImport}
                                    disabled={isLoading}
                                >
                                    <Layers size={18} /> {isLoading ? 'Importando...' : `Importar desde ${selectedSource}`}
                                </button>
                                <button className="btn btn-outline" onClick={() => setHasSearched(false)}>
                                    Intentar otra búsqueda
                                </button>
                            </div>
                        </div>
                    )}

                    {!isLoading && !isImporting && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                            gap: '1.5rem',
                            paddingBottom: '2rem'
                        }}>
                            {results.map((item: any) => (
                                <div
                                    key={item.id}
                                    onClick={() => navigate(`/jurisprudencia/${item.id}`)}
                                    style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                                >
                                    <div className="card hover-card group" style={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        position: 'relative',
                                        padding: '1.5rem'
                                    }}>
                                        {/* Sub-header background effect */}
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            height: '4px',
                                            background: 'linear-gradient(90deg, hsl(var(--hsl-primary)), hsl(var(--hsl-accent)))',
                                            opacity: 0,
                                            transition: 'opacity 0.3s'
                                        }} className="card-top-gradient" />

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{
                                                    padding: '0.5rem',
                                                    borderRadius: '0.75rem',
                                                    backgroundColor: 'hsl(var(--hsl-surface-muted))',
                                                    color: 'hsl(var(--hsl-primary))'
                                                }}>
                                                    <Gavel size={18} />
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--hsl-text-main))' }}>
                                                        {item.tribunal}
                                                    </span>
                                                    <span style={{ fontSize: '0.65rem', color: 'hsl(var(--hsl-text-muted))' }}>
                                                        {item.jurisdiccion || 'Jurisdicción N/D'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                                                {item.rankingScore && (
                                                    <div className="badge badge-gold" style={{ padding: '0.35rem 0.75rem', fontSize: '0.7rem' }}>
                                                        Match: {(item.rankingScore * 100).toFixed(0)}%
                                                    </div>
                                                )}
                                                {item.similarity === 0.5 && (
                                                    <span style={{ fontSize: '0.6rem', color: 'hsl(var(--hsl-accent))', fontWeight: 700 }}>KEYWORD MATCH</span>
                                                )}
                                            </div>
                                        </div>

                                        <h3 style={{
                                            fontSize: '1.1rem',
                                            fontWeight: 700,
                                            color: 'hsl(var(--hsl-primary))',
                                            marginBottom: '0.75rem',
                                            lineHeight: 1.4,
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden'
                                        }}>
                                            {item.caratula || (Array.isArray(item.tema) ? item.tema.join(' - ') : item.tema) || 'Fallo sin título'}
                                        </h3>

                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '0.5rem',
                                            marginBottom: '1rem'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'hsl(var(--hsl-text-muted))' }}>
                                                <Calendar size={14} />
                                                {item.fecha ? format(new Date(item.fecha), 'dd/MM/yyyy') : 'S/F'}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'hsl(var(--hsl-text-muted))' }}>
                                                <FileText size={14} />
                                                {item.nroExpediente || 'Exp: N/D'}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'hsl(var(--hsl-text-muted))' }}>
                                                <Scale size={14} />
                                                {item.fuero}
                                            </div>
                                        </div>

                                        <div style={{
                                            flex: 1,
                                            fontSize: '0.875rem',
                                            lineHeight: 1.6,
                                            color: 'hsl(var(--hsl-text-muted))',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            marginBottom: '1.5rem',
                                            padding: '0.75rem',
                                            borderRadius: '0.5rem',
                                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                            border: '1px solid rgba(255, 255, 255, 0.05)'
                                        }}>
                                            {item.resumen || item.textoCompleto || 'Sin resumen disponible.'}
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            paddingTop: '1rem',
                                            borderTop: '1px solid hsl(var(--hsl-border))'
                                        }}>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                {item.precedencia === 'OBLIGATORIO' && (
                                                    <span className="badge badge-red" style={{ gap: '0.25rem' }}>
                                                        <Award size={12} /> Obligatorio
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                {item.fuenteOficialUrl && (
                                                    <a
                                                        href={item.fuenteOficialUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="btn btn-ghost"
                                                        style={{ padding: '0.4rem', color: 'hsl(var(--hsl-accent))' }}
                                                        title="Ver fuente oficial"
                                                    >
                                                        <ExternalLink size={16} />
                                                    </a>
                                                )}
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    color: 'hsl(var(--hsl-primary))',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600
                                                }}>
                                                    Ver detalle <ChevronRight size={16} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
