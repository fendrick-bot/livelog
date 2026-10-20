---
name: realtime-live-writing
description: How live writing works end to end (Socket.IO rooms, the TextOp diff protocol with versions and snapshots, LiveHub buffering and persistence, presence counts, typing sounds, reconnect recovery). Use when touching sockets, the live editor, the live reader, presence, or anything that feels laggy.
---

# Realtime and live writing

Contract: `packages/shared/src/realtime.ts` (`ClientToServerEvents`, `ServerToClientEvents`,
`ROOMS`). Server: `apps/server/src/realtime/gateway.ts`. Buffer: `modules/live/live-hub.ts`.

## Principles

- **Writes go through REST** (comments, reactions, status). Sockets fan out events, plus the
  one exception: the writer's keystroke stream.
- **Rooms**: `site` (everyone: `live:status`), `admin` (admin toasts), `log:<id>` (one entry).
- Connection state recovery (2 min) restores rooms and missed events after short drops.

## Live typing protocol

1. Writer (`apps/web/src/hooks/useLiveWriter.ts`) batches keystrokes every ~60ms into one
   `TextOp { pos, del, ins }` from `diffText(lastSent, current)` and emits
   `live:op { logId, baseVersion, op }` with an ack.
2. `LiveHub.applyOp` accepts it only if `baseVersion` matches; otherwise the writer receives
   `VERSION_MISMATCH` and sends `live:replace` (a full snapshot).
3. The server broadcasts `live:op { op, version }` (or `live:snapshot`) to the room, excluding
   the writer.
4. Readers (`hooks/useLogRoom.ts`) apply ops only when `version === local + 1`; any gap or
   invalid op triggers a re-`log:join`, which returns a fresh snapshot.
5. `LiveHub` keeps the text in memory and flushes dirty buffers to Postgres every 2s, on
   end-live and on shutdown. After a restart it re-hydrates lazily from the DB (version resets
   to 0, so clients resync automatically).

Cost per keystroke: a few bytes on the wire, zero database writes.

## Presence

`log:join` / `log:leave` / `disconnecting` schedule a debounced (300ms) count of non-admin
sockets in the room → `presence { viewers }` and `LiveHub.setViewers` (peak for history).

## Sound

`apps/web/src/lib/sound/soundscape.ts` synthesises soft typewriter keys (per inserted char,
paced and capped) and an optional rain + lo-fi pad. It unlocks only on a user gesture; prefs
persist in localStorage. Readers hear `typeBurst(op)`; the writer hears local keydowns.

## Scaling note

Phase 1 is single-instance (in-memory buffers and the local adapter). To scale out: move
buffers to Redis, add `@socket.io/redis-adapter`, and pin writers with sticky sessions.

## Tests

`apps/server/test/realtime.test.ts` (ops, stale versions, snapshots, permissions, presence,
comment/reaction fan-out); `packages/shared/src/text.test.ts` (diff/apply).
