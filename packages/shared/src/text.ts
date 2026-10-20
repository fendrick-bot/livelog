/**
 * Text helpers shared by server and web: live-typing operations, slugs,
 * excerpts and reading time.
 */

/** A single splice: delete `del` chars at `pos`, then insert `ins`. */
export interface TextOp {
  pos: number;
  del: number;
  ins: string;
}

/**
 * Smallest single splice turning `prev` into `next` (common prefix/suffix).
 * Returns null when nothing changed. Typing produces tiny ops, which keeps
 * the live stream cheap no matter how long the entry gets.
 */
export function diffText(prev: string, next: string): TextOp | null {
  if (prev === next) return null;
  const minLength = Math.min(prev.length, next.length);
  let start = 0;
  while (start < minLength && prev.charCodeAt(start) === next.charCodeAt(start)) start++;

  let prevEnd = prev.length;
  let nextEnd = next.length;
  while (
    prevEnd > start &&
    nextEnd > start &&
    prev.charCodeAt(prevEnd - 1) === next.charCodeAt(nextEnd - 1)
  ) {
    prevEnd--;
    nextEnd--;
  }
  return { pos: start, del: prevEnd - start, ins: next.slice(start, nextEnd) };
}

export function isValidOp(text: string, op: TextOp): boolean {
  return (
    Number.isInteger(op.pos) &&
    Number.isInteger(op.del) &&
    op.pos >= 0 &&
    op.del >= 0 &&
    op.pos + op.del <= text.length &&
    typeof op.ins === 'string'
  );
}

export function applyOp(text: string, op: TextOp): string {
  if (!isValidOp(text, op)) throw new RangeError('Text operation is out of bounds');
  return text.slice(0, op.pos) + op.ins + text.slice(op.pos + op.del);
}

export function slugify(input: string, maxLength = 80): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/** Strip the most common markdown syntax so text reads cleanly in previews and emails. */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function excerptFrom(markdown: string, maxLength = 180): string {
  // Headings usually repeat the title, so excerpts start at the first real sentence.
  const body = markdown.replace(/^\s{0,3}#{1,6}\s+.*$/gm, '');
  const plain = stripMarkdown(body) || stripMarkdown(markdown);
  if (plain.length <= maxLength) return plain;
  const cut = plain.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function wordCount(text: string): number {
  const plain = stripMarkdown(text);
  return plain ? plain.split(' ').length : 0;
}

export function readingMinutes(text: string, wordsPerMinute = 200): number {
  return Math.max(1, Math.round(wordCount(text) / wordsPerMinute));
}
