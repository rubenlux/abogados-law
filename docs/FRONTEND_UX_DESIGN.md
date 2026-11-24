# Diseño de Experiencia de Usuario (UX) y Frontend

El objetivo es una interfaz que inspire confianza, autoridad y eficiencia. "Menos clics, más derecho".

## 1. Design System: "Justicia Digital"

### Paleta de Colores
Sofisticada, evitando el azul "tech" genérico.
*   **Primary Navy**: `#0f172a` (Slate 900) - Autoridad, base.
*   **Secondary Slate**: `#475569` (Slate 600) - Textos secundarios.
*   **Accent gold**: `#d97706` (Amber 600) - Detalles, vencimientos advertencia.
*   **Functional Red**: `#dc2626` (Red 600) - Plazos vencidos/fatales.
*   **Functional Green**: `#059669` (Emerald 600) - Confirmaciones, vigencia.
*   **Paper White**: `#ffffff` - Fondo de documentos (con sutil textura grano en modo lectura).

### Tipografía
*   **Titulares**: *Playfair Display* (Serif) - Para documentos legales y títulos de secciones. Aporta seriedad.
*   **UI/Cuerpo**: *Inter* o *Geist Sans* - Legibilidad máxima en densidades altas de datos.

## 2. Mapa de Pantallas (Sitemap)

1.  **Auth**
    *   Login / MFA / Recovery
    *   Tenant Selection (si aplica)
2.  **Dashboard (Home)**
    *   "La Oficina Hoy": Resumen de vencimientos, tareas y novedades.
    *   Widget "Plazos Críticos".
3.  **Expedientes (Cases)**
    *   Grid List (Buscador avanzado, filtros por estado/juzgado).
    *   **Case Detail (El centro de comando)**:
        *   Header: Carátula, Autos, Timeline visual de estado.
        *   Tabs: Actuaciones, Documentos, Agenda, Partes, Finanzas.
4.  **Gestión Documental**
    *   Viewer de PDF enriquecido (Highlight de entidades).
    *   Editor de escritos con IA (Split view: Chat a la izquierda, Editor a la derecha).
5.  **Agenda Judicial**
    *   Calendario Mensual/Semanal.
    *   Lista de Vencimientos.
6.  **Admin / Config**
    *   Usuarios, Roles, Auditoría.
    *   Configuración de Alertas.

## 3. Flujos UX Clave

### Flujo A: El "Café de la Mañana" (Revisión diaria)
1.  Abogado entra al Dashboard.
2.  Ve semáforo de plazos: 2 Rojos (Hoy), 5 Amarillos (Semana).
3.  Clic en Rojo 1: Lleva directo al Expediente -> Tab Documentos -> Filtro "A presentar".
4.  IA sugiere: "Debes presentar el alegato antes de las 9:30".
5.  Acción: Clic "Generar borrador de Alegato con IA".

### Flujo B: Subida de Cédula (Notificación)
1.  Drag & drop de PDF en el Dashboard o Expediente.
2.  Loader animado: "Analizando documento...".
3.  Modal de confirmación ("Magic Moment"):
    *   "Detecté una **Cédula de Traslado de Demanda**."
    *   "Fecha notificación: **22/01/2026**."
    *   "Plazo legal sugerido: **15 días hábiles** (CPCC)."
    *   "Vencimiento calculado: **12/02/2026 09:30**."
4.  Usuario confirma -> Se agenda automáticamente y se disparan alertas.

## 4. Componentes React Necesarios

*   `DecisionModal`: Para confirmar acciones críticas inferidas por IA.
*   `LegalTimeline`: Visualización horizontal de hitos del expediente.
*   `PDFViewerWithHighlights`: Wrapper de PDF.js que permite pintar capas sobre el texto (entidades detectadas).
*   `RichTextEditor (Lexical/Tiptap)`: Soporte para comentarios al margen y autocompletado IA.
*   `ConfidenceBadge`: Pill que muestra el % de certeza de la IA (verde >90, amarillo >70, rojo <70).

## 5. Wireframe Textual: Case Detail Layout

```
+---------------------------------------------------------------+
|  < Back   GARCIA c/ PEREZ s/ DAÑOS   [Estado: PRUEBA]  | MENU |
+---------------------------------------------------------------+
|  [RESUMEN IA: "El expte está en etapa de pericias..."]        |
+---------------------------------------------------------------+
| LEFT SIDEBAR (20%) |  MAIN CONTENT (50%)    | RIGHT SIDE (30%)|
|                    |                        |                 |
| > Actuaciones      |  [DOC] Pericia Me...   |  AGENDA EXPTE   |
|   Documentos       |  -------------------   |  [!] 22/01 Vto  |
|   Partes           |  Este es el contenido  |      Contestar  |
|   Movimientos      |  del documento visua-  |                 |
|   Finanzas         |  lizado.               |  CHAT CON IA    |
|                    |                        |  [ Bot ]: Hola, |
| [UPLOAD BTN]       |  [Highlight: FECHA]    |  en este doc    |
|                    |                        |  se menciona... |
|                    |  [ACCIONES RAPIDAS]    |                 |
|                    |  [Responder] [Ver]     |  [Input.......] |
+--------------------+------------------------+-----------------+
```
