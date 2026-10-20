import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/cn';

const components: Components = {
  a: ({ href, children, ...props }) => {
    const external = href?.startsWith('http');
    return (
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        {...props}
      >
        {children}
      </a>
    );
  },
  img: ({ alt, ...props }) => <img alt={alt ?? ''} loading="lazy" decoding="async" {...props} />,
};

/** Diary-styled markdown. Raw HTML is never rendered (react-markdown escapes it). */
export const Markdown = memo(function Markdown({
  content,
  caret,
  className,
}: {
  content: string;
  caret?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('prose-diary', caret && 'live-caret', className)}>
      {content.trim() ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {content}
        </ReactMarkdown>
      ) : (
        <p className="italic text-ink-faded">{caret ? '' : 'This page is still blank.'}</p>
      )}
    </div>
  );
});
