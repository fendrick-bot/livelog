# Livelog

**A diary, written live.** Livelog lets one writer stream a blog entry as they type it.
Readers watch the words land in real time on an old-diary themed site, with soft typewriter
sounds, reactions, and notes in the margin. They can subscribe to get an email the moment a
session starts, and send in their own stories for the community section.

This is phase 1: a complete, tested foundation for the writer, readers and community.

## Features

**Writer (admin)**

- Write entries with autosave; save as draft, publish, archive, or **go live** and stream every keystroke.
- **Schedule** the next live session. Readers see a flip-clock countdown on the home page.
- Per-entry switches for **comments** and **reactions**; they take effect instantly, even mid-stream.
- Tags, excerpts, entry management with filters and search.
- Review reader stories: accept (publishes to "Other diaries") or decline, each with an email to the writer.
- Moderate comments, manage subscribers, and browse the **live history** (duration, peak readers, emails sent).
- Live toasts when stories, comments or subscribers arrive.

**Readers**

- Watch a live entry being typed, with a blinking caret, "writing…" quill, reader count and elapsed time.
- Optional **soundscape**: synthesised typewriter keys plus rain and slow piano.
- React (👍 ❤️ ✨ 🥹 with floating emoji for everyone in the room) and leave threaded comments.
- Share through the native share sheet, copy link, X, WhatsApp, LinkedIn or email; shared links unfurl with Open Graph tags.
- Subscribe by email (double opt-in, one-click unsubscribe).
- Send their own story through a four-step form with mood prompts and a saved draft.
- Accounts with a device list and remote sign-out.

## Stack

| Layer   | Choice                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------- |
| Web     | React 19, Vite 8, React Router 7, TanStack Query 5, Tailwind CSS 4, Motion, react-markdown        |
| API     | Node 24, Express 5, Socket.IO 4, zod 4, jose (JWT), nodemailer, pino                              |
| Data    | PostgreSQL 17 via **Drizzle ORM**; embedded **PGlite** for zero-setup dev and tests               |
| Tooling | TypeScript 6 (strict), ESLint 10, Prettier, Vitest 5, Husky + lint-staged, GitHub Actions, Docker |

## Quick start

Requires Node 22.12+ (24 recommended, see `.nvmrc`).

```bash
npm install
cp .env.example .env
```

**Option A: zero setup (embedded Postgres).** Set `DATABASE_DRIVER=pglite` in `.env`. Migrations run automatically on boot.

**Option B: real Postgres and a test inbox.**

```bash
docker compose up -d     # Postgres on :5432, Mailpit SMTP on :1025, inbox at http://localhost:8025
npm run db:migrate
```

Then, for either option:

```bash
npm run db:seed          # creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev              # web http://localhost:5173 · api http://localhost:4000
```

Sign in with the seeded admin. You land on the writing desk at `/admin`.

## Project structure

```
packages/shared/        contracts: enums, zod schemas, DTOs, socket events, text diff
apps/server/
  src/db/schema/        Drizzle tables (one file per model) + relations
  src/modules/<model>/  repository · mapper · service · controller
  src/realtime/         Socket.IO gateway (rooms, presence, live typing)
  src/lib/              errors, route builder, tokens, crypto, events, logger
  drizzle/              generated SQL migrations (committed)
  test/                 integration tests on in-memory Postgres
apps/web/src/
  api/                  React Query hooks per feature
  hooks/                live status, room subscription, live writer, countdown
  components/diary/     the design system: Paper, Tape, Stamp, Button, Field, Dialog
  pages/                public pages and admin/ (code-split)
.claude/skills/         context skill per data model, data pattern, realtime protocol
```

## How data is handled

Every feature follows the same path, so changes are predictable:

