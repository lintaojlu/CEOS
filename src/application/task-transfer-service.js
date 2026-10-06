/**
 * 任务在必做、选做、灵感之间移动。界面只负责拖拽事件。
 */

export class TaskTransferService {
  /**
   * @param {object} deps
   * @param {import('./schedule-service.js').ScheduleService} deps.scheduleService
   * @param {import('./idea-inbox-service.js').IdeaInboxService} deps.ideaInboxService
   */
  constructor({ scheduleService, ideaInboxService }) {
    this.scheduleService = scheduleService;
    this.ideaInboxService = ideaInboxService;
  }

  /**
   * @param {{ from: 'required'|'optional'|'ideas', id: string, to: 'required'|'optional'|'ideas' }} move
   * @returns {{ ok: boolean, error?: string }}
   */
  transfer({ from, id, to }) {
    if (!from || !to || !id || from === to) return { ok: true };

    if (to === 'ideas' && (from === 'required' || from === 'optional')) {
      const task = this.scheduleService.takeTask(from, id);
      if (task) this.ideaInboxService.deferFromDaily(task);
      return { ok: true };
    }

    if (from === 'ideas' && (to === 'required' || to === 'optional')) {
      const result = this.ideaInboxService.pickUp(id, to);
      if (result && result.error) return { ok: false, error: result.error };
      if (!result) return { ok: false, error: '这条灵感不存在' };
      return { ok: true };
    }

    if ((from === 'required' || from === 'optional') && (to === 'required' || to === 'optional')) {
      this.scheduleService.moveTask(from, id, to);
      return { ok: true };
    }

    return { ok: false, error: '不支持这样移动' };
  }
}
