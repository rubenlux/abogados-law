# Seguridad Forense: Legal Hold y Hash Chains

## 1. Validación de Integridad (Hash Chain)

### Concepto
Para garantizar que nadie (ni DB Admin) alteró los logs, usamos una cadena donde:
`Hash(N) = SHA256( Log(N) + Hash(N-1) )`

### Proceso de Verificación Periódica
Un Cron Job ("Auditor Bot") corre cada hora:
1.  Lee el último log validado (`Checkpoint`).
2.  Recorre secuencialmente todos los logs nuevos.
3.  Recalcula los hashes.
4.  Si `CalculatedHash != StoredHash` -> **ALERTA ROJA: INTEGRIDAD COMPROMETIDA**.

### Script de Verificación (Concepto)
```typescript
async function verifyChain() {
  const logs = await db.auditLog.findMany({ orderBy: { timestamp: 'asc' } });
  
  for (let i = 1; i < logs.length; i++) {
    const prev = logs[i-1];
    const curr = logs[i];
    
    const expectedHash = sha256(prev.currentHash + JSON.stringify(curr.data));
    
    if (curr.prevHash !== prev.currentHash || curr.currentHash !== expectedHash) {
      throw new SecurityException(`Broken chain at ID ${curr.id}`);
    }
  }
  return "INTEGRITY OK";
}
```

## 2. Legal Hold (Retención Legal)

### Definición
Un "Legal Hold" es una orden de preservación que bloquea toda política de borrado o expiración automática sobre documentos vinculados a un litigio específico.

### Implementación
*   **Flag `legalHold` en Documento**: Si es `true`, sobreescribe cualquier permiso de borrado.
*   **Reason**: Campo de texto obligatorio explicando la causa (ej. "Orden judicial Expte 555/24").
*   **Notificación**: Al activar Hold, se notifica a todos los custodios (abogados asignados).

## 3. Exportación Forense (Paquete Judicial)

Permite generar un ZIP auto-contenido para presentar en juicio como prueba informática.

### Contenido del Paquete
1.  **Documentos Originales**: Archivos PDF y DOCX tal cual se subieron (sin alterar metadatos).
2.  **Manifiesto de Integridad (JSON + PDF)**: Lista de hashes SHA256 de cada archivo.
3.  **Audit Trail Completo**: CSV con todos los accesos y modificaciones.
4.  **Certificado de Autenticidad**: Firmado digitalmente por la plataforma (SaaS Private Key).

### Estándar EDRM (Electronic Discovery Reference Model)
El formato de exportación sigue estándares `EDRM XML` para ser importable en software de eDiscovery (Relativity, Nuix).
