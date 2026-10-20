# Livelog

A diary written live. The admin (the "diarist") writes entries that readers can watch being
typed in real time, react to, and comment on. Readers can subscribe for a "live now" email and
send their own stories, which the admin can publish in a community section.

## Monorepo

| Path              | What                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared` | Contracts used by both apps: enums, zod input schemas, DTOs, socket events, text diff helpers. Consumed as TypeScript source. |
| `apps/server`     | Express 5 + Socket.IO + Drizzle ORM on Postgres (node-postgres, or embedded PGlite). Bundled with esbuild.                    |
| `apps/web`        | React 19 + Vite 8 + React Router 7 + TanStack Query + Tailwind 4 + Motion. Diary theme.                                       |
| `.claude/skills`  | One context skill per data model, plus the data pattern and realtime protocol.                                                |

## Commands

```bash
npm run dev            # server :4000 + web :5173 (web proxies /api and /socket.io)
npm run check          # format:check + lint + typecheck + tests (what CI runs)
npm test               # all workspaces (server tests boot the real app on in-memory PGlite)
npm run db:generate -- --name <change>   # after editing apps/server/src/db/schema/*
npm run db:migrate     # apply migrations (automatic on boot with DATABASE_DRIVER=pglite)
npm run db:seed        # admin account from ADMIN_EMAIL/ADMIN_PASSWORD + sample tags/entry
npm run build          # web → apps/web/dist, server → apps/server/dist
```

## How data flows

Read `.claude/skills/livelog-data-pattern/SKILL.md` before changing any model or endpoint.
In short: shared zod schema → `route()` controller → service (rules, transactions, events) →
repository (SQL only) → mapper (row → DTO) → React Query hook. Emails go through the
transactional outbox; realtime broadcasts are driven by domain events, never called from
services directly.

Per-model context: `model-user`, `model-session`, `model-log`, `model-tag`, `model-comment`,
`model-reaction`, `model-story-request`, `model-subscriber`, `model-live-session`,
`model-email-outbox`. Live typing, presence and sockets: `realtime-live-writing`.

## Conventions

- TypeScript strict everywhere; `import type` for types (verbatimModuleSyntax).
- Every API response is `{ data }` or `{ error: { code, message, details? } }`.
- Errors: `Errors.*` from `apps/server/src/lib/errors.ts` with a stable `code`.
- Never expose emails in public DTOs; use `toPublicUser()`.
- New schema column ⇒ migration committed + DTO + mapper + model skill updated. CI fails on
  schema drift.
- UI: reuse `components/diary/*` (Paper, Tape, Stamp, Button, Field, Dialog). Keep pages
  usable at 360px wide; respect `prefers-reduced-motion`.
- Commits follow Conventional Commits (enforced by the `commit-msg` hook).
- TypeScript is pinned to 6.0.x because typescript-eslint supports `<6.1`.
