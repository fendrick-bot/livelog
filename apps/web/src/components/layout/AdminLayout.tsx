import {
  Archive,
  BookOpen,
  Clock,
  Inbox,
  LayoutDashboard,
  MessagesSquare,
  Tags,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { useAdminStats } from '../../api/admin';
import { useLiveStatus } from '../../hooks/useLiveStatus';
import { cn } from '../../lib/cn';
import { PageTransition } from './PageTransition';

const ITEMS = [
  { to: '/admin', label: 'Desk', icon: LayoutDashboard, end: true },
  { to: '/admin/logs', label: 'Entries', icon: BookOpen },
  { to: '/admin/stories', label: 'Stories', icon: Inbox, badge: 'stories' as const },
  { to: '/admin/comments', label: 'Margin notes', icon: MessagesSquare },
  { to: '/admin/tags', label: 'Tags', icon: Tags },
  { to: '/admin/subscribers', label: 'Subscribers', icon: Users },
  { to: '/admin/history', label: 'Live history', icon: Clock },
];

/** The writing desk: a leather ledger with tabbed sections. */
export function AdminLayout() {
  const stats = useAdminStats();
  const live = useLiveStatus();
  const pending = stats.data?.pendingStories ?? 0;
  const liveLog = live.data?.live;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b-[3px] border-leather-deep bg-leather shadow-[0_8px_24px_-10px_rgba(0,0,0,0.7)]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <Link to="/admin" className="flex items-baseline gap-2">
            <span className="font-hand text-3xl text-gold">Livelog</span>
            <span className="font-type text-[0.62rem] uppercase tracking-[0.25em] text-paper/55">
              writing desk
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {liveLog && (
              <Link
                to={`/admin/logs/${liveLog.id}`}
                className="wax-seal inline-flex items-center gap-2 rounded-full px-3 py-1 font-type text-[0.65rem] uppercase tracking-[0.18em]"
              >
                <span
                  className="size-1.5 rounded-full bg-[#ffd9c2] animate-live-pulse"
                  aria-hidden
                />{' '}
                On air
              </Link>
            )}
            <Link to="/" className="link-ink text-sm text-paper/75 hover:text-paper">
              View the diary →
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row lg:gap-8 lg:py-10">
        <nav
          aria-label="Admin"
          className="scrollbar-ink -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible lg:px-0"
        >
          {ITEMS.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group relative flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-r-full rounded-l-sm px-4 py-2.5 text-[1.02rem] transition-all lg:-ml-1',
                  isActive
                    ? 'paper translate-x-0 text-ink lg:translate-x-2'
                    : 'text-paper/70 hover:bg-white/5 hover:text-paper lg:hover:translate-x-1',
                )
              }
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
              {badge === 'stories' && pending > 0 && (
                <span className="ml-auto rounded-full bg-wax px-2 py-0.5 font-type text-[0.62rem] text-paper">
                  {pending}
                </span>
              )}
            </NavLink>
          ))}
          <Link
            to="/"
            className="hidden items-center gap-2.5 px-4 py-2.5 text-sm text-paper/45 hover:text-paper/80 lg:mt-6 lg:flex"
          >
            <Archive className="size-4" aria-hidden /> Back to the diary
          </Link>
        </nav>

        <main className="min-w-0 flex-1">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}

/** Paper panel used by every admin page. */
export function AdminPanel({
  title,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('paper rounded-[4px] p-5 sm:p-7', className)}>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-ink/15 pb-4">
        <h1 className="font-hand text-4xl leading-none text-ink">{title}</h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}
