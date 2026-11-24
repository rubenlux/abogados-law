# Roadmap de Desarrollo - Abogado Virtual

## ✅ Fase 1: Fundamentos (COMPLETADO)

### Backend
- [x] Arquitectura NestJS modular
- [x] PostgreSQL + Prisma ORM
- [x] Modelo de datos multi-tenant
- [x] DTOs con validación estricta
- [x] Transacciones ACID
- [x] Auditoría forense (hash chain)

### Frontend
- [x] React + TypeScript + Vite
- [x] Zustand para estado global
- [x] React Router para navegación
- [x] Diseño moderno con CSS custom properties

---

## ✅ Fase 2: Seguridad & Autenticación (COMPLETADO)

- [x] JWT con Access + Refresh Tokens
- [x] Hash de refresh tokens en DB (bcrypt)
- [x] Endpoints: `/auth/login`, `/auth/refresh`, `/auth/logout`
- [x] Interceptor HTTP con renovación automática
- [x] Helmet + CORS restrictivo
- [x] Rate Limiting (Throttler)
- [x] Guards JWT en endpoints protegidos
- [x] Documentación: `AUTH_SECURITY.md`

---

## ✅ Fase 3: Agenda Judicial Avanzada (COMPLETADO)

### Backend
- [x] Modelo `CalendarioJudicial` (feriados por jurisdicción)
- [x] `DeadlineCalculatorService` (días hábiles + feriados)
- [x] Endpoints: `/agenda`, `/agenda/eventos`, `/agenda/simular-vencimiento`
- [x] Scheduler (Cron diario 9 AM)
- [x] Integración con IA (cédula → vencimiento)

### Frontend
- [x] Vista Agenda con calendario mensual
- [x] Calculadora de plazos integrada
- [x] Flujo: Expediente → IA → Agendar
- [x] Documentación: `AGENDA_ENGINE_IMPLEMENTATION.md`

---

## 🔄 Fase 4: IA Jurídica Avanzada (EN PROGRESO)

### Backend
- [x] Arquitectura RAG (Retrieval-Augmented Generation)
- [x] `EmbeddingService` con OpenAI embeddings
- [x] Búsqueda semántica con pgvector
- [x] Endpoint `/ia/ask` con GPT-4
- [x] Endpoint `/ia/ingest` para cargar normas
- [ ] **Script de ingesta masiva** (Códigos argentinos completos)
- [ ] **Integración de jurisprudencia** (CSJN + Cámaras)
- [ ] **Caché semántica** (Redis)
- [ ] **Ranking de precedentes** (por vigencia y relevancia)
- [ ] **Chat con memoria** (contexto por expediente)

### Frontend
- [x] Hook `useLegalAssistant` con método `ask`
- [x] Cliente HTTP para `/ia/ask`
- [ ] **Interfaz de chat mejorada** en detalle de expediente
- [ ] **Panel de administración** para ingesta de normas
- [ ] **Visualización de fuentes** citadas

### Documentación
- [x] `RAG_IMPLEMENTATION.md`

---

## 📋 Fase 5: Multi-Tenant SaaS (PLANIFICADO)

### Backend
- [ ] Aislamiento estricto por `organizationId`
- [ ] Middleware de tenant detection
- [ ] Sistema de planes (STARTER, PRO, ENTERPRISE)
- [ ] Límites por tenant:
  - [ ] Usuarios
  - [ ] Expedientes
  - [ ] Tokens IA
  - [ ] Almacenamiento
- [ ] Admin master global
- [ ] Onboarding automatizado
- [ ] Facturación (Stripe/MercadoPago)

### Frontend
- [ ] Panel de administración de organización
- [ ] Gestión de usuarios y roles
- [ ] Métricas de uso
- [ ] Configuración de límites

---

## 🎨 Fase 6: UX Premium (PLANIFICADO)

### Optimizaciones
- [ ] Loaders y skeletons en todas las vistas
- [ ] Manejo de errores con Toasts/Notificaciones
- [ ] Empty states diseñados
- [ ] Optimistic UI en operaciones críticas
- [ ] Infinite scroll en listas largas
- [ ] Búsqueda global (Cmd+K)

### Mobile
- [ ] Diseño responsive completo
- [ ] PWA (Progressive Web App)
- [ ] Notificaciones push
- [ ] Modo offline básico

### Accesibilidad
- [ ] ARIA labels
- [ ] Navegación por teclado
- [ ] Contraste WCAG AA
- [ ] Screen reader support

---

## 🚀 Fase 7: Productivización (PLANIFICADO)

### Infraestructura
- [ ] Docker Compose completo (backend + DB + Redis)
- [ ] CI/CD con GitHub Actions
- [ ] Deploy en Railway/Render/AWS
- [ ] Backups automáticos (diarios)
- [ ] Monitoreo (Sentry + Prometheus)
- [ ] Logs centralizados (Winston + CloudWatch)

### Seguridad Avanzada
- [ ] CSRF protection
- [ ] Rotación automática de refresh tokens
- [ ] Auditoría de login/logout
- [ ] Límites por IP + por usuario
- [ ] 2FA (TOTP)

### Performance
- [ ] Caché de queries frecuentes (Redis)
- [ ] CDN para assets estáticos
- [ ] Lazy loading de módulos
- [ ] Code splitting
- [ ] Compresión gzip/brotli

---

## 🎯 Fase 8: Features Avanzadas (FUTURO)

- [ ] Redacción automática de escritos
- [ ] Score de riesgo por expediente
- [ ] Predicción de resultados (ML)
- [ ] OCR avanzado (Tesseract/Google Vision)
- [ ] Firma digital de documentos
- [ ] Integración con sistemas judiciales (ej. Lex100)
- [ ] Reportes y analytics avanzados
- [ ] Exportación forense certificada

---

## 📊 Estado Actual del Proyecto

| Área | Completitud | Nivel |
|------|-------------|-------|
| Backend Core | 95% | 9/10 |
| Seguridad | 95% | 9.5/10 |
| Agenda Judicial | 90% | 9/10 |
| IA Legal (RAG) | 60% | 7/10 |
| Frontend | 80% | 8/10 |
| Multi-Tenant | 30% | 3/10 |
| UX/UI | 70% | 7/10 |
| Deploy | 0% | 0/10 |

**Nivel General del Producto**: **8/10** (Enterprise-ready en core, falta pulido comercial)

---

## 🎯 Prioridades Inmediatas

1. **Completar RAG** (ingesta masiva + jurisprudencia)
2. **Mejorar UX del chat** (interfaz + memoria)
3. **Multi-tenant básico** (aislamiento + planes)
4. **Deploy a staging** (Docker + Railway)
5. **Testing E2E** (Playwright)

---

## 💡 Decisión Estratégica Recomendada

**Orden óptimo de ejecución**:

1. ✅ **IA jurídica avanzada** (diferenciador comercial)
2. **Multi-tenant + SaaS** (escalabilidad)
3. **Deploy productivo** (validación de mercado)
4. **UX premium** (retención de usuarios)

**Razón**: Ya resolviste el problema difícil (arquitectura + seguridad + agenda). Ahora construyes **valor diferencial** antes de escalar.
