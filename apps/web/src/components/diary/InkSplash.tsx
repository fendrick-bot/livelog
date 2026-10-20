import { useEffect } from 'react';

const IGNORE = 'input, textarea, select, [contenteditable="true"], [data-no-ink]';

/** A tiny ink blot blooms wherever you click, like a fountain pen touching paper. */
export function InkSplash() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || (event.target as Element | null)?.closest(IGNORE)) return;
      const size = 26 + Math.random() * 14;
      const drops = Array.from({ length: 4 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const distance = 11 + Math.random() * 6;
        const radius = 1.2 + Math.random() * 1.6;
        return `<circle cx="${20 + Math.cos(angle) * distance}" cy="${20 + Math.sin(angle) * distance}" r="${radius}"/>`;
      }).join('');
      const blot = document.createElement('div');
      blot.className = 'ink-drop';
      blot.style.left = `${event.clientX}px`;
      blot.style.top = `${event.clientY}px`;
      blot.style.width = blot.style.height = `${size}px`;
      blot.innerHTML = `<svg viewBox="0 0 40 40" width="100%" height="100%" fill="#1f3a5f"><path d="M20 12c5 0 9 3 8.5 8.3-.4 4.6-4.2 8.2-8.8 7.9-4.7-.3-8-4-7.6-8.6C12.5 15 15.4 12 20 12z" opacity=".75"/>${drops}</svg>`;
      blot.addEventListener('animationend', () => blot.remove(), { once: true });
      document.body.appendChild(blot);
    };

    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return null;
}
