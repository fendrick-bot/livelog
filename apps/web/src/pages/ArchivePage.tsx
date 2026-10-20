import { Search } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useLogs, useTags } from '../api/logs';
import {
  EmptyState,
  ErrorNote,
  InkLoader,
  Pagination,
  SectionTitle,
} from '../components/diary/Feedback';
import { Paper } from '../components/diary/Paper';
import { LogGrid } from '../components/logs/LogCard';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { cn } from '../lib/cn';

export default function ArchivePage() {
  const [params, setParams] = useSearchParams();
  const tag = params.get('tag') ?? undefined;
  const page = Number(params.get('page') ?? 1) || 1;
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebouncedValue(search.trim(), 350);
  const tags = useTags();
  const logs = useLogs({ kind: 'author', tag, q: q || undefined, page, pageSize: 12 });

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  const usedTags = (tags.data ?? []).filter((item) => item.logCount > 0);

  return (
    <div>
      <SectionTitle eyebrow="The archive" title="Every entry, in ink">
        Browse by tag, or search for a half-remembered line.
      </SectionTitle>

      <Paper className="mb-10 flex flex-col gap-4 rounded-[4px] px-5 py-4 md:flex-row md:items-center">
        <label className="flex flex-1 items-center gap-3">
          <Search className="size-4 text-ink-faded" aria-hidden />
          <span className="sr-only">Search entries</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              update({ page: undefined });
            }}
            placeholder="Search titles and excerpts…"
            className="field-input border-0 text-lg"
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by tag">
          <button
            type="button"
            onClick={() => update({ tag: undefined, page: undefined })}
            className={cn('stamp transition', !tag ? 'text-wax' : 'text-ink-faded hover:text-ink')}
          >
            All
          </button>
          {usedTags.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                update({ tag: tag === item.slug ? undefined : item.slug, page: undefined })
              }
              className={cn(
                'stamp transition',
                tag === item.slug ? 'text-wax' : 'text-quill hover:opacity-70',
              )}
              aria-pressed={tag === item.slug}
            >
              #{item.name} <span className="opacity-60">{item.logCount}</span>
            </button>
          ))}
        </div>
      </Paper>

      {logs.isPending ? (
        <InkLoader className="text-paper/70" />
      ) : logs.error ? (
        <Paper>
          <ErrorNote error={logs.error} onRetry={() => void logs.refetch()} />
        </Paper>
      ) : logs.data.items.length === 0 ? (
        <Paper className="mx-auto max-w-xl">
          <EmptyState title="Nothing on these pages">
            Try another tag or a different word.
          </EmptyState>
        </Paper>
      ) : (
        <div className={cn('transition-opacity', logs.isPlaceholderData && 'opacity-60')}>
          <LogGrid logs={logs.data.items} />
          <div className="mt-6 text-paper/80 [&_*]:text-paper/80">
            <Pagination
              page={logs.data.page}
              totalPages={logs.data.totalPages}
              onChange={(next) => update({ page: String(next) })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
