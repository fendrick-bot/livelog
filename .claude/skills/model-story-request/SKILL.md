---
name: model-story-request
description: Context for the StoryRequest model (readers asking the diarist to publish their own story, the multi-step "share your story" form, admin accept/reject review, and how accepted stories become community logs). Use when changing story submission, review, moods, anonymity or the community section.
---

# Story request

**Table** `story_requests` — `apps/server/src/db/schema/story-requests.ts`

| Column                                                 | Notes                                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| submitter_id                                           | fk users, `set null` (story survives account deletion)                              |
| title (4–160), pitch (20–600), content (200–50k chars) |                                                                                     |
| mood                                                   | `STORY_MOODS`: hopeful, nostalgic, grateful, heartbroken, curious, brave (optional) |
| is_anonymous                                           | publish with byline "Anonymous"                                                     |
| contact_email                                          | optional; replies fall back to the account email                                    |
| status                                                 | `pending` → `accepted` \| `rejected` (final)                                        |
| admin_note, reviewed_by_id, reviewed_at                |                                                                                     |
| published_log_id                                       | the community log created on acceptance                                             |

## Lifecycle (`modules/stories/story.service.ts`)

1. **Submit** (`POST /api/stories`, signed-in, rate-limited 5/hour): `consent: true` is
   required by the schema. Emits `story.submitted` → admin toast.
2. **Accept** (`POST /api/admin/stories/:id/accept`, optional `title`, `content`, `tagIds`,
   `note`) — one transaction:
   - creates a `logs` row with `kind='community'`, `status='published'`, author = submitter
     (or the admin if the account is gone), `excerpt` = pitch, `byline` = "Anonymous" when asked;
   - marks the request accepted and links `published_log_id`;
   - queues a `story_reviewed` email (accepted) to the writer.
     Then emits `story.reviewed` and `log.changed`.
3. **Reject** (`POST /api/admin/stories/:id/reject`, optional `note`): marks rejected and
   queues a kind `story_reviewed` email. Reviewing twice → `409 STORY_ALREADY_REVIEWED`.

Community logs then behave like any published log: comments, reactions, tags, editing in the
admin editor, and the "Other diaries" page (`GET /api/logs?kind=community`).

## Code map

| Layer      | File                                                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository | `modules/stories/story.repository.ts`                                                                                                                                              |
| Mapper     | `modules/stories/story.mapper.ts`                                                                                                                                                  |
| Controller | `modules/stories/story.controller.ts` — `POST /api/stories`, `GET /api/stories/mine`, admin `GET /api/admin/stories`, `GET /:id`, `POST /:id/accept`, `POST /:id/reject`           |
| Shared     | `submitStoryInput`, `acceptStoryInput`, `rejectStoryInput`, `listStoriesQuery`; `StoryRequestDto`                                                                                  |
| Web        | `pages/ShareStoryPage.tsx` (4 steps: mood → name it → write it → sign it; draft saved to localStorage), `pages/CommunityPage.tsx`, `pages/admin/StoriesPage.tsx`, `api/stories.ts` |

## Tests

`apps/server/test/community.test.ts` → "story requests".
