import { LIMITS, type CommentDto, type LogDetailDto } from '@livelog/shared';
import { CornerDownRight, Trash } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { useComments, useCreateComment, useDeleteComment } from '../../api/comments';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { timeAgo } from '../../lib/format';
import { Button } from '../diary/Button';
import { InkLoader } from '../diary/Feedback';

function Avatar({ name, admin }: { name: string; admin?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full font-hand text-xl',
        admin ? 'wax-seal' : 'border border-ink/20 bg-paper-deep text-ink-soft',
      )}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function CommentForm({
  logId,
  parentId,
  onDone,
  compact,
}: {
  logId: string;
  parentId?: string;
  onDone?: () => void;
  compact?: boolean;
}) {
  const [body, setBody] = useState('');
  const create = useCreateComment(logId);
  const remaining = LIMITS.comment.max - body.length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    create.mutate(
      { body, parentId },
      {
        onSuccess: () => {
          setBody('');
          onDone?.();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={LIMITS.comment.max}
        rows={compact ? 2 : 3}
        placeholder={parentId ? 'Write a reply…' : 'Leave a note in the margin…'}
        aria-label={parentId ? 'Reply' : 'Your note'}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit(event);
        }}
        className="paper-ruled w-full resize-none rounded-[3px] border border-ink/15 px-3 font-serif text-[1.05rem] leading-[1.75rem] text-ink [--margin-x:-10px] [--rule:1.75rem] focus:border-quill/50 focus:outline-none"
      />
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-xs', remaining < 100 ? 'text-wax' : 'text-ink-faded')}>
          {remaining < 300 ? `${remaining} left` : '⌘/Ctrl + Enter to send'}
        </span>
        <div className="flex gap-2">
          {onDone && (
            <Button variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
          )}
          <Button type="submit" size="sm" loading={create.isPending} disabled={!body.trim()}>
            {parentId ? 'Reply' : 'Pin note'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function CommentItem({
  comment,
  log,
  canReply,
}: {
  comment: CommentDto;
  log: LogDetailDto;
  canReply: boolean;
}) {
  const { user } = useAuth();
  const [replying, setReplying] = useState(false);
  const remove = useDeleteComment(log.id);
  const canDelete = user && (user.id === comment.author.id || user.role === 'admin');

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="flex gap-3"
    >
      <Avatar name={comment.author.displayName} admin={comment.author.isAdmin} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-hand text-xl leading-none text-ink">
            {comment.author.displayName}
          </span>
          {comment.author.isAdmin && (
            <span className="font-type text-[0.6rem] uppercase tracking-widest text-wax">
              diarist
            </span>
          )}
          <time className="text-xs text-ink-faded" dateTime={comment.createdAt}>
            {timeAgo(comment.createdAt)}
          </time>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-ink-soft">
          {comment.body}
        </p>
        <div className="mt-1 flex gap-3 text-xs">
          {canReply && !comment.parentId && (
            <button
              type="button"
              className="link-ink text-quill"
              onClick={() => setReplying((value) => !value)}
            >
              Reply
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-ink-faded hover:text-wax"
              onClick={() => remove.mutate(comment.id)}
              disabled={remove.isPending}
            >
              <Trash className="size-3" aria-hidden /> Remove
            </button>
          )}
        </div>
        {comment.replies.length > 0 && (
          <ul className="mt-3 flex flex-col gap-3 border-l-2 border-margin/70 pl-3">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} log={log} canReply={false} />
            ))}
          </ul>
        )}
        {replying && (
          <div className="mt-3 flex gap-2">
            <CornerDownRight className="mt-2 size-4 shrink-0 text-ink-faded" aria-hidden />
            <div className="flex-1">
              <CommentForm
                logId={log.id}
                parentId={comment.id}
                onDone={() => setReplying(false)}
                compact
              />
            </div>
          </div>
        )}
      </div>
    </motion.li>
  );
}

/** "Notes in the margin": comments with live updates and one level of replies. */
export function CommentSection({ log, className }: { log: LogDetailDto; className?: string }) {
  const { status, user } = useAuth();
  const location = useLocation();
  const comments = useComments(log.id);
  const items = comments.data?.pages.flatMap((page) => page.items) ?? [];
  const total = comments.data?.pages[0]?.total ?? 0;
  const open = log.allowComments || user?.role === 'admin';

  return (
    <section className={cn('flex flex-col gap-5', className)} aria-labelledby="notes-heading">
      <header className="flex items-baseline justify-between">
        <h2 id="notes-heading" className="font-hand text-3xl text-ink">
          Notes in the margin
        </h2>
        <span className="font-type text-xs text-ink-faded">{total}</span>
      </header>

      {!open ? (
        <p className="rounded border border-dashed border-ink/20 p-3 text-sm italic text-ink-faded">
          The margins are closed for this entry.
        </p>
      ) : status === 'authenticated' ? (
        <CommentForm logId={log.id} />
      ) : (
        <p className="rounded border border-dashed border-ink/25 p-3 text-sm italic text-ink-soft">
          <Link
            to={`/login?next=${encodeURIComponent(location.pathname)}`}
            className="link-ink font-semibold not-italic text-quill"
          >
            Sign in
          </Link>{' '}
          to leave a note in the margin.
        </p>
      )}

      {comments.isPending ? (
        <InkLoader label="Reading the margins…" />
      ) : items.length === 0 ? (
        <p className="py-4 text-center font-hand text-xl text-ink-faded">
          No notes yet. Be the first to write one.
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          <AnimatePresence initial={false}>
            {items.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                log={log}
                canReply={open && status === 'authenticated'}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {comments.hasNextPage && (
        <Button
          variant="paper"
          size="sm"
          className="self-center"
          loading={comments.isFetchingNextPage}
          onClick={() => void comments.fetchNextPage()}
        >
          Older notes
        </Button>
      )}
    </section>
  );
}
