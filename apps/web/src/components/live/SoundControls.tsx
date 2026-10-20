import { AudioLines, Headphones, Keyboard, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSoundscape } from '../../hooks/useSoundscape';
import { cn } from '../../lib/cn';
import { Checkbox } from '../diary/Field';

/** Gramophone-style sound menu: typing sounds, ambient music and volume. */
export function SoundControls({
  className,
  prominent,
}: {
  className?: string;
  prominent?: boolean;
}) {
  const { prefs, unlocked, soundscape } = useSoundscape();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const on = unlocked && (prefs.keys || prefs.music);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!unlocked && prominent) {
    return (
      <button
        type="button"
        onClick={() => soundscape.unlock()}
        className={cn(
          'group inline-flex items-center gap-2 rounded-full border border-quill/30 bg-quill/5 px-4 py-2 font-hand text-xl text-quill transition hover:bg-quill/10',
          className,
        )}
      >
        <Headphones className="size-5 transition-transform group-hover:-rotate-12" aria-hidden />
        Hear the typewriter
      </button>
    );
  }

  return (
    <div ref={panelRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-label="Sound settings"
        onClick={() => {
          if (!unlocked) soundscape.unlock();
          setOpen((value) => !value);
        }}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition',
          on
            ? 'border-quill/40 bg-quill/8 text-quill'
            : 'border-ink/20 text-ink-faded hover:text-ink',
        )}
      >
        {on ? (
          <Volume2 className="size-4" aria-hidden />
        ) : (
          <VolumeX className="size-4" aria-hidden />
        )}
        <span className="font-type text-[0.7rem] uppercase tracking-widest">Sound</span>
      </button>
      {open && (
        <div className="paper absolute right-0 z-30 mt-2 w-72 rounded-[4px] p-4">
          <p className="mb-3 font-hand text-2xl">Soundscape</p>
          <div className="flex flex-col gap-3">
            <Checkbox
              checked={prefs.keys}
              onChange={(keys) => soundscape.setPrefs({ keys })}
              label={
                <span className="inline-flex items-center gap-2">
                  <Keyboard className="size-4" aria-hidden /> Typewriter keys
                </span>
              }
              description="A soft click for every word as it lands."
            />
            <Checkbox
              checked={prefs.music}
              onChange={(music) => soundscape.setPrefs({ music })}
              label={
                <span className="inline-flex items-center gap-2">
                  <AudioLines className="size-4" aria-hidden /> Rain & slow piano
                </span>
              }
              description="Gentle ambience while you read along."
            />
            <label className="flex items-center gap-3 text-sm text-ink-soft">
              <VolumeX className="size-4" aria-hidden />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={prefs.volume}
                onChange={(event) => soundscape.setPrefs({ volume: Number(event.target.value) })}
                className="w-full accent-quill"
                aria-label="Volume"
              />
              <Volume2 className="size-4" aria-hidden />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
