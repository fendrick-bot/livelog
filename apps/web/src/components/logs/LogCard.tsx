import { REACTION_META, REACTION_TYPES, type LogSummaryDto } from '@livelog/shared';
import { MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { prefetchLog } from '../../api/logs';
import { cn } from '../../lib/cn';
import { diaryDate, plural, tiltFor } from '../../lib/format';
import { Tape } from '../diary/Paper';
import { TagChips } from './TagChips';

/** An index card pinned to the desk: tilts back to straight and lifts on hover. */
export function LogCard({
  log,
  variant = 'card',
  index = 0,
}: {
  log: LogSummaryDto;
  variant?: 'card' | 'note';
  index?: number;
}) {
  const tilt = tiltFor(log.id);
  const isLive = log.status === 'live';
  const date = log.publishedAt ?? log.liveStartedAt ?? log.createdAt;
  const totalReactions = REACTION_TYPES.reduce((sum, type) => sum + log.reactionCounts[type], 0);
  const topReactions = REACTION_TYPES.filter((type) => log.reactionCounts[type] > 0).slice(0, 3);

  return (
    <motion.article
      initial={{ opacity: 0, y: 18, rotate: tilt * 2 }}
      whileInView={{ opacity: 1, y: 0, rotate: tilt }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: Math.min(index, 6) * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ rotate: 0, y: -6, transition: { duration: 0.25 } }}
      className="group relative h-full"
    >
      <Link
        to={`/logs/${log.slug}`}
        onMouseEnter={() => prefetchLog(log.slug)}
        onFocus={() => prefetchLog(log.slug)}
        className={cn(
          'paper relative flex h-full flex-col gap-3 rounded-[3px] px-5 pb-5 pt-7 transition-shadow duration-300 group-hover:shadow-[0_30px_50px_-22px_rgba(20,10,4,0.85),0_4px_10px_rgba(20,10,4,0.25)]',
          variant === 'note' && 'bg-[#f3e7c3]',
        )}
      >
        <Tape
          className={cn('-top-3 left-1/2 -translate-x-1/2', tilt > 0 ? 'rotate-3' : '-rotate-3')}
        />
        <div className="flex items-center justify-between gap-2">
          <time
            dateTime={date}
            className="font-type text-[0.7rem] uppercase tracking-[0.16em] text-ink-faded"
          >
            {diaryDate(date)}
          </time>
          {isLive && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-wax px-2.5 py-0.5 font-type text-[0.65rem] uppercase tracking-widest text-paper">
              <span className="size-1.5 rounded-full bg-paper animate-live-pulse" /> Live
            </span>
          )}
        </div>
        <h3 className="font-hand text-[2rem] leading-[1.05] text-ink transition-colors group-hover:text-quill">
          {log.title}
        </h3>
        {log.excerpt && (
          <p className="line-clamp-4 text-[1.02rem] leading-relaxed text-ink-soft">{log.excerpt}</p>
        )}
        <TagChips tags={log.tags} linked={false} className="mt-auto pt-1" />
        <footer className="flex items-center justify-between border-t border-dashed border-ink/15 pt-3 text-sm text-ink-faded">
          <span className="italic">
            {log.kind === 'community'
              ? `by ${log.author.displayName}`
              : isLive
                ? 'being written now…'
                : `${log.readingMinutes} min read`}
          </span>
          <span className="flex items-center gap-3">
            {totalReactions > 0 && (
              <span className="flex items-center gap-1" title={plural(totalReactions, 'reaction')}>
                <span aria-hidden className="text-sm tracking-tighter">
                  {topReactions.map((type) => REACTION_META[type].emoji).join('')}
                </span>
                {totalReactions}
              </span>
            )}
            {log.commentCount > 0 && (
              <span className="flex items-center gap-1" title={plural(log.commentCount, 'note')}>
                <MessageCircle className="size-3.5" aria-hidden /> {log.commentCount}
              </span>
            )}
          </span>
        </footer>
      </Link>
    </motion.article>
  );
}

export function LogGrid({ logs, variant }: { logs: LogSummaryDto[]; variant?: 'card' | 'note' }) {
  return (
    <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {logs.map((log, index) => (
        <LogCard key={log.id} log={log} variant={variant} index={index} />
      ))}
    </div>
  );
}
