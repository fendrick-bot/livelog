import { Link2, Mail, MessageCircle, Send, Share2, Globe } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { canNativeShare, copyLink, nativeShare, shareUrls, type ShareTarget } from '../lib/share';
import { cn } from '../lib/cn';
import { Button } from './diary/Button';

export function ShareButton({ target, className }: { target: ShareTarget; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const urls = shareUrls(target);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const onClick = () => {
    if (canNativeShare() && window.matchMedia('(pointer: coarse)').matches)
      void nativeShare(target);
    else setOpen((value) => !value);
  };

  const item =
    'flex items-center gap-3 rounded px-3 py-2 text-left text-ink-soft hover:bg-ink/5 hover:text-ink';

  return (
    <div ref={ref} className={cn('relative', className)}>
      <Button
        variant="paper"
        size="sm"
        icon={<Share2 className="size-3.5" />}
        onClick={onClick}
        aria-expanded={open}
      >
        Share
      </Button>
      {open && (
        <div className="paper absolute right-0 z-30 mt-2 flex w-56 flex-col rounded-[4px] p-2">
          <button
            type="button"
            className={item}
            onClick={() => void copyLink(target.url).then(() => setOpen(false))}
          >
            <Link2 className="size-4" aria-hidden /> Copy link
          </button>
          <a className={item} href={urls.x} target="_blank" rel="noopener noreferrer">
            <Send className="size-4" aria-hidden /> Post on X
          </a>
          <a className={item} href={urls.whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-4" aria-hidden /> WhatsApp
          </a>
          <a className={item} href={urls.linkedin} target="_blank" rel="noopener noreferrer">
            <Globe className="size-4" aria-hidden /> LinkedIn
          </a>
          <a className={item} href={urls.email}>
            <Mail className="size-4" aria-hidden /> Email a friend
          </a>
        </div>
      )}
    </div>
  );
}
