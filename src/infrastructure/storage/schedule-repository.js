import { normalizeScheduleDocument, emptyScheduleDocument } from '../../domain/schedule/schedule-document.js';

const KEY = 'ceoSchedule';

export class ScheduleRepository {
  /** @param {import('./local-storage-adapter.js').LocalStorageAdapter} adapter */
  constructor(adapter) {
    this.adapter = adapter;
  }

  /** @returns {import('../../domain/schedule/schedule-document.js').ScheduleDocument} */
  load() {
    return normalizeScheduleDocument(this.adapter.getJson(KEY, {}));
  }

  /** @param {import('../../domain/schedule/schedule-document.js').ScheduleDocument} data */
  save(data) {
    this.adapter.setJson(KEY, normalizeScheduleDocument(data || emptyScheduleDocument()));
  }
}

export { KEY as SCHEDULE_KEY };
