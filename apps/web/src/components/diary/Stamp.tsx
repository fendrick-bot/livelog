import type { LogStatus } from '@livelog/shared';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'ink' | 'wax' | 'quill' | 'moss' | 'faded' | 'gold';

const tones: Record<Tone, string> = {
  ink: 'text-ink',
  wax: 'text-wax',
  quill: 'text-quill',
  moss: 'text-moss',
  faded: 'text-ink-faded',
  gold: 'text-[#8a6a2a]',
};

export function Stamp({
  tone = 'ink',
  tilt = -2,
  className,
  children,
}: {
  tone?: Tone;
  tilt?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn('stamp', tones[tone], className)}
      style={{ '--stamp-tilt': `${tilt}deg` } as CSSProperties}
    >
      {children}
    </span>
  );
}

const STATUS: Record<LogStatus, { tone: Tone; label: string }> = {
  draft: { tone: 'faded', label: 'Draft' },
  scheduled: { tone: 'quill', label: 'Scheduled' },
  live: { tone: 'wax', label: 'Live' },
  published: { tone: 'moss', label: 'Published' },
  archived: { tone: 'ink', label: 'Archived' },
};

export function StatusStamp({ status, className }: { status: LogStatus; className?: string }) {
  const { tone, label } = STATUS[status];
  return (
    <Stamp tone={tone} className={className}>
      {status === 'live' && (
        <span className="size-1.5 rounded-full bg-wax-bright animate-live-pulse" />
      )}
      {label}
    </Stamp>
  );
}
