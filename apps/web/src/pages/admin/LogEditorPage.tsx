import {
  LIMITS,
  readingMinutes,
  wordCount,
  type LogDetailDto,
  type UpdateLogInput,
} from '@livelog/shared';
import { ArrowLeft, CalendarClock, Eye, PenLine, Radio, Square, Trash } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  useAdminLog,
  useDeleteLog,
  useEndLive,
  useLogAction,
  useScheduleLog,
  useUpdateLog,
  type LogAction,
} from '../../api/admin';
import { TagPicker } from '../../components/admin/TagPicker';
import { CommentSection } from '../../components/comments/CommentSection';
import { Button } from '../../components/diary/Button';
import { useConfirm } from '../../components/diary/Confirm';
import { ErrorNote, InkLoader } from '../../components/diary/Feedback';
import { Checkbox } from '../../components/diary/Field';
import { Paper } from '../../components/diary/Paper';
import { StatusStamp } from '../../components/diary/Stamp';
import { FloatingReactions } from '../../components/live/Reactions';
import { useFloaters } from '../../hooks/useFloaters';
import { SoundControls } from '../../components/live/SoundControls';
import { Markdown } from '../../components/Markdown';
import { useElapsed } from '../../hooks/useCountdown';
import { useLiveWriter, type WriterStatus } from '../../hooks/useLiveWriter';
import { useLogRoom } from '../../hooks/useLogRoom';
import { cn } from '../../lib/cn';
import { NEW_ENTRY_TITLE } from '../../lib/constants';
import { dateTime, duration, plural, toLocalInputValue } from '../../lib/format';
import { soundscape } from '../../lib/sound/soundscape';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

const WRITER_LABEL: Record<WriterStatus, string> = {
  idle: '',
  connecting: 'Connecting…',
  synced: 'Readers are in sync',
  sending: 'Sending…',
  offline: 'Offline: will catch up on reconnect',
  error: 'Stream hiccup: retrying',
};

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Paper className={cn('rounded-[4px] p-5', className)}>
      <h2 className="mb-3 font-hand text-2xl leading-none">{title}</h2>
      {children}
    </Paper>
  );
}

function OnAirBar({
  log,
  viewers,
  status,
  onEnd,
  ending,
}: {
  log: LogDetailDto;
  viewers: number;
  status: WriterStatus;
  onEnd: (publish: boolean) => void;
  ending: boolean;
}) {
  const elapsed = useElapsed(log.liveStartedAt);
  return (
    <div className="wax-seal flex flex-col gap-3 rounded-[6px] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="inline-flex items-center gap-2 font-type text-sm uppercase tracking-[0.25em]">
          <span className="size-2.5 rounded-full bg-[#ffd9c2] animate-live-pulse" aria-hidden /> On
          air
        </span>
        <span className="font-type text-sm">{duration(elapsed)}</span>
        <span className="inline-flex items-center gap-1.5 text-sm">
          <Eye className="size-4" aria-hidden /> {plural(viewers, 'reader')}
        </span>
        <span
          className={cn(
            'text-sm italic',
            status === 'offline' || status === 'error' ? 'text-[#ffd9c2]' : 'text-paper/75',
          )}
        >
          {WRITER_LABEL[status]}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="paper" size="sm" onClick={() => onEnd(false)} disabled={ending}>
          End, keep as draft
        </Button>
        <Button
          variant="ink"
          size="sm"
          icon={<Square className="size-3" />}
          onClick={() => onEnd(true)}
          loading={ending}
        >
          End & publish
        </Button>
      </div>
    </div>
  );
}

