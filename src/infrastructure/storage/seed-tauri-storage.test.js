import { describe, expect, it } from 'vitest';
import { applyBackupToStorage, seedTauriLocalStorage } from './seed-tauri-storage.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    }
  };
}

describe('seedTauriLocalStorage', () => {
  it('writes the backup into Tauri storage once, even if a stub schedule is already there', async () => {
    const storage = memoryStorage({
      ceoSchedule: JSON.stringify({ '2026-09-01': {} }),
      ceoSchemaVersion: '2'
    });
    const backup = {
      schemaVersion: 4,
      exportedAt: '2026-09-30T05:04:10.824Z',
      schedule: { '2026-09-30': { required: [{ id: 'a' }] } },
      workspace: { ideas: [], milestones: [], projects: [] }
    };
    const seeded = await seedTauriLocalStorage({
      isTauri: true,
      storage,
      fetchBackup: async () => backup
    });
    expect(seeded).toBe(true);
    expect(JSON.parse(storage.getItem('ceoSchedule'))['2026-09-30'].required[0].id).toBe('a');
    expect(storage.getItem('ceoSchemaVersion')).toBe('4');
    expect(storage.getItem('ceoImportedBackupAt')).toBe('2026-09-30T05:04:10.824Z');

    expect(await seedTauriLocalStorage({
      isTauri: true,
      storage,
      fetchBackup: async () => {
        throw new Error('should not fetch again');
      }
    })).toBe(false);
  });

  it('does not touch browser storage', async () => {
    const browser = memoryStorage();
    expect(await seedTauriLocalStorage({
      isTauri: false,
      storage: browser,
      fetchBackup: async () => ({ schedule: { '2026-09-30': {} } })
    })).toBe(false);
    expect(browser.getItem('ceoSchedule')).toBe(null);
  });

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
