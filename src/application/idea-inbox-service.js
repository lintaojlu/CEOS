import {
  createIdeaDocument,
  foldStoredTitle,
  hydrateIdea,
  ideaBody,
  ideaTitle,
  isSafeIdeaId,
  migrateWorkspaceIdeas,
  pruneImages,
  toIdeaFile
} from '../domain/ideas/idea-document.js';
import { getBlockers, partitionIdeas } from '../domain/ideas/readiness.js';
import { normalizeNotes } from '../domain/schedule/daily-task.js';
import { todayKey } from '../domain/shared/date-key.js';
import { createMemoryIdeaStore } from '../infrastructure/storage/idea-file-store.js';
import { Events } from './event-bus.js';

/**
 * 灵感按文件存放。内存里留一份缓存，界面和测试读 getNodes()。
 */
export class IdeaInboxService {
  /**
   * @param {object} deps
   * @param {import('./schedule-service.js').ScheduleService} deps.scheduleService
   * @param {import('./event-bus.js').EventBus} deps.eventBus
   * @param {ReturnType<typeof createMemoryIdeaStore>} [deps.store]
   */
  constructor({ scheduleService, eventBus, store = createMemoryIdeaStore() }) {
    this.scheduleService = scheduleService;
    this.eventBus = eventBus;
    this.store = store;
    /** @type {any[]} */
    this._nodes = [];
  }

  async load() {
    const listed = await this.store.list();
    /** @type {Map<string, any>} */
    const byId = new Map();
    for (const raw of listed) {
      const doc = hydrateIdea(raw);
      if (doc) byId.set(doc.id, doc);
    }
    const legacy = Array.isArray(this.scheduleService.workspace?.ideas)
      ? this.scheduleService.workspace.ideas
      : [];
    if (legacy.length) {
      for (const doc of migrateWorkspaceIdeas(legacy)) {
        if (!doc || byId.has(doc.id)) continue;
        await this.store.write(doc);
        byId.set(doc.id, doc);
      }
      this.scheduleService.workspace.ideas = [];
      this.scheduleService.persist();
    }
    this._nodes = [...byId.values()];
    this.eventBus.emit(Events.IDEAS_UPDATED, { reason: 'load' });
  }

  persist() {
    for (const node of this._nodes) void this.store.write(node);
  }

  getNodes() {
    return this._nodes;
  }

  /** @param {any[]} ideas */
  replaceAll(ideas) {
    const next = (ideas || []).map((item) => hydrateIdea(item)).filter(Boolean);
    const nextIds = new Set(next.map((node) => node.id));
    for (const prev of this._nodes) {
      if (!nextIds.has(prev.id)) void this.store.remove(prev.id);
    }
    this._nodes = next;
    for (const node of next) void this.store.write(node);
    this.eventBus.emit(Events.IDEAS_UPDATED, { reason: 'replace' });
  }

  getContext() {
    return {
      schedule: this.scheduleService.data,
      ideas: this._nodes,
      todayKey: todayKey(),
      dayKey: this.scheduleService.getDateKey()
    };
  }

  partition() {
    return partitionIdeas(this._nodes.filter(Boolean), this.getContext());
  }

  /**
   * @param {string} text
   * @param {Record<string, any>} [extra]
   */
  addIdea(text, extra = {}) {
    const node = hydrateIdea(createIdeaDocument({
      id: isSafeIdeaId(extra.id) ? extra.id : undefined,
      title: text,
      body: extra.body ?? extra.note ?? '',
      images: extra.images,
      completed: extra.completed,
      pinned: extra.pinned,
      createdAt: extra.createdAt
    }));
    this._nodes.push(node);
    void this.store.write(node);
    this.eventBus.emit(Events.IDEAS_UPDATED, {});
    return node;
  }

  /**
   * 任务放进灵感：标题用任务标题，正文用任务说明。
   * @param {import('../domain/schedule/daily-task.js').DailyTask} task
   */
  deferFromDaily(task) {
    const existing = this._nodes.find((node) => node.id === task.id);
    if (existing) return existing;
    const body = normalizeNotes(task.notes, { note: task.note, subtasks: task.subtasks })
      .map((item) => item.text)
      .join('\n');
    return this.addIdea(task.text || '', {
      id: isSafeIdeaId(task.id) ? task.id : undefined,
      body,
      pinned: !!task.pinned,
      completed: false
    });
  }

  /** @param {string} id */
  toggleComplete(id) {
    const idea = this._nodes.find((node) => node.id === id);
    if (!idea) return;
    this.update(id, { completed: !idea.completed });
  }

  /** @param {string} id */
  pin(id) {
    const idea = this._nodes.find((node) => node.id === id);
    if (!idea) return;
    this.update(id, { pinned: !idea.pinned });
  }

  /** @param {string} id */
  delete(id) {
    this._nodes = this._nodes.filter((node) => node.id !== id);
    void this.store.remove(id);
    this.eventBus.emit(Events.IDEAS_UPDATED, {});
  }

  /**
   * @param {string} id
   * @param {Record<string, any>} patch
   */
  update(id, patch) {
    const idea = this._nodes.find((node) => node.id === id);
    if (!idea) return { error: '灵感不存在' };
    let body = idea.body || '';
    if (patch.body != null || patch.note != null) body = String(patch.body ?? patch.note);
    if (patch.title != null || patch.text != null) {
      body = foldStoredTitle(String(patch.title ?? patch.text), body);
    }
    if (patch.completed != null) idea.completed = !!patch.completed;
    if (patch.pinned != null) idea.pinned = !!patch.pinned;
    idea.body = body;
    idea.title = ideaTitle(idea);
    idea.images = pruneImages(idea.body, patch.images != null ? patch.images : idea.images);
    idea.text = idea.title;
    idea.note = idea.body;
    void this.store.write(idea);
    this.eventBus.emit(Events.IDEAS_UPDATED, {});
    return { idea };
  }

  /** @param {string} id */
  getBlockers(id) {
    const idea = this._nodes.find((node) => node.id === id);
    if (!idea) return null;
    return getBlockers(idea, this.getContext());
  }

  /** @param {string} id */
  find(id) {
    return this._nodes.find((node) => node.id === id) || null;
  }

  /** 给日报和导出用的标题。 */
  titleOf(idea) {
    return ideaTitle(idea);
  }

  bodyOf(idea) {
    return ideaBody(idea);
  }
}
