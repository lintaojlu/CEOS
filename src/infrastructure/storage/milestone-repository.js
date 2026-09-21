const KEY = 'ceoMilestones';

export class MilestoneRepository {
  /** @param {import('./local-storage-adapter.js').LocalStorageAdapter} adapter */
  constructor(adapter) {
    this.adapter = adapter;
  }

  load() {
    const raw = this.adapter.getJson(KEY, []);
    return Array.isArray(raw) ? raw : [];
  }

  /** @param {any[]} milestones */
  save(milestones) {
    this.adapter.setJson(KEY, milestones);
  }
}

export { KEY as MILESTONES_KEY };
