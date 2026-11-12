import { describe, expect, it } from 'vitest';
import { TAG_PALETTE, canonicalTagColor, nextTagColor } from './tag-palette.js';
import { tagPillStyle } from './fixed-tags.js';

describe('tag palette', () => {
  it('lists the swatches from left to right, then the next row', () => {
    expect(TAG_PALETTE).toEqual([
      '#FFFFFF',
      '#A16C39',
      '#FC2D3E',
      '#FA6710',
      '#F79410',
      '#14C370',
      '#15B8A4',
      '#1784FC',
      '#915BFC',
      '#FB3399',
      '#777777'
    ]);
  });

  it('maps the previous palette onto this one', () => {
    expect(canonicalTagColor('#F5C400')).toBe('#F79410');
    expect(canonicalTagColor('#111111')).toBe('#777777');
    expect(canonicalTagColor('#1F9D8A')).toBe('#15B8A4');
    expect(canonicalTagColor('#E56B6F')).toBe('#FC2D3E');
    expect(canonicalTagColor('#3B6FE0')).toBe('#1784FC');
    expect(canonicalTagColor('#6BBF59')).toBe('#14C370');
    expect(canonicalTagColor('#8B7FD4')).toBe('#915BFC');
    expect(canonicalTagColor('#8E8E93')).toBe('#777777');
    expect(canonicalTagColor('#8E4A6B')).toBe('#FB3399');
    expect(canonicalTagColor('#D4923A')).toBe('#FA6710');
    expect(canonicalTagColor('#15b8a4')).toBe('#15B8A4');
  });

  it('gives a new tag the first color nobody is using', () => {
    expect(nextTagColor([])).toBe('#FFFFFF');
    expect(nextTagColor([{ color: '#FFFFFF' }, { color: '#A16C39' }])).toBe('#FC2D3E');
    expect(nextTagColor([{ color: '#1F9D8A' }])).toBe('#FFFFFF');
  });

  it('uses paper-colored text on the five light fills', () => {
    expect(tagPillStyle({ color: '#FFFFFF' }).color).toBe('#141414');
    expect(tagPillStyle({ color: '#F79410' }).color).toBe('#141414');
    expect(tagPillStyle({ color: '#14C370' }).color).toBe('#141414');
    expect(tagPillStyle({ color: '#1784FC' }).color).toBe('#ffffff');
    expect(tagPillStyle({ color: '#F5C400' })).toEqual({ background: '#F79410', color: '#141414' });
  });
});
