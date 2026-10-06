/**
 * 界面偏好。和日程数据分开存。
 */

import { Events } from './event-bus.js';

export class UiPrefsService {
  /**
   * @param {object} deps
   * @param {import('../infrastructure/storage/ui-prefs-repository.js').UiPrefsRepository} deps.repo
   * @param {import('./event-bus.js').EventBus} deps.eventBus
   */
  constructor({ repo, eventBus }) {
    this.repo = repo;
    this.eventBus = eventBus;
    this.prefs = repo.load();
  }

  get() {
    return this.prefs;
  }

  /** @param {Partial<import('../infrastructure/storage/ui-prefs-repository.js').UiPrefs>} patch */
  update(patch) {
    this.prefs = this.repo.save({ ...this.prefs, ...patch });
    this.eventBus.emit(Events.UI_PREFS_UPDATED, this.prefs);
    return this.prefs;
  }
}
