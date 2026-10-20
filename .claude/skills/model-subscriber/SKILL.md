---
name: model-subscriber
description: Context for the Subscriber model (email list with double opt-in, confirmation and unsubscribe tokens, who receives "live now" emails). Use when changing subscribe/confirm/unsubscribe flows, the subscribe card, or notification recipients.
---

# Subscriber

**Table** `subscribers` — `apps/server/src/db/schema/subscribers.ts`

| Column                                       | Notes                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------- |
| email                                        | unique, lower-cased                                                   |
| status                                       | `pending` → `active` → `unsubscribed` (can re-subscribe → `pending`)  |
| confirm_token_hash, confirm_token_expires_at | SHA-256 of the emailed token, valid 48h                               |
| unsubscribe_token                            | random, unique, embedded in every email (List-Unsubscribe header too) |
| confirmed_at, unsubscribed_at                |                                                                       |

## Flow (`modules/subscribers/subscriber.service.ts`)

1. `POST /api/subscribers { email }` → always `202` with the same message (no address
   probing). Inside one transaction: create or refresh the pending row and queue a
   `subscribe_confirm` email. Already-active addresses are a silent no-op.
2. Email link → web `/subscribe/confirm?token=…` → `POST /api/subscribers/confirm` →
   `active`; emits `subscriber.confirmed` (admin toast). Expired/unknown → `400 TOKEN_EXPIRED_LINK`.
3. `/unsubscribe?token=…` → `POST /api/subscribers/unsubscribe` → `unsubscribed`.
4. **Go-live** (`LogService.goLive`) emails every `active` subscriber once per entry per
   30 minutes via `listActiveRecipients()` + the outbox.

The confirm token is scrubbed from the outbox payload once sent (`OutboxRepository.markSent`).

## Code map

| Layer      | File                                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository | `modules/subscribers/subscriber.repository.ts`                                                                                                                 |
| Controller | `modules/subscribers/subscriber.controller.ts` — public `POST /api/subscribers`, `/confirm`, `/unsubscribe`; admin `GET /api/admin/subscribers`, `DELETE /:id` |
| Shared     | `subscribeInput`, `tokenInput`, `listSubscribersQuery`; `SubscriberDto`                                                                                        |
| Web        | `components/SubscribeCard.tsx` (wax-seal envelope), `pages/SubscriptionPages.tsx`, `pages/admin/SubscribersPage.tsx`, `api/subscribers.ts`                     |

## Tests

`apps/server/test/community.test.ts` → "subscribers"; `logs.test.ts` → go-live notifications.
