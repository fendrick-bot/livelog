import { Feather, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useAdminLogs, useAdminStats, useAdminStories, useCreateLog } from '../../api/admin';
import { StatCard } from '../../components/admin/StatCard';
import { Button, ButtonLink } from '../../components/diary/Button';
import { InkLoader } from '../../components/diary/Feedback';
import { Paper } from '../../components/diary/Paper';
import { Countdown } from '../../components/live/Countdown';
import { LiveBadge } from '../../components/live/LiveBadge';
import { useLiveStatus } from '../../hooks/useLiveStatus';
import { useAuth } from '../../lib/auth';
import { NEW_ENTRY_TITLE } from '../../lib/constants';
import { dateTime, timeAgo } from '../../lib/format';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const stats = useAdminStats();
  const live = useLiveStatus();
  const drafts = useAdminLogs({ status: 'draft', pageSize: 5 });
  const pending = useAdminStories({ status: 'pending', pageSize: 3 });
  const create = useCreateLog();

  const newEntry = () =>
    create.mutate(
      { title: NEW_ENTRY_TITLE },
      { onSuccess: (log) => void navigate(`/admin/logs/${log.id}`) },
    );

  const s = stats.data;
  const liveLog = live.data?.live;
  const next = live.data?.next;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-type text-xs uppercase tracking-[0.25em] text-gold/90">
            The writing desk
          </p>
          <h1 className="font-hand text-5xl text-paper">
            {greeting()}, {user?.displayName.split(' ')[0]}.
          </h1>
        </div>
        <Button
          variant="wax"
          size="lg"
          icon={<Plus className="size-4" />}
          onClick={newEntry}
          loading={create.isPending}
        >
          New entry
        </Button>
      </div>

      <Paper className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        {liveLog ? (
          <>
            <div className="flex flex-col gap-2">
              <LiveBadge className="w-fit" />
              <p className="font-hand text-4xl">{liveLog.title}</p>
              <p className="italic text-ink-faded">
                {live.data?.viewers ?? 0} readers are with you right now.
              </p>
            </div>
            <ButtonLink
              to={`/admin/logs/${liveLog.id}`}
              variant="wax"
              size="lg"
              icon={<Feather className="size-4" />}
            >
              Back to the page
            </ButtonLink>
          </>
        ) : next ? (
          <>
            <div className="flex flex-col gap-3">
              <p className="font-type text-xs uppercase tracking-[0.25em] text-quill">
                Next live session · {dateTime(next.scheduledFor!)}
              </p>
              <p className="font-hand text-4xl">{next.title}</p>
              <Countdown target={next.scheduledFor!} />
            </div>
            <ButtonLink to={`/admin/logs/${next.id}`} variant="ink">
              Open entry
            </ButtonLink>
          </>
        ) : (
          <>
            <div>
              <p className="font-hand text-4xl">Nothing scheduled.</p>
              <p className="italic text-ink-faded">
                Readers see a quiet page. Schedule a session and they'll see a countdown instead.
              </p>
            </div>
            <ButtonLink to="/admin/logs" variant="paper">
              Pick an entry
            </ButtonLink>
          </>
        )}
      </Paper>

      {stats.isPending || !s ? (
        <InkLoader className="text-paper/70" />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          <StatCard
            label="Published"
            value={s.logs.published}
            note={`${s.communityLogs} community stories`}
            to="/admin/logs"
          />
          <StatCard
            label="Drafts"
            value={s.logs.draft}
            note={`${s.logs.scheduled} scheduled`}
            to="/admin/logs"
          />
          <StatCard
            label="Subscribers"
            value={s.subscribers.active}
            note={`${s.subscribers.pending} awaiting confirmation`}
            to="/admin/subscribers"
          />
          <StatCard
            label="Stories waiting"
            value={s.pendingStories}
            accent={s.pendingStories > 0}
            to="/admin/stories"
          />
          <StatCard label="Reads" value={s.totalViews} />
          <StatCard label="Margin notes" value={s.comments} to="/admin/comments" />
          <StatCard label="Reactions" value={s.reactions} />
          <StatCard label="Live sessions" value={s.liveSessions} to="/admin/history" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Paper className="p-6">
          <h2 className="mb-3 font-hand text-3xl">Unfinished drafts</h2>
          {drafts.data?.items.length ? (
            <ul className="divide-y divide-dashed divide-ink/15">
              {drafts.data.items.map((log) => (
                <li key={log.id}>
                  <Link
                    to={`/admin/logs/${log.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:text-quill"
                  >
                    <span className="truncate text-lg">{log.title}</span>
                    <span className="shrink-0 text-sm text-ink-faded">
                      {timeAgo(log.updatedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="italic text-ink-faded">No drafts. A clean desk.</p>
          )}
        </Paper>
        <Paper className="p-6">
          <h2 className="mb-3 font-hand text-3xl">Letters from readers</h2>
          {pending.data?.items.length ? (
            <ul className="divide-y divide-dashed divide-ink/15">
              {pending.data.items.map((story) => (
                <li key={story.id}>
                  <Link
                    to="/admin/stories"
                    className="flex items-center justify-between gap-3 py-2.5 hover:text-quill"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-lg">{story.title}</span>
                      <span className="text-sm italic text-ink-faded">
                        from {story.submitter.displayName}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-ink-faded">
                      {timeAgo(story.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="italic text-ink-faded">No new stories waiting.</p>
          )}
        </Paper>
      </div>
    </div>
  );
}
