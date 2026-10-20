import type { TagDto } from '@livelog/shared';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { cn } from '../../lib/cn';

export function TagChips({
  tags,
  linked = true,
  className,
}: {
  tags: TagDto[];
  linked?: boolean;
  className?: string;
}) {
  if (tags.length === 0) return null;
  return (
    <ul className={cn('flex flex-wrap gap-x-2 gap-y-1.5', className)}>
      {tags.map((tag, index) => {
        const chip = (
          <span
            className="stamp text-quill"
            style={
              {
                '--stamp-tilt': `${index % 2 ? 1.5 : -1.5}deg`,
                fontSize: '0.66rem',
              } as CSSProperties
            }
          >
            #{tag.name}
          </span>
        );
        return (
          <li key={tag.id}>
            {linked ? (
              <Link
                to={`/logs?tag=${tag.slug}`}
                className="transition-opacity hover:opacity-70"
                onClick={(event) => event.stopPropagation()}
              >
                {chip}
              </Link>
            ) : (
              chip
            )}
          </li>
        );
      })}
    </ul>
  );
}
