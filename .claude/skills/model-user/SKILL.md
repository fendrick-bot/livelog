---
name: model-user
description: Context for the User model (accounts, roles admin/reader, public author identity). Use when touching signup/profile data, roles, who can do what, how authors appear publicly (PublicUserDto, bylines), or the users table.
---

# User

**Table** `users` — `apps/server/src/db/schema/users.ts`

| Column                  | Type             | Notes                                                                      |
| ----------------------- | ---------------- | -------------------------------------------------------------------------- |
| id                      | uuid pk          | `gen_random_uuid()`                                                        |
| email                   | varchar(254)     | unique (`users_email_idx`); always lower-cased by the shared `emailSchema` |
| password_hash           | text             | `scrypt$N$r$p$salt$hash` (`lib/crypto.ts`)                                 |
| display_name            | varchar(60)      | 2–60 chars                                                                 |
| role                    | `user_role` enum | `admin` \| `reader` (default `reader`)                                     |
| avatar_url              | text null        | not editable in phase 1                                                    |
| last_login_at           | timestamptz null | set on login                                                               |
| created_at / updated_at | timestamptz      | `updated_at` bumps via `$onUpdate`                                         |

## Rules

- **Admins** are users whose email is in `ADMIN_EMAILS` at signup, or created/promoted by
  `npm run db:seed` (`ADMIN_EMAIL`/`ADMIN_PASSWORD`). There is no role-change endpoint yet.
- **Emails never leave the server in public payloads.** Public identity is `PublicUserDto`
  (`id`, `displayName`, `avatarUrl`, `isAdmin`) built by `toPublicUser()` in
  `modules/users/user.mapper.ts`. A log `byline` (e.g. "Anonymous") replaces the author entirely
  and nulls the id.
- Deleting a user cascades sessions, comments, reactions; logs `restrict` (author must stay);
  story requests `set null`.

## Code map

| Layer      | File                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------- |
| Schema     | `apps/server/src/db/schema/users.ts`                                                              |
| Repository | `apps/server/src/modules/users/user.repository.ts`                                                |
| Mapper     | `apps/server/src/modules/users/user.mapper.ts` (`toUserDto`, `toPublicUser`, `publicUserColumns`) |
| Service    | `AuthService` (`modules/auth/auth.service.ts`) creates users                                      |
| Shared     | `signupInput`, `loginInput` (`schemas/auth.ts`), `UserDto`, `PublicUserDto` (`dto.ts`), `ROLES`   |
| Web        | `lib/auth.ts` (`useAuth()` → `{ status, user }`), `pages/AccountPage.tsx`                         |

## Related

`model-session` for sign-in mechanics. Authorisation checks are `route({ auth: 'admin' })` on
the server and `<RequireAdmin>` / `<RequireAuth>` (`components/auth/Guards.tsx`) on the web.

## Tests

`apps/server/test/auth.test.ts` — signup normalisation, duplicate email, admin role, access control.
