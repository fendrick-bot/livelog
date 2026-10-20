---
name: livelog-data-pattern
description: The layered data-handling pattern every Livelog module follows (shared zod contract → controller → service → repository → mapper → DTO → React Query hook). Use before adding or changing any model, column, endpoint, DTO field or API hook, and whenever you are unsure where a piece of logic belongs.
---

# Livelog data pattern

Every feature moves data through the same layers. Follow them in order and a change is
complete when every layer has been touched.

```
packages/shared  ── enums (constants.ts) · zod input schemas (schemas/*) · response DTOs (dto.ts) · socket contract (realtime.ts)
       │
apps/server/src
  db/schema/<model>.ts          Drizzle table. Enum values imported from @livelog/shared.
  modules/<m>/<m>.repository.ts SQL only. Takes a DbExecutor (pool or transaction). Returns rows.
  modules/<m>/<m>.mapper.ts     Row → DTO. The ONLY place a DB row becomes an API shape.
  modules/<m>/<m>.service.ts    Business rules, transactions, domain events. Throws AppError.
  modules/<m>/<m>.controller.ts Express Router built with route({ auth, params, query, body }).
  modules/repositories.ts       createRepositories(executor) + transaction runner.
  container.ts                  Composition root. Wires repos → services → worker.
       │
apps/web/src
  api/<m>.ts                    React Query hooks; cache keys from lib/query-keys.ts.
  pages/ & components/          UI. Validates forms with the SAME shared zod schema.
```

## Rules

1. **Contracts live in `@livelog/shared`.** Never define a request/response shape in only one
   app. Enums are `as const` tuples; DB enums (`db/schema/enums.ts`) derive from them.
2. **Repositories never throw business errors** and never import services. They return `null`
   for "not found". Use `withRelations`-style constants for relational queries.
3. **Services own rules.** They receive `{ repos, transaction, events, ... }` from the container.
   Multi-step writes go through `transaction(async (repos) => ...)`, which hands you
   repositories bound to the transaction.
4. **Errors** are `Errors.*` from `lib/errors.ts` with a stable `code`
   (`NOT_FOUND`, `INVALID_TRANSITION`, `COMMENTS_CLOSED`...). The web shows `message`; code is for logic.
5. **Controllers are thin.** `route()` validates params → query → body, enforces
   `auth: 'public' | 'user' | 'admin'` (and narrows the `auth` type), and wraps output in `{ data }`.
   Returning nothing yields `204`.
6. **Side effects after commit** are domain events (`lib/events.ts`). Services never import
   socket.io; `realtime/gateway.ts` subscribes and broadcasts.
7. **Emails are written to `email_outbox` inside the same transaction** as the change that
   causes them (see `model-email-outbox`). Never send mail inline from a request.
8. **Dates** are `timestamptz` in the DB, `Date` in services, ISO strings in DTOs (`lib/dates.ts`).
9. **Lists** use `paginationQuery` (page/pageSize) and return `Paginated<T>` via `paginate()`.
   Count queries reuse the same `where`.
10. **No N+1.** Batch-load counts for a page of rows (see `LogService.summaries`).

## Adding a column (checklist)

1. `apps/server/src/db/schema/<model>.ts` — add the column.
2. `npm run db:generate -- --name <what_changed>` and commit the SQL in `apps/server/drizzle/`.
3. `packages/shared/src/dto.ts` — add the field to the DTO.
4. `packages/shared/src/schemas/<model>.ts` — accept it in create/update inputs if writable.
5. `modules/<m>/<m>.mapper.ts` — map it. TypeScript will flag the DTO until you do.
6. `modules/<m>/<m>.service.ts` — apply defaults/rules on write.
7. Web: hook in `apps/web/src/api/<m>.ts`, then the UI.
8. Tests in `apps/server/test/*.test.ts`; update the model's skill file in `.claude/skills/`.

## Adding a model

Create `db/schema/<model>.ts` (+ export from `schema/index.ts`, relations in `relations.ts`),
then `modules/<model>/{repository,mapper,service,controller}.ts`, register the repository in
`modules/repositories.ts`, the service in `container.ts`, the router in `modules/index.ts`
(admin routes go through `modules/admin/admin.controller.ts`). Add a `model-<name>` skill.

## Testing

`apps/server/test/helpers.ts → createTestContext()` boots the real app on an in-memory
PGlite Postgres with migrations applied and a `MemoryMailer`. Use `signup`, `signupAdmin`,
`createLog`, `publishedLog`. Call `container.outboxWorker.drain()` to deliver queued emails.
