import { LIMITS, type TagDto } from '@livelog/shared';
import { Pencil, Plus, Trash } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAdminTags, useCreateTag, useDeleteTag, useRenameTag } from '../../api/admin';
import { Button } from '../../components/diary/Button';
import { useConfirm } from '../../components/diary/Confirm';
import { EmptyState, InkLoader } from '../../components/diary/Feedback';
import { AdminPanel } from '../../components/layout/AdminLayout';

function TagRow({ tag, onDelete }: { tag: TagDto; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const rename = useRenameTag();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || name.trim() === tag.name) return setEditing(false);
    rename.mutate({ id: tag.id, name: name.trim() }, { onSuccess: () => setEditing(false) });
  };

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      {editing ? (
        <form onSubmit={submit} className="flex flex-1 items-center gap-2">
          <input
            autoFocus
            value={name}
            maxLength={LIMITS.tagName.max}
            onChange={(event) => setName(event.target.value)}
            className="field-input flex-1 py-1"
            aria-label="Tag name"
          />
          <Button type="submit" size="sm" loading={rename.isPending}>
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <>
          <span className="flex items-baseline gap-3">
            <span className="stamp text-quill">#{tag.name}</span>
            <span className="text-sm text-ink-faded">
              {tag.logCount === 1 ? '1 entry' : `${tag.logCount} entries`}
            </span>
          </span>
          <span className="flex gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full p-2 text-ink-faded hover:bg-ink/5 hover:text-ink"
              aria-label={`Rename ${tag.name}`}
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-full p-2 text-ink-faded hover:bg-wax/10 hover:text-wax"
              aria-label={`Delete ${tag.name}`}
            >
              <Trash className="size-4" />
            </button>
          </span>
        </>
      )}
    </li>
  );
}

export default function TagsPage() {
  const tags = useAdminTags();
  const create = useCreateTag();
  const remove = useDeleteTag();
  const [name, setName] = useState('');
  const [dialog, confirm] = useConfirm();

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate(name.trim(), { onSuccess: () => setName('') });
  };

  return (
    <AdminPanel title="Tags">
      {dialog}
      <form onSubmit={add} className="mb-6 flex items-end gap-3">
        <label className="flex-1">
          <span className="font-hand text-[1.45rem] leading-none text-ink-soft">A new tag</span>
          <input
            value={name}
            maxLength={LIMITS.tagName.max}
            onChange={(event) => setName(event.target.value)}
            placeholder="Late nights"
            className="field-input"
          />
        </label>
        <Button
          type="submit"
          icon={<Plus className="size-4" />}
          loading={create.isPending}
          disabled={!name.trim()}
        >
          Add
        </Button>
      </form>
      {tags.isPending ? (
        <InkLoader />
      ) : !tags.data?.length ? (
        <EmptyState title="No tags yet">Tags help readers find entries by theme.</EmptyState>
      ) : (
        <ul className="divide-y divide-dashed divide-ink/15">
          {tags.data.map((tag) => (
            <TagRow
              key={tag.id}
              tag={tag}
              onDelete={() =>
                void confirm({
                  title: `Remove #${tag.name}?`,
                  body: 'Entries keep their text; they just lose this tag.',
                  confirmLabel: 'Remove',
                  danger: true,
                }).then((ok) => ok && remove.mutate(tag.id))
              }
            />
          ))}
        </ul>
      )}
    </AdminPanel>
  );
}
