import { cn } from '../../lib/cn';

export type ButtonVariant = 'ink' | 'wax' | 'paper' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-full font-type uppercase tracking-[0.12em] transition-[transform,box-shadow,background-color,color,border-color] duration-150 ease-out disabled:opacity-55 disabled:pointer-events-none active:translate-y-[2px]';

const variants: Record<ButtonVariant, string> = {
  ink: 'bg-ink text-paper shadow-[0_4px_0_0_#120c08] hover:-translate-y-0.5 hover:bg-[#3a2c21] hover:shadow-[0_6px_0_0_#120c08] active:shadow-[0_1px_0_0_#120c08]',
  wax: 'wax-seal hover:-translate-y-0.5 hover:brightness-110 active:brightness-95',
  paper:
    'bg-paper/85 text-ink border border-ink/25 shadow-[0_3px_0_0_rgba(43,33,24,0.18)] hover:-translate-y-0.5 hover:border-ink/50 hover:bg-paper active:shadow-none',
  ghost: 'text-quill hover:bg-quill/8',
  danger: 'text-wax border border-wax/40 hover:bg-wax/8 hover:border-wax/70',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3.5 text-[0.7rem]',
  md: 'h-10 px-5 text-xs',
  lg: 'h-12 px-7 text-sm',
};

export function buttonClass(
  variant: ButtonVariant = 'ink',
  size: ButtonSize = 'md',
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], className);
}
