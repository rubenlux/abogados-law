# ⚖️ Abogado Virtual - Plataforma Legal con IA

Sistema integral de gestión legal con inteligencia artificial, scraping de jurisprudencia, y búsqueda semántica.

---

## 🚀 Características Principales

### ✅ **Implementado y Funcional**

1. **🔍 Scraper de Jurisprudencia CSJN**
   - Extracción automática de fallos de la Corte Suprema
   - Pipeline de ingesta con embeddings OpenAI
   - Búsqueda semántica inteligente
   - **[Ver documentación →](./docs/CSJN_SCRAPER_COMPLETE.md)**

2. **🤖 Asistente Legal con IA**
   - Chat inteligente con contexto legal
   - Integración con jurisprudencia
   - Análisis de riesgo legal

3. **📊 Gestión de Expedientes**
   - CRUD completo
   - Tracking de estado
   - Agenda judicial automatizada

4. **🔐 Enterprise Security**
   - HMAC para Legal Pixel
   - Backups automáticos
   - Gestión de secretos con Doppler
   - **[Ver documentación →](./docs/ENTERPRISE_PRODUCTION_READINESS.md)**

5. **📈 Analytics & Admin**
   - Dashboard de métricas
   - Logs forenses
   - Panel de administración

---

## 📁 Estructura del Proyecto

```
Abogados_law/
├── backend/              # NestJS API
│   ├── src/
│   │   ├── crawler/      # 🆕 Scraper CSJN
│   │   ├── ia/           # Módulos de IA
│   │   ├── core/         # Seguridad, backups
│   │   └── ...
│   └── prisma/           # Schema de BD
│
├── frontend/             # React + Vite
│   └── src/
│       ├── pages/
│       │   └── Jurisprudence.tsx  # 🆕 Búsqueda
│       └── ...
│
├── admin-platform/       # Admin Dashboard
│
└── docs/                 # Documentación
    ├── CSJN_SCRAPER_COMPLETE.md       # 🆕 Scraper completo
    ├── SCRAPER_QUICK_START.md         # 🆕 Guía rápida
    ├── SCRAPER_TO_FRONTEND_GUIDE.md   # 🆕 Integración
    └── ENTERPRISE_PRODUCTION_READINESS.md
```

---

## 🚀 Inicio Rápido

### **Requisitos**
- Node.js 18+
- PostgreSQL 14+ con pgvector
- OpenAI API Key

### **1. Backend**
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

### **2. Frontend**
```bash
cd frontend
npm install
npm run dev
```

### **3. Scraper CSJN** (Opcional)
```bash
cd backend
npx ts-node src/crawler/run.ts
npx ts-node src/crawler/pipeline/ingest-to-db.ts
```

---

## 📚 Documentación

### **Nuevas Features (23/01/2026)**
- 📖 [**Scraper CSJN - Completo**](./docs/CSJN_SCRAPER_COMPLETE.md) - Documentación técnica completa
- ⚡ [**Guía Rápida**](./docs/SCRAPER_QUICK_START.md) - Inicio en 3 pasos
- 🔗 [**Integración Frontend**](./docs/SCRAPER_TO_FRONTEND_GUIDE.md) - Cómo buscar desde el frontend

### **Documentación Existente**
- 🔐 [**Enterprise Security**](./docs/ENTERPRISE_PRODUCTION_READINESS.md) - Hardening de producción
- 🔒 [**Security Model**](./docs/SECURITY_MODEL.md) - Modelo de seguridad
- 📊 [**Jurisprudence Engine**](./docs/JURISPRUDENCE_ENGINE.md) - Motor de búsqueda

---

## 🎯 Endpoints Principales

### **Jurisprudencia**
```
GET  /jurisprudence/search?query=daños
GET  /jurisprudence/stats
GET  /jurisprudence/:id
POST /jurisprudence/ingest
```

### **IA**
```
POST /ia/ask
POST /ia/risk-analysis
```

### **Expedientes**
```
GET  /expedientes
POST /expedientes
GET  /expedientes/:id
```

### **Admin**
```
GET /admin-api/stats
GET /admin-api/logs
GET /admin-api/traffic
```

---

## 🔧 Variables de Entorno

```env
# Database
DATABASE_URL="postgresql://..."

# OpenAI
OPENAI_API_KEY="sk-..."

# JWT
JWT_SECRET="..."

# Legal Pixel
PIXEL_HMAC_SECRET="..."

# Doppler (Opcional)
DOPPLER_TOKEN="..."
```

---

## 📊 Stack Tecnológico

### **Backend**
- NestJS
- Prisma ORM
- PostgreSQL + pgvector
- OpenAI API
- Playwright (scraping)

### **Frontend**
- React 18
- Vite
- TailwindCSS
- Lucide Icons

### **DevOps**
- Doppler (secrets)
- node-cron (scheduler)
- Winston (logging)

---

## 🧪 Testing

```bash
# Backend
cd backend
npm test

# Scraper
npx ts-node src/crawler/run.ts

# Verificar BD
psql -d abogado_virtual -c "SELECT COUNT(*) FROM \"Jurisprudence\";"
```

---

## 📈 Roadmap

### **Próximas Features**
- [ ] Scheduler automático para scraper
- [ ] Descarga de PDFs completos
- [ ] Scraper para Cámaras Federales
- [ ] OCR para documentos escaneados
- [ ] Multi-tenant completo
- [ ] Mobile app

---

## 👥 Equipo

**Desarrollado por:** Equipo Abogado Virtual  
**Última actualización:** 23/01/2026  
**Versión:** 1.2.0

---

## 📝 Changelog

### v1.2.0 (23/01/2026)
- ✅ Scraper CSJN funcional
- ✅ Pipeline de ingesta con OpenAI
- ✅ Búsqueda semántica en frontend
- ✅ Documentación completa

### v1.1.0 (22/01/2026)
- ✅ Enterprise security (HMAC, backups)
- ✅ Doppler integration
- ✅ Admin dashboard

### v1.0.0 (20/01/2026)
- ✅ MVP inicial
- ✅ CRUD expedientes
- ✅ Asistente IA básico

---

## 📄 Licencia

Propietario - Todos los derechos reservados
