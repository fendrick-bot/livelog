import { LIMITS } from '@livelog/shared';
import { Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAdminTags, useCreateTag } from '../../api/admin';
import { cn } from '../../lib/cn';

export function TagPicker({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const tags = useAdminTags();
  const create = useCreateTag();
  const [name, setName] = useState('');
  const selected = new Set(value);
  const full = value.length >= LIMITS.tagsPerLog;

  const toggle = (id: string) => {
    if (selected.has(id)) onChange(value.filter((item) => item !== id));
    else if (!full) onChange([...value, id]);
  };

  const add = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = tags.data?.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (!selected.has(existing.id)) toggle(existing.id);
      setName('');
      return;
    }
    create.mutate(trimmed, {
      onSuccess: (tag) => {
        if (!full) onChange([...value, tag.id]);
        setName('');
      },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {tags.data?.map((tag) => {
          const active = selected.has(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              disabled={disabled || (!active && full)}
              onClick={() => toggle(tag.id)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-type text-[0.68rem] uppercase tracking-wider transition disabled:opacity-40',
                active
                  ? 'border-quill/60 bg-quill text-paper'
                  : 'border-ink/20 text-ink-soft hover:border-ink/45',
              )}
            >
              #{tag.name}
              {active && <X className="size-3" aria-hidden />}
            </button>
          );
        })}
        {tags.data?.length === 0 && (
          <span className="text-sm italic text-ink-faded">
            No tags yet. Create the first one below.
          </span>
        )}
      </div>
      <form onSubmit={add} className="flex items-center gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={LIMITS.tagName.max}
          placeholder="New tag…"
          aria-label="New tag name"
          disabled={disabled}
          className="field-input flex-1 py-1 text-base"
        />
        <button
          type="submit"
          disabled={disabled || !name.trim() || create.isPending}
          className="rounded-full p-1.5 text-quill hover:bg-quill/10 disabled:opacity-40"
          aria-label="Add tag"
        >
          <Plus className="size-4" />
        </button>
      </form>
    </div>
  );
}
