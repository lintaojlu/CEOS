/**
 * 用设置里的标准化模型精简当前查看日这条任务的标题，并把原标题插进说明。
 * 这一行空着时用默认模型。没抽出新标题时不改这条任务。
 */

import { LlmRequestError } from './llm-service.js';
import { normalizeNotes } from '../domain/schedule/daily-task.js';
import {
  STANDARDIZE_SYSTEM,
  buildStandardizePrompt,
  prependOriginalTitle,
  titleFromModel
} from '../domain/schedule/task-standardize.js';

export class TaskStandardizeService {
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
   * @returns {Promise<boolean>} 标题是否换成了新的
   */
  async standardize(type, taskId) {
    const dateKey = this.scheduleService.getDateKey();
    const task = this.scheduleService.findTaskOnDate(dateKey, type, taskId);
    if (!task) throw new Error('这条任务已经不在了');

    const title = String(task.text || '').trim();
    if (!title) return false;
    const notes = normalizeNotes(task.notes, { note: task.note, subtasks: task.subtasks }).map((note) => note.text);
    let raw = '';
    try {
      raw = await this.llmService.complete({
        slot: 'standardizeModel',
        maxTokens: 64,
        system: STANDARDIZE_SYSTEM,
        user: buildStandardizePrompt({ title, notes })
      });
    } catch (error) {
      if (error instanceof LlmRequestError && error.code === 'not-configured') throw error;
      throw new Error(error?.message || '标准化失败');
    }

    const nextTitle = titleFromModel(raw);
    if (!nextTitle) throw new Error('没有得到可用的标题');
    if (nextTitle === title) return false;

    const fresh = this.scheduleService.findTaskOnDate(dateKey, type, taskId);
    if (!fresh) throw new Error('这条任务已经不在了');
    const nextNotes = prependOriginalTitle(
      normalizeNotes(fresh.notes, { note: fresh.note, subtasks: fresh.subtasks }),
      title
    );
    const saved = this.scheduleService.updateTaskOnDate(dateKey, type, taskId, {
      text: nextTitle,
      notes: nextNotes
    });
    if (!saved) throw new Error('这条任务已经不在了');
    return true;
  }
}
