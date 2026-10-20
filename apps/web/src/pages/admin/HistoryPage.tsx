import { useState } from 'react';
import { Link } from 'react-router';
import { useLiveHistory } from '../../api/admin';
import { EmptyState, InkLoader, Pagination } from '../../components/diary/Feedback';
import { StatusStamp } from '../../components/diary/Stamp';
import { AdminPanel } from '../../components/layout/AdminLayout';
import { cn } from '../../lib/cn';
import { dateTime, duration } from '../../lib/format';

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const history = useLiveHistory(page);

  return (
    <AdminPanel title="Live history">
      <p className="mb-5 italic text-ink-soft">
        Every time the pen went live: how long, how many readers at the peak, and who got a letter.
      </p>
      {history.isPending ? (
        <InkLoader />
      ) : !history.data?.items.length ? (
        <EmptyState title="No live sessions yet">
          Your first live entry will be recorded here.
        </EmptyState>
      ) : (
        <>
          <ol
            className={cn(
              'relative ml-3 border-l-2 border-dashed border-ink/20',
              history.isPlaceholderData && 'opacity-60',
            )}
          >
            {history.data.items.map((session) => (
              <li key={session.id} className="relative mb-6 pl-6 last:mb-0">
                <span
                  aria-hidden
                  className={cn(
                    'absolute -left-[9px] top-2 size-4 rounded-full border-2 border-paper',
                    session.endedAt ? 'bg-ink-faded' : 'bg-wax-bright animate-live-pulse',
                  )}
                />
                <p className="font-type text-[0.68rem] uppercase tracking-widest text-ink-faded">
                  {dateTime(session.startedAt)}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to={`/admin/logs/${session.log.id}`}
                    className="font-hand text-3xl leading-tight hover:text-quill"
                  >
                    {session.log.title}
                  </Link>
                  <StatusStamp status={session.log.status} />
                </div>
                <dl className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
                  <div>
                    <dt className="inline text-ink-faded">Duration </dt>
                    <dd className="inline font-type">
                      {session.durationSeconds === null
                        ? 'still live'
                        : duration(session.durationSeconds)}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-ink-faded">Peak readers </dt>
                    <dd className="inline font-type">{session.peakViewers}</dd>
                  </div>
                  <div>
                    <dt className="inline text-ink-faded">Letters sent </dt>
                    <dd className="inline font-type">{session.notifiedSubscribers}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
          <Pagination
            page={history.data.page}
            totalPages={history.data.totalPages}
            onChange={setPage}
          />
        </>
      )}
    </AdminPanel>
  );
}
