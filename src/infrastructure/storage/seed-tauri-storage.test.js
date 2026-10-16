import { describe, expect, it } from 'vitest';
import { applyBackupToStorage } from './seed-tauri-storage.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    }
  };
}

describe('applyBackupToStorage', () => {
  it('stores workspace next to the schedule', () => {
    const storage = memoryStorage();
    applyBackupToStorage(storage, {
      schemaVersion: 4,
      schedule: {},
      workspace: { ideas: [{ id: 'i' }], milestones: [], projects: [] }
    });
    expect(JSON.parse(storage.getItem('ceoWorkspace')).ideas[0].id).toBe('i');
  });
});
