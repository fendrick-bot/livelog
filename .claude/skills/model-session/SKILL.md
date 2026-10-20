---
name: model-session
description: Context for the Session model and the whole sign-in/session lifecycle (JWT access tokens, rotating refresh-token cookies, reuse detection, device list, silent refresh in the SPA, socket auth). Use for anything about login, logout, token expiry, 401 handling, cookies or "signed-in devices".
---

# Session (auth)

**Table** `sessions` — `apps/server/src/db/schema/sessions.ts`. One row per signed-in device.

| Column                               | Notes                                                   |
| ------------------------------------ | ------------------------------------------------------- |
| user_id                              | fk users, cascade                                       |
| token_hash                           | SHA-256 of the current refresh token (unique)           |
| previous_token_hash                  | hash before the last rotation (reuse detection)         |
| rotated_at                           | when it last rotated                                    |
| user_agent, ip                       | shown on the account page                               |
| expires_at                           | sliding: `REFRESH_TOKEN_TTL_DAYS` from the last refresh |
| last_used_at, revoked_at, created_at |                                                         |

## How it works

- **Access token**: HS256 JWT (`lib/tokens.ts`, `AccessTokens`), claims `sub`, `role`, `sid`,
  TTL `ACCESS_TOKEN_TTL_SECONDS` (900). Sent as `Authorization: Bearer`. Lives only in memory.
- **Refresh token**: 48 random bytes in the httpOnly, `SameSite=Strict` cookie `ll_rt`
  scoped to `/api/auth`. Only its hash is stored. A readable `ll_session=1` hint cookie lets the
  SPA skip the refresh call for anonymous visitors.
- **Rotation** (`AuthService.refresh`): every refresh issues a new token. The update is
  optimistic (`WHERE token_hash = presented`) so two concurrent refreshes cannot both win.
- **Reuse detection**: a token matching `previous_token_hash`
  - within 30s → `401 REFRESH_STALE` (benign race between tabs; client retries),
  - later → the session is revoked (`401 SESSION_EXPIRED`).
- `authenticate` middleware: no header → anonymous; bad/expired token → `401 TOKEN_EXPIRED |
TOKEN_INVALID`, which tells the client to refresh and retry.
- Sockets: the handshake `auth.token` is verified once per connection; an invalid token
  connects anonymously (reading never needs an account).

## Web side (`apps/web/src/lib/auth.ts`, `lib/api.ts`)

- `bootstrapAuth()` at startup; `authReady` gates the first API calls.
- `refreshSession()` is single-flight per tab and serialised across tabs with
  `navigator.locks`; it retries `REFRESH_STALE`.
- Proactive refresh 60s before expiry and on `visibilitychange`.
- `api.*` retries once after a successful refresh on `TOKEN_EXPIRED/TOKEN_INVALID`.
- `lib/socket.ts` re-handshakes when the signed-in user changes.

## Endpoints (`modules/auth/auth.controller.ts`)

`POST /api/auth/signup | login | refresh | logout`, `GET /api/auth/me`,
`GET /api/auth/sessions`, `DELETE /api/auth/sessions/:id`.

## Tests

`apps/server/test/auth.test.ts` — rotation, stale reuse, logout, device list.
