import { Eye } from 'lucide-react';
import { cn } from '../../lib/cn';
import { plural } from '../../lib/format';

export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'wax-seal inline-flex items-center gap-2 rounded-full px-3 py-1 font-type text-xs uppercase tracking-[0.2em]',
        className,
      )}
    >
      <span className="size-2 rounded-full bg-[#ffd9c2] animate-live-pulse" aria-hidden />
      Live
    </span>
  );
}

export function ViewerCount({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-sm text-ink-faded', className)}
      aria-live="polite"
    >
      <Eye className="size-4" aria-hidden />
      {count === 0 ? 'just you, for now' : `${plural(count, 'reader')} here`}
    </span>
  );
}

/** A tiny quill that scribbles while new words are arriving. */
export function WritingIndicator({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-hand text-lg text-quill transition-opacity duration-500',
        active ? 'opacity-100' : 'opacity-0',
      )}
      aria-hidden={!active}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5 animate-quill"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <path d="M20 3c-6 1-11 6-13 13l-2 5 5-2c7-2 12-7 13-13" />
        <path d="M7 16 15 8" />
      </svg>
      writing…
    </span>
  );
}
