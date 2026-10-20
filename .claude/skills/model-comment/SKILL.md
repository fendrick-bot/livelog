---
name: model-comment
description: Context for the Comment model ("notes in the margin": one-level replies, visible/hidden moderation, allow-comments switch, live fan-out over sockets). Use when changing comments, replies, moderation, or the comment UI.
---

# Comment

**Table** `comments` — `apps/server/src/db/schema/comments.ts`

| Column    | Notes                                                                          |
| --------- | ------------------------------------------------------------------------------ |
| log_id    | fk logs, cascade                                                               |
| author_id | fk users, cascade                                                              |
| parent_id | self fk, cascade. **Replies are one level deep**: a parent is always top-level |
| body      | 1–2000 chars, trimmed                                                          |
| status    | `visible` \| `hidden`                                                          |

Index `(log_id, created_at)` serves the newest-first listing.

## Rules (`modules/comments/comment.service.ts`)

- Readers need an account. The log must be public (`live`/`published`); admins can also
  comment on non-public logs.
- `allow_comments = false` → `403 COMMENTS_CLOSED` for readers; admins may still write.
- Listing is newest-first, top-level only, paginated; each item carries its visible `replies`
  (oldest-first) loaded in one batch query.
- Authors and admins can delete; admins can hide/unhide. Hiding emits `comment.removed`,
  unhiding emits `comment.created`, so open pages update instantly.
- `commentCount` on log DTOs counts **visible** comments (replies included).

## Code map

| Layer      | File                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Repository | `modules/comments/comment.repository.ts`                                                                                                                                             |
| Mapper     | `modules/comments/comment.mapper.ts` (`toCommentDto`, `toAdminCommentDto`)                                                                                                           |
| Controller | `modules/comments/comment.controller.ts` — `GET/POST /api/logs/:logId/comments`, `DELETE /api/comments/:id`, admin `GET /api/admin/comments`, `PATCH/DELETE /api/admin/comments/:id` |
| Shared     | `createCommentInput`, `moderateCommentInput`, `adminListCommentsQuery`; `CommentDto`, `AdminCommentDto`                                                                              |
| Web        | `api/comments.ts` (infinite query + `addCommentToCache`/`removeCommentFromCache`), `components/comments/CommentSection.tsx`, `pages/admin/CommentsPage.tsx`                          |

## Realtime

`comment.created` → `comment:new` to `log:<id>` and an `admin:notify` toast for admins;
`comment.removed` → `comment:removed`. `hooks/useLogRoom.ts` writes both into the React Query
cache; the cache helpers de-duplicate the author's own optimistic insert.

## Tests

`apps/server/test/interactions.test.ts` (comments section), `realtime.test.ts`.
