import { createMilestone, sortMilestonesByDate } from '../domain/milestone/milestone.js';
import { Events } from './event-bus.js';

/**
 * Milestones are day-scoped: stored on ScheduleDay.milestones for the milestone's target date.
 * The viewed day only shows that day's milestones; editing never rewrites another day's list
 * except when the target date itself changes (move between buckets).
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
    // Live inside schedule days.
  }

  persist() {
    this.scheduleService.persist();
    this.eventBus.emit(Events.MILESTONES_UPDATED, {});
  }

  /**
   * Aggregate milestones from every day (export / rare overview only).
   * Prefer listForDay for the main UI — days stay decoupled.
   * @returns {import('../domain/milestone/milestone.js').Milestone[]}
   */
  listAll() {
    /** @type {import('../domain/milestone/milestone.js').Milestone[]} */
    const all = [];
    const seen = new Set();
    Object.keys(this.scheduleService.data || {}).forEach((dateKey) => {
      const day = this.scheduleService.data[dateKey];
      (day?.milestones || []).forEach((m) => {
        if (!m || !m.id || seen.has(m.id)) return;
        seen.add(m.id);
        all.push(m);
      });
    });
    return sortMilestonesByDate(all.slice());
  }

  /** Current viewed day's milestones (day-scoped UI). */
  get milestones() {
    return this.listForDay(this.scheduleService.getDateKey());
  }

  /**
   * @param {string} dateKey
   * @returns {import('../domain/milestone/milestone.js').Milestone[]}
   */
  listForDay(dateKey) {
    const day = this.scheduleService.data[dateKey];
    return Array.isArray(day?.milestones) ? day.milestones : [];
  }

  /**
   * Ensure the schedule day for `date` exists and return its milestones array.
   * @param {string} date
   */
  _bucketForDate(date) {
    const dateKey = date || this.scheduleService.getDateKey();
    // Temporarily switch ensure via scheduleRepo
    if (!this.scheduleService.data[dateKey]) {
      this.scheduleService.data[dateKey] = {
        required: [],
        optional: [],
        ideas: [],
        milestones: [],
        reflection: '',
        reflectionTags: [],
        aiEval: ''
      };
    }
    const day = this.scheduleService.data[dateKey];
    if (!Array.isArray(day.milestones)) day.milestones = [];
    return day;
  }

  add(title, date) {
    const day = this._bucketForDate(date);
    day.milestones.push(createMilestone(title, date));
    sortMilestonesByDate(day.milestones);
    this.persist();
  }

  update(id, title, date) {
    // Find which day currently owns this milestone
    let ownerKey = null;
    let milestone = null;
    Object.keys(this.scheduleService.data || {}).forEach((dateKey) => {
      const day = this.scheduleService.data[dateKey];
      const found = (day?.milestones || []).find((m) => m.id === id);
      if (found) {
        ownerKey = dateKey;
        milestone = found;
      }
    });
    if (!milestone || !ownerKey) return;

    milestone.title = title;
    milestone.date = date;

    // If target date changed, move to the new day's bucket
    if (date && date !== ownerKey) {
      const oldDay = this.scheduleService.data[ownerKey];
      oldDay.milestones = (oldDay.milestones || []).filter((m) => m.id !== id);
      const newDay = this._bucketForDate(date);
      newDay.milestones.push(milestone);
      sortMilestonesByDate(newDay.milestones);
    } else {
      sortMilestonesByDate(this.scheduleService.data[ownerKey].milestones);
    }
    this.persist();
  }

  delete(id) {
    Object.keys(this.scheduleService.data || {}).forEach((dateKey) => {
      const day = this.scheduleService.data[dateKey];
      if (!day?.milestones) return;
      day.milestones = day.milestones.filter((m) => m.id !== id);
    });
    this.persist();
  }

  toggle(id) {
    Object.keys(this.scheduleService.data || {}).forEach((dateKey) => {
      const day = this.scheduleService.data[dateKey];
      const m = (day?.milestones || []).find((x) => x.id === id);
      if (m) m.completed = !m.completed;
    });
    this.persist();
  }
}
