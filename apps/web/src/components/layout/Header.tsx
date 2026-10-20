import { BookOpen, LayoutDashboard, LogOut, Menu, User, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useLogout } from '../../api/auth';
import { useLiveStatus } from '../../hooks/useLiveStatus';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/cn';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/logs', label: 'Entries' },
  { to: '/community', label: 'Other diaries' },
  { to: '/share-your-story', label: 'Share your story' },
];

function LivePill() {
  const { data } = useLiveStatus();
  if (!data?.live) return null;
  return (
    <Link
      to={`/logs/${data.live.slug}`}
      className="wax-seal inline-flex items-center gap-2 rounded-full px-3 py-1 font-type text-[0.68rem] uppercase tracking-[0.18em] transition hover:brightness-110"
    >
      <span className="size-1.5 rounded-full bg-[#ffd9c2] animate-live-pulse" aria-hidden />
      Live now
    </Link>
  );
}

function AccountMenu() {
  const { status, user } = useAuth();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  if (status !== 'authenticated' || !user) {
    return (
      <Link
        to="/login"
        className="link-ink font-type text-xs uppercase tracking-[0.18em] text-paper/85 hover:text-paper"
      >
        Sign in
      </Link>
    );
  }

  const item =
    'flex items-center gap-2.5 rounded px-3 py-2 text-ink-soft hover:bg-ink/5 hover:text-ink';
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Account menu"
        className="grid size-9 place-items-center rounded-full border border-gold/50 bg-paper font-hand text-xl text-leather shadow-inner transition hover:scale-105"
      >
        {user.displayName.charAt(0).toUpperCase()}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, rotate: -1 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="paper absolute right-0 z-40 mt-3 w-60 rounded-[4px] p-2"
          >
            <p className="px-3 pb-2 pt-1">
              <span className="block font-hand text-2xl leading-tight">{user.displayName}</span>
              <span className="block truncate text-xs text-ink-faded">{user.email}</span>
            </p>
            <div className="border-t border-dashed border-ink/15 pt-1">
              {user.role === 'admin' && (
                <Link to="/admin" className={item}>
                  <LayoutDashboard className="size-4" aria-hidden /> Writing desk
                </Link>
              )}
              <Link to="/account" className={item}>
                <User className="size-4" aria-hidden /> My reader card
              </Link>
              <button type="button" className={cn(item, 'w-full')} onClick={() => logout.mutate()}>
                <LogOut className="size-4" aria-hidden /> Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <header className="sticky top-0 z-30">
      <div className="border-b-[3px] border-leather-deep bg-leather bg-[radial-gradient(circle_at_30%_0%,rgba(255,220,170,0.12),transparent_60%)] shadow-[0_8px_24px_-10px_rgba(0,0,0,0.7)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="group flex items-baseline gap-3">
            <span className="font-hand text-[2.1rem] leading-none text-gold drop-shadow-[0_1px_0_rgba(0,0,0,0.6)] transition group-hover:text-[#e6c486]">
              Livelog
            </span>
            <span className="hidden font-type text-[0.62rem] uppercase tracking-[0.25em] text-paper/50 lg:inline">
              a diary, written live
            </span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'relative py-1 text-[1.05rem] transition-colors',
                    isActive ? 'text-paper' : 'text-paper/70 hover:text-paper',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <motion.span
                        layoutId="bookmark-ribbon"
                        aria-hidden
                        className="absolute left-1/2 top-[2.35rem] h-7 w-3.5 -translate-x-1/2 bg-wax shadow-md [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <LivePill />
            <AccountMenu />
            <button
              type="button"
              className="grid size-9 place-items-center rounded-full text-paper/80 hover:bg-white/10 md:hidden"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        <div aria-hidden className="mx-auto h-0 max-w-6xl border-t border-dashed border-gold/25" />
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            aria-label="Mobile"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="paper absolute inset-x-3 top-[4.5rem] rounded-[4px] p-3 md:hidden"
          >
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded px-3 py-3 font-hand text-2xl',
                    isActive ? 'bg-ink/5 text-quill' : 'text-ink',
                  )
                }
              >
                <BookOpen className="size-4 opacity-60" aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
