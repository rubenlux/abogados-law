# AGENTS.md

## Project Overview

Legal management platform ("Abogado Virtual") with AI-powered jurisprudence search, case management, and legal drafting.

**Stack**: NestJS (backend) + React/Vite (frontend) + PostgreSQL/pgvector + OpenAI

## Repository Structure

```
Abogados_law/
├── backend/              # NestJS API (port 3000)
│   ├── src/
│   │   ├── crawler/      # CSJN scraper (Playwright)
│   │   ├── ia/           # AI modules (chat, risk, drafting, jurisprudence)
│   │   ├── auth/         # JWT authentication
│   │   ├── expediente/   # Case management
│   │   ├── agenda/       # Judicial calendar
│   │   └── ...
│   ├── prisma/           # Database schema
│   └── scripts/          # One-off scripts (ingest, test, etc.)
├── frontend/             # React + Vite (port 5173)
│   └── src/
│       ├── modules/     # Feature modules (dashboard, ia, agenda, etc.)
│       ├── pages/        # Page components
│       └── components/   # Shared UI components
├── admin-platform/       # Admin dashboard (separate Vite app)
└── docs/                # Extensive technical documentation
```

## Developer Commands

### Backend
```bash
cd backend
npm install && npx prisma generate && npx prisma db push
npm run start:dev      # Watch mode
npm run lint            # ESLint + Prettier
npm run format          # Prettier only
npx prisma seed        # Populate database
npx ts-node src/crawler/run.ts  # Run scraper
```

### Frontend
```bash
cd frontend
npm install
npm run dev             # Dev server on :5173
npm run build           # TypeScript check + Vite build
npm run lint            # ESLint
```

### Admin Platform
```bash
cd admin-platform
npm install
npm run dev
npm run build
```

## Database

- **ORM**: Prisma with PostgreSQL + pgvector extension
- **Prisma commands**: `npx prisma generate` (after schema changes), `npx prisma db push` (apply schema)
- **Seed**: `npm run seed` in backend directory

## Key Patterns

### Frontend Styling
- Uses **custom CSS variables** in `index.css` (not standard Tailwind config)
- CSS custom properties: `--hsl-primary`, `--hsl-surface`, `--hsl-background`, etc.
- Component classes: `.btn`, `.btn-primary`, `.card`, `.badge`, `.input-field`
- Fonts: `--font-heading: 'Playfair Display'` (serif), `--font-sans: 'Inter'`

### Frontend State
- **Zustand** for state management (`src/core/store/`)
- React Router v7 for routing
- Protected routes via `useAuthStore`

### Backend Architecture
- NestJS modules per feature (IA, crawler, auth, etc.)
- Prisma service injected via `PrismaService`
- HMAC-protected Legal Pixel analytics

## Important Notes

- **No `npm test`** in package.json for backend - tests exist but require manual setup
- Scraper outputs to `src/crawler/run.ts`; ingestion via separate scripts in `scripts/`
- Documentation in `/docs` covers: CSJN scraper, AI chat, jurisprudence engine, security, deployment
- API base URL needs to be configured (typically `http://localhost:3000` for dev)
