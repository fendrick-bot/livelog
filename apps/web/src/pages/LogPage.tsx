import { type ReactionType } from '@livelog/shared';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { useLog } from '../api/logs';
import { CommentSection } from '../components/comments/CommentSection';
import { ErrorNote, InkLoader } from '../components/diary/Feedback';
import { Paper } from '../components/diary/Paper';
import { LiveBadge, ViewerCount, WritingIndicator } from '../components/live/LiveBadge';
import { FloatingReactions, ReactionBar } from '../components/live/Reactions';
import { useFloaters } from '../hooks/useFloaters';
import { SoundControls } from '../components/live/SoundControls';
import { TagChips } from '../components/logs/TagChips';
import { Markdown } from '../components/Markdown';
import { ShareButton } from '../components/ShareButton';
import { useElapsed } from '../hooks/useCountdown';
import { useLogRoom } from '../hooks/useLogRoom';
import { useTypingActive } from '../hooks/useTypingActive';
import { ApiError } from '../lib/api';
import { diaryDate, duration, plural } from '../lib/format';
import { soundscape } from '../lib/sound/soundscape';
import NotFoundPage from './NotFoundPage';

export default function LogPage() {
  const { slug = '' } = useParams();
  const query = useLog(slug);
  const log = query.data;
  const { floaters, launch } = useFloaters();
  const lastLocal = useRef<{ type: ReactionType; at: number } | null>(null);

  const { liveText, viewers, typingAt } = useLogRoom(log, {
    onOp: (op) => soundscape.typeBurst(op),
    onReaction: (type) => {
      const mine = lastLocal.current;
      if (mine && mine.type === type && Date.now() - mine.at < 2_500) return;
      launch(type);
    },
    onEnded: (payload) =>
      toast(
        payload.status === 'published'
          ? 'The ink has dried: this entry is now published.'
          : 'The live session has ended.',
        {
          icon: '🖋️',
        },
      ),
  });

  const isLive = log?.status === 'live';
  const typing = useTypingActive(typingAt);
  const elapsed = useElapsed(isLive ? log?.liveStartedAt : null);

  useEffect(() => {
    soundscape.setAmbience(isLive);
    return () => soundscape.setAmbience(false);
  }, [isLive]);

  useEffect(() => {
    if (log) document.title = `${isLive ? '🔴 ' : ''}${log.title} · Livelog`;
    return () => {
      document.title = 'Livelog · a diary, written live';
    };
  }, [log, isLive]);

  if (query.isPending) return <InkLoader className="text-paper/70" />;
  if (query.error) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NotFoundPage />;
    return (
      <Paper className="mx-auto max-w-xl">
        <ErrorNote error={query.error} onRetry={() => void query.refetch()} />
      </Paper>
    );
  }
  if (!log) return null;

  const content = isLive ? (liveText?.content ?? log.content) : log.content;
  const date = log.publishedAt ?? log.liveStartedAt ?? log.createdAt;
  const shareTarget = {
    title: log.title,
    text: isLive
      ? `I'm reading "${log.title}" as it's being written, live:`
      : `"${log.title}" on Livelog`,
    url: `${window.location.origin}/logs/${log.slug}`,
  };

  return (
    <div className="flex flex-col gap-6">
      <Link
        to={log.kind === 'community' ? '/community' : '/logs'}
        className="link-ink inline-flex w-fit items-center gap-2 text-paper/70 hover:text-paper"
      >
        <ArrowLeft className="size-4" aria-hidden />{' '}
        {log.kind === 'community' ? 'Other diaries' : 'All entries'}
      </Link>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <article className="paper relative rounded-[4px]">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-[2.25rem] w-px bg-margin md:left-[3.5rem]"
          />

          <header className="flex flex-col gap-4 pb-6 pl-[3.25rem] pr-5 pt-8 sm:pr-10 md:pl-[4.75rem]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {isLive ? (
                  <>
                    <LiveBadge />
                    <span className="font-type text-xs text-ink-faded" aria-label="Live for">
                      {duration(elapsed)}
                    </span>
                    <ViewerCount count={viewers} />
                  </>
                ) : (
                  <time
                    dateTime={date}
                    className="font-type text-xs uppercase tracking-[0.2em] text-ink-faded"
                  >
                    {diaryDate(date)}
                  </time>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isLive && <SoundControls />}
                <ShareButton target={shareTarget} />
              </div>
            </div>

            <h1 className="font-hand text-5xl leading-[1.02] text-ink sm:text-6xl">{log.title}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-ink-faded">
              <span className="italic">
                by <span className="text-ink-soft">{log.author.displayName}</span>
                {!isLive && <> · {log.readingMinutes} min read</>}
                {log.viewCount > 0 && <> · {plural(log.viewCount, 'read')}</>}
              </span>
              <TagChips tags={log.tags} />
            </div>
            {isLive && (
              <div className="flex flex-wrap items-center gap-4">
                <WritingIndicator active={typing} />
                <SoundControls prominent className="sm:hidden" />
              </div>
            )}
          </header>

          <div
            className="paper-ruled pb-[var(--rule)] pl-[3.25rem] pr-5 [--margin-x:-10px] sm:pr-10 md:pl-[4.75rem]"
            style={{ backgroundColor: 'transparent' }}
          >
            <Markdown content={content} caret={isLive} />
            {isLive && !content.trim() && (
              <p className="prose-diary italic text-ink-faded">
                The page is blank. The first words are on their way
                <span
                  className="ml-1 inline-block h-[1.1em] w-0.5 translate-y-1 bg-quill animate-caret"
                  aria-hidden
                />
              </p>
            )}
          </div>

          <footer className="relative flex flex-wrap items-center justify-between gap-4 border-t border-dashed border-ink/15 py-5 pl-[3.25rem] pr-5 sm:pr-10 md:pl-[4.75rem]">
            <div className="relative">
              <FloatingReactions floaters={floaters} />
              <ReactionBar
                log={log}
                onLocalReaction={(type) => {
                  lastLocal.current = { type, at: Date.now() };
                  launch(type);
                }}
              />
            </div>
            {!isLive && <span className="font-hand text-2xl text-ink-faded">— fin —</span>}
          </footer>
        </article>

        <aside className="lg:sticky lg:top-24">
          <Paper className="scrollbar-ink rounded-[4px] p-5 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
            <CommentSection log={log} />
          </Paper>
        </aside>
      </div>
    </div>
  );
}
