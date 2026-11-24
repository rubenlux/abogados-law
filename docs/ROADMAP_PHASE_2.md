
# Roadmap Técnico - Fase 2 (Post-MVP)

## 1. Infraestructura & DevOps
- [ ] **Docker Compose**: Crear `docker-compose.yml` unificando `postgres`, `backend`, `frontend`, `admin`.
- [ ] **Redis**: Implementar para caché de sesiones y colas de trabajos (BullMQ) para tareas pesadas (scrapers).
- [ ] **Backup S3**: Script automático para dump de PostgreSQL a AWS S3.

## 2. Inteligencia Artificial (Deepening)
- [ ] **Vector Database Real**: Migrar de Mock a `pgvector` o Pinecone.
- [ ] **Fine-tuning**: Entrenar un modelo pequeño (Llama 3) con jurisprudencia local argentina.
- [ ] **OCR Pipeline**: Integrar Tesseract o AWS Textract para PDFs escaneados de expedientes.

## 3. Seguridad & Compliance
- [ ] **2FA (MFA)**: Implementar TOTP (Google Authenticator) para login.
- [ ] **Audit Vault**: API para que auditores externos verifiquen la integridad de los hashes `EventLog`.
- [ ] **GDPR/LPDP**: Módulo de "Derecho al Olvido" (Soft delete con crypto-shredding).

## 4. Negocio (Monetización)
- [ ] **Stripe/MercadoPago**: Integración de pasarela de pagos para suscripciones.
- [ ] **Metered Billing**: Cobrar por token de IA excedente.
- [ ] **Whitelabel**: Permitir personalizar logo y colores para grandes estudios.
