import { useEffect, useState } from 'react';

/** True for `windowMs` after the last keystroke timestamp. */
export function useTypingActive(lastTypedAt: number, windowMs = 1_500): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!lastTypedAt) return;
    setActive(true);
    const id = setTimeout(() => setActive(false), windowMs);
    return () => clearTimeout(id);
  }, [lastTypedAt, windowMs]);
  return active;
}
