/**
 * 用设置里的小模型，根据任务标题生成标签名，并挂到当前查看日的这一条上。
 */

import { LlmRequestError } from './llm-service.js';
import { TAG_NAME_SYSTEM, buildTagNamePrompt, tagNameFromModel } from '../domain/schedule/tag-name.js';

export class TaskTagService {
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
   * @returns {Promise<string>}
   */
  async createForTask(type, taskId) {
    const dateKey = this.scheduleService.getDateKey();
    const task = this.scheduleService.findTaskOnDate(dateKey, type, taskId);
    if (!task) throw new Error('这条任务已经不在了');

    const title = String(task.text || '').trim();
    let raw = '';
    try {
      raw = await this.llmService.completeSmall({
        system: TAG_NAME_SYSTEM,
        user: buildTagNamePrompt(title)
      });
    } catch (error) {
      if (error instanceof LlmRequestError && error.code === 'not-configured') throw error;
      raw = '';
    }
    const name = tagNameFromModel(raw, title);
    if (!name) throw new Error('没有得到可用的标签名');

    const saved = this.scheduleService.attachTagNamed(type, taskId, name, dateKey);
    if (!saved) throw new Error('这条任务已经不在了');
    return name;
  }
}
