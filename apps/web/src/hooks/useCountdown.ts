import { useEffect, useState } from 'react';
import { serverOffset } from './useLiveStatus';

export interface Countdown {
  remainingMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

export function useCountdown(target: string | null | undefined): Countdown {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [target]);

  const remainingMs = target ? Math.max(0, new Date(target).getTime() - (now + serverOffset())) : 0;
  const total = Math.floor(remainingMs / 1000);
  return {
    remainingMs,
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
    done: remainingMs <= 0,
  };
}

/** Seconds elapsed since `since`, ticking every second (for "live for 12:03"). */
export function useElapsed(since: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [since]);
  return since ? Math.max(0, (now + serverOffset() - new Date(since).getTime()) / 1000) : 0;
}
