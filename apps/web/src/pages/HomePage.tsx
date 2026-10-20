import type { LiveStatusDto, LogSummaryDto } from '@livelog/shared';
import { ArrowRight, Feather } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useLogs } from '../api/logs';
import { ButtonLink } from '../components/diary/Button';
import { EmptyState, InkLoader, SectionTitle } from '../components/diary/Feedback';
import { Paper, Tape } from '../components/diary/Paper';
import { Countdown } from '../components/live/Countdown';
import { LiveBadge, ViewerCount, WritingIndicator } from '../components/live/LiveBadge';
import { SoundControls } from '../components/live/SoundControls';
import { LogGrid } from '../components/logs/LogCard';
import { SubscribeCard } from '../components/SubscribeCard';
import { useLiveStatus } from '../hooks/useLiveStatus';
import { useLogRoom } from '../hooks/useLogRoom';
import { useTypingActive } from '../hooks/useTypingActive';
import { diaryDate, dateTime } from '../lib/format';
import { soundscape } from '../lib/sound/soundscape';

/** Streams the live entry's newest lines straight onto the hero page. */
function LivePreview({ log }: { log: LogSummaryDto }) {
  const { liveText, viewers, typingAt } = useLogRoom(log, {
    onOp: (op) => soundscape.typeBurst(op),
  });
  const typing = useTypingActive(typingAt);
  const boxRef = useRef<HTMLDivElement>(null);
  const text = liveText?.content ?? '';

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [text]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <LiveBadge />
        <ViewerCount count={viewers} />
        <WritingIndicator active={typing} />
      </div>
      <h2 className="font-hand text-4xl leading-tight text-ink sm:text-5xl">{log.title}</h2>
      <div
        ref={boxRef}
        className="relative h-44 overflow-hidden whitespace-pre-wrap break-words font-serif text-lg leading-[var(--rule)] text-ink-soft [mask-image:linear-gradient(to_bottom,transparent,black_35%)]"
        aria-live="off"
      >
        {text.slice(-700)}
        <span
          className="ml-0.5 inline-block h-[1.1em] w-0.5 translate-y-0.5 bg-quill animate-caret"
          aria-hidden
        />
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-3">
        <ButtonLink
          to={`/logs/${log.slug}`}
          variant="wax"
          size="lg"
          icon={<Feather className="size-4" />}
        >
          Read along live
        </ButtonLink>
        <SoundControls prominent />
      </div>
    </div>
  );
}

function NextUp({ next }: { next: LogSummaryDto }) {
  return (
    <div className="flex h-full flex-col gap-5">
      <p className="font-type text-xs uppercase tracking-[0.25em] text-quill">Next live entry</p>
      <h2 className="font-hand text-4xl leading-tight text-ink sm:text-5xl">{next.title}</h2>
      <Countdown target={next.scheduledFor!} />
      <p className="italic text-ink-faded">
        Pencilled in for {dateTime(next.scheduledFor!)}. Subscribe below and I will send you a
        letter the second the ink starts flowing.
      </p>
    </div>
  );
}

function Resting() {
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <p className="font-type text-xs uppercase tracking-[0.25em] text-ink-faded">
        Between entries
      </p>
      <h2 className="font-hand text-4xl leading-tight text-ink sm:text-5xl">The ink is drying.</h2>
      <p className="italic text-ink-soft">
        No live session is scheduled right now. Leave your address below and you will be the first
        to know when the pen moves again.
      </p>
    </div>
  );
}

