import { IdeaPickupParseError, IDEA_PICKUP_SYSTEM, buildIdeaPickupPrompt, parseIdeaPickup } from '../domain/ideas/idea-pickup.js';
import { createDailyTask } from '../domain/schedule/daily-task.js';
import { parseDateKey, todayKey } from '../domain/shared/date-key.js';

/**
 * 用设置里的默认模型把一条灵感拆成今天的必做。确认后才写入，并删掉灵感文件。
 */
export class IdeaPickupService {
  /**
   * @param {object} deps
   * @param {import('./idea-inbox-service.js').IdeaInboxService} deps.ideaInboxService
   * @param {import('./schedule-service.js').ScheduleService} deps.scheduleService
   * @param {{ complete: (input: { system?: string, user: string }) => Promise<string> }} deps.llmService
   * @param {() => string} [deps.now]
   */
  constructor({ ideaInboxService, scheduleService, llmService, now = todayKey }) {
    this.ideaInboxService = ideaInboxService;
    this.scheduleService = scheduleService;
    this.llmService = llmService;
    this.now = now;
  }

  /** @param {string} ideaId */
  async preview(ideaId) {
    const idea = this.ideaInboxService.getNodes().find((node) => node.id === ideaId);
    if (!idea) throw new IdeaPickupParseError('灵感不存在');
    const user = buildIdeaPickupPrompt(idea);
    const text = await this.llmService.complete({ system: IDEA_PICKUP_SYSTEM, user });
    return { ideaId, tasks: parseIdeaPickup(text), prompt: user };
  }

  /**
   * @param {string} ideaId
   * @param {{ title: string, note: string }[]} tasks
   */
  commit(ideaId, tasks) {
    const parsed = parseIdeaPickup(JSON.stringify(tasks));
    const idea = this.ideaInboxService.getNodes().find((node) => node.id === ideaId);
    if (!idea) throw new IdeaPickupParseError('灵感不存在');
    const date = this.now();
    const base = parseDateKey(date) || new Date();
    for (const item of parsed) {
      const task = createDailyTask(item.title, base, { note: item.note });
      this.scheduleService.insertTaskOnDate(date, 'required', task);
    }
    this.ideaInboxService.delete(ideaId);
    return { date, count: parsed.length };
  }
}
