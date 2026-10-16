import { describe, expect, it } from 'vitest';
import { EventBus } from './event-bus.js';
import { JevService } from './jev-service.js';
import { LlmService } from './llm-service.js';
import { ScheduleService } from './schedule-service.js';
import { TaskBreakdownService } from './task-breakdown-service.js';
import { TaskIntakeService } from './task-intake-service.js';
import { TaskStandardizeService } from './task-standardize-service.js';
import { TaskTagService } from './task-tag-service.js';
import { LocalStorageAdapter } from '../infrastructure/storage/local-storage-adapter.js';
import { ScheduleRepository } from '../infrastructure/storage/schedule-repository.js';
import { WorkspaceRepository } from '../infrastructure/storage/workspace-repository.js';
import { DEFAULT_JEV_MODEL } from '../infrastructure/storage/llm-settings-repository.js';
import { AI_TASK_TITLE, HUMAN_TASK_TITLE } from '../domain/schedule/task-breakdown.js';
import { JEV_QUESTIONS } from '../domain/schedule/task-jev.js';

function createSchedule() {
  const store = {};
  const adapter = new LocalStorageAdapter({
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; }
  });
  const service = new ScheduleService({
    scheduleRepo: new ScheduleRepository(adapter),
    workspaceRepo: new WorkspaceRepository(adapter),
    eventBus: new EventBus()
  });
  service.load();
  return service;
}

function llm(settings, chat) {
  return new LlmService({
    settingsRepo: { load: () => settings, save: (next) => next },
    eventBus: new EventBus(),
    chat
  });
}

const chatSettings = {
  baseUrl: 'https://example.com/v1',
  fullUrl: false,
  apiKey: 'k',
  model: 'big',
  tagModel: 'tagger',
  standardizeModel: 'short',
  breakdownModel: 'splitter'
};

const jevSettings = {
  jevApiKey: 'ts-key',
  jevBaseUrl: 'https://api.typesafe.ai/v1',
  jevModel: ''
};

/**
 * @param {string} system
 * @returns {'tag'|'standardize'|'breakdown'|''}
 */
function kindOf(system) {
  if (system.includes('"project"')) return 'tag';
  if (system.includes('"title"')) return 'standardize';
  if (system.includes('两条说明')) return 'breakdown';
  return '';
}

/**
 * @param {import('./schedule-service.js').ScheduleService} schedule
 * @param {object} [options]
 */
function createIntake(schedule, options = {}) {
  const calls = [];
  const evaluations = [];
  const replies = {
    tag: '{"project":"日程"}',
    standardize: '{"title":"对一下菜单"}',
    breakdown: '人类任务\n亲手做\n\nAI任务\n交给代理',
    ...options.replies
  };
  const answers = {
    standardize: { type: 'noul', noul: 0.2 },
    breakdown: { type: 'noul', noul: 0.2 },
    ...options.answers
  };
  const chat = async (input) => {
    const kind = kindOf(input.system);
    calls.push({ kind, ...input });
    if (options.fail?.has(kind)) throw new Error(`${kind}失败`);
    return replies[kind];
  };
  const languageModel = llm(chatSettings, chat);
  const jevService = options.jevService || new JevService({
    settingsRepo: { load: () => ({ ...jevSettings, ...options.jevSettings }) },
    evaluate: async (input) => {
      evaluations.push(input);
      if (options.failJev) throw new Error('JEV 失败');
      return { model: 'jev-1.13.0', answers };
    }
  });
  const service = new TaskIntakeService({
    scheduleService: schedule,
    jevService,
    taskTagService: options.taskTagService || new TaskTagService({ scheduleService: schedule, llmService: languageModel }),
    taskStandardizeService: options.taskStandardizeService || new TaskStandardizeService({ scheduleService: schedule, llmService: languageModel }),
    taskBreakdownService: options.taskBreakdownService || new TaskBreakdownService({ scheduleService: schedule, llmService: languageModel })
  });
  return { service, calls, evaluations };
}

