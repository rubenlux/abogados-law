# Seguridad Forense y Avanzada (Enterprise Grade)

Diseño para soportar estudios jurídicos grandes y departamentos legales corporativos que requieren niveles militares de seguridad.

## 1. Backups WORM (Write Once, Read Many)
Objetivo: Protección total contra Ransomware y borrado malicioso.

*   **Implementación Tecnológica**: AWS S3 Object Lock en modo "Compliance".
*   **Política**: Todo documento subido se retiene inmutablemente por 10 años (prescripción decenal genérica).
*   **Consecuencia**: Ni siquiera el Admin con credenciales root puede borrar o modificar un documento bloqueado hasta que expire el timer de retención.

## 2. Auditoría Inmutable y Firma Digital de Logs

### Estructura de Hash Chain
Cada entrada de log contiene el hash de la entrada anterior, creando una cadena criptográfica (similar a Blockchain).

```json
LogEntry {
  "id": 105,
  "timestamp": "2026-01-22T10:00:00Z",
  "action": "VIEW_DOCUMENT",
  "user": "abogado@estudio.com",
  "data": { "doc_id": "uuid..." },
  "prev_hash": "a1b2c3d4...", // Hash del ID 104
  "current_hash": "e5f6g7h8..." // SHA256(prev_hash + timestamp + action + user + data)
}
```

### Firma Diaria
Cada 24 horas, el sistema:
1.  Genera un "Digest" de todos los logs del día.
2.  Firma ese Digest con una clave privada HSM (Hardware Security Module) externa.
3.  Guarda la firma en un servicio de terceros o Ledger público para prueba de existencia.

## 3. Funcionalidades de Investigación Interna

### Exportación Forense
Permite a un auditor externo descargar un "Paquete de Evidencia" de un expediente:
*   ZIP encriptado conteniendo:
    *   Todos los documentos (versiones originales).
    *   Historial completo de accesos (quién vio qué y cuándo).
    *   Reporte de integridad (verificación de hashes).

### Modo "Sabotaje / Investigación"
Un SuperAdmin puede poner a un usuario en "Modo Vigilancia":
*   Log level aumenta a "VERBOSE" (captura queries, clicks, tiempos de lectura).
*   El usuario no sabe que está siendo monitoreado.
*   Se bloquean exportaciones masivas o borrados (Shadowban de acciones destructivas).

## 4. Control de Acceso Avanzado

### Doble Aprobación (4 Eyes Principle)
Acciones críticas requieren la aprobación de un segundo socio vía App móvil:
*   Eliminar un expediente completo.
*   Cambiar permisos de usuario Admin.
*   Exportar toda la base de datos de clientes.

### Bloqueo de Borrados Masivos (Rate Limiting Destructivo)
Si un usuario intenta borrar > 5 documentos en 1 minuto:
1.  Se bloquea su cuenta preventivamente.
2.  Se dispara alerta de seguridad a los socios.
3.  Se revierte automáticamente la transacción (Soft Delete).
