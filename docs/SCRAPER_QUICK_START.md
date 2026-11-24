# 🚀 Guía Rápida: Scraper CSJN

## ⚡ Inicio Rápido (3 pasos)

### 1️⃣ Ejecutar Scraper
```bash
cd backend
npx ts-node src/crawler/run.ts
```
**Resultado:** `csjn-results.json` con 10 fallos

### 2️⃣ Ingestar en BD
```bash
npx ts-node src/crawler/pipeline/ingest-to-db.ts
```
**Resultado:** Datos en PostgreSQL con embeddings

### 3️⃣ Buscar en Frontend
```
http://localhost:5173/jurisprudencia/buscar
```
**Resultado:** Búsqueda semántica funcionando

---

## 📖 Documentación Completa

Ver: [`CSJN_SCRAPER_COMPLETE.md`](./CSJN_SCRAPER_COMPLETE.md)

---

## 🎯 Endpoints Principales

### Búsqueda
```
GET /jurisprudence/search?query=daños&limit=10
```

### Estadísticas
```
GET /jurisprudence/stats
```

### Por ID
```
GET /jurisprudence/:id
```

---

## 🔧 Configuración

### Backend
- Puerto: `3000`
- Comando: `npm run start:dev`
- OpenAI API Key requerida

### Frontend
- Puerto: `5173`
- Comando: `npm run dev`
- Ruta: `/jurisprudencia/buscar`

---

## ✅ Checklist

- [x] Scraper CSJN funcionando
- [x] Pipeline de ingesta
- [x] API de búsqueda
- [x] Frontend premium
- [x] Documentación completa
- [ ] Scheduler automático (próximo)
- [ ] Descarga de PDFs (próximo)

---

## 📊 Estado Actual

- **Fallos en BD:** 10
- **Tribunal:** CSJN
- **Embeddings:** ✅ Generados
- **Frontend:** ✅ Funcionando
- **Búsqueda:** ✅ Semántica con IA
