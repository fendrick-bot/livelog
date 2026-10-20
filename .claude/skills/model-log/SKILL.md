---
name: model-log
description: Context for the Log model, the diary entry at the heart of Livelog (author and community kinds, draft/scheduled/live/published/archived status machine, slugs, excerpts, comment/reaction switches, go-live and end-live). Use for any change to entries, publishing, scheduling, the countdown, live status, or modules/logs.
---

# Log (diary entry)

**Table** `logs` — `apps/server/src/db/schema/logs.ts`

| Column                                       | Notes                                                            |
| -------------------------------------------- | ---------------------------------------------------------------- |
| author_id                                    | fk users (`restrict`)                                            |
| kind                                         | `author` (the diarist) \| `community` (an accepted reader story) |
| status                                       | `draft` \| `scheduled` \| `live` \| `published` \| `archived`    |
| title (160), slug (200, unique)              | slug from `slugify(title)`, `-xxxxxx` suffix on collision        |
| excerpt (300) null                           | custom excerpt; null → derived from content by the mapper        |
| content text                                 | markdown                                                         |
| cover_image_url, byline (60)                 | byline overrides the author name (e.g. "Anonymous")              |
| allow_comments, allow_reactions              | the admin's per-entry interaction switches                       |
| reading_minutes, view_count                  |                                                                  |
| scheduled_for                                | next live time (status `scheduled`)                              |
| live_started_at, live_ended_at, published_at |                                                                  |

Indexes: partial unique `logs_single_live_idx` guarantees **one live entry at a time**;
partial index on `scheduled_for` for scheduled rows.

## Status machine

Defined once in `packages/shared/src/constants.ts` (`LOG_TRANSITIONS`, `canTransition`) and
enforced by `LogService.changeStatus` / `goLive` / `endLive`:

```
draft      → scheduled | live | published | archived
scheduled  → draft | live | published | archived   (scheduled → scheduled = reschedule)
live       → published | draft                     (only via end-live)
published  → draft | live | archived
archived   → draft | published
```

Public visitors see only `live` and `published` (`PUBLIC_LOG_STATUSES`). A live entry cannot be
edited through status endpoints or deleted until the stream ends (`LOG_IS_LIVE`).

## Key behaviours (`modules/logs/log.service.ts`)

- **Slugs are permanent** once the entry has been published or live; drafts re-slug on rename.
- **goLive**: one transaction flips status, opens a `live_sessions` row and queues one
  `live_started` email per active subscriber, unless the same entry went live in the last
  30 minutes. Then `LiveHub.open()` and the `log.liveStarted` event.
- **endLive**: flushes the LiveHub buffer, sets `published` (keeps the first `published_at`)
  or `draft`, closes the live session with the peak reader count, emits `log.liveEnded`.
- While live, `content` in the DB lags the in-memory buffer by ≤2s; detail reads overlay the
  buffer (`LiveHub.peek`). A REST `PATCH` with content while live replaces the buffer and
  broadcasts a snapshot.
- **Next scheduled** (`getLiveStatus`) shows entries up to 2h after their start time.
- Lists skip `content` and read a 600-char `content_preview` for excerpts.
- `view_count` increments on public reads by non-admins (does not touch `updated_at`).

## Code map

| Layer       | File                                                                                                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema      | `apps/server/src/db/schema/logs.ts`, `tags.ts` (`log_tags`)                                                                                                      |
| Repository  | `modules/logs/log.repository.ts` (`LogRecord`, `LogListRecord`)                                                                                                  |
| Mapper      | `modules/logs/log.mapper.ts` (`toLogSummary`)                                                                                                                    |
| Service     | `modules/logs/log.service.ts`                                                                                                                                    |
| Controller  | `modules/logs/log.controller.ts` — public `/api/logs`, `/api/live/status`; admin `/api/admin/logs`                                                               |
| Live buffer | `modules/live/live-hub.ts` (see `realtime-live-writing`)                                                                                                         |
| Shared      | `createLogInput`, `updateLogInput`, `scheduleLiveInput`, `endLiveInput`, `listLogsQuery`, `adminListLogsQuery`; `LogSummaryDto`, `LogDetailDto`, `LiveStatusDto` |
| Web         | `api/logs.ts`, `api/admin.ts`; `pages/LogPage.tsx`, `pages/HomePage.tsx`, `pages/ArchivePage.tsx`, `pages/admin/LogEditorPage.tsx`, `pages/admin/LogsPage.tsx`   |

## Endpoints

Public: `GET /api/logs?kind&tag&q&page&pageSize`, `GET /api/logs/:slug`, `GET /api/live/status`.
Admin: `GET|POST /api/admin/logs`, `GET|PATCH|DELETE /api/admin/logs/:id`,
`POST /api/admin/logs/:id/{publish|unpublish|archive|schedule|unschedule|go-live|end-live}`.

## Events → sockets

`log.changed` → `log:updated` to the entry's room (+ `live:status` if scheduled/live involved);
`log.liveStarted` / `log.liveEnded` → `live:status` site-wide, `live:ended` to the room;
`log.deleted` → `live:status`.

## Tests

`apps/server/test/logs.test.ts` (visibility, slugs, state machine, tags, schedule, go-live
notifications and cooldown, history), `realtime.test.ts` (streaming).
