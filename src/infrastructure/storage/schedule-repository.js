import { normalizeScheduleDay, createEmptyScheduleDay } from '../../data/schedule-record.js';

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
    if (!data[dateKey] || !Array.isArray(data[dateKey].required) || !Array.isArray(data[dateKey].optional)) {
      data[dateKey] = normalizeScheduleDay(data[dateKey] || {});
    }
    return data[dateKey];
  }
}

export { KEY as SCHEDULE_KEY };
