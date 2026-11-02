/**
 * 两条任务合成框之后，用创建标签的模型补一个不超过 12 字的标题。
 * 标题如果已经被改过，就不再覆盖。
 */

import { LlmRequestError } from './llm-service.js';
import { GROUP_TITLE_SYSTEM, buildGroupTitlePrompt, titleFromModel } from '../domain/schedule/task-group.js';

export class TaskGroupService {
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
   * @param {string} groupId
   * @param {string} fallback
   * @param {string[]} titles
   */
  async name(type, groupId, fallback, titles) {
    let raw = '';
    try {
      raw = await this.llmService.complete({
        slot: 'tagModel',
        maxTokens: 64,
        system: GROUP_TITLE_SYSTEM,
        user: buildGroupTitlePrompt(titles)
      });
    } catch (error) {
      if (error instanceof LlmRequestError && error.code === 'not-configured') return null;
      return null;
    }
    const title = titleFromModel(raw);
    if (!title) return null;
    return this.scheduleService.renameGroupIfFallback(type, groupId, title, fallback);
  }
}
