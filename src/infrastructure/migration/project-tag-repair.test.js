import { describe, it, expect, vi } from 'vitest';
import { LocalStorageAdapter } from '../storage/local-storage-adapter.js';
import { applyProjectTagRepair } from './project-tag-repair.js';
import { TAG_PALETTE } from '../../domain/schedule/tag-palette.js';

function memAdapter(seed = {}) {
  const store = { ...seed };
  return new LocalStorageAdapter({
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    }
  });
}

const payload = {
  tags: [
    { id: 'p1', name: '垂搜知识图谱', color: TAG_PALETTE[0] },
    { id: 'p2', name: '攀岩项目', color: TAG_PALETTE[1] },
    { id: 'p3', name: 'ceos', color: TAG_PALETTE[2] }
  ],
  copies: {
    '2026-10-08|required|t1': 'p1',
    '2026-10-08|required|t2': 'p3'
  },
  taskTag: {
    t1: 'p1',
    t2: 'p3'
  },
  orphans: [
    { id: 'orphan', text: '实现ai', completed: false, note: '', tagId: 'p2', subtasks: [] }
  ]
};

describe('applyProjectTagRepair', () => {
  it('puts the original projects back as tags and relinks daily tasks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T12:00:00'));
    const adapter = memAdapter({
      ceoWorkspace: JSON.stringify({
        ideas: [{ id: 'i1', text: '灵感' }],
        milestones: [],
        tags: [
          { id: 'new-a', name: '腾讯', color: TAG_PALETTE[0] },
          { id: 'new-ceos', name: 'ceos', color: TAG_PALETTE[1] }
        ]
      }),
      ceoSchedule: JSON.stringify({
        '2026-10-08': {
          required: [
            { id: 't1', text: '自建知识库技术方案', completed: true, tagId: '' },
            { id: 't2', text: '灵感（笔记）优化，增加多模态', completed: false, tagId: 'new-ceos' }
          ],
          optional: []
        },
        '2026-09-21': {
          required: [
            { id: 't1', text: '【腾讯】自建知识库技术方案', completed: false, tagId: 'p1' }
          ],
          optional: []
        }
      })
    });

    expect(applyProjectTagRepair(adapter, payload)).toBe(true);

    const workspace = adapter.getJson('ceoWorkspace', {});
    const schedule = adapter.getJson('ceoSchedule', {});
    expect(workspace.tags.map((tag) => tag.name)).toEqual(['垂搜知识图谱', '攀岩项目', 'ceos', '腾讯']);
    expect(workspace.tags[0].id).toBe('p1');
    expect(workspace.tags[2].id).toBe('p3');
    expect(workspace.tags[3].color).toBe(TAG_PALETTE[3]);
    expect(workspace.ideas[0].id).toBe('i1');
    expect(schedule['2026-10-08'].required[0].tagIds).toEqual(['p1']);
    expect(schedule['2026-10-08'].required[1].tagIds).toEqual(['p3']);
    expect(schedule['2026-09-21'].required[0].tagIds).toEqual([]);
    const orphan = schedule['2026-10-09'].required.find((task) => task.id === 'orphan');
    expect(orphan.text).toBe('实现ai');
    expect(orphan.tagIds).toEqual(['p2']);

    expect(applyProjectTagRepair(adapter, payload)).toBe(false);
    const kept = adapter.getJson('ceoWorkspace', {});
    kept.tags = kept.tags.filter((tag) => tag.id !== 'p2');
    adapter.setJson('ceoWorkspace', kept);
    expect(applyProjectTagRepair(adapter, payload)).toBe(false);
    expect(adapter.getJson('ceoWorkspace', {}).tags.map((tag) => tag.id)).not.toContain('p2');
    vi.useRealTimers();
  });
});
