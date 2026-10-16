import { describe, expect, it } from 'vitest';
import { tagsVisibleOnDay } from './fixed-tags.js';

const life = { id: 'tag-life', name: '生活', color: '#F5C400' };
const work = { id: 'tag-work', name: '工作', color: '#111111' };
const ceos = { id: 'ceos', name: 'CEOS', color: '#3366cc' };
const climb = { id: 'climb', name: '攀岩项目', color: '#cc6633' };

describe('tagsVisibleOnDay', () => {
  it('hides 生活 and 工作 when the day has no task on them and they are not pinned', () => {
    const visible = tagsVisibleOnDay([life, work, ceos], {
      required: [{ id: 'a', text: '买菜', tagIds: [] }],
      optional: []
    });
    expect(visible).toEqual([]);
  });

  it('shows a tag only when that day has a task carrying it', () => {
    const visible = tagsVisibleOnDay([life, work, ceos, climb], {
      required: [{ id: 'a', text: '改日程', tagIds: ['ceos'] }],
      optional: [{ id: 'b', text: '休息', tagIds: ['tag-life'] }]
    });
    expect(visible.map((tag) => tag.name)).toEqual(['生活', 'CEOS']);
    expect(visible.map((tag) => tag.id)).toEqual(['tag-life', 'ceos']);
  });

  it('keeps a pinned tag on a day that has no task carrying it', () => {
    const pinned = { ...work, pinned: true };
    const today = tagsVisibleOnDay([life, pinned, ceos], { required: [], optional: [] });
    const tomorrow = tagsVisibleOnDay([life, pinned, ceos], {
      required: [{ id: 'a', text: '改日程', tagId: 'ceos' }],
      optional: []
    });
    expect(today.map((tag) => tag.id)).toEqual(['tag-work']);
    expect(tomorrow.map((tag) => tag.id)).toEqual(['tag-work', 'ceos']);
  });
});
