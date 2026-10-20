import {
  REACTION_META,
  REACTION_TYPES,
  type LogDetailDto,
  type ReactionType,
} from '@livelog/shared';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useToggleReaction } from '../../api/reactions';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/cn';
import type { Floater } from '../../hooks/useFloaters';

export function FloatingReactions({ floaters }: { floaters: Floater[] }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-full h-48 overflow-visible"
    >
      {floaters.map((floater) => (
        <span
          key={floater.id}
          className="absolute bottom-0 text-2xl animate-float-up"
          style={
            {
              left: `${floater.left}%`,
              '--drift': `${floater.drift}px`,
              '--spin': `${floater.spin}deg`,
            } as CSSProperties
          }
        >
          {floater.emoji}
        </span>
      ))}
    </div>
  );
}

export function ReactionBar({
  log,
  onLocalReaction,
}: {
  log: LogDetailDto;
  onLocalReaction: (type: ReactionType) => void;
}) {
  const { status } = useAuth();
  const navigate = useNavigate();
  const toggle = useToggleReaction(log);

  if (!log.allowReactions) {
    return <p className="text-sm italic text-ink-faded">Reactions are resting for this entry.</p>;
  }

  const react = (type: ReactionType) => {
    if (status !== 'authenticated') {
      toast('Sign in to leave your mark', {
        description: 'Reactions and notes need a (free) reader card.',
        action: { label: 'Sign in', onClick: () => void navigate(`/login?next=/logs/${log.slug}`) },
      });
      return;
    }
    const active = !log.viewerReactions.includes(type);
    if (active) onLocalReaction(type);
    toggle.mutate({ type, active });
  };

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="React to this entry">
      {REACTION_TYPES.map((type) => {
        const active = log.viewerReactions.includes(type);
        const meta = REACTION_META[type];
        return (
          <button
            key={type}
            type="button"
            aria-pressed={active}
            onClick={() => react(type)}
            className={cn(
              'group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 transition-all duration-200 active:scale-95',
              active
                ? 'border-wax/50 bg-wax/10 text-wax shadow-[inset_0_1px_3px_rgba(143,45,45,0.2)]'
                : 'border-ink/20 bg-paper/50 text-ink-soft hover:-translate-y-0.5 hover:border-ink/40',
            )}
          >
            <span
              className={cn(
                'text-lg transition-transform duration-200 group-hover:scale-125',
                active && 'scale-110',
              )}
              aria-hidden
            >
              {meta.emoji}
            </span>
            <span className="font-type text-xs">{log.reactionCounts[type]}</span>
            <span className="sr-only">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
