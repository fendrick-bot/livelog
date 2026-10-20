import { LogOut, Monitor, Smartphone } from 'lucide-react';
import { Link } from 'react-router';
import { useLogout, useRevokeSession, useSessions } from '../api/auth';
import { useMyStories } from '../api/stories';
import { Button } from '../components/diary/Button';
import { InkLoader, SectionTitle } from '../components/diary/Feedback';
import { Paper } from '../components/diary/Paper';
import { Stamp } from '../components/diary/Stamp';
import { useAuth } from '../lib/auth';
import { shortDay, timeAgo } from '../lib/format';

function describeDevice(userAgent: string | null): { label: string; mobile: boolean } {
  if (!userAgent) return { label: 'Unknown device', mobile: false };
  const mobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Browser';
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Mac OS X/.test(userAgent) && !mobile
      ? 'macOS'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Android/.test(userAgent)
          ? 'Android'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : '';
  return { label: `${browser}${os ? ` on ${os}` : ''}`, mobile };
}

export default function AccountPage() {
  const { user } = useAuth();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const logout = useLogout();
  const stories = useMyStories(true);
  if (!user) return null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <SectionTitle eyebrow="Reader card" title={user.displayName} />

      <Paper className="grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
        <span
          className="wax-seal grid size-20 place-items-center rounded-full font-hand text-5xl"
          aria-hidden
        >
          {user.displayName.charAt(0).toUpperCase()}
        </span>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="font-type text-[0.65rem] uppercase tracking-widest text-ink-faded">
              Email
            </dt>
            <dd className="break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="font-type text-[0.65rem] uppercase tracking-widest text-ink-faded">
              Member since
            </dt>
            <dd>{shortDay(user.createdAt)}</dd>
          </div>
          <div>
            <dt className="font-type text-[0.65rem] uppercase tracking-widest text-ink-faded">
              Role
            </dt>
            <dd>{user.role === 'admin' ? 'The diarist' : 'Reader'}</dd>
          </div>
          <div className="flex items-end">
            <Button
              variant="danger"
              size="sm"
              icon={<LogOut className="size-3.5" />}
              onClick={() => logout.mutate()}
              loading={logout.isPending}
            >
              Sign out here
            </Button>
          </div>
        </dl>
      </Paper>

      <Paper className="p-6 sm:p-8">
        <h2 className="font-hand text-3xl">Signed-in devices</h2>
        <p className="mb-4 text-sm italic text-ink-faded">
          If you don't recognise one, sign it out.
        </p>
        {sessions.isPending ? (
          <InkLoader />
        ) : (
          <ul className="divide-y divide-dashed divide-ink/15">
            {sessions.data?.map((session) => {
              const device = describeDevice(session.userAgent);
              const Icon = device.mobile ? Smartphone : Monitor;
              return (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="size-5 text-ink-faded" aria-hidden />
                    <span>
                      <span className="block">
                        {device.label}{' '}
                        {session.current && (
                          <Stamp tone="moss" className="ml-2">
                            This device
                          </Stamp>
                        )}
                      </span>
                      <span className="block text-sm text-ink-faded">
                        Active {timeAgo(session.lastUsedAt)} · since {shortDay(session.createdAt)}
                      </span>
                    </span>
                  </span>
                  {!session.current && (
                    <Button
                      variant="paper"
                      size="sm"
                      onClick={() => revoke.mutate(session.id)}
                      disabled={revoke.isPending}
                    >
                      Sign out
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Paper>

      <Paper className="p-6 sm:p-8">
        <h2 className="font-hand text-3xl">Your stories</h2>
        {stories.data && stories.data.length > 0 ? (
          <ul className="mt-3 divide-y divide-dashed divide-ink/15">
            {stories.data.map((story) => (
              <li key={story.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  <span className="block font-hand text-2xl">{story.title}</span>
                  <span className="text-sm text-ink-faded">sent {timeAgo(story.createdAt)}</span>
                </span>
                {story.publishedLog ? (
                  <Link to={`/logs/${story.publishedLog.slug}`} className="link-ink text-quill">
                    Published →
                  </Link>
                ) : (
                  <Stamp tone={story.status === 'pending' ? 'quill' : 'faded'}>
                    {story.status}
                  </Stamp>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 italic text-ink-faded">
            Nothing sent yet.{' '}
            <Link to="/share-your-story" className="link-ink text-quill">
              Share your story
            </Link>
          </p>
        )}
      </Paper>
    </div>
  );
}
