import { createIdeaNode } from '../domain/ideas/idea-node.js';
import { validateDependsOn } from '../domain/ideas/dag-validator.js';
import { partitionIdeas, getBlockers, isIdeaReady } from '../domain/ideas/readiness.js';
import { createDailyTask } from '../domain/schedule/daily-task.js';
import { syncPrevDayIdeas } from '../domain/schedule/schedule-day.js';
import { todayKey, getDateKey, addDays } from '../domain/shared/date-key.js';
import { Events } from './event-bus.js';

/**
 * Ideas are day-scoped: each ScheduleDay owns its ideas[].
 * The inbox / DAG always reflect the currently viewed day.
 */
export class IdeaInboxService {
  /**
   * @param {object} deps
   * @param {import('./schedule-service.js').ScheduleService} deps.scheduleService
   * @param {import('./event-bus.js').EventBus} deps.eventBus
   */
  constructor({ scheduleService, eventBus }) {
    this.scheduleService = scheduleService;
    this.eventBus = eventBus;
    /** @type {ReturnType<typeof setTimeout>|null} */
    this._positionPersistTimer = null;
  }

  load() {
    // Ideas live inside schedule days; nothing separate to load.
  }

  /** @returns {import('../domain/ideas/idea-node.js').IdeaNode[]} */
  get nodes() {
    const day = this.scheduleService.getCurrentData();
    if (!Array.isArray(day.ideas)) day.ideas = [];
    return day.ideas;
  }

  persist() {
    this.scheduleService.persist();
    this.eventBus.emit(Events.IDEAS_UPDATED, {});
  }

  getNodes() {
    return this.nodes;
  }

  /** @returns {import('../domain/ideas/readiness.js').ReadinessContext} */
  getContext() {
    const dayKey = this.scheduleService.getDateKey();
    return {
      schedule: this.scheduleService.data,
      ideas: this.nodes,
      todayKey: todayKey(),
      dayKey
    };
  }

  partition() {
    return partitionIdeas(this.nodes, this.getContext());
  }

  readyCount() {
    return this.partition().ready.length;
  }

  /**
   * @param {string} text
   * @param {Partial<import('../domain/ideas/idea-node.js').IdeaNode>} [extra]
   */
  addIdea(text, extra = {}) {
    const node = createIdeaNode({ text, ...extra });
    this.nodes.push(node);
    this.persist();
    return node;
  }

  /**
   * Defer a daily task into the current day's ideas inbox.
   * @param {import('../domain/schedule/daily-task.js').DailyTask} task
   */
  deferFromDaily(task) {
    if (this.nodes.some((n) => n.id === task.id)) return this.nodes.find((n) => n.id === task.id);
    const node = createIdeaNode({
      id: task.id,
      text: task.text,
      note: task.note || '',
      completed: false,
      pinned: !!task.pinned,
      createdAt: Date.now(),
      dueDate: null,
      dependsOn: []
    });
    this.nodes.push(node);
    this.persist();
    return node;
  }

  /**
   * @param {string} ideaId
   * @param {'required'|'optional'} [list]
   */
  pickUp(ideaId, list = 'required') {
    const idea = this.nodes.find((n) => n.id === ideaId);
    if (!idea || idea.completed) return null;
    if (!isIdeaReady(idea, this.getContext())) {
      return { error: '灵感尚未就绪，无法列入今日' };
    }
    const task = createDailyTask(idea.text, this.scheduleService.currentDate, {
      id: `${idea.id}-pickup-${Date.now()}`,
      note: idea.note || '',
      pinned: idea.pinned
    });
    this.scheduleService.insertTask(list, task);
    idea.completed = true;
    this.persist();
    return { task, idea };
  }

  toggleComplete(id) {
    const idea = this.nodes.find((n) => n.id === id);
    if (!idea) return;
    idea.completed = !idea.completed;
    this.persist();
  }

  pin(id) {
    const idea = this.nodes.find((n) => n.id === id);
    if (!idea) return;
    idea.pinned = !idea.pinned;
    this.persist();
  }

  delete(id) {
    const day = this.scheduleService.getCurrentData();
    day.ideas = (day.ideas || []).filter((n) => n.id !== id);
    day.ideas.forEach((n) => {
      n.dependsOn = (n.dependsOn || []).filter(
        (r) => !(r.scope === 'idea' && r.id === id)
      );
    });
    this.persist();
  }

  /**
   * @param {string} id
   * @param {object} patch
   */
  update(id, patch) {
    const ideas = this.nodes;
    const idea = ideas.find((n) => n.id === id);
    if (!idea) return { error: '灵感不存在' };

    if (patch.dependsOn) {
      const dayKey = this.scheduleService.getDateKey();
      const deps = (patch.dependsOn || []).filter((ref) => {
        if (!ref) return false;
        if (ref.scope === 'idea') return true;
        if (ref.scope === 'daily') return !ref.dateKey || ref.dateKey === dayKey;
        return false;
      }).map((ref) =>
        ref.scope === 'daily'
          ? { scope: 'daily', dateKey: dayKey, list: ref.list, id: ref.id }
          : { scope: 'idea', id: ref.id }
      );
      const result = validateDependsOn(ideas, id, deps);
      if (!result.ok) return { error: result.reason };
      idea.dependsOn = deps;
    }
    if (patch.text != null) idea.text = patch.text;
    if (patch.note != null) idea.note = patch.note;
    if (patch.dueDate !== undefined) idea.dueDate = patch.dueDate;
    this.persist();
    return { idea };
  }

