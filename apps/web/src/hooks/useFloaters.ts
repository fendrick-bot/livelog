import { REACTION_META, type ReactionType } from '@livelog/shared';
import { useCallback, useState } from 'react';

export interface Floater {
  id: number;
  emoji: string;
  left: number;
  drift: number;
  spin: number;
}

let floaterId = 0;

/** Emoji that drift up from the reaction bar whenever anyone reacts. */
export function useFloaters() {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const launch = useCallback((type: ReactionType) => {
    const floater: Floater = {
      id: ++floaterId,
      emoji: REACTION_META[type].emoji,
      left: 10 + Math.random() * 80,
      drift: (Math.random() - 0.5) * 80,
      spin: (Math.random() - 0.5) * 30,
    };
    setFloaters((current) => [...current.slice(-24), floater]);
    setTimeout(
      () => setFloaters((current) => current.filter((item) => item.id !== floater.id)),
      1_900,
    );
  }, []);
  return { floaters, launch };
}
