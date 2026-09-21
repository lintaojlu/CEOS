const SCHEMA_KEY = 'ceoSchemaVersion';

export class LocalStorageAdapter {
  /**
   * @param {Storage} [storage]
   */
  constructor(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    this.storage = storage;
  }

  /** @param {string} key */
  getJson(key, fallback = null) {
    if (!this.storage) return fallback;
    try {
      const raw = this.storage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  /** @param {string} key @param {any} value */
  setJson(key, value) {
    if (!this.storage) return;
    this.storage.setItem(key, JSON.stringify(value));
  }

  /** @param {string} key */
  remove(key) {
    if (!this.storage) return;
    this.storage.removeItem(key);
  }

  getSchemaVersion() {
    if (!this.storage) return 0;
    const v = this.storage.getItem(SCHEMA_KEY);
    return v ? parseInt(v, 10) || 0 : 0;
  }

  setSchemaVersion(version) {
    if (!this.storage) return;
    this.storage.setItem(SCHEMA_KEY, String(version));
  }
}

export { SCHEMA_KEY };
