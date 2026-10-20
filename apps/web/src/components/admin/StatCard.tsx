import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '../../lib/cn';
import { tiltFor } from '../../lib/format';

export function StatCard({
  label,
  value,
  note,
  to,
  accent,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  to?: string;
  accent?: boolean;
}) {
  const body = (
    <div
      className={cn(
        'paper flex h-full flex-col gap-1 rounded-[3px] px-4 py-4 transition duration-300 hover:-translate-y-1 hover:rotate-0',
        accent && 'ring-2 ring-wax/40',
      )}
      style={{ rotate: `${tiltFor(label, 1.2)}deg` }}
    >
      <span className="font-type text-[0.62rem] uppercase tracking-[0.2em] text-ink-faded">
        {label}
      </span>
      <span className="font-hand text-5xl leading-none text-ink">{value}</span>
      {note && <span className="text-sm italic text-ink-faded">{note}</span>}
    </div>
  );
  return to ? (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
