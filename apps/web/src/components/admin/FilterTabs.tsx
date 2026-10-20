import { cn } from '../../lib/cn';

export function FilterTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; count?: number }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" className="scrollbar-ink -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'shrink-0 rounded-full px-3.5 py-1.5 font-type text-[0.7rem] uppercase tracking-widest transition',
            value === option.value ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-ink/5',
          )}
        >
          {option.label}
          {option.count !== undefined && <span className="ml-1.5 opacity-60">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}
