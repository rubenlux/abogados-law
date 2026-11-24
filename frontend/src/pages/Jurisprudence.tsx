import { useState, useEffect } from 'react';
import { Search, Scale, Calendar, ExternalLink, TrendingUp, Filter } from 'lucide-react';
import { useAuthStore } from '../core/store/useAuthStore';

interface JurisprudenceResult {
    id: string;
    tribunal: string;
    nroExpediente: string;
    fecha: string;
    jurisdiccion: string;
    fuero: string;
    tema: string[];
    resumen: string;
    fuenteOficialUrl: string;
    similarity: number;
    rankingScore: number;
    precedencia: string;
}

export default function Jurisprudence() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<JurisprudenceResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const [filters, setFilters] = useState({
        tribunal: '',
        jurisdiccion: '',
        fuero: ''
    });

    // Obtener token del store de Zustand
    const token = useAuthStore((state) => state.token);

    const handleSearch = async () => {
        if (!query.trim()) return;

        setLoading(true);
        setError('');
        try {
            if (!token) {
                setError('No estás autenticado. Por favor, inicia sesión.');
                return;
            }

            const params = new URLSearchParams({
                query,
                limit: '20',
                ...Object.fromEntries(
                    Object.entries(filters).filter(([_, v]) => v)
                )
            });

            const response = await fetch(
                `http://localhost:3000/jurisprudence/search?${params}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));

                if (response.status === 500) {
                    throw new Error('Error en el servidor. Por favor, verificá que la base de datos esté funcionando correctamente.');
                }

                throw new Error(errorData.message || 'Error en la búsqueda');
            }

            const data = await response.json();
            setResults(data.results || []);
        } catch (error: any) {
            console.error('Error searching:', error);

            // Fallback: intentar listar todos los casos si la búsqueda semántica falla
            if (error.message.includes('servidor')) {
                try {
                    console.log('Intentando fallback a listado simple...');
                    const fallbackResponse = await fetch(
                        `http://localhost:3000/jurisprudence/list?limit=20`,
                        {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    if (fallbackResponse.ok) {
                        const fallbackData = await fallbackResponse.json();
                        setResults(fallbackData.results || []);
                        setError('Búsqueda semántica no disponible. Mostrando todos los casos.');
                        return;
                    }
                } catch (fallbackError) {
                    console.error('Fallback también falló:', fallbackError);
                }
            }

            setError(error.message || 'Error al buscar jurisprudencia');
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            if (!token) {
                console.log('No token for stats yet');
                return;
            }

            console.log('Loading stats with token...');
            const response = await fetch('http://localhost:3000/jurisprudence/stats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Stats loaded:', data);
                setStats(data);
            } else {
                console.error('Stats response not ok:', response.status);
                if (response.status === 401) {
                    setError('Sesión expirada. Por favor, vuelve a iniciar sesión.');
                }
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    // Cargar estadísticas al montar o cuando el token esté disponible
    useEffect(() => {
        if (token) {
            loadStats();
        }
    }, [token]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Scale className="w-8 h-8 text-blue-600" />
                        <h1 className="text-3xl font-bold text-gray-900">
                            Búsqueda de Jurisprudencia
                        </h1>
                    </div>
                    <p className="text-gray-600">
                        Búsqueda semántica inteligente en fallos de la CSJN
                    </p>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white rounded-lg shadow p-4">
                            <div className="text-sm text-gray-600 mb-1">Total de Fallos</div>
                            <div className="text-2xl font-bold text-blue-600">
                                {stats.totalCases}
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4">
                            <div className="text-sm text-gray-600 mb-1">CSJN</div>
                            <div className="text-2xl font-bold text-green-600">
                                {stats.byTribunal?.CSJN || 0}
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4">
                            <div className="text-sm text-gray-600 mb-1">Chunks Indexados</div>
                            <div className="text-2xl font-bold text-purple-600">
                                {stats.totalChunks}
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4">
                            <div className="text-sm text-gray-600 mb-1">Rango de Fechas</div>
                            <div className="text-sm font-semibold text-gray-700">
                                {stats.dateRange?.oldest && new Date(stats.dateRange.oldest).toLocaleDateString('es-AR')}
                                {' - '}
                                {stats.dateRange?.newest && new Date(stats.dateRange.newest).toLocaleDateString('es-AR')}
                            </div>
                        </div>
                    </div>
                )}

                {/* Search Box */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <div className="flex gap-3 mb-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Ej: daños y perjuicios, responsabilidad civil, medio ambiente..."
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold transition-colors"
                        >
                            {loading ? 'Buscando...' : 'Buscar'}
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-3">
                        <Filter className="w-4 h-4 text-gray-500" />
                        <select
                            value={filters.tribunal}
                            onChange={(e) => setFilters({ ...filters, tribunal: e.target.value })}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                            <option value="">Todos los tribunales</option>
                            <option value="CSJN">CSJN</option>
                            <option value="CAMARA_FEDERAL">Cámara Federal</option>
                            <option value="CAMARA_PROVINCIAL">Cámara Provincial</option>
                        </select>

                        <select
                            value={filters.jurisdiccion}
                            onChange={(e) => setFilters({ ...filters, jurisdiccion: e.target.value })}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                            <option value="">Todas las jurisdicciones</option>
                            <option value="NACIONAL">Nacional</option>
                            <option value="PROVINCIAL">Provincial</option>
                        </select>

                        <select
                            value={filters.fuero}
                            onChange={(e) => setFilters({ ...filters, fuero: e.target.value })}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                            <option value="">Todos los fueros</option>
                            <option value="CIVIL">Civil</option>
                            <option value="COMERCIAL">Comercial</option>
                            <option value="PENAL">Penal</option>
                            <option value="LABORAL">Laboral</option>
                            <option value="CONTENCIOSO_ADMINISTRATIVO">Contencioso Administrativo</option>
                        </select>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-700 text-sm font-semibold">{error}</p>
                        </div>
                    )}
                </div>

                {/* Results */}
                {results.length > 0 && (
                    <div className="space-y-4">
                        <div className="text-sm text-gray-600 mb-4">
                            Se encontraron <span className="font-semibold">{results.length}</span> resultados
                        </div>

                        {results.map((result) => (
                            <div
                                key={result.id}
                                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            {result.tema.join(' - ')}
                                        </h3>
                                        <div className="flex items-center gap-4 text-sm text-gray-600">
                                            <span className="flex items-center gap-1">
                                                <Scale className="w-4 h-4" />
                                                <span className="font-semibold">{result.tribunal}</span>
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4" />
                                                {new Date(result.fecha).toLocaleDateString('es-AR')}
                                            </span>
                                            {result.nroExpediente && (
                                                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                                    Expte: {result.nroExpediente}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Scores */}
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-green-600" />
                                            <span className="text-sm font-semibold text-green-600">
                                                {(result.similarity * 100).toFixed(1)}% relevancia
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Score: {result.rankingScore.toFixed(2)}
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded ${result.precedencia === 'VINCULANTE'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {result.precedencia}
                                        </span>
                                    </div>
                                </div>

                                {/* Summary */}
                                <p className="text-gray-700 mb-4 leading-relaxed">
                                    {result.resumen}
                                </p>

                                {/* Footer */}
                                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                                    <div className="flex gap-2 text-xs">
                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                            {result.jurisdiccion}
                                        </span>
                                        <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">
                                            {result.fuero}
                                        </span>
                                    </div>

                                    {result.fuenteOficialUrl && (
                                        <a
                                            href={result.fuenteOficialUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-sm"
                                        >
                                            Ver fallo completo
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!loading && results.length === 0 && query && (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <Scale className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">
                            No se encontraron resultados
                        </h3>
                        <p className="text-gray-500">
                            Intentá con otros términos de búsqueda
                        </p>
                    </div>
                )}

                {/* Initial State */}
                {!loading && results.length === 0 && !query && (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <Search className="w-16 h-16 text-blue-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">
                            Buscá jurisprudencia de la CSJN
                        </h3>
                        <p className="text-gray-500 mb-4">
                            Usá búsqueda semántica para encontrar fallos relevantes
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center">
                            <button
                                onClick={() => { setQuery('daños y perjuicios'); handleSearch(); }}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                            >
                                Daños y perjuicios
                            </button>
                            <button
                                onClick={() => { setQuery('medio ambiente'); handleSearch(); }}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                            >
                                Medio ambiente
                            </button>
                            <button
                                onClick={() => { setQuery('responsabilidad civil'); handleSearch(); }}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                            >
                                Responsabilidad civil
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
