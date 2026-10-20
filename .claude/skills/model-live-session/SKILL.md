---
name: model-live-session
description: Context for the LiveSession model (one row per broadcast: start/end, peak readers, how many subscribers were emailed) and the admin "Live history" page. Use when changing live history, viewer statistics or notification cooldown logic.
---

# Live session

**Table** `live_sessions` — `apps/server/src/db/schema/live-sessions.ts`

| Column               | Notes                                                           |
| -------------------- | --------------------------------------------------------------- |
| log_id               | fk logs, cascade                                                |
| started_by_id        | fk users, set null                                              |
| started_at, ended_at | `ended_at` null while live                                      |
| peak_viewers         | max concurrent readers (admin sockets excluded)                 |
| notified_subscribers | emails queued when this session started (0 inside the cooldown) |

## Rules

- Created in `LogService.goLive`'s transaction; closed by `LiveSessionRepository.endOpen`
  in `endLive` with `greatest(existing, peak)`.
- Peak comes from `LiveHub.setViewers`, which the socket gateway calls (debounced 300ms)
  whenever someone joins/leaves a log room.
- `hasStartedSince(logId, now − 30min)` implements the email cooldown so toggling live on/off
  does not spam subscribers.
- Duration is computed in `AdminService.liveHistory` (`durationSeconds`, null while live).

## Code map

| Layer      | File                                                                            |
| ---------- | ------------------------------------------------------------------------------- |
| Repository | `modules/live/live-session.repository.ts`                                       |
| Service    | `modules/admin/admin.service.ts` (`liveHistory`), `modules/logs/log.service.ts` |
| Controller | `GET /api/admin/live-sessions?page` in `modules/admin/admin.controller.ts`      |
| Shared     | `LiveSessionDto`                                                                |
| Web        | `pages/admin/HistoryPage.tsx`, `api/admin.ts` (`useLiveHistory`)                |

## Tests

`apps/server/test/logs.test.ts` → "goes live, notifies active subscribers once…".
