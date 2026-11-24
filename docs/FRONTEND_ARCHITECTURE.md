# Arquitectura Frontend "Justicia Digital"

## 1. Estructura de Directorios (Definitiva)

```
frontend/
├── src/
│   ├── assets/            # Imágenes, fuentes estáticas
│   ├── components/
│   │   ├── common/        # Átomos (Button, Input, Card, Badge)
│   │   ├── layout/        # MainLayout, Sidebar, Navbar
│   │   ├── domain/        # Componentes de negocio (ExpedienteCard, PDFViewer)
│   │   └── rbac/          # Guardas de permisos (ProtectRoute)
│   ├── core/
│   │   ├── api/           # Clientes Axios/Fetch, Endpoints
│   │   ├── hooks/         # Custom Hooks (useExpediente, useAuth)
│   │   ├── types/         # Definiciones TypeScript globales
│   │   └── utils/         # Date formatting, currency, validators
│   ├── modules/           # Vistas agrupadas por dominio
│   │   ├── auth/          # Login, Recovery
│   │   ├── dashboard/     # Home, Widgets
│   │   ├── expedientes/   # Lists, Detail, Upload, Timeline
│   │   ├── agenda/        # Calendar View, Alerts
│   │   └── ia/            # Asssitant View, Chat Interface
│   ├── theme/             # Design Tokens (si no usamos CSS variables solo)
│   ├── App.tsx
│   └── main.tsx
```

## 2. Stack Tecnológico Frontend

*   **Core**: React 19 + TypeScript.
*   **Build**: Vite.
*   **Routing**: React Router v7 (o v6 data routers).
*   **State Management**: 
    *   Server State: **TanStack Query (React Query)** - OBLIGATORIO para manejo de caché y async.
    *   Client State: **Zustand** (Liviano, para UI state como sidebar open/close).
*   **Forms**: **React Hook Form** + **Zod** (Validación de esquemas fuerte).
*   **UI Library**: 
    *   **Radix UI** (Primitivos accesibles headless).
    *   **Shadcn/UI** (Implementación de referencia usando Tailwind - aunque aquí usamos CSS Modules/Variables según pedido anterior, podemos adaptar la lógica de componentes de Shadcn a CSS puro si se prefiere "Vanilla", o usar Tailwind si el usuario lo permite ahora. NOTA: Por restricción inicial "Use Vanilla CSS", mantendremos CSS variables + clases utilitarias propias, imitando la API de Shadcn).
    *   *Nota: Si se permite Tailwind, aceleraría x10. Asumimos Vanilla CSS optimizado.*
*   **Visualización**:
    *   Gráficos: **Recharts**.
    *   Calendario: **React-Big-Calendar** o **FullCalendar**.
    *   PDF: **React-PDF**.
    *   Editor Texto: **Tiptap** (Headless WYSIWYG).

## 3. Design System Implementation

### Tokens (CSS Variables)
Definidos en `index.css` (Navy, Slate, Gold).

### Componentes Base (Átomos)
Deben ser "tontos" (stateless) y recibir props de estilo.
*   `Button`: variantes (primary, ghost, outline, danger).
*   `Input`: con label, error message, support text.
*   `Card`: container con border, shadow y padding standard.
*   `Modal`: Overlay con focus trap (usando Radix Dialog).

## 4. Patrones de UX
*   **Optimistic UI**: Al agendar un evento, mostrarlo inmediatamente antes de confirmar con el servidor.
*   **Skeleton Loading**: No mostrar spinners gigantes, sino esqueletos de las cards.
*   **Toast Notifications**: Feedback no intrusivo para acciones (ej. "Escrito guardado").