function Editor({ log }: { log: LogDetailDto }) {
  const navigate = useNavigate();
  const isLive = log.status === 'live';
  const [title, setTitle] = useState(log.title);
  const [content, setContent] = useState(log.content);
  const [excerpt, setExcerpt] = useState(log.excerpt ?? '');
  const [excerptDirty, setExcerptDirty] = useState(false);
  const [tagIds, setTagIds] = useState(log.tags.map((tag) => tag.id));
  const [preview, setPreview] = useState(false);
  const [scheduleAt, setScheduleAt] = useState(() =>
    toLocalInputValue(
      log.scheduledFor ? new Date(log.scheduledFor) : new Date(Date.now() + 60 * 60_000),
    ),
  );
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const saved = useRef({ title: log.title, content: log.content });
  const selectOnMouseUp = useRef(false);

  const update = useUpdateLog(log.id, { silent: true });
  const settings = useUpdateLog(log.id);
  const action = useLogAction(log.id);
  const schedule = useScheduleLog(log.id);
  const endLive = useEndLive(log.id);
  const remove = useDeleteLog();
  const writer = useLiveWriter(log.id, isLive, content);
  const { floaters, launch } = useFloaters();
  const room = useLogRoom(log, { onReaction: launch });
  const [dialog, confirm] = useConfirm();

  const save = useCallback(
    async (extra: UpdateLogInput = {}): Promise<boolean> => {
      const patch: UpdateLogInput = { ...extra };
      const trimmed = title.trim();
      if (trimmed && trimmed !== saved.current.title) patch.title = trimmed;
      if (!isLive && content !== saved.current.content) patch.content = content;
      if (Object.keys(patch).length === 0) {
        setSaveState('saved');
        return true;
      }
      setSaveState('saving');
      try {
        await update.mutateAsync(patch);
        saved.current = {
          title: patch.title ?? saved.current.title,
          content: patch.content ?? saved.current.content,
        };
        setSaveState('saved');
        return true;
      } catch (error) {
        setSaveState('error');
        toast.error(error instanceof Error ? error.message : 'Could not save');
        return false;
      }
    },
    [title, content, isLive, update],
  );

  // Autosave: title always, content only when not live (live text streams over the socket).
  useEffect(() => {
    const dirty =
      (title.trim() && title.trim() !== saved.current.title) ||
      (!isLive && content !== saved.current.content);
    if (!dirty) return;
    setSaveState('dirty');
    const id = setTimeout(() => void save(), 1_200);
    return () => clearTimeout(id);
  }, [title, content, isLive, save]);

  // Never lose words to an accidental tab close.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (saveState === 'dirty' || saveState === 'saving') event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [saveState]);

  const onContentChange = (text: string) => {
    setContent(text);
    writer.push(text);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void save();
      return;
    }
    if (event.key.length === 1 || event.key === 'Enter' || event.key === 'Backspace') {
      soundscape.key(
        event.key === 'Enter'
          ? 'enter'
          : event.key === ' '
            ? 'space'
            : event.key === 'Backspace'
              ? 'delete'
              : 'key',
      );
    }
  };

  const run = async (name: LogAction) => {
    if (name === 'go-live') {
      if (!(await save())) return;
      action.mutate('go-live', {
        onSuccess: () =>
          toast.success('You are live. Subscribers are being notified.', { icon: '🔴' }),
      });
      return;
    }
    if (!(await save())) return;
    action.mutate(name, {
      onSuccess: (updated) => toast.success(`Entry is now ${updated.status}.`),
    });
  };

  const finishLive = async (publish: boolean) => {
    await writer.settle();
    endLive.mutate(
      { publish },
      {
        onSuccess: (updated) => {
          saved.current.content = content;
          setContent(updated.content);
          toast.success(
            publish ? 'Published. The ink has dried.' : 'Stream ended. Saved as a draft.',
          );
        },
      },
    );
  };

  const onDelete = async () => {
    if (
      await confirm({
        title: 'Tear out this page?',
        body: 'The entry, its notes and reactions will be deleted forever.',
        confirmLabel: 'Delete',
        danger: true,
      })
    ) {
      remove.mutate(log.id, { onSuccess: () => void navigate('/admin/logs') });
    }
  };

  const words = wordCount(content);
  const busy = action.isPending || endLive.isPending;
  const s = log.status;

  return (
    <div className="flex flex-col gap-5">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin/logs"
          className="link-ink inline-flex items-center gap-2 text-paper/70 hover:text-paper"
        >
          <ArrowLeft className="size-4" aria-hidden /> All entries
        </Link>
        {(s === 'published' || s === 'live') && (
          <a
            href={`/logs/${log.slug}`}
            target="_blank"
            rel="noreferrer"
            className="link-ink text-sm text-paper/70 hover:text-paper"
          >
            Open reader view ↗
          </a>
        )}
      </div>

      {isLive && (
        <OnAirBar
          log={log}
          viewers={writer.viewers || room.viewers}
          status={writer.status}
          onEnd={(publish) => void finishLive(publish)}
          ending={endLive.isPending}
        />
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Paper className="relative overflow-hidden rounded-[4px]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-ink/15 px-5 py-3">
            <div className="flex items-center gap-3">
              <StatusStamp status={s} />
              <span
                className="font-type text-[0.68rem] uppercase tracking-widest text-ink-faded"
                aria-live="polite"
              >
                {isLive
                  ? 'streaming live'
                  : {
                      saved: 'saved',
                      dirty: 'unsaved changes',
                      saving: 'saving…',
                      error: 'save failed',
                    }[saveState]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div role="tablist" className="flex rounded-full border border-ink/15 p-0.5">
                {[
                  { value: false, label: 'Write', icon: PenLine },
                  { value: true, label: 'Preview', icon: Eye },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    role="tab"
                    aria-selected={preview === value}
                    onClick={() => setPreview(value)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-type text-[0.65rem] uppercase tracking-widest transition',
                      preview === value ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink',
                    )}
                  >
                    <Icon className="size-3" aria-hidden /> {label}
                  </button>
                ))}
              </div>
              <SoundControls />
            </div>
          </div>

          <div className="px-5 pt-5 sm:px-8">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={LIMITS.title.max}
              placeholder="A title for today…"
              aria-label="Title"
              autoFocus={log.title === NEW_ENTRY_TITLE}
              onFocus={(event) => {
                if (event.currentTarget.value !== NEW_ENTRY_TITLE) return;
                event.currentTarget.select();
                selectOnMouseUp.current = true;
              }}
              onMouseUp={(event) => {
                // A click that focused the field would otherwise collapse the selection on mouse-up.
                if (selectOnMouseUp.current) event.preventDefault();
                selectOnMouseUp.current = false;
              }}
              className="w-full bg-transparent font-hand text-4xl leading-tight text-ink placeholder:text-ink-faded/50 focus:outline-none sm:text-5xl"
            />
          </div>

          {preview ? (
            <div
              className="paper-ruled min-h-[60vh] px-5 pb-[var(--rule)] pl-[3.25rem] [--margin-x:2.25rem] sm:pr-8 md:pl-[4.75rem] md:[--margin-x:3.5rem]"
              style={{ backgroundColor: 'transparent' }}
            >
              <Markdown content={content} caret={isLive} />
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(event) => onContentChange(event.target.value)}
              onKeyDown={onKeyDown}
              maxLength={LIMITS.content.max}
              placeholder={isLive ? 'Readers are watching… write your first line.' : 'Dear diary,'}
              aria-label="Entry text"
              spellCheck
              className="paper-ruled block min-h-[60vh] w-full resize-y bg-transparent pb-[var(--rule)] pl-[3.25rem] pr-5 font-serif text-[1.16rem] leading-[var(--rule)] text-ink placeholder:italic placeholder:text-ink-faded/60 focus:outline-none sm:pr-8 md:pl-[4.75rem] md:text-[1.25rem]"
              style={{ backgroundColor: 'transparent' }}
            />
          )}

          <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-ink/15 px-5 py-3 text-sm text-ink-faded">
            <FloatingReactions floaters={floaters} />
            <span>
              {plural(words, 'word')} · {readingMinutes(content)} min read
            </span>
            <span className="hidden sm:inline">Markdown supported · ⌘/Ctrl + S saves</span>
          </div>
        </Paper>

        <aside className="flex flex-col gap-4">
          <Panel title="Publishing">
            <div className="flex flex-col gap-2">
              {(s === 'draft' || s === 'scheduled' || s === 'published') && (
                <Button
                  variant="wax"
                  icon={<Radio className="size-4" />}
                  onClick={() => void run('go-live')}
                  loading={action.isPending && action.variables === 'go-live'}
                  disabled={busy}
                >
                  {s === 'published' ? 'Go live again' : 'Go live now'}
                </Button>
              )}
              {(s === 'draft' || s === 'scheduled' || s === 'archived') && (
                <Button variant="ink" onClick={() => void run('publish')} disabled={busy}>
                  Publish
                </Button>
              )}
              {s === 'published' && (
                <Button variant="paper" onClick={() => void run('unpublish')} disabled={busy}>
                  Unpublish to draft
                </Button>
              )}
              {s === 'archived' && (
                <Button variant="paper" onClick={() => void run('unpublish')} disabled={busy}>
                  Restore to draft
                </Button>
              )}
              {(s === 'draft' || s === 'scheduled' || s === 'published') && (
                <Button variant="ghost" onClick={() => void run('archive')} disabled={busy}>
                  Archive
                </Button>
              )}
              {isLive && (
                <p className="text-sm italic text-ink-faded">
                  Use the On air bar above to end the stream.
                </p>
              )}
            </div>
          </Panel>

          {(s === 'draft' || s === 'scheduled') && (
            <Panel title="Schedule a live session">
              <div className="flex flex-col gap-3">
                {log.scheduledFor && (
                  <p className="flex items-center gap-2 text-quill">
                    <CalendarClock className="size-4" aria-hidden /> {dateTime(log.scheduledFor)}
                  </p>
                )}
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  min={toLocalInputValue(new Date())}
                  onChange={(event) => setScheduleAt(event.target.value)}
                  className="field-box"
                  aria-label="Live session time"
                />
                <div className="flex gap-2">
                  <Button
                    variant="ink"
                    size="sm"
                    disabled={!scheduleAt}
                    loading={schedule.isPending}
                    onClick={() =>
                      void save().then(
                        (ok) => ok && schedule.mutate(new Date(scheduleAt).toISOString()),
                      )
                    }
                  >
                    {log.scheduledFor ? 'Reschedule' : 'Schedule'}
                  </Button>
                  {s === 'scheduled' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void run('unschedule')}
                      disabled={busy}
                    >
                      Unschedule
                    </Button>
                  )}
                </div>
                <p className="text-xs italic text-ink-faded">
                  Readers see a countdown on the home page.
                </p>
              </div>
            </Panel>
          )}

          <Panel title="Tags">
            <TagPicker
              value={tagIds}
              onChange={(ids) => {
                setTagIds(ids);
                settings.mutate({ tagIds: ids });
              }}
            />
          </Panel>

          <Panel title="Reader interactions">
            <div className="flex flex-col gap-3">
              <Checkbox
                checked={log.allowComments}
                onChange={(allowComments) => settings.mutate({ allowComments })}
                label="Allow notes in the margin"
                description="Comments. Takes effect instantly, even while live."
              />
              <Checkbox
                checked={log.allowReactions}
                onChange={(allowReactions) => settings.mutate({ allowReactions })}
                label="Allow reactions"
                description="Likes, love, inspired and moved."
              />
            </div>
          </Panel>

          <Panel title="Excerpt">
            <textarea
              value={excerpt}
              maxLength={LIMITS.excerpt.max}
              onChange={(event) => {
                setExcerpt(event.target.value);
                setExcerptDirty(true);
              }}
              onBlur={() => {
                if (!excerptDirty) return;
                setExcerptDirty(false);
                settings.mutate({ excerpt: excerpt.trim() || null });
              }}
              rows={3}
              placeholder="Leave blank to use the opening lines."
              className="field-box text-base"
              aria-label="Excerpt"
            />
          </Panel>

          {isLive && (
            <Paper className="scrollbar-ink max-h-[32rem] overflow-y-auto rounded-[4px] p-5">
              <CommentSection log={log} />
            </Paper>
          )}

          <Panel title="Danger zone">
            <Button
              variant="danger"
              size="sm"
              icon={<Trash className="size-3.5" />}
              onClick={() => void onDelete()}
              disabled={isLive || remove.isPending}
            >
              Delete entry
            </Button>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

export default function LogEditorPage() {
  const { id = '' } = useParams();
  const query = useAdminLog(id);
  if (query.isPending) return <InkLoader className="text-paper/70" />;
  if (query.error || !query.data) {
    return (
      <Paper>
        <ErrorNote error={query.error} onRetry={() => void query.refetch()} />
      </Paper>
    );
  }
  return <Editor key={query.data.id} log={query.data} />;
}
