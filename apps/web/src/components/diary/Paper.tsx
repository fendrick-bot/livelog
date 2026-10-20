import type { CSSProperties, HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface PaperProps extends HTMLAttributes<HTMLDivElement> {
  ruled?: boolean;
  /** Degrees of rotation, for a hand-placed look. */
  tilt?: number;
}

export function Paper({ ruled, tilt, className, style, ...rest }: PaperProps) {
  const merged: CSSProperties = tilt ? { ...style, rotate: `${tilt}deg` } : (style ?? {});
  return (
    <div
      className={cn(ruled ? 'paper-ruled paper' : 'paper', 'relative rounded-[3px]', className)}
      style={merged}
      {...rest}
    />
  );
}

export function Tape({ className }: { className?: string }) {
  return <span aria-hidden className={cn('tape', className)} />;
}
