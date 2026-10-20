import { toast } from 'sonner';

export interface ShareTarget {
  title: string;
  text?: string;
  url: string;
}

export const canNativeShare = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export async function nativeShare(target: ShareTarget): Promise<void> {
  try {
    await navigator.share(target);
  } catch (error) {
    if ((error as Error).name !== 'AbortError') await copyLink(target.url);
  }
}

export async function copyLink(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied. Paste it anywhere.');
  } catch {
    toast.message('Copy this link', { description: url });
  }
}

export function shareUrls(target: ShareTarget) {
  const url = encodeURIComponent(target.url);
  const text = encodeURIComponent(target.text ?? target.title);
  return {
    x: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
    whatsapp: `https://wa.me/?text=${text}%20${url}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    email: `mailto:?subject=${encodeURIComponent(target.title)}&body=${text}%0A%0A${url}`,
  };
}
