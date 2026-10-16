import { ideaBody, ideaTitle, markdownForModel } from '../domain/ideas/idea-document.js';
import { partitionIdeas } from '../domain/ideas/readiness.js';
import { todayKey } from '../domain/shared/date-key.js';
import { applyProposal } from '../domain/agent/apply.js';
import {
  noteDetailDate,
  readListDay,
  readListTags,
  readNearMilestones,
  readOpenDays,
  readOpenTasks,
  readReadyIdeas
} from '../domain/agent/reads.js';
import { READ_NAMES } from '../domain/agent/catalog.js';
import { AGENT_CONTEXT_TEMPLATE } from '../domain/agent/prompt.js';
import { buildAgentContext } from '../domain/agent/context.js';
import {
  applyTurnOverrides,
  dropStaged,
  editStaged,
  moveStaged,
  rowFromCall,
  stageWrite,
  validateProposal
} from '../domain/agent/writes.js';
import { Events } from './event-bus.js';

export class AgentRuntime {
  /**
   * @param {object} deps
   * @param {import('./schedule-service.js').ScheduleService} deps.scheduleService
   * @param {import('./idea-inbox-service.js').IdeaInboxService} deps.ideaInboxService
   * @param {import('./milestone-service.js').MilestoneService} deps.milestoneService
   */
  constructor({ scheduleService, ideaInboxService, milestoneService }) {
    this.scheduleService = scheduleService;
    this.ideaInboxService = ideaInboxService;
    this.milestoneService = milestoneService;
    this.rowSerial = 0;
  }

  world() {
    const ideas = this.ideaInboxService.getNodes();
    const schedule = this.scheduleService.data;
    const today = todayKey();
    const dayKey = this.scheduleService.getDateKey();
    const ready = partitionIdeas(ideas, { schedule, ideas, todayKey: today, dayKey: today }).ready;
    return {
      tagIds: (this.scheduleService.workspace.tags || []).map((tag) => tag.id),
      tags: this.scheduleService.workspace.tags || [],
      ideas,
      readyIds: ready.map((idea) => idea.id),
      schedule,
      viewedKey: dayKey,
      today
    };
  }

  /**
   * @param {string} name
   * @param {any} args
   * @param {string[]} detailDates
   */
  read(name, args, detailDates) {
    const world = this.world();
    const date = String(args?.date || '').trim();
    if (!READ_NAMES.has(name)) return { ok: false, error: '没有这个函数', detailDates };
    if (name === 'list_tags') return { ok: true, data: readListTags(world.tags), detailDates };
    if (name === 'list_ready_ideas') {
      return {
        ok: true,
        data: readReadyIdeas(world.ideas, world.schedule, world.today, world.today),
        detailDates
      };
    }
    if (name === 'read_idea') {
      const id = String(args?.ideaId || '').trim();
      const idea = (world.ideas || []).find((item) => item.id === id);
      if (!idea) return { ok: false, error: '灵感不存在', detailDates };
      return {
        ok: true,
        data: {
          id: idea.id,
          title: ideaTitle(idea),
          body: markdownForModel(ideaBody(idea)),
          completed: !!idea.completed,
          pinned: !!idea.pinned
        },
        detailDates
      };
    }
    if (name === 'list_day') return { ok: true, data: readListDay(world.schedule, date), detailDates };
    if (name === 'list_open_days') {
      return { ok: true, data: readOpenDays(world.schedule, ''), detailDates };
    }
    if (name === 'list_open_tasks') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: '日期无效', detailDates };
      const noted = noteDetailDate(detailDates, date);
      if (!noted.ok) return { ok: false, error: noted.error, detailDates };
      return { ok: true, data: readOpenTasks(world.schedule, date), detailDates: noted.used };
    }
    if (name === 'list_near_milestones') {
      return {
        ok: true,
        data: readNearMilestones(this.milestoneService.listAll(), date || world.today),
        detailDates
      };
    }
    return { ok: false, error: '没有这个函数', detailDates };
  }

  /**
   * @param {{ writableDates?: string[] }} turn
   */
  contextFor(turn) {
    const world = this.world();
    return buildAgentContext(AGENT_CONTEXT_TEMPLATE, {
      today: world.today,
      tags: world.tags,
      schedule: world.schedule,
      ideas: world.ideas,
      milestones: this.milestoneService.listAll(),
      writableDates: turn?.writableDates || []
    });
  }

  stage(staged, name, raw, turn) {
    const world = this.world();
    const prepared = applyTurnOverrides(name, raw, world, turn || {});
    if (!prepared.ok) return { ok: false, error: prepared.error, staged };
    this.rowSerial += 1;
    const call = {
      id: `row-${this.rowSerial}`,
      name,
      args: prepared.args,
      allowCreate: turn.allowCreate === true,
      allowRemove: turn.allowRemove === true,
      capped: turn.requiredCap != null,
      cap: turn.requiredCap ?? 0,
      writableDates: turn.writableDates || []
    };
    return stageWrite(staged, call, world);
  }

  /** @param {any[]} staged */
  commit(staged) {
    const world = this.world();
    const checked = validateProposal(staged, world);
    if (!checked.ok) return checked;
    const draft = {
      schedule: this.scheduleService.data,
      ideas: this.ideaInboxService.getNodes()
    };
    const snapshot = structuredClone(draft);
    let applied;
    try {
      applied = applyProposal(draft, staged.map((call) => ({ ...call, args: { ...call.args } })));
    } catch (error) {
      this.scheduleService.data = snapshot.schedule;
      const message = error && error.message ? error.message : '写入失败';
      return { ok: false, index: 0, error: message };
    }
    if (!applied.ok) return applied;
    this.scheduleService.data = draft.schedule;
    this.ideaInboxService.replaceAll(draft.ideas);
    this.scheduleService.persist();
    this.scheduleService.eventBus.emit(Events.TASKS_UPDATED, { reason: 'agent' });
    this.scheduleService.eventBus.emit(Events.IDEAS_UPDATED, { reason: 'agent' });
    return { ok: true };
  }
}

export { editStaged, dropStaged, moveStaged, rowFromCall };
