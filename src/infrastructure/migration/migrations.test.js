import { describe, it, expect } from 'vitest';
import { LocalStorageAdapter } from '../storage/local-storage-adapter.js';
import { ScheduleRepository } from '../storage/schedule-repository.js';
import { IdeaRepository } from '../storage/idea-repository.js';
import { migrateV0ToV1, migrateV1ToV2 } from './migrations.js';

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

describe('migrations', () => {
  it('v0→v1 keeps per-day ideas on the day', () => {
    const adapter = memAdapter({
      ceoSchedule: JSON.stringify({
        '2026-09-01': {
          required: [],
          optional: [],
          ideas: [
            { id: 'i1', text: 'Idea one', completed: false },
            { id: 'i2', text: 'Idea two', completed: false }
          ]
        }
      })
    });
    const scheduleRepo = new ScheduleRepository(adapter);
    const ideaRepo = new IdeaRepository(adapter);
    migrateV0ToV1(adapter, scheduleRepo, ideaRepo);
    const schedule = scheduleRepo.load();
    expect(schedule['2026-09-01'].ideas).toHaveLength(2);
    expect(schedule['2026-09-01'].ideas.map((n) => n.id).sort()).toEqual(['i1', 'i2']);
  });

  it('v1→v2 folds global ideas/milestones onto days', () => {
    const adapter = memAdapter({
      ceoSchedule: JSON.stringify({
        '2026-09-16': { required: [], optional: [], ideas: [], milestones: [] }
      }),
      ceoIdeas: JSON.stringify({
        version: 1,
        nodes: [
          {
            id: 'i1',
            text: 'from global',
            createdAt: Date.parse('2026-09-16T12:00:00'),
            completed: false,
            pinned: false,
            note: '',
            dueDate: null,
            dependsOn: []
          }
        ]
      }),
      ceoMilestones: JSON.stringify([
        { id: 'm1', title: 'Ship', date: '2026-09-21', completed: false }
      ]),
      ceoSchemaVersion: '1'
    });
    const scheduleRepo = new ScheduleRepository(adapter);
    const ideaRepo = new IdeaRepository(adapter);
    migrateV1ToV2(adapter, scheduleRepo, ideaRepo, null);
    const schedule = scheduleRepo.load();
    expect(schedule['2026-09-16'].ideas.some((n) => n.id === 'i1')).toBe(true);
    expect(schedule['2026-09-21'].milestones.some((m) => m.id === 'm1')).toBe(true);
    expect(ideaRepo.exists()).toBe(false);
    expect(adapter.getJson('ceoMilestones', null)).toBe(null);
    expect(adapter.getSchemaVersion()).toBe(2);
  });
});
