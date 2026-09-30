import { createMilestone, sortMilestonesByDate } from '../domain/milestone/milestone.js';
import { Events } from './event-bus.js';

/**
 * Milestones are one global list on the workspace.
 * The timeline shows every milestone; the date field is the target date.
 */
export class MilestoneService {
  /**
   * @param {object} deps
   * @param {import('./schedule-service.js').ScheduleService} deps.scheduleService
   * @param {import('./event-bus.js').EventBus} deps.eventBus
   */
  constructor({ scheduleService, eventBus }) {
    this.scheduleService = scheduleService;
    this.eventBus = eventBus;
  }

  load() {
    // Live on the workspace loaded by ScheduleService.
  }

  persist() {
    this.scheduleService.persist();
    this.eventBus.emit(Events.MILESTONES_UPDATED, {});
  }

  /** @returns {import('../domain/milestone/milestone.js').Milestone[]} */
  _list() {
    if (!Array.isArray(this.scheduleService.workspace.milestones)) {
      this.scheduleService.workspace.milestones = [];
    }
    return this.scheduleService.workspace.milestones;
  }

  /** @returns {import('../domain/milestone/milestone.js').Milestone[]} */
  listAll() {
    return sortMilestonesByDate(this._list().slice());
  }

  /** Full timeline, independent of the viewed day. */
  get milestones() {
    return this.listAll();
  }

  add(title, date) {
    const list = this._list();
    list.push(createMilestone(title, date));
    sortMilestonesByDate(list);
    this.persist();
  }

  update(id, title, date) {
    const milestone = this._list().find((m) => m.id === id);
    if (!milestone) return;
    milestone.title = title;
    milestone.date = date;
    sortMilestonesByDate(this._list());
    this.persist();
  }

  delete(id) {
    const workspace = this.scheduleService.workspace;
    workspace.milestones = this._list().filter((m) => m.id !== id);
    this.persist();
  }

  toggle(id) {
    const milestone = this._list().find((m) => m.id === id);
    if (!milestone) return;
    milestone.completed = !milestone.completed;
    this.persist();
  }
}
