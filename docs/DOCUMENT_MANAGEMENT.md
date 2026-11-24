# Sistema de Gestión Documental Avanzada

Implementación de un sistema robusto de gestión de archivos judiciales con trazabilidad completa.

## Capacidades

1.  **Versionado Automático**:
    *   Cada subida genera una nueva entrada en `DocumentVersion`.
    *   Se mantiene el historial completo de cambios.

2.  **Integridad (SHA256)**:
    *   Cálculo de hash criptográfico para cada versión.
    *   Garantiza que el archivo no ha sido alterado (Forensics).

3.  **Legal Hold (Litigation Hold)**:
    *   Bloqueo de documentos para impedir su eliminación o modificación durante procesos de *discovery* o auditoría.
    *   Flag `legalHold` y `legalHoldReason`.

4.  **OCR (Reconocimiento Óptico de Caracteres)**:
    *   Procesamiento asíncrono para extraer texto de PDFs e imágenes.
    *   Permite búsquedas *Full-Text* sobre el contenido de los documentos.

5.  **Comparación de Versiones**:
    *   Endpoint para comparar metadatos y contenido (diff) entre dos versiones de un mismo documento.

## API

- `POST /documents/:id/versions`: Subir nueva versión.
- `PATCH /documents/:id/legal-hold`: Activar/Desactivar bloqueo legal.
- `GET /documents/compare/:v1/:v2`: Comparar versiones.
