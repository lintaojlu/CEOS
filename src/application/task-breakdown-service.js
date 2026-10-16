/**
 * 用已有的模型设置，把一条任务拆成两条说明并写回该任务所在的那一天。
 */

import { normalizeNotes, normalizeTagIds } from '../domain/schedule/daily-task.js';
import {
  BREAKDOWN_SYSTEM,
  buildBreakdownPrompt,
  parseBreakdown,
  replaceBreakdownNotes,
  selectRelatedTasks
} from '../domain/schedule/task-breakdown.js';

export class TaskBreakdownService {
  /**
   * @param {object} deps
   * @param {import('./schedule-service.js').ScheduleService} deps.scheduleService
   * @param {import('./llm-service.js').LlmService} deps.llmService
   */
  constructor({ scheduleService, llmService }) {
    this.scheduleService = scheduleService;
    this.llmService = llmService;
  }

  /**
   * @param {'required'|'optional'} type
   * @param {string} taskId
   * @returns {Promise<Array<{ id: string, text: string }>>}
   */
  async breakdown(type, taskId) {
    const dateKey = this.scheduleService.getDateKey();
    const task = this.scheduleService.findTaskOnDate(dateKey, type, taskId);
    if (!task) throw new Error('这条任务已经不在了');

    const tags = this.scheduleService.workspace?.tags || [];
    const nameById = new Map(tags.map((tag) => [tag.id, tag.name]));
    const tagIds = normalizeTagIds(task);
    const related = selectRelatedTasks({
      days: this.scheduleService.data,
      taskId,
      tagIds
    });
    const notes = normalizeNotes(task.notes, { note: task.note, subtasks: task.subtasks });
    const user = buildBreakdownPrompt({
      title: task.text || '',
      tagNames: namesFor(tagIds, nameById),
      notes: notes.map((note) => note.text),
      related: related.map((item) => ({
        dateKey: item.dateKey,
        text: item.text,
        completed: item.completed,
        tagNames: namesFor(item.tagIds, nameById)
      }))
    });

    const raw = await this.llmService.complete({ system: BREAKDOWN_SYSTEM, user });
    const parsed = parseBreakdown(raw);

    const fresh = this.scheduleService.findTaskOnDate(dateKey, type, taskId);
    if (!fresh) throw new Error('这条任务已经不在了');
    const next = replaceBreakdownNotes(
      normalizeNotes(fresh.notes, { note: fresh.note, subtasks: fresh.subtasks }),
      parsed.humanBody,
      parsed.aiBody
    );
    const saved = this.scheduleService.setTaskNotes(dateKey, type, taskId, next);
    if (!saved) throw new Error('这条任务已经不在了');
    return saved.notes;
  }
}

/**
 * @param {string[]} ids
 * @param {Map<string, string>} nameById
 * @returns {string[]}
 */
function namesFor(ids, nameById) {
  return ids.map((id) => nameById.get(id)).filter(Boolean);
}
