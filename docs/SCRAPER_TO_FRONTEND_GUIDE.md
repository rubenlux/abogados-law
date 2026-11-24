# 🔍 Guía: Scraper CSJN → Base de Datos → Frontend

## 📋 Flujo Completo

```
┌─────────────────┐      ┌──────────────┐      ┌─────────────┐      ┌──────────────┐
│  CSJN Website   │ ───▶ │   Scraper    │ ───▶ │  Pipeline   │ ───▶ │  PostgreSQL  │
│  (sjconsulta)   │      │ (Playwright) │      │  (Ingesta)  │      │  + Embeddings│
└─────────────────┘      └──────────────┘      └─────────────┘      └──────────────┘
                                                                              │
                                                                              ▼
                         ┌──────────────────────────────────────────────────────┐
                         │           API Backend (NestJS)                       │
                         │  GET /jurisprudence/search?query=daños              │
                         └──────────────────────────────────────────────────────┘
                                                  │
                                                  ▼
                         ┌──────────────────────────────────────────────────────┐
                         │           Frontend (React)                           │
                         │  Búsqueda semántica + Ranking por tribunal           │
                         └──────────────────────────────────────────────────────┘
```

---

## 🚀 Paso 1: Ejecutar el Scraper

```bash
cd backend
npx ts-node src/crawler/run.ts
```

**Resultado:** Archivo `csjn-results.json` con 10 fallos de CSJN.

---

## 📥 Paso 2: Ingestar en la Base de Datos

```bash
npx ts-node src/crawler/pipeline/ingest-to-db.ts
```

**Qué hace:**
- Lee `csjn-results.json`
- Transforma el formato del scraper al formato de la BD
- Genera embeddings con OpenAI para cada fallo
- Guarda en PostgreSQL (tabla `Jurisprudence` y `JurisprudenceChunk`)

**Resultado:**
```
✅ Ingesta completada:
   - Exitosos: 10
   - Fallidos: 0
   - Duplicados: 0
```

---

## 🔍 Paso 3: Buscar desde el Frontend

### **Opción A: Usando el Asistente Legal (Recomendado)**

El asistente legal **ya integra automáticamente** la búsqueda de jurisprudencia:

```typescript
// frontend/src/pages/Chat.tsx
// El usuario pregunta: "¿Qué dice la CSJN sobre daños ambientales?"

// El backend automáticamente:
// 1. Busca en la BD de jurisprudencia
// 2. Rankea por relevancia semántica + jerarquía de tribunal
// 3. Incluye los fallos en el contexto del LLM
```

### **Opción B: Búsqueda Directa (API)**

Podés hacer búsquedas directas desde cualquier componente:

```typescript
// frontend/src/services/jurisprudence.service.ts

export const searchJurisprudence = async (query: string, filters?: {
    tribunal?: 'CSJN' | 'CAMARA_FEDERAL' | 'CAMARA_PROVINCIAL';
    jurisdiccion?: 'NACIONAL' | 'PROVINCIAL';
    fuero?: 'CIVIL' | 'COMERCIAL' | 'PENAL' | 'LABORAL' | 'CONTENCIOSO_ADMINISTRATIVO';
    fechaDesde?: string;
    fechaHasta?: string;
    limit?: number;
}) => {
    const params = new URLSearchParams({
        query,
        ...filters
    });

    const response = await fetch(
        `http://localhost:3000/jurisprudence/search?${params}`,
        {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        }
    );

    return response.json();
};
```

**Ejemplo de uso:**

```typescript
// En un componente React
const [results, setResults] = useState([]);

const handleSearch = async () => {
    const data = await searchJurisprudence('daños ambientales', {
        tribunal: 'CSJN',
        limit: 10
    });
    
    setResults(data.results);
};

