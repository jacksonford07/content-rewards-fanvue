# Content Rewards PRD

Clean monorepo starter with the same tech stack as `community-access-app`.

## Stack

**Frontend**
- Vite 7 + React 19 + TypeScript
- Tailwind CSS v4 (`@tailwindcss/vite`) + `tw-animate-css`
- shadcn/ui (radix-maia style, phosphor icons)
- React Router 7, Axios, Framer Motion, Sonner, next-themes

**Backend (`/server`)**
- NestJS 11
- Drizzle ORM + `@neondatabase/serverless` (Postgres)
- JWT auth (`@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`)
- bcrypt

## Getting started

```bash
# root: install frontend deps
pnpm install

# server: install backend deps
pnpm --dir server install

# run both in parallel
pnpm dev
```

Frontend: http://localhost:5173
API: http://localhost:3000

## Environment

Create `server/.env`:

```
DATABASE_URL=postgres://...
JWT_SECRET=change-me
FRONTEND_URL=http://localhost:5173
PORT=3000
```
