---
name: model-tag
description: Context for the Tag model and the log_tags join table (naming, slugs, counts, filtering entries by tag, the admin tag picker). Use when adding, renaming, counting or filtering by tags.
---

# Tag

**Tables** — `apps/server/src/db/schema/tags.ts`

- `tags`: `id`, `name` (≤40), `slug` (≤60, unique `tags_slug_idx`), timestamps.
  Uniqueness is by slug, so "Late Nights" and "late nights" collide (`409 TAG_EXISTS`).
- `log_tags`: composite pk `(log_id, tag_id)`, both cascade on delete; index on `tag_id`.

## Rules

- Slug = `slugify(name, 60)`; a name without letters/digits is a validation error.
- At most `LIMITS.tagsPerLog` (10) tags per entry. `LogService.assertTagsExist` validates ids.
- `LogRepository.setTags` replaces the whole set (delete + insert) inside the caller's transaction.
- Public `GET /api/tags` counts only public entries (`live`, `published`); the admin list counts all.
- Deleting a tag only removes the associations; entries stay.

## Code map

| Layer      | File                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository | `modules/tags/tag.repository.ts` (`listWithCounts`, `findByIds`)                                                                                        |
| Mapper     | `modules/tags/tag.mapper.ts`                                                                                                                            |
| Service    | `modules/tags/tag.service.ts`                                                                                                                           |
| Controller | `modules/tags/tag.controller.ts` — `GET /api/tags`; admin `GET/POST /api/admin/tags`, `PATCH/DELETE /api/admin/tags/:id`                                |
| Shared     | `tagInput`, `TagDto`                                                                                                                                    |
| Web        | `components/logs/TagChips.tsx`, `components/admin/TagPicker.tsx`, `pages/admin/TagsPage.tsx`, archive filter in `pages/ArchivePage.tsx` (`?tag=<slug>`) |

## Tests

`apps/server/test/logs.test.ts` → "filters by tag and searches titles".
