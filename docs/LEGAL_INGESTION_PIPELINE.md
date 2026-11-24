# Pipeline de Ingesta de Normas Legales

## Arquitectura General

```
Fuente → Parser → Normalización → Deduplicación → Embedding → Almacenamiento → Indexación
```

---

## 1. Fuentes de Datos

### Fuentes Oficiales Argentinas

| Fuente | Tipo | URL | Cobertura |
|--------|------|-----|-----------|
| InfoLEG | API/HTML | http://www.infoleg.gob.ar | Legislación Nacional |
| SAIJ | API | http://www.saij.gob.ar | Jurisprudencia + Legislación |
| Boletín Oficial | PDF/HTML | https://www.boletinoficial.gob.ar | Leyes recientes |
| Digesto Jurídico | PDF | - | Códigos consolidados |

### Tipos de Documentos Soportados

- **PDF**: Códigos, leyes publicadas
- **HTML**: Sitios oficiales, bases de datos web
- **API**: Servicios REST de organismos oficiales
- **MANUAL**: Ingesta manual por administradores

---

## 2. Pipeline de Procesamiento

### Fase 1: Extracción

**Parser por tipo de fuente**:

```typescript
interface Parser {
    extractMetadata(source: Source): Metadata;
    extractArticles(source: Source): Article[];
    validateStructure(articles: Article[]): boolean;
}
```

**Metadata extraída**:
- Nombre de la norma
- Número (Ley XXXXX, Decreto YYYY)
- Jurisdicción
- Fuero
- Fecha de vigencia
- Fecha de derogación (si aplica)

**Artículos extraídos**:
- Número de artículo
- Incisos/apartados
- Texto completo
- Referencias cruzadas

### Fase 2: Normalización

**TextNormalizationService**:

1. **Limpieza de formato**:
   - Remover saltos de línea excesivos
   - Normalizar espacios
   - Eliminar caracteres de control
   - Unificar comillas

2. **Generación de checksum**:
   - SHA256 del texto normalizado
   - Usado para deduplicación

3. **Extracción automática**:
   - Keywords (top 10 por frecuencia)
   - Conceptos jurídicos (pattern matching)
   - Temas (clasificación futura con ML)

### Fase 3: Deduplicación

**Estrategias**:

1. **Por checksum**: Texto idéntico → rechazo inmediato
2. **Por unique constraint**: `(jurisdiccion, numeroNorma, articulo, version)` → error de DB
3. **Por similitud semántica**: Embedding similarity > 0.95 → alerta de posible duplicado

### Fase 4: Embeddings

**EmbeddingService**:
- Modelo: OpenAI `text-embedding-3-small` (1536 dims)
- Input: `textoNormalizado`
- Output: Vector almacenado en pgvector

**Optimizaciones**:
- Batch processing (hasta 100 normas por request)
- Retry con backoff exponencial
- Fallback a vectores aleatorios en desarrollo

### Fase 5: Almacenamiento

**Transacción ACID**:

```typescript
await prisma.$transaction(async (tx) => {
    // 1. Crear registro
    const norm = await tx.legalNorm.create({ data });
    
    // 2. Actualizar embedding (raw SQL)
    await tx.$executeRaw`UPDATE "LegalNorm" SET embedding = ...`;
    
    // 3. Registrar auditoría
    await tx.auditLog.create({ ... });
});
```

### Fase 6: Indexación

**Índices creados**:
- `(jurisdiccion, fuero, estado)` → Filtros frecuentes
- `(tipoNorma, numeroNorma)` → Búsqueda exacta
- `(checksumTexto)` → Deduplicación
- `embedding` (HNSW) → Búsqueda vectorial

---

## 3. Versionado de Normas

### Modelo de Versiones

Cuando una norma se modifica:

1. **Norma original**:
   - `estado` → `MODIFICADA`
   - `normaModificadoraId` → ID de nueva versión

2. **Nueva versión**:
   - `versionNorma` → `original.versionNorma + 1`
   - `estado` → `VIGENTE`
   - Nuevo embedding (el texto cambió)

### Consulta de Versiones

```typescript
// Última versión vigente
findFirst({ 
    where: { numeroNorma, articulo, estado: 'VIGENTE' },
    orderBy: { versionNorma: 'desc' }
})

// Historial completo
findMany({
    where: { numeroNorma, articulo },
    orderBy: { versionNorma: 'desc' }
})
```

---

## 4. Detección de Conflictos

### Estrategia

1. **Similitud semántica alta** (> 0.90):
   - Misma jurisdicción
   - Mismo fuero
   - Texto muy similar
   - → Posible conflicto normativo

2. **Análisis manual**:
   - Admin revisa normas marcadas
   - Actualiza campo `conflictsWith: [id1, id2]`

### Casos de Uso

- Leyes provinciales vs nacionales
- Decretos reglamentarios contradictorios
- Jurisprudencia contradictoria

---

## 5. Seguridad y Auditoría

### Control de Acceso

- **Ingesta**: Solo `ADMIN`
- **Búsqueda**: Todos los usuarios autenticados
- **Modificación**: Solo `ADMIN` + auditoría completa

### Auditoría

Cada operación registra:
- Usuario (`ingestedBy`, `verifiedBy`)
- Timestamp (`parsedAt`, `verifiedAt`)
- Versión del parser (`parsingVersion`)
- Hash del archivo fuente (`sourceFileHash`)

---

## 6. Scripts de Ingesta

### Ingesta Manual

```bash
npx ts-node scripts/ingest-legal-norms.ts
```

### Ingesta desde PDF

```bash
npx ts-node scripts/parsers/pdf-parser.ts --file codigo_civil.pdf
```

### Ingesta desde API

```bash
npx ts-node scripts/parsers/infoleg-importer.ts --ley 26994
```

---

## 7. Monitoreo y Métricas

### Endpoint de Estadísticas

`GET /legal/stats`:

```json
{
  "total": 15420,
  "withEmbeddings": 15420,
  "embeddingCoverage": "100%",
  "byJurisdiccion": [
    { "jurisdiccion": "NACION", "_count": 8500 },
    { "jurisdiccion": "CABA", "_count": 3200 }
  ],
  "byFuero": [...],
  "byEstado": [
    { "estado": "VIGENTE", "_count": 14200 },
    { "estado": "DEROGADA", "_count": 1220 }
  ]
}
```

---

## 8. Roadmap de Ingesta

### Fase 1 (Actual)
- ✅ Modelo de datos extendido
- ✅ Servicios de ingesta y búsqueda
- ✅ Normalización automática
- ✅ Deduplicación por checksum

### Fase 2 (Próxima)
- [ ] Parser de PDFs (PyPDF2/pdfplumber)
- [ ] Parser de HTML (BeautifulSoup)
- [ ] Integración con InfoLEG API
- [ ] Clasificación automática de temas (ML)

### Fase 3 (Futuro)
- [ ] OCR para PDFs escaneados (Tesseract)
- [ ] Extracción de referencias cruzadas
- [ ] Grafo de relaciones entre normas
- [ ] Actualización automática desde fuentes oficiales