function Hero({ status, loading }: { status: LiveStatusDto | undefined; loading: boolean }) {
  return (
    <section className="relative mx-auto w-full max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 24, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-[12px] bg-leather p-2 shadow-[0_45px_90px_-35px_rgba(0,0,0,0.95)] [transform-style:preserve-3d] sm:p-3"
      >
        <div className="relative grid md:grid-cols-2">
          {/* Left page */}
          <Paper className="overflow-hidden rounded-[5px] px-6 py-9 sm:px-10 md:rounded-r-none">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full border-[10px] border-[#9b6b3a]/12 [filter:blur(0.6px)]"
            />
            <p className="font-type text-xs uppercase tracking-[0.25em] text-ink-faded">
              {diaryDate(new Date())}
            </p>
            <h1 className="mt-4 font-hand text-6xl leading-[0.95] text-ink sm:text-7xl">
              Dear reader,
            </h1>
            <div className="mt-6 flex flex-col gap-4 text-[1.15rem] leading-relaxed text-ink-soft">
              <p>
                This is a diary written <em>out loud</em>. When I sit down to write, you can watch
                every word land on the page: the pauses, the crossed-out lines, the sentence that
                finally arrives.
              </p>
              <p>Pull up a chair, turn the soundscape on, and leave a note in the margin.</p>
            </div>
            <p className="mt-6 font-hand text-3xl text-quill">— the diarist</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/logs" variant="ink">
                Read past entries
              </ButtonLink>
              <ButtonLink to="/share-your-story" variant="paper">
                Share your story
              </ButtonLink>
            </div>
          </Paper>

          {/* Right page */}
          <Paper
            ruled
            className="min-h-[24rem] rounded-[5px] px-6 py-9 sm:px-10 md:rounded-l-none md:pl-16"
          >
            <span
              aria-hidden
              className="absolute -top-2 right-10 h-24 w-5 bg-wax shadow-md [clip-path:polygon(0_0,100%_0,100%_100%,50%_82%,0_100%)]"
            />
            {loading ? (
              <InkLoader />
            ) : status?.live ? (
              <LivePreview log={status.live} />
            ) : status?.next ? (
              <NextUp next={status.next} />
            ) : (
              <Resting />
            )}
          </Paper>

          {/* Book gutter */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-14 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(60,35,15,0.22)_45%,rgba(60,35,15,0.28)_50%,rgba(60,35,15,0.22)_55%,transparent)] md:block"
          />
        </div>
      </motion.div>
    </section>
  );
}

export default function HomePage() {
  const status = useLiveStatus();
  const recent = useLogs({ kind: 'author', pageSize: 6 });
  const community = useLogs({ kind: 'community', pageSize: 3 });

  return (
    <div className="flex flex-col gap-20 sm:gap-24">
      <Hero status={status.data} loading={status.isPending} />

      <section>
        <SectionTitle eyebrow="From the diary" title="Recent entries">
          Some were written live, letter by letter. All of them are still warm.
        </SectionTitle>
        {recent.isPending ? (
          <InkLoader className="text-paper/70" />
        ) : recent.data && recent.data.items.length > 0 ? (
          <>
            <LogGrid logs={recent.data.items} />
            <div className="mt-10 text-center">
              <Link
                to="/logs"
                className="link-ink inline-flex items-center gap-2 font-hand text-2xl text-gold"
              >
                Turn to the archive <ArrowRight className="size-5" />
              </Link>
            </div>
          </>
        ) : (
          <Paper className="mx-auto max-w-xl">
            <EmptyState title="The first page is still blank">
              Check back soon, or subscribe to hear when the first entry is written.
            </EmptyState>
          </Paper>
        )}
      </section>

      <section id="subscribe" className="mx-auto w-full max-w-2xl scroll-mt-24">
        <SubscribeCard />
      </section>

      <section>
        <SectionTitle eyebrow="Community" title="Pages from other diaries">
          Stories readers trusted me with. Read them gently, and leave a kind note.
        </SectionTitle>
        {community.data && community.data.items.length > 0 ? (
          <LogGrid logs={community.data.items} variant="note" />
        ) : (
          !community.isPending && (
            <p className="font-hand text-2xl text-paper/70">
              No stories yet. Yours could be the first.
            </p>
          )
        )}
        <div className="mt-12">
          <Paper
            tilt={-0.6}
            className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 py-10 text-center sm:px-12"
          >
            <Tape className="-top-3 left-10 -rotate-6" />
            <Tape className="-top-3 right-10 rotate-6" />
            <p className="font-hand text-4xl leading-tight">
              Have a story that wants to be written?
            </p>
            <p className="max-w-xl italic text-ink-soft">
              Send it to me. If it fits these pages, I will publish it in the community section for
              readers to find, with your name or anonymously, as you prefer.
            </p>
            <ButtonLink
              to="/share-your-story"
              variant="wax"
              size="lg"
              icon={<Feather className="size-4" />}
            >
              Write to me
            </ButtonLink>
          </Paper>
        </div>
      </section>
    </div>
  );
}
