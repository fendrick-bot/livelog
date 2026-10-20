---
name: model-email-outbox
description: Context for the EmailOutbox model (transactional outbox, email kinds and payloads, templates, the polling worker with retries, SMTP/Mailpit/log transports). Use when adding an email, changing templates, debugging delivery or touching modules/notifications.
---

# Email outbox

**Table** `email_outbox` — `apps/server/src/db/schema/email-outbox.ts`

| Column                                               | Notes                                                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| kind                                                 | `subscribe_confirm` \| `live_started` \| `story_reviewed` (`EMAIL_KINDS`, server-only) |
| to_email                                             |                                                                                        |
| payload jsonb                                        | typed per kind in `modules/notifications/email-jobs.ts` (`EmailPayloads`)              |
| status                                               | `pending` → `sending` → `sent` \| `failed`                                             |
| attempts, last_error, send_after, locked_at, sent_at | retry bookkeeping                                                                      |

## Why an outbox

Emails are inserted **in the same transaction** as the change that causes them
(`repos.outbox.enqueue([...])`). If the transaction rolls back, no email; if the process
crashes after commit, the email is still delivered. Requests never wait on SMTP.

## Worker (`modules/notifications/outbox.worker.ts`)

- Polls every `OUTBOX_POLL_MS`; claims 25 due rows with `FOR UPDATE SKIP LOCKED`, so
  several instances never double-send.
- Failure → `pending` again with backoff `30s × 2^(attempt−1)`; after 5 attempts → `failed`.
- Rows stuck in `sending` for 10 minutes are released.
- `markSent` removes the one-time `token` key from the payload.
- `drain()` processes everything due (used by tests).

## Templates (`modules/notifications/templates.ts`)

One renderer per kind returns `{ subject, html, text, headers? }`. HTML is an inline-styled
"letter on aged paper" layout; every interpolated value goes through `escapeHtml`. Links use
`PUBLIC_URL`.

## Transports (`modules/notifications/mailer.ts`)

`SMTP_HOST` set → nodemailer SMTP (docker compose ships Mailpit: SMTP 1025, inbox
http://localhost:8025). Unset → emails are logged. Tests use `MemoryMailer` (`failNext` simulates errors).

## Adding an email

1. Add the kind to `EMAIL_KINDS` (`db/schema/enums.ts`) and `npm run db:generate`.
2. Add its payload type to `EmailPayloads`.
3. Add a renderer to `templates.ts` (TypeScript forces this).
4. Enqueue it from a service inside the relevant transaction.

## Tests

`apps/server/test/community.test.ts` (confirmation, scrubbing, retry/backoff), `logs.test.ts`.