// Renderizar resultados
{results.map(result => (
    <div key={result.id}>
        <h3>{result.tema}</h3>
        <p><strong>Tribunal:</strong> {result.tribunal}</p>
        <p><strong>Fecha:</strong> {result.fecha}</p>
        <p><strong>Resumen:</strong> {result.resumen}</p>
        <p><strong>Similarity:</strong> {(result.similarity * 100).toFixed(1)}%</p>
        <p><strong>Ranking Score:</strong> {result.rankingScore.toFixed(2)}</p>
        <a href={result.fuente_oficial_url} target="_blank">Ver fallo completo</a>
    </div>
))}
```

---

## 📊 Paso 4: Ver Estadísticas

```bash
# Endpoint de estadísticas
GET http://localhost:3000/jurisprudence/stats
```

**Respuesta:**
```json
{
    "totalCases": 10,
    "byTribunal": {
        "CSJN": 10
    },
    "byJurisdiccion": {
        "NACIONAL": 10
    },
    "byFuero": {
        "TODOS": 10
    },
    "totalChunks": 30,
    "avgChunksPerCase": 3.0,
    "dateRange": {
        "oldest": "2025-11-27",
        "newest": "2025-12-18"
    }
}
```

---

## 🎯 Endpoints Disponibles

### **1. Búsqueda Semántica**
```
GET /jurisprudence/search?query=daños&tribunal=CSJN&limit=10
```

### **2. Obtener por ID**
```
GET /jurisprudence/:id
```

### **3. Buscar por Expediente**
```
GET /jurisprudence/expediente/:nroExpediente?tribunal=CSJN
```

### **4. Casos Relacionados (Citaciones)**
```
GET /jurisprudence/related/:id
```

### **5. Estadísticas**
```
GET /jurisprudence/stats
```

---

## 🔄 Automatización (Próximo Paso)

Para ejecutar el scraper automáticamente cada día:

```typescript
// backend/src/crawler/scheduler.ts
import * as cron from 'node-cron';

// Ejecutar todos los días a las 3 AM
cron.schedule('0 3 * * *', async () => {
    console.log('🕐 Ejecutando scraper diario...');
    
    // 1. Ejecutar scraper
    await scrapeCSJN(page, 'jurisprudencia reciente');
    
    // 2. Ingestar automáticamente
    await ingestToDB();
    
    console.log('✅ Scraper diario completado');
});
```

---

## 🧪 Testing

### **Test 1: Verificar ingesta**
```bash
# En PostgreSQL
SELECT COUNT(*) FROM "Jurisprudence" WHERE tribunal = 'CSJN';
# Debería devolver: 10
```

### **Test 2: Verificar embeddings**
```bash
SELECT COUNT(*) FROM "JurisprudenceChunk" WHERE embedding IS NOT NULL;
# Debería devolver: ~30 (3 chunks por caso en promedio)
```

### **Test 3: Búsqueda semántica**
```bash
curl -X GET "http://localhost:3000/jurisprudence/search?query=daños%20ambientales" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📝 Notas Importantes

1. **Embeddings:** Se generan automáticamente con OpenAI al ingestar
2. **Duplicados:** El sistema detecta duplicados por `nro_expediente` + `tribunal`
3. **Ranking:** Combina similarity semántica + jerarquía de tribunal + fecha
4. **Chunks:** El texto se divide automáticamente en chunks de ~500 tokens para mejor búsqueda

---

## 🎨 Ejemplo de UI (Sugerencia)

```tsx
// frontend/src/pages/Jurisprudence.tsx
export const JurisprudencePage = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        setLoading(true);
        const data = await searchJurisprudence(query);
        setResults(data.results);
        setLoading(false);
    };

    return (
        <div className="jurisprudence-page">
            <h1>🔍 Búsqueda de Jurisprudencia</h1>
            
            <div className="search-box">
                <input 
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ej: daños y perjuicios, responsabilidad civil..."
                />
                <button onClick={handleSearch}>Buscar</button>
            </div>

            {loading && <div>Buscando...</div>}

            <div className="results">
                {results.map(result => (
                    <JurisprudenceCard key={result.id} case={result} />
                ))}
            </div>
        </div>
    );
};
```

---

## ✅ Checklist de Implementación

- [x] Scraper CSJN funcionando
- [x] Pipeline de ingesta creado
- [ ] Ejecutar ingesta inicial
- [ ] Verificar datos en PostgreSQL
- [ ] Probar endpoint de búsqueda
- [ ] Integrar en frontend
- [ ] Implementar scheduler diario
- [ ] Agregar descarga de PDFs completos
