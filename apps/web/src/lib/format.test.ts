import { describe, expect, it } from 'vitest';
import { duration, plural, tiltFor, timeAgo } from './format';

describe('format helpers', () => {
  it('formats durations like a stopwatch', () => {
    expect(duration(65)).toBe('1:05');
    expect(duration(3725)).toBe('1:02:05');
    expect(duration(-3)).toBe('0:00');
  });

  it('pluralises simply', () => {
    expect(plural(1, 'reader')).toBe('1 reader');
    expect(plural(3, 'reader')).toBe('3 readers');
    expect(plural(2, 'story', 'stories')).toBe('2 stories');
  });

  it('gives stable tilts within range', () => {
    expect(tiltFor('abc')).toBe(tiltFor('abc'));
    for (const seed of ['a', 'bb', 'some-uuid', 'zzz']) {
      expect(Math.abs(tiltFor(seed))).toBeLessThanOrEqual(2.4);
    }
  });

  it('describes recent times', () => {
    const now = Date.now();
    expect(timeAgo(new Date(now - 10_000), now)).toBe('just now');
    expect(timeAgo(new Date(now - 3 * 60_000), now)).toMatch(/3 minutes ago/);
  });
});
