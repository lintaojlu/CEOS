import { normalizeScheduleDay, createEmptyScheduleDay } from '../../domain/schedule/schedule-day.js';

const KEY = 'ceoSchedule';

export class ScheduleRepository {
  /** @param {import('./local-storage-adapter.js').LocalStorageAdapter} adapter */
  constructor(adapter) {
    this.adapter = adapter;
  }

  /** @returns {Record<string, import('../../domain/schedule/schedule-day.js').ScheduleDay>} */
  load() {
    const raw = this.adapter.getJson(KEY, {});
    const out = {};
    Object.keys(raw || {}).forEach((dateKey) => {
      out[dateKey] = normalizeScheduleDay(raw[dateKey]);
    });
    return out;
  }

  /** @param {Record<string, any>} data */
  save(data) {
    const cleaned = {};
    Object.keys(data || {}).forEach((dateKey) => {
      cleaned[dateKey] = normalizeScheduleDay(data[dateKey]);
    });
    this.adapter.setJson(KEY, cleaned);
  }

  /**
   * @param {Record<string, any>} data
   * @param {string} dateKey
   */
  ensureDay(data, dateKey) {
    if (!data[dateKey]) {
      data[dateKey] = createEmptyScheduleDay();
    } else if (!Array.isArray(data[dateKey].ideas) || !Array.isArray(data[dateKey].milestones)) {
      // Only normalize when the day is still in a legacy / incomplete shape.
      data[dateKey] = normalizeScheduleDay(data[dateKey]);
    }
    const day = data[dateKey];
    if (!Array.isArray(day.ideas)) day.ideas = [];
    if (!Array.isArray(day.milestones)) day.milestones = [];
    if (!Array.isArray(day.required)) day.required = [];
    if (!Array.isArray(day.optional)) day.optional = [];
    return day;
  }
}

export { KEY as SCHEDULE_KEY };
