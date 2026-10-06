import { describe, expect, it } from 'vitest';
import { QUOTES, msUntilNextHour, nextRandomQuote, pickQuote, quoteForHour } from './quote-library.js';

describe('pickQuote', () => {
  it('stays on the same line for a date and moves when offset changes', () => {
    const first = pickQuote('2026-10-05', 0);
    const again = pickQuote('2026-10-05', 0);
    const next = pickQuote('2026-10-05', 1);
    expect(again).toEqual(first);
    expect(next.text).not.toBe(first.text);
    expect(QUOTES.map((item) => item.text)).toContain(first.text);
  });

  it('wraps a negative offset into the library', () => {
    const quote = pickQuote('2026-10-05', -1);
    expect(quote.index).toBeGreaterThanOrEqual(0);
    expect(quote.index).toBeLessThan(QUOTES.length);
  });
});

describe('quoteForHour', () => {
  it('keeps one line through an hour and advances at the next hour', () => {
    const at = new Date(2026, 9, 6, 13, 10, 0);
    const later = new Date(2026, 9, 6, 13, 59, 0);
    const nextHour = new Date(2026, 9, 6, 14, 0, 0);
    expect(quoteForHour(later)).toEqual(quoteForHour(at));
    expect(quoteForHour(nextHour).index).toBe((quoteForHour(at).index + 1) % QUOTES.length);
    expect(msUntilNextHour(at)).toBe(50 * 60 * 1000);
    expect(msUntilNextHour(nextHour)).toBe(60 * 60 * 1000);
  });
});

describe('nextRandomQuote', () => {
  it('picks the index given by the random source and skips the previous line', () => {
    const first = nextRandomQuote(-1, () => 0.02);
    const again = nextRandomQuote(first.index, () => 0.02);
    expect(first.index).toBe(1);
    expect(again.index).not.toBe(first.index);
    expect(QUOTES.map((item) => item.text)).toContain(again.text);
  });
});