describe('TaskIntakeService', () => {
  it('classifies first, then asks both questions about the tagged task in one request', async () => {
    const schedule = createSchedule();
    const life = schedule.addTag('生活');
    const task = schedule.addTask('required', '下午跟张三对一下标签菜单', [life.id]);
    schedule.addNote('required', task.id, '确认说明会不会丢');
    const { service, calls, evaluations } = createIntake(schedule);

    await service.settle('required', task.id);

    expect(calls.map((call) => call.kind)).toEqual(['tag']);
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0].model).toBe(DEFAULT_JEV_MODEL);
    expect(evaluations[0].questions).toBe(JEV_QUESTIONS);
    expect(evaluations[0].state).toEqual({
      title: '下午跟张三对一下标签菜单',
      notes: ['确认说明会不会丢'],
      projects: ['生活', '日程']
    });
    expect(schedule.getCurrentData().required[0].text).toBe('下午跟张三对一下标签菜单');
  });

  it('standardizes before breakdown when both nouls are high enough', async () => {
    const schedule = createSchedule();
    const task = schedule.addTask('required', '下午跟张三对一下标签菜单，确认说明会不会丢');
    const { service, calls } = createIntake(schedule, {
      answers: {
        standardize: { type: 'noul', noul: 0.5 },
        breakdown: { type: 'noul', noul: 0.8 }
      }
    });

    await service.settle('required', task.id);
    expect(calls.map((call) => call.kind)).toEqual(['tag', 'standardize', 'breakdown']);
    const saved = schedule.getCurrentData().required[0];
    expect(saved.text).toBe('对一下菜单');
    expect(calls.find((call) => call.kind === 'breakdown').user).toContain('标题：对一下菜单');
    expect(saved.notes.map((note) => note.text.split('\n')[0])).toEqual([
      '下午跟张三对一下标签菜单，确认说明会不会丢',
      HUMAN_TASK_TITLE,
      AI_TASK_TITLE
    ]);
  });

  it('runs only the action whose noul clears the threshold', async () => {
    const schedule = createSchedule();
    const task = schedule.addTask('required', '下午跟张三对一下标签菜单，确认说明会不会丢');
    const { service } = createIntake(schedule, {
      answers: {
        standardize: { type: 'noul', noul: 0.9 },
        breakdown: { type: 'noul', noul: 0.49 }
      }
    });

    await service.settle('required', task.id);
    const saved = schedule.getCurrentData().required[0];
    expect(saved.text).toBe('对一下菜单');
    expect(saved.notes.map((note) => note.text)).toEqual(['下午跟张三对一下标签菜单，确认说明会不会丢']);
  });

  it('breaks down without standardizing when only that noul is high enough', async () => {
    const schedule = createSchedule();
    const task = schedule.addTask('required', '买菜');
    const { service } = createIntake(schedule, {
      answers: {
        standardize: { type: 'choice', choice: 'yes' },
        breakdown: { type: 'noul', noul: 1 }
      }
    });

    await service.settle('required', task.id);
    const saved = schedule.getCurrentData().required[0];
    expect(saved.text).toBe('买菜');
    expect(saved.notes.map((note) => note.text.split('\n')[0])).toEqual([HUMAN_TASK_TITLE, AI_TASK_TITLE]);
  });

  it('still judges after classification fails, and still breaks down after standardization fails', async () => {
    const schedule = createSchedule();
    const task = schedule.addTask('required', '买菜');
    let brokeDown = false;
    const { service, evaluations } = createIntake(schedule, {
      answers: {
        standardize: { type: 'noul', noul: 0.9 },
        breakdown: { type: 'noul', noul: 0.9 }
      },
      taskTagService: { createForTask: async () => { throw new Error('分类失败'); } },
      taskStandardizeService: { standardize: async () => { throw new Error('标准化失败'); } },
      taskBreakdownService: { breakdown: async () => { brokeDown = true; } }
    });

    await expect(service.settle('required', task.id)).resolves.toBeUndefined();
    expect(evaluations).toHaveLength(1);
    expect(brokeDown).toBe(true);
    expect(schedule.getCurrentData().required[0].text).toBe('买菜');
  });

  it('stops before breakdown when the task disappears during standardization', async () => {
    const schedule = createSchedule();
    const task = schedule.addTask('required', '买菜');
    let brokeDown = false;
    const { service } = createIntake(schedule, {
      answers: {
        standardize: { type: 'noul', noul: 0.9 },
        breakdown: { type: 'noul', noul: 0.9 }
      },
      taskStandardizeService: { standardize: async () => { schedule.deleteTask('required', task.id); } },
      taskBreakdownService: { breakdown: async () => { brokeDown = true; } }
    });

    await service.settle('required', task.id);
    expect(brokeDown).toBe(false);
    expect(schedule.getCurrentData().required).toEqual([]);
  });

  it('sends a chosen model id and skips the request when the key is empty', async () => {
    const schedule = createSchedule();
    const named = schedule.addTask('required', '买菜');
    const chosen = createIntake(schedule, { jevSettings: { jevModel: 'jev-1.14.0' } });
    await chosen.service.settle('required', named.id);
    expect(chosen.evaluations[0].model).toBe('jev-1.14.0');

    const quiet = schedule.addTask('optional', '散步');
    const skipped = createIntake(schedule, { jevSettings: { jevApiKey: '' } });
    await skipped.service.settle('optional', quiet.id);
    expect(skipped.evaluations).toEqual([]);
    expect(schedule.getCurrentData().optional[0].text).toBe('散步');
  });

  it('does nothing when the task is already gone', async () => {
    const schedule = createSchedule();
    const task = schedule.addTask('required', '买菜');
    const { service, evaluations } = createIntake(schedule, {
      taskTagService: { createForTask: async () => { schedule.deleteTask('required', task.id); } }
    });

    await expect(service.settle('required', 'missing')).resolves.toBeUndefined();
    await service.settle('required', task.id);
    expect(evaluations).toEqual([]);
  });

  it('skips both actions when the decision request fails', async () => {
    const schedule = createSchedule();
    const task = schedule.addTask('required', '下午跟张三对一下标签菜单');
    const { service } = createIntake(schedule, { failJev: true });

    await service.settle('required', task.id);
    expect(schedule.getCurrentData().required[0].text).toBe('下午跟张三对一下标签菜单');
    expect(schedule.getCurrentData().required[0].notes).toEqual([]);
  });
});
