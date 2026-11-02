import {
  parseBoardFile,
  topmostBoardText
} from '../domain/ideas/board-scene.js';
import {
  createIdeaDocument,
  foldStoredTitle,
  hydrateIdea,
  ideaBody,
  ideaTitle,
  isSafeIdeaId,
  migrateWorkspaceIdeas,
  pruneImages
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
    /** @type {Map<string, string>} */
    this._boards = new Map();
  }

  async load() {
    let metas = [];
    if (this.store.listBoardMeta) {
      try {
        metas = await this.store.listBoardMeta();
      } catch {
        metas = [];
      }
    }
    this._boards = new Map((metas || []).map((item) => [item.id, String(item.label || '')]));
    const listed = await this.store.list();
    /** @type {Map<string, any>} */
    const byId = new Map();
    for (const raw of listed) {
      const doc = hydrateIdea(raw);
      if (!doc) continue;
      if (!ideaTitle(doc) && !this._boards.has(doc.id)) {
        await this.store.remove(doc.id);
        continue;
      }
      byId.set(doc.id, doc);
    }
    const legacy = Array.isArray(this.scheduleService.workspace?.ideas)
      ? this.scheduleService.workspace.ideas
      : [];
    if (legacy.length) {
      for (const doc of migrateWorkspaceIdeas(legacy)) {
        if (!doc || byId.has(doc.id) || !ideaTitle(doc)) continue;
        await this.store.write(doc);
        byId.set(doc.id, doc);
      }
      this.scheduleService.workspace.ideas = [];
      this.scheduleService.persist();
    }
    for (const [id] of this._boards) {
      if (byId.has(id)) continue;
      const doc = hydrateIdea({ id, body: '', createdAt: Date.now() });
      if (!doc) continue;
      await this.store.write(doc);
      byId.set(id, doc);
    }
    this._nodes = [...byId.values()];
    this.eventBus.emit(Events.IDEAS_UPDATED, { reason: 'load' });
  }

  /** 没有标题、也没有画板的灵感只留在内存里。已经写过的文件删掉。 */
  commit(node) {
    if (!node) return;
    if (!ideaTitle(node) && !this.hasBoard(node.id)) {
      void this.store.remove(node.id);
      return;
    }
    void this.store.write(node);
  }

  persist() {
    for (const node of this._nodes) this.commit(node);
  }

  getNodes() {
    return this._nodes;
  }

  /** @param {any[]} ideas */
  replaceAll(ideas) {
    const next = (ideas || []).map((item) => hydrateIdea(item)).filter(Boolean);
    const nextIds = new Set(next.map((node) => node.id));
    for (const prev of this._nodes) {
      if (nextIds.has(prev.id)) continue;
      void this.store.remove(prev.id);
      void this.store.removeBoard(prev.id);
      this._boards.delete(prev.id);
    }
    this._nodes = next;
    for (const node of next) this.commit(node);
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
    this.commit(node);
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
  delete(id) {
    this._nodes = this._nodes.filter((node) => node.id !== id);
    this._boards.delete(id);
    void this.store.remove(id);
    void this.store.removeBoard(id);
    this.eventBus.emit(Events.IDEAS_UPDATED, {});
  }

  /** @param {string} id */
  hasBoard(id) {
    return this._boards.has(id);
  }

  /** @param {string} id */
  boardLabel(id) {
    return this._boards.get(id) || '';
  }

  /** @param {string} id */
  readBoard(id) {
    return this.store.readBoard(id);
  }

  /**
   * 空画布不留文件。有内容时连同灵感文件一起留下，即使正文还是空的。
   * @param {string} id
   * @param {string} json
   */
  async saveBoard(id, json) {
    const parsed = parseBoardFile(json);
    if (!parsed.ok || !parsed.scene) throw new Error('这块画打不开');
    if (parsed.empty) {
      await this.clearBoard(id);
      return;
    }
    const label = topmostBoardText(parsed.scene);
    await this.store.writeBoard(id, json, label);
    this._boards.set(id, label);
    const idea = this.find(id);
    if (idea) this.commit(idea);
    this.eventBus.emit(Events.IDEAS_UPDATED, { reason: 'board' });
  }

  /** @param {string} id */
  async clearBoard(id) {
    this._boards.delete(id);
    await this.store.removeBoard(id);
    const idea = this.find(id);
    if (idea) this.commit(idea);
    this.eventBus.emit(Events.IDEAS_UPDATED, { reason: 'board' });
  }

  /** @param {string} id */
  async quarantineBoard(id) {
    await this.store.quarantineBoard(id);
    this._boards.delete(id);
    const idea = this.find(id);
    if (idea) this.commit(idea);
    this.eventBus.emit(Events.IDEAS_UPDATED, { reason: 'board' });
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
    this.commit(idea);
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

  /** 给导出用的标题。 */
  titleOf(idea) {
    return ideaTitle(idea);
  }

  bodyOf(idea) {
    return ideaBody(idea);
  }
}
