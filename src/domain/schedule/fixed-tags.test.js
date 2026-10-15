import { describe, expect, it } from 'vitest';
import { tagsVisibleOnDay } from './fixed-tags.js';

const life = { id: 'tag-life', name: '生活', color: '#F5C400' };
const work = { id: 'tag-work', name: '工作', color: '#111111' };
const ceos = { id: 'ceos', name: 'CEOS', color: '#3366cc' };
const climb = { id: 'climb', name: '攀岩项目', color: '#cc6633' };

describe('tagsVisibleOnDay', () => {
  it('keeps 生活 and 工作 on a day with no other tags in use', () => {
    const visible = tagsVisibleOnDay([life, work, ceos], {
      required: [{ id: 'a', text: '买菜', tagIds: [] }],
      optional: []
    });
    expect(visible.map((tag) => tag.name)).toEqual(['生活', '工作']);
  });

  it('shows a tag only when that day has a task carrying it', () => {
    const visible = tagsVisibleOnDay([life, work, ceos, climb], {
      required: [{ id: 'a', text: '改日程', tagIds: ['ceos'] }],
      optional: [{ id: 'b', text: '休息', tagIds: ['tag-life'] }]
    });
    expect(visible.map((tag) => tag.name)).toEqual(['生活', '工作', 'CEOS']);
  });

  it('hides a tag that only appears on another day', () => {
    const catalog = [life, work, ceos];
    const today = tagsVisibleOnDay(catalog, { required: [], optional: [] });
    const tomorrow = tagsVisibleOnDay(catalog, {
      required: [{ id: 'a', text: '改日程', tagId: 'ceos' }],
      optional: []
    });
    expect(today.map((tag) => tag.id)).toEqual(['tag-life', 'tag-work']);
    expect(tomorrow.map((tag) => tag.id)).toEqual(['tag-life', 'tag-work', 'ceos']);
  });
});
