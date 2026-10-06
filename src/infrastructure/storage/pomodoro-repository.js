import { normalizeSession } from '../../domain/pomodoro/session.js';

const KEY = 'ceoPomodoro';

export class PomodoroRepository {
  /** @param {import('./local-storage-adapter.js').LocalStorageAdapter} adapter */
  constructor(adapter) {
    this.adapter = adapter;
  }

  /** @returns {import('../../domain/pomodoro/session.js').PomodoroSession|null} */
  load() {
    return normalizeSession(this.adapter.getJson(KEY, null));
  }

  /** @param {import('../../domain/pomodoro/session.js').PomodoroSession|null} session */
  save(session) {
    if (!session) {
      this.adapter.remove(KEY);
      return;
    }
    const normalized = normalizeSession(session);
    if (!normalized) {
      this.adapter.remove(KEY);
      return;
    }
    this.adapter.setJson(KEY, normalized);
  }
}

export { KEY as POMODORO_KEY };
