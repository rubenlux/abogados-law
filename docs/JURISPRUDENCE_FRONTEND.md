
# Jurisprudence Explorer Frontend

Módulo de exploración de jurisprudencia integrado en la plataforma Abogados Law.

## Características

El módulo permite a los abogados investigar precedentes legales utilizando el motor de búsqueda semántica vectorial.

## Páginas Implementadas

### 1. Búsqueda (`/jurisprudencia`)
- **Ruta**: `src/modules/jurisprudencia/pages/JurisprudencePage.tsx`
- **Funcionalidades**:
  - **Search Bar Semántico**: Busca conceptos, no solo palabras clave exactas.
  - **Filtros Laterales**: Fuero, Tribunal, Año.
  - **Ranking Visual**: Badge con porcentaje de coincidencia (Score).
  - **Feedback**: Estados de carga y resultados vacíos.

### 2. Detalle del Fallo (`/jurisprudencia/:id`)
- **Ruta**: `src/modules/jurisprudencia/pages/JurisprudenceDetail.tsx`
- **Funcionalidades**:
  - **Lectura Inmersiva**: Estilo "papel" con tipografía serif para lectura prolongada.
  - **Sumario Inteligente**: Resumen generado/extraído visible al inicio.
  - **Ficha Técnica**: Metadatos clave (Expediente, Vigencia, Precedencia).
  - **Navegación**: Botón de retorno manteniendo el flujo.

## Componentes UI

- Se utiliza el Design System existente (variables CSS HSL).
- **Animaciones**: `animate-fade-in` para transiciones suaves.
- **Iconografía**: `lucide-react` para consistencia visual.

## Integración API

Se han agregado métodos al `apiClient`:
- `jurisprudence.search(params)`
- `jurisprudence.findById(id)`
- `jurisprudence.getStats()`

## Próximos Pasos (Frontend)

- [ ] Implementar acción real "Enviar al Chat" (pasar contexto via state).
- [ ] Implementar acción "Usar en Redacción" (copiar al editor de documentos).
- [ ] Paginación numerada (actualmente scroll/limit).
