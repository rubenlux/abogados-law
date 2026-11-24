# Legal Pixel™ v2 – Enterprise Forensic Telemetry System

Sistema de observabilidad jurídica de grado forense, diseñado para garantizar integridad criptográfica, trazabilidad absoluta y auditoría no repudiable.

## 1. Arquitectura de Datos Forense

### Modelo `EventLog` Extendido
Se enriquece el modelo base para soportar cadena de custodia digital.

```prisma
model EventLog {
  // Identificadores & Trazabilidad
  id             String      @id @default(uuid())
  correlationId  String?     // UUID para agrupar operaciones complejas
  requestId      String?     // ID único del request HTTP
  parentEventId  String?     // Causalidad (ej: LOGIN -> VIEW_DOC)
  
  // Taxonomía
  category       EventCategory // SECURITY, LEGAL, IA, FINANCIAL, HR
  severity       EventSeverity // LOW, MEDIUM, HIGH, CRITICAL
  eventType      String      
  
  // Contexto del Actor
  actorType      ActorType   // USER, EMPLOYEE, BOT
  actorId        String
  organizationId String?
  sessionId      String?
  
  // Datos del Evento
  entityType     String?
  entityId       String?
  payload        Json?       // Datos encriptados si son sensibles
  
  // Metadatos Técnicos
  timestamp      DateTime    @default(now())
  ipAddress      String?
  userAgent      String?
  geoCountry     String?     // ISO Code
  
  // Seguridad Forense (Inmutabilidad)
  prevHash       String?     // Hash del evento anterior (Blockchain-like)
  currentHash    String?     // SHA-256(id + timestamp + payload + prevHash)
  signature      String?     // Firma digital del servidor HMAC-SHA256
  
  // Auditoría & Compliance
  riskScore      Int         @default(0) // 0-100
  isAnomaly      Boolean     @default(false)
  retentionPolicy String     @default("HOT") // HOT (90d), WARM (1y), COLD (10y)
  
  @@index([timestamp])
  @@index([actorId])
  @@index([correlationId])
  @@index([currentHash])
}

enum EventCategory { SECURITY, LEGAL, IA, FINANCIAL, HR, SYSTEM, CLIENT }
enum EventSeverity { INFO, LOW, MEDIUM, HIGH, CRITICAL }
```

## 2. Servicios del Núcleo

### `EventIntegrityService`
*   **Hashing Encadenado**: Antes de guardar un evento, busca el hash del último evento registrado para esa organización/actor y lo incluye en el cálculo del nuevo hash.
*   **Firma**: Firma cada evento con una clave privada rotativa del servidor.

### `RiskScoringService` (Anomaly Detection)
*   Evalúa reglas heurísticas en tiempo real (ej: "Usuario accedió a 50 expedientes en 1 minuto" -> Score 90, Severity HIGH).
*   Marca flags `isAnomaly` para revisión humana inmediata.

### `SessionReplayService`
*   Permite reconstruir la línea de tiempo exacta de una sesión.
*   (Futuro) Almacena snapshots del DOM o video diffs.

## 3. Seguridad de Ingestión
*   **Rate Limiting**: Límites estrictos por IP y Tenant.
*   **Verificación de Origen**: Validación de encabezados CORS y tokens de sesión.
*   **Anti-spoofing**: El backend fuerza el `actorId` basado en el token JWT, ignorando lo que envíe el frontend.

## 4. Estrategia de Retención (Data Lifecycle)
1.  **Hot (0-90 días)**: PostgreSQL (NVMe). Búsquedas instantáneas.
2.  **Warm (90d - 1 año)**: Move a partición comprimida o base columnar (ClickHouse).
3.  **Cold (> 1 año)**: S3 Glacier Deep Archive (WORM - Write Once Read Many). Requerido por ley en ciertas jurisdicciones.

## 5. Implementación
Para actualizar a v2, se requiere:
1.  Migración de Prisma (alter table).
2.  Middleware de Hashing en `AnalyticsService`.
3.  Servicio de rotación de claves para firmas.