1. **Contract**: request schemas, DTOs and enums live in `packages/shared` and are used by both apps. The web validates forms with the same zod schema the API enforces.
2. **Controller**: `route({ auth, params, query, body }, handler)` validates input, enforces `public | user | admin`, and wraps output as `{ data }`.
3. **Service**: business rules, status transitions and transactions. Failures are `AppError`s with stable codes.
4. **Repository**: SQL only, via Drizzle; works the same inside or outside a transaction.
5. **Mapper**: turns rows into DTOs; the only place that decides what leaves the server.
6. **Events**: after a commit, services emit domain events. The socket gateway broadcasts them; services never touch sockets.
7. **Outbox**: emails are queued in the same transaction and delivered by a retrying worker.

The full guide, with checklists for adding a column or a model, is in
[.claude/skills/livelog-data-pattern/SKILL.md](.claude/skills/livelog-data-pattern/SKILL.md).

## Realtime and latency

- The writer's text travels as tiny diff operations (about 60ms batches) with version numbers. Readers apply them in order and fetch a fresh snapshot after any gap, so they always converge on exactly what the writer sees.
- Live text is buffered in memory and flushed to Postgres every 2 seconds, so keystrokes never hit the database.
- Socket connection-state recovery restores rooms and missed events after brief network drops.
- Sessions refresh silently before tokens expire, across tabs without races, so requests rarely see a 401.
- Admin screens are code-split, vendor code ships in long-cached chunks, entries prefetch on hover, and live status is pushed rather than polled.

Details: [.claude/skills/realtime-live-writing/SKILL.md](.claude/skills/realtime-live-writing/SKILL.md).

## Scripts

| Command                                                     | What it does                                |
| ----------------------------------------------------------- | ------------------------------------------- |
| `npm run dev`                                               | API and web in watch mode                   |
| `npm run check`                                             | Format check, lint, typecheck and all tests |
| `npm test`                                                  | Tests in every workspace                    |
| `npm run build` / `npm start`                               | Production build / start the bundled API    |
| `npm run db:generate -- --name <change>`                    | Create a migration after editing the schema |
| `npm run db:migrate` · `db:seed` · `db:studio` · `db:check` | Database tasks                              |

## Configuration

All variables are documented in [.env.example](.env.example). The important ones:

| Variable                           | Purpose                                                      |
| ---------------------------------- | ------------------------------------------------------------ |
| `DATABASE_DRIVER` / `DATABASE_URL` | `pg` with a connection URL, or `pglite` (embedded)           |
| `JWT_ACCESS_SECRET`                | At least 32 random characters                                |
| `ADMIN_EMAILS`                     | Emails that become admins on signup                          |
| `PUBLIC_URL`                       | Base URL for links in emails and share previews              |
| `SMTP_*`, `MAIL_FROM`              | Outgoing mail. Leave `SMTP_HOST` empty to log emails instead |
| `SERVE_WEB`                        | Serve the built web app from the API (single deployable)     |

## Quality gates

- **Pre-commit**: lint-staged (ESLint and Prettier on staged files), migration consistency for schema edits, full typecheck.
- **Commit message**: Conventional Commits, e.g. `feat(live): show reader count`.
- **Pre-push**: the test suite.
- **CI** (`.github/workflows/ci.yml`): format, lint and typecheck; tests; migrations and seed against a real Postgres 17, including a schema-drift check; production build; Docker image build. Dependabot keeps dependencies current.

## Deployment

```bash
docker build -t livelog .
docker run -p 4000:4000 \
  -e DATABASE_URL=postgres://... -e JWT_ACCESS_SECRET=... \
  -e PUBLIC_URL=https://your.domain -e CORS_ORIGINS=https://your.domain \
  -e COOKIE_SECURE=true -e TRUST_PROXY=true livelog
```

The image applies migrations on start, then serves the API, Socket.IO and the web app on one port.
Phase 1 is designed for a single instance. Scaling out needs Redis for live buffers and the Socket.IO Redis adapter.

## Roadmap ideas for phase 2

- Rich media in entries (image uploads), cover images in the editor.
- Horizontal scaling (Redis adapter, shared live buffers).
- Reader profiles and avatars, notification preferences, scheduled "starting soon" reminders.
- Analytics on reading time and drop-off during live sessions.