  getBlockers(id) {
    const idea = this.nodes.find((n) => n.id === id);
    if (!idea) return null;
    return getBlockers(idea, this.getContext());
  }

  /**
   * @param {string} [excludeId]
   */
  listPredecessorCandidates(excludeId) {
    const dateKey = this.scheduleService.getDateKey();
    const ideas = this.nodes
      .filter((n) => !n.completed && n.id !== excludeId)
      .map((n) => ({
        scope: /** @type {const} */ ('idea'),
        id: n.id,
        label: `灵感 · ${n.text}`
      }));

    const daily = this.scheduleService.listIncompleteDailyTasks().map(({ list, task }) => ({
      scope: /** @type {const} */ ('daily'),
      dateKey,
      list,
      id: task.id,
      label: `${list === 'required' ? '必做' : '选做'} · ${task.text}`
    }));

    return [...ideas, ...daily];
  }

  subscribeToTaskCompletion() {
    this.eventBus.on(Events.TASK_COMPLETED, () => {
      this.eventBus.emit(Events.IDEAS_UPDATED, { reason: 'task:completed' });
    });
  }

  /**
   * Explicit only: copy unfinished ideas from yesterday into the current day.
   * @returns {number} how many ideas were added
   */
  syncPrevDayIdeas() {
    const prevKey = getDateKey(addDays(this.scheduleService.currentDate, -1));
    const currentKey = this.scheduleService.getDateKey();
    const prev = this.scheduleService.data[prevKey];
    if (!prev) return 0;
    const current = this.scheduleService.getCurrentData();
    const before = (current.ideas || []).length;
    syncPrevDayIdeas(prev, current, { prevKey, currentKey });
    const added = (current.ideas || []).length - before;
    if (added > 0) this.persist();
    else this.eventBus.emit(Events.IDEAS_UPDATED, { reason: 'sync:noop' });
    return added;
  }

  /**
   * @param {string} id
   * @param {{ x: number, y: number }} position
   */
  updatePosition(id, position) {
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') return;
    const idea = this.nodes.find((n) => n.id === id);
    if (!idea) return;
    idea.position = { x: position.x, y: position.y };
    if (this._positionPersistTimer) clearTimeout(this._positionPersistTimer);
    this._positionPersistTimer = setTimeout(() => {
      this._positionPersistTimer = null;
      this.scheduleService.persist();
    }, 150);
  }

  /**
   * @param {string} fromId
   * @param {string} toId
   */
  setIdeaDependency(fromId, toId) {
    if (!fromId || !toId || fromId === toId) {
      return { error: '无效的依赖边' };
    }
    // Snapshot once — getCurrentData used to re-normalize on every access and
    // orphaned the first lookup, so dependsOn never stuck.
    const ideas = this.nodes;
    const to = ideas.find((n) => n.id === toId);
    const from = ideas.find((n) => n.id === fromId);
    if (!to || !from) return { error: '灵感不存在（仅可连接当天灵感）' };

    const deps = [...(to.dependsOn || [])];
    if (deps.some((r) => r.scope === 'idea' && r.id === fromId)) {
      return { idea: to };
    }
    deps.push({ scope: 'idea', id: fromId });
    const result = validateDependsOn(ideas, toId, deps);
    if (!result.ok) return { error: result.reason };
    to.dependsOn = deps;
    this.persist();
    return { idea: to };
  }

  /**
   * @param {string} fromId
   * @param {string} toId
   */
  removeIdeaDependency(fromId, toId) {
    const ideas = this.nodes;
    const to = ideas.find((n) => n.id === toId);
    if (!to) return { error: '灵感不存在' };
    to.dependsOn = (to.dependsOn || []).filter(
      (r) => !(r.scope === 'idea' && r.id === fromId)
    );
    this.persist();
    return { idea: to };
  }

  getDagViewModel() {
    const ideas = this.nodes;
    const { ready, waiting, completed } = partitionIdeas(ideas, this.getContext());
    /** @type {Record<string, 'ready'|'waiting'|'completed'>} */
    const statusById = {};
    ready.forEach((n) => {
      statusById[n.id] = 'ready';
    });
    waiting.forEach((n) => {
      statusById[n.id] = 'waiting';
    });
    completed.forEach((n) => {
      statusById[n.id] = 'completed';
    });

    /** @type {Array<{ id: string, source: string, target: string }>} */
    const edges = [];
    ideas.forEach((n) => {
      (n.dependsOn || []).forEach((ref) => {
        if (ref.scope !== 'idea') return;
        if (!ideas.some((x) => x.id === ref.id)) return;
        edges.push({
          id: `e-${ref.id}-${n.id}`,
          source: ref.id,
          target: n.id
        });
      });
    });

    return {
      ideas: ideas.slice(),
      edges,
      statusById
    };
  }
}
