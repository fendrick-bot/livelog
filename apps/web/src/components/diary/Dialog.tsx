import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Native <dialog>: focus trapping, Esc to close and a backdrop for free. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        'paper m-auto w-[min(36rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[4px] p-0 text-ink backdrop:bg-[#140c07]/60 backdrop:backdrop-blur-[2px]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-5">
        <h2 className="font-hand text-3xl leading-tight">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-ink-faded hover:bg-ink/5 hover:text-ink"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="px-6 pb-6 pt-3">{children}</div>
    </dialog>
  );
}
