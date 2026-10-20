import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../lib/api';
import { Button } from './Button';

/** Three ink drops bouncing: the loading state everywhere. */
export function InkLoader({
  label = 'Turning the pages…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn('flex flex-col items-center gap-3 py-10 text-ink-faded', className)}
    >
      <div className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="size-2.5 rounded-full bg-quill/70 animate-bounce"
            style={{ animationDelay: `${index * 140}ms` }}
          />
        ))}
      </div>
      <span className="font-hand text-xl">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="font-hand text-3xl text-ink-soft">{title}</p>
      {children && <div className="max-w-md italic text-ink-faded">{children}</div>}
      {action}
      <div className="flourish mt-2 w-40 opacity-70" aria-hidden />
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="font-hand text-3xl text-wax">An ink blot ruined this page</p>
      <p className="italic text-ink-faded">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="paper" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-4 py-6 font-type text-sm text-ink-soft"
    >
      <button
        type="button"
        className="link-ink disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ← Previous
      </button>
      <span className="font-hand text-xl">
        page {page} of {totalPages}
      </span>
      <button
        type="button"
        className="link-ink disabled:opacity-40"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next →
      </button>
    </nav>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-6 flex flex-col gap-1', className)}>
      {eyebrow && (
        <p className="font-type text-xs uppercase tracking-[0.25em] text-gold/90">{eyebrow}</p>
      )}
      <h2 className="font-hand text-4xl leading-tight text-paper md:text-5xl">{title}</h2>
      {children && <p className="max-w-2xl italic text-paper/70">{children}</p>}
    </header>
  );
}
