import { useSyncExternalStore } from 'react';
import { soundscape } from '../lib/sound/soundscape';

export function useSoundscape() {
  const state = useSyncExternalStore(
    soundscape.subscribe,
    soundscape.getSnapshot,
    soundscape.getSnapshot,
  );
  return { ...state, soundscape };
}
