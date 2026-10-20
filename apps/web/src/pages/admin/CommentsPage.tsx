import type { CommentStatus } from '@livelog/shared';
import { Eye, EyeOff, Trash } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useAdminComments, useAdminDeleteComment, useModerateComment } from '../../api/admin';
import { FilterTabs } from '../../components/admin/FilterTabs';
import { useConfirm } from '../../components/diary/Confirm';
import { EmptyState, InkLoader, Pagination } from '../../components/diary/Feedback';
import { Stamp } from '../../components/diary/Stamp';
import { AdminPanel } from '../../components/layout/AdminLayout';
import { cn } from '../../lib/cn';
import { timeAgo } from '../../lib/format';

type Filter = CommentStatus | 'all';

export default function CommentsPage() {
  const [status, setStatus] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const comments = useAdminComments({
    status: status === 'all' ? undefined : status,
    page,
    pageSize: 20,
  });
  const moderate = useModerateComment();
  const remove = useAdminDeleteComment();
  const [dialog, confirm] = useConfirm();

  return (
    <AdminPanel title="Margin notes">
      {dialog}
      <div className="mb-5">
        <FilterTabs
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'All' },
            { value: 'visible', label: 'Visible' },
            { value: 'hidden', label: 'Hidden' },
          ]}
        />
      </div>
      {comments.isPending ? (
        <InkLoader />
      ) : !comments.data?.items.length ? (
        <EmptyState title="Quiet margins">
          Readers' notes appear here as they are written.
        </EmptyState>
      ) : (
        <>
          <ul
            className={cn(
              'divide-y divide-dashed divide-ink/15',
              comments.isPlaceholderData && 'opacity-60',
            )}
          >
            {comments.data.items.map((comment) => (
              <li
                key={comment.id}
                className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm text-ink-faded">
                    <span className="font-hand text-xl text-ink">{comment.author.displayName}</span>{' '}
                    on{' '}
                    <Link to={`/logs/${comment.log.slug}`} className="link-ink text-quill">
                      {comment.log.title}
                    </Link>{' '}
                    · {timeAgo(comment.createdAt)} {comment.parentId && '· reply'}
                  </p>
                  <p
                    className={cn(
                      'mt-1 whitespace-pre-wrap break-words',
                      comment.status === 'hidden' && 'text-ink-faded line-through',
                    )}
                  >
                    {comment.body}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {comment.status === 'hidden' && <Stamp tone="faded">hidden</Stamp>}
                  <button
                    type="button"
                    onClick={() =>
                      moderate.mutate({
                        id: comment.id,
                        status: comment.status === 'hidden' ? 'visible' : 'hidden',
                      })
                    }
                    className="rounded-full p-2 text-ink-faded hover:bg-ink/5 hover:text-ink"
                    aria-label={comment.status === 'hidden' ? 'Show comment' : 'Hide comment'}
                    title={comment.status === 'hidden' ? 'Show' : 'Hide'}
                  >
                    {comment.status === 'hidden' ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void confirm({
                        title: 'Delete this note?',
                        body: 'It will be removed permanently, with any replies.',
                        confirmLabel: 'Delete',
                        danger: true,
                      }).then((ok) => ok && remove.mutate(comment.id))
                    }
                    className="rounded-full p-2 text-ink-faded hover:bg-wax/10 hover:text-wax"
                    aria-label="Delete comment"
                  >
                    <Trash className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            page={comments.data.page}
            totalPages={comments.data.totalPages}
            onChange={setPage}
          />
        </>
      )}
    </AdminPanel>
  );
}
