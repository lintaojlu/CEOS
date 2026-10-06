/**
 * 把当天任务整理成日报提示词，调用 LLM，写回当天的 aiEval。
 */

import { buildDailyReportPrompt, DAILY_REPORT_SYSTEM } from '../domain/report/daily-report-prompt.js';
import { Events } from './event-bus.js';

export class DailyReportService {
  /**
   * @param {object} deps
   * @param {import('./schedule-service.js').ScheduleService} deps.scheduleService
   * @param {import('./idea-inbox-service.js').IdeaInboxService} deps.ideaInboxService
   * @param {import('./llm-service.js').LlmService} deps.llmService
   * @param {import('./event-bus.js').EventBus} deps.eventBus
   */
  constructor({ scheduleService, ideaInboxService, llmService, eventBus }) {
    this.scheduleService = scheduleService;
    this.ideaInboxService = ideaInboxService;
    this.llmService = llmService;
    this.eventBus = eventBus;
  }

  /** @returns {Promise<string>} */
  async generate() {
    const data = this.scheduleService.getCurrentData();
    const workspace = this.scheduleService.workspace || {};
    const prompt = buildDailyReportPrompt({
      dateKey: this.scheduleService.getDateKey(),
      required: (data.required || []).map((task) => this._taskInput(task)),
      optional: (data.optional || []).map((task) => this._taskInput(task)),
      ideas: (this.ideaInboxService.getNodes() || []).filter(Boolean).map((idea) => ({
        text: idea.text,
        completed: idea.completed,
        note: idea.note,
        dueDate: idea.dueDate || ''
      })),
      projects: (workspace.projects || []).map((project) => ({
        name: project.name,
        tasks: (project.tasks || []).map((task) => ({ text: task.text, completed: !!task.completed }))
      })),
      milestones: (workspace.milestones || []).map((item) => ({
        title: item.title,
        date: item.date,
        completed: !!item.completed
      })),
      reflection: data.reflection || ''
    });
    const text = await this.llmService.complete({ system: DAILY_REPORT_SYSTEM, user: prompt });
    this.scheduleService.setAiEval(text);
    this.eventBus.emit(Events.REPORT_UPDATED, { dateKey: this.scheduleService.getDateKey() });
    return text;
  }

  /** @param {import('../domain/schedule/daily-task.js').DailyTask} task */
  _taskInput(task) {
    return {
      label: this.scheduleService.taskTitle(task),
      completed: !!task.completed,
      note: task.note || ''
    };
  }
}
