import { describe, expect, it } from 'vitest';
import { applyOp, diffText, excerptFrom, readingMinutes, slugify } from './text';

describe('diffText / applyOp', () => {
  const cases: Array<[string, string]> = [
    ['', 'hello'],
    ['hello', ''],
    ['hello', 'hello world'],
    ['hello world', 'hello brave world'],
    ['abcdef', 'abXYef'],
    ['aaaa', 'aaa'],
    ['dear diary', 'Dear diary,'],
    ['emoji 😀 here', 'emoji 😃 here'],
  ];

  it.each(cases)('round-trips %j -> %j', (prev, next) => {
    const op = diffText(prev, next);
    expect(op).not.toBeNull();
    expect(applyOp(prev, op!)).toBe(next);
  });

  it('returns null for identical text', () => {
    expect(diffText('same', 'same')).toBeNull();
  });

  it('produces a minimal op for a single keystroke', () => {
    expect(diffText('Dear dia', 'Dear diar')).toEqual({ pos: 8, del: 0, ins: 'r' });
  });

  it('rejects out-of-bounds ops', () => {
    expect(() => applyOp('abc', { pos: 2, del: 5, ins: '' })).toThrow(RangeError);
    expect(() => applyOp('abc', { pos: -1, del: 0, ins: 'x' })).toThrow(RangeError);
  });
});

describe('slugify', () => {
  it('creates url-safe slugs', () => {
    expect(slugify('  Café days: Writing at 3 AM! ')).toBe('cafe-days-writing-at-3-am');
    expect(slugify("Someone's ‘quiet’ night")).toBe('someones-quiet-night');
  });
});

describe('excerptFrom / readingMinutes', () => {
  it('strips markdown and truncates on a word boundary', () => {
    const excerpt = excerptFrom(
      '# Title\n\nSome **bold** words and a [link](https://x.y) here.',
      30,
    );
    expect(excerpt).toBe('Some bold words and a link…');
  });

  it('falls back to headings when that is all there is', () => {
    expect(excerptFrom('## Only a heading')).toBe('Only a heading');
  });

  it('never returns less than one minute', () => {
    expect(readingMinutes('short')).toBe(1);
    expect(readingMinutes('word '.repeat(1000))).toBe(5);
  });
});
