import { SUBSCRIBER_STATUSES, type SubscriberStatus } from '@livelog/shared';
import { Search, Trash } from 'lucide-react';
import { useState } from 'react';
import { useAdminStats, useAdminSubscribers, useRemoveSubscriber } from '../../api/admin';
import { FilterTabs } from '../../components/admin/FilterTabs';
import { useConfirm } from '../../components/diary/Confirm';
import { EmptyState, InkLoader, Pagination } from '../../components/diary/Feedback';
import { Stamp } from '../../components/diary/Stamp';
import { AdminPanel } from '../../components/layout/AdminLayout';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { cn } from '../../lib/cn';
import { shortDay } from '../../lib/format';

type Filter = SubscriberStatus | 'all';
const TONE = { active: 'moss', pending: 'quill', unsubscribed: 'faded' } as const;

export default function SubscribersPage() {
  const [status, setStatus] = useState<Filter>('active');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const stats = useAdminStats();
  const subscribers = useAdminSubscribers({
    status: status === 'all' ? undefined : status,
    q: q || undefined,
    page,
    pageSize: 25,
  });
  const remove = useRemoveSubscriber();
  const [dialog, confirm] = useConfirm();

  return (
    <AdminPanel title="Subscribers">
      {dialog}
      <p className="mb-5 italic text-ink-soft">
        Active subscribers get one email each time you go live (never more than once per entry every
        30 minutes).
      </p>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <FilterTabs
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={[
            ...SUBSCRIBER_STATUSES.map((value) => ({
              value,
              label: value,
              count: stats.data?.subscribers[value],
            })),
            { value: 'all' as const, label: 'All' },
          ]}
        />
        <label className="flex items-center gap-2 md:w-64">
          <Search className="size-4 text-ink-faded" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find an email…"
            aria-label="Search subscribers"
            className="field-input py-1 text-base"
          />
        </label>
      </div>
      {subscribers.isPending ? (
        <InkLoader />
      ) : !subscribers.data?.items.length ? (
        <EmptyState title="No one here yet">
          Share the home page: the subscribe envelope is right there.
        </EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table
              className={cn(
                'w-full min-w-[34rem] text-left',
                subscribers.isPlaceholderData && 'opacity-60',
              )}
            >
              <thead className="font-type text-[0.65rem] uppercase tracking-widest text-ink-faded">
                <tr className="border-b border-ink/15">
                  <th className="py-2 pr-3 font-normal">Email</th>
                  <th className="py-2 pr-3 font-normal">Status</th>
                  <th className="py-2 pr-3 font-normal">Confirmed</th>
                  <th className="py-2 pr-3 font-normal">Joined</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-ink/15">
                {subscribers.data.items.map((subscriber) => (
                  <tr key={subscriber.id}>
                    <td className="py-3 pr-3 break-all">{subscriber.email}</td>
                    <td className="py-3 pr-3">
                      <Stamp tone={TONE[subscriber.status]}>{subscriber.status}</Stamp>
                    </td>
                    <td className="py-3 pr-3 text-sm text-ink-faded">
                      {subscriber.confirmedAt ? shortDay(subscriber.confirmedAt) : '—'}
                    </td>
                    <td className="py-3 pr-3 text-sm text-ink-faded">
                      {shortDay(subscriber.createdAt)}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          void confirm({
                            title: 'Remove subscriber?',
                            body: subscriber.email,
                            confirmLabel: 'Remove',
                            danger: true,
                          }).then((ok) => ok && remove.mutate(subscriber.id))
                        }
                        className="rounded-full p-2 text-ink-faded hover:bg-wax/10 hover:text-wax"
                        aria-label={`Remove ${subscriber.email}`}
                      >
                        <Trash className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={subscribers.data.page}
            totalPages={subscribers.data.totalPages}
            onChange={setPage}
          />
        </>
      )}
    </AdminPanel>
  );
}
