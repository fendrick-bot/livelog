import { STORY_STATUSES, type StoryRequestDto, type StoryStatus } from '@livelog/shared';
import { Check, ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useAcceptStory, useAdminStats, useAdminStories, useRejectStory } from '../../api/admin';
import { FilterTabs } from '../../components/admin/FilterTabs';
import { TagPicker } from '../../components/admin/TagPicker';
import { Button } from '../../components/diary/Button';
import { Dialog } from '../../components/diary/Dialog';
import { EmptyState, InkLoader, Pagination } from '../../components/diary/Feedback';
import { TextArea, TextField } from '../../components/diary/Field';
import { Stamp } from '../../components/diary/Stamp';
import { AdminPanel } from '../../components/layout/AdminLayout';
import { Markdown } from '../../components/Markdown';
import { cn } from '../../lib/cn';
import { timeAgo } from '../../lib/format';

const MOOD_EMOJI: Record<string, string> = {
  hopeful: '🌱',
  nostalgic: '📻',
  grateful: '🕯️',
  heartbroken: '🥀',
  curious: '🔭',
  brave: '⛰️',
};
const TONE = { pending: 'quill', accepted: 'moss', rejected: 'faded' } as const;

type Filter = StoryStatus | 'all';
type Review = { story: StoryRequestDto; mode: 'accept' | 'reject' } | null;

function StoryCard({
  story,
  onReview,
}: {
  story: StoryRequestDto;
  onReview: (mode: 'accept' | 'reject') => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-[4px] border border-ink/12 bg-paper/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-hand text-3xl leading-tight">
            {story.mood && (
              <span className="mr-2 text-2xl" title={story.mood}>
                {MOOD_EMOJI[story.mood]}
              </span>
            )}
            {story.title}
          </p>
          <p className="text-sm text-ink-faded">
            from <span className="text-ink-soft">{story.submitter.displayName}</span>
            {story.isAnonymous && ' (wants to stay anonymous)'} ·{' '}
            {story.contactEmail ?? story.submitter.email} · {timeAgo(story.createdAt)}
          </p>
        </div>
        <Stamp tone={TONE[story.status]}>{story.status}</Stamp>
      </div>
      <p className="mt-3 italic text-ink-soft">{story.pitch}</p>
      {story.adminNote && (
        <p className="mt-2 border-l-2 border-margin pl-3 text-sm italic text-ink-faded">
          Your note: “{story.adminNote}”
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mt-3 inline-flex items-center gap-1 text-sm text-quill"
        aria-expanded={open}
      >
        <ChevronDown
          className={cn('size-4 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
        {open ? 'Fold the letter' : 'Read the full story'}
      </button>
      {open && (
        <div className="mt-3 max-h-[28rem] overflow-y-auto rounded border border-dashed border-ink/20 bg-paper p-4 scrollbar-ink">
          <Markdown content={story.content} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {story.status === 'pending' && (
          <>
            <Button
              variant="ink"
              size="sm"
              icon={<Check className="size-3.5" />}
              onClick={() => onReview('accept')}
            >
              Accept & publish
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<X className="size-3.5" />}
              onClick={() => onReview('reject')}
            >
              Decline kindly
            </Button>
          </>
        )}
        {story.publishedLog && (
          <>
            <Link
              to={`/logs/${story.publishedLog.slug}`}
              className="rounded-full px-3 py-1.5 font-type text-[0.7rem] uppercase tracking-widest text-quill hover:bg-quill/8"
            >
              View published
            </Link>
            <Link
              to={`/admin/logs/${story.publishedLog.id}`}
              className="rounded-full px-3 py-1.5 font-type text-[0.7rem] uppercase tracking-widest text-ink-soft hover:bg-ink/5"
            >
              Edit entry
            </Link>
          </>
        )}
      </div>
    </li>
  );
}

function ReviewDialog({ review, onClose }: { review: Review; onClose: () => void }) {
  const accept = useAcceptStory();
  const reject = useRejectStory();
  const [title, setTitle] = useState(review?.story.title ?? '');
  const [note, setNote] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  if (!review) return null;
  const { story, mode } = review;

  const submit = () => {
    if (mode === 'accept') {
      accept.mutate(
        {
          id: story.id,
          input: { title: title.trim() || undefined, tagIds, note: note.trim() || undefined },
        },
        { onSuccess: onClose },
      );
    } else {
      reject.mutate({ id: story.id, note: note.trim() || undefined }, { onSuccess: onClose });
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={mode === 'accept' ? 'Publish this story' : 'Decline this story'}
    >
      <div className="flex flex-col gap-5">
        {mode === 'accept' ? (
          <>
            <TextField
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <div>
              <p className="mb-2 font-hand text-[1.45rem] leading-none text-ink-soft">Tags</p>
              <TagPicker value={tagIds} onChange={setTagIds} />
            </div>
          </>
        ) : (
          <p className="italic text-ink-soft">
            The writer will receive a gentle email. Adding a personal note goes a long way.
          </p>
        )}
        <TextArea
          label={mode === 'accept' ? 'A note to the writer (optional)' : 'A kind note (optional)'}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
        />
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={mode === 'accept' ? 'wax' : 'ink'}
            onClick={submit}
            loading={accept.isPending || reject.isPending}
          >
            {mode === 'accept' ? 'Publish it' : 'Send & decline'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export default function StoriesPage() {
  const [status, setStatus] = useState<Filter>('pending');
  const [page, setPage] = useState(1);
  const [review, setReview] = useState<Review>(null);
  const stats = useAdminStats();
  const stories = useAdminStories({
    status: status === 'all' ? undefined : status,
    page,
    pageSize: 10,
  });

  return (
    <AdminPanel title="Letters from readers">
      <div className="mb-5">
        <FilterTabs
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={[
            ...STORY_STATUSES.map((value) => ({
              value,
              label: value,
              count: value === 'pending' ? stats.data?.pendingStories : undefined,
            })),
            { value: 'all' as const, label: 'All' },
          ]}
        />
      </div>
      {stories.isPending ? (
        <InkLoader />
      ) : !stories.data?.items.length ? (
        <EmptyState title={status === 'pending' ? 'The letterbox is empty' : 'Nothing here'}>
          New story requests appear here the moment they arrive.
        </EmptyState>
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {stories.data.items.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                onReview={(mode) => setReview({ story, mode })}
              />
            ))}
          </ul>
          <Pagination
            page={stories.data.page}
            totalPages={stories.data.totalPages}
            onChange={setPage}
          />
        </>
      )}
      <ReviewDialog
        key={review ? `${review.story.id}-${review.mode}` : 'none'}
        review={review}
        onClose={() => setReview(null)}
      />
    </AdminPanel>
  );
}
