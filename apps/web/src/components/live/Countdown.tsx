import { AnimatePresence, motion } from 'motion/react';
import { useCountdown } from '../../hooks/useCountdown';

function Digit({ value }: { value: string }) {
  return (
    <span className="relative inline-grid h-14 w-10 place-items-center overflow-hidden rounded-[4px] bg-[#fbf5e6] font-type text-[2rem] text-ink shadow-[inset_0_-2px_0_rgba(0,0,0,0.08),0_3px_6px_-2px_rgba(30,15,5,0.45)] sm:h-16 sm:w-12 sm:text-[2.4rem] [perspective:300px]">
      <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-ink/15" />
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 90, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="block [transform-origin:50%_50%]"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Unit({ value, label }: { value: number; label: string }) {
  const text = String(value).padStart(2, '0');
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex gap-1">
        {[...text].map((char, index) => (
          <Digit key={index} value={char} />
        ))}
      </div>
      <span className="font-hand text-lg text-ink-faded">{label}</span>
    </div>
  );
}

/** Flip-clock countdown to the next scheduled live entry. */
export function Countdown({ target }: { target: string }) {
  const { days, hours, minutes, seconds, done } = useCountdown(target);
  if (done) {
    return (
      <p className="font-hand text-3xl text-quill">Any moment now… the pen is being uncapped.</p>
    );
  }
  return (
    <div
      className="flex flex-wrap items-start gap-3 sm:gap-4"
      role="timer"
      aria-label={`${days} days ${hours} hours ${minutes} minutes ${seconds} seconds`}
    >
      {days > 0 && <Unit value={days} label={days === 1 ? 'day' : 'days'} />}
      <Unit value={hours} label="hours" />
      <Unit value={minutes} label="minutes" />
      <Unit value={seconds} label="seconds" />
    </div>
  );
}
