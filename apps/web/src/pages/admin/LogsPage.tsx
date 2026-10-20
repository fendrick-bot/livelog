import { LOG_STATUSES, type LogStatus } from '@livelog/shared';
import { ExternalLink, Plus, Search, Trash } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAdminLogs, useAdminStats, useCreateLog, useDeleteLog } from '../../api/admin';
import { FilterTabs } from '../../components/admin/FilterTabs';
import { Button } from '../../components/diary/Button';
import { useConfirm } from '../../components/diary/Confirm';
import { EmptyState, InkLoader, Pagination } from '../../components/diary/Feedback';
import { Stamp, StatusStamp } from '../../components/diary/Stamp';
import { AdminPanel } from '../../components/layout/AdminLayout';
import { TagChips } from '../../components/logs/TagChips';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { cn } from '../../lib/cn';
import { NEW_ENTRY_TITLE } from '../../lib/constants';
import { dateTime, timeAgo } from '../../lib/format';

type Filter = LogStatus | 'all';

export default function LogsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const stats = useAdminStats();
  const logs = useAdminLogs({
    status: status === 'all' ? undefined : status,
    q: q || undefined,
    page,
    pageSize: 15,
  });
  const create = useCreateLog();
  const remove = useDeleteLog();
  const [dialog, confirm] = useConfirm();

  const counts = stats.data?.logs;
  const options: Array<{ value: Filter; label: string; count?: number }> = [
    { value: 'all', label: 'All' },
    ...LOG_STATUSES.map((value) => ({ value, label: value, count: counts?.[value] })),
  ];

  const onDelete = async (id: string, title: string) => {
    if (
      await confirm({
        title: 'Tear out this page?',
        body: `“${title}” and its notes and reactions will be deleted forever.`,
        confirmLabel: 'Delete',
        danger: true,
      })
    ) {
      remove.mutate(id);
    }
  };

  return (
    <AdminPanel
      title="Entries"
      actions={
        <Button
          variant="wax"
          icon={<Plus className="size-4" />}
          loading={create.isPending}
          onClick={() =>
            create.mutate(
              { title: NEW_ENTRY_TITLE },
              { onSuccess: (log) => void navigate(`/admin/logs/${log.id}`) },
            )
          }
        >
          New entry
        </Button>
      }
    >
      {dialog}
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <FilterTabs
          value={status}
          options={options}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
        <label className="flex items-center gap-2 md:w-64">
          <Search className="size-4 text-ink-faded" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search entries…"
            aria-label="Search entries"
            className="field-input py-1 text-base"
          />
        </label>
      </div>

      {logs.isPending ? (
        <InkLoader />
      ) : !logs.data?.items.length ? (
        <EmptyState title="No entries here">
          Start a new one, or pick a different filter.
        </EmptyState>
      ) : (
        <>
          <ul
            className={cn(
              'divide-y divide-dashed divide-ink/15 transition-opacity',
              logs.isPlaceholderData && 'opacity-60',
            )}
          >
            {logs.data.items.map((log) => (
              <li
                key={log.id}
                className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/admin/logs/${log.id}`}
                      className="font-hand text-[1.75rem] leading-tight hover:text-quill"
                    >
                      {log.title}
                    </Link>
                    <StatusStamp status={log.status} />
                    {log.kind === 'community' && <Stamp tone="gold">Community</Stamp>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-faded">
                    <span>edited {timeAgo(log.updatedAt)}</span>
                    {log.scheduledFor && (
                      <span className="text-quill">live {dateTime(log.scheduledFor)}</span>
                    )}
                    <span>
                      {log.viewCount} reads · {log.commentCount} notes
                    </span>
                    <TagChips tags={log.tags} linked={false} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {(log.status === 'published' || log.status === 'live') && (
                    <a
                      href={`/logs/${log.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full p-2 text-ink-faded hover:bg-ink/5 hover:text-ink"
                      aria-label="Open public page"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                  <Link
                    to={`/admin/logs/${log.id}`}
                    className="rounded-full px-3 py-1.5 font-type text-[0.7rem] uppercase tracking-widest text-quill hover:bg-quill/8"
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    disabled={log.status === 'live'}
                    onClick={() => void onDelete(log.id, log.title)}
                    className="rounded-full p-2 text-ink-faded hover:bg-wax/10 hover:text-wax disabled:opacity-30"
                    aria-label={`Delete ${log.title}`}
                  >
                    <Trash className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={logs.data.page} totalPages={logs.data.totalPages} onChange={setPage} />
        </>
      )}
    </AdminPanel>
  );
}
