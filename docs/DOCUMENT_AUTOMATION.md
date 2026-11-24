# Automatización Documental (Smart Templates)

El sistema permite crear y utilizar plantillas dinámicas para la generación masiva o automatizada de escritos jurídicos recurrentes (e.g., Cédulas, Demandas tipo, Cartas Documento).

## Características

1.  **Variables Dinámicas**:
    *   Sintaxis `{{variable}}` (ej: `{{nombre_cliente}}`, `{{juzgado}}`).
    *   Detección automática de variables faltantes antes de generar.

2.  **Gestión de Plantillas**:
    *   CRUD completo de plantillas por organización (`organizationId`).
    *   Categorización (Laboral, Civil, Administrativo).

3.  **Motor de Generación**:
    *   Endpoint dedicado para fusionar datos + plantilla.
    *   Salida en texto/HTML lista para exportar a PDF/Word.

## API Endpoints

### Crear Plantilla
`POST /templates`
```json
{
  "name": "Demanda Despido",
  "content": "Sr. Juez...\n Vengo por {{actor}} contra {{demandado}}...",
  "variables": ["actor", "demandado"],
  "category": "LABORAL"
}
```

### Generar Documento
`POST /templates/:id/generate`
```json
{
  "actor": "Juan Perez",
  "demandado": "Empresa S.A."
}
```

## Próximos Pasos Visionados
- Editor visual WYSIWYG para plantillas.
- Condiciones lógicas (`{{#if tiene_hijos}}...{{/if}}`).
- Flujos de aprobación antes de generación final.
