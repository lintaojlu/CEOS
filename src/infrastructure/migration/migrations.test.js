import { describe, it, expect } from 'vitest';
import { LocalStorageAdapter } from '../storage/local-storage-adapter.js';
import { ScheduleRepository } from '../storage/schedule-repository.js';
import { IdeaRepository } from '../storage/idea-repository.js';
import { migrateV0ToV1, migrateV1ToV2, migrateV2ToV3, migrateV3ToV4 } from './migrations.js';
import { WorkspaceRepository } from '../storage/workspace-repository.js';

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
    const schedule = adapter.getJson('ceoSchedule', {});
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
    const schedule = adapter.getJson('ceoSchedule', {});
    expect(schedule['2026-09-16'].ideas.some((n) => n.id === 'i1')).toBe(true);
    expect(schedule['2026-09-21'].milestones.some((m) => m.id === 'm1')).toBe(true);
    expect(ideaRepo.exists()).toBe(false);
    expect(adapter.getJson('ceoMilestones', null)).toBe(null);
    expect(adapter.getSchemaVersion()).toBe(2);
  });

  it('v2→v3 lifts ideas, milestones, and completed project tasks into the workspace', () => {
    const adapter = memAdapter({
      ceoSchedule: JSON.stringify({
        '2026-09-16': {
          required: [{ id: 't1', text: '把代码跑通', completed: false, projectId: 'p1', time: 1 }],
          optional: [],
          ideas: [{ id: 'i1', text: '灵感', completed: false }],
          milestones: [],
          projects: [{ id: 'p1', name: '垂搜知识图谱' }]
        },
        '2026-09-17': {
          required: [{ id: 't1', text: '把代码跑通', completed: true, projectId: 'p1', time: 2 }],
          optional: [],
          ideas: [],
          milestones: [{ id: 'm1', title: 'Ship', date: '2026-09-21', completed: false }],
          projects: [{ id: 'p1', name: '垂搜知识图谱' }]
        }
      }),
      ceoSchemaVersion: '2'
    });
    migrateV2ToV3(adapter);
    const workspace = new WorkspaceRepository(adapter).load();
    const schedule = adapter.getJson('ceoSchedule', {});
    expect(workspace.ideas.some((n) => n.id === 'i1')).toBe(true);
    expect(workspace.milestones.some((m) => m.id === 'm1')).toBe(true);
    const project = workspace.projects.find((p) => p.id === 'p1');
    expect(project.name).toBe('垂搜知识图谱');
    expect(project.tasks).toHaveLength(1);
    expect(project.tasks[0].id).toBe('t1');
    expect(project.tasks[0].completed).toBe(true);
    expect(project.tasks[0].text).toBe('把代码跑通');
    expect(schedule['2026-09-17'].ideas).toBeUndefined();
    expect(schedule['2026-09-17'].projects).toBeUndefined();
    expect(schedule['2026-09-17'].required[0].id).toBe('t1');
    expect(adapter.getSchemaVersion()).toBe(3);
  });

  it('v2→v3 folds same-named projects from different days into one', () => {
    const adapter = memAdapter({
      ceoSchedule: JSON.stringify({
        '2026-09-16': {
          required: [{ id: 't1', text: '把代码跑通', completed: true, projectId: 'p1' }],
          optional: [],
          projects: [{ id: 'p1', name: '垂搜知识图谱' }]
        },
        '2026-09-17': {
          required: [],
          optional: [],
          projects: [{ id: 'p2', name: '垂搜知识图谱' }]
        },
        '2026-09-18': {
          required: [
            { id: 't2', text: '写文档', completed: false, projectId: 'p3' },
            { id: 't3', text: '跑测试', completed: false, projectId: 'p3' }
          ],
          optional: [],
          projects: [{ id: 'p3', name: '垂搜知识图谱' }]
        }
      }),
      ceoSchemaVersion: '2'
    });
    migrateV2ToV3(adapter);
    const workspace = new WorkspaceRepository(adapter).load();
    const schedule = adapter.getJson('ceoSchedule', {});
    expect(workspace.projects).toHaveLength(1);
    expect(workspace.projects[0].id).toBe('p1');
    expect(workspace.projects[0].tasks.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    expect(schedule['2026-09-18'].required[0].projectId).toBe('p1');
  });

  it('v3→v4 merges duplicate project names and rewrites daily project ids', () => {
    const adapter = memAdapter({
      ceoSchemaVersion: '3',
      ceoWorkspace: JSON.stringify({
        ideas: [],
        milestones: [],
        projects: [
          {
            id: 'p1',
            name: '垂搜知识图谱',
            tasks: [{ id: 't1', text: '把代码跑通', completed: true, list: 'required', subtasks: [] }]
          },
          { id: 'p2', name: '垂搜知识图谱', tasks: [] },
          {
            id: 'p3',
            name: '垂搜知识图谱',
            tasks: [
              { id: 't2', text: '写文档', completed: false, list: 'required', subtasks: [] },
              { id: 't1', text: '把代码跑通', completed: false, list: 'required', subtasks: [{ id: 's1', text: '步骤', completed: true }] }
            ]
          }
        ]
      }),
      ceoSchedule: JSON.stringify({
        '2026-09-16': {
          required: [{ id: 't1', text: '把代码跑通', completed: true, projectId: 'p1' }],
          optional: []
        },
        '2026-09-18': {
          required: [{ id: 't2', text: '写文档', completed: false, projectId: 'p3' }],
          optional: []
        }
      })
    });
    migrateV3ToV4(adapter);
    const workspace = new WorkspaceRepository(adapter).load();
    const schedule = adapter.getJson('ceoSchedule', {});
    expect(workspace.projects).toHaveLength(1);
    expect(workspace.projects[0].name).toBe('垂搜知识图谱');
    expect(workspace.projects[0].tasks.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(workspace.projects[0].tasks[0].completed).toBe(true);
    expect(workspace.projects[0].tasks[0].subtasks[0].completed).toBe(true);
    expect(schedule['2026-09-18'].required[0].projectId).toBe('p1');
    expect(adapter.getSchemaVersion()).toBe(4);
  });
});
