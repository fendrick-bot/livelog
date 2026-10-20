---
name: model-reaction
description: Context for the Reaction model (like/love/inspired/moved toggles, counts, allow-reactions switch, floating emoji broadcast). Use when changing reactions, their types, counts or the reaction bar.
---

# Reaction

**Table** `reactions` — `apps/server/src/db/schema/reactions.ts`

`(log_id, user_id, type)` is unique: each reader can leave each reaction type once per entry.
Types come from `REACTION_TYPES` in `packages/shared/src/constants.ts`
(`like 👍`, `love ❤️`, `inspired ✨`, `moved 🥹`; labels and emoji in `REACTION_META`).

## Rules (`modules/reactions/reaction.service.ts`)

- `PUT /api/logs/:logId/reactions/:type` adds, `DELETE` removes. Both are **idempotent** and
  return `ReactionStateDto` (`counts`, `viewerReactions`).
- Requires an account; log must be public (admins exempt). `allow_reactions = false` →
  `403 REACTIONS_CLOSED` for readers.
- Only real changes emit `reaction.changed` → socket `reaction:update` with fresh counts.
- Counts for lists are batch-loaded (`countsByLogIds`), never per row.

## Adding a reaction type

1. Add it to `REACTION_TYPES` and `REACTION_META` in shared constants.
2. `npm run db:generate -- --name add_reaction_<type>` (it alters the `reaction_type` enum).
3. Nothing else: mappers fill zeros via `emptyReactionCounts()`, the UI iterates the tuple.

## Web

`api/reactions.ts` (`useToggleReaction`, optimistic), `components/live/Reactions.tsx`
(`ReactionBar`, `FloatingReactions`), `hooks/useFloaters.ts`. `LogPage` skips the socket echo of
the viewer's own reaction so the emoji floats once.

## Tests

`apps/server/test/interactions.test.ts` (reactions section), `realtime.test.ts`.
