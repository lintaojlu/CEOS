import { describe, expect, it } from 'vitest';
import { loadUserRecords } from './file-record-store.js';

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

const backup = {
  schemaVersion: 4,
  exportedAt: '2026-09-30T05:04:10.824Z',
  schedule: { '2026-09-30': { required: [{ id: 'a' }] } },
  workspace: { ideas: [], milestones: [], projects: [] }
};

describe('loadUserRecords', () => {
  it('keeps existing files and does not read localStorage again', async () => {
    const legacy = memoryStorage({ ceoSchedule: '{"from":"browser"}' });
    let fetched = false;
    const writes = [];
    const storage = await loadUserRecords({
      read: async () => ({ exists: true, records: { ceoSchedule: '{"from":"file"}' } }),
      write: async (key, body) => { writes.push([key, body]); },
      legacy,
      fetchBackup: async () => { fetched = true; return backup; }
    });
    expect(storage.getItem('ceoSchedule')).toBe('{"from":"file"}');
    expect(fetched).toBe(false);
    expect(writes).toEqual([]);
  });

  it('copies localStorage into files once when the files are missing', async () => {
    const legacy = memoryStorage({
      ceoSchedule: JSON.stringify({ '2026-09-01': {} }),
      ceoSchemaVersion: '7'
    });
    const writes = [];
    const storage = await loadUserRecords({
      read: async () => ({ exists: false, records: {} }),
      write: async (key, body) => { writes.push([key, body]); },
      legacy,
      fetchBackup: async () => { throw new Error('should not fetch'); }
    });
    expect(storage.getItem('ceoSchedule')).toBe(legacy.getItem('ceoSchedule'));
    expect(storage.getItem('ceoSchemaVersion')).toBe('7');
    expect(writes.map(([key]) => key).sort()).toEqual(['ceoSchedule', 'ceoSchemaVersion']);
  });

  it('writes the dev backup only when files and localStorage are both empty', async () => {
    const writes = [];
    const storage = await loadUserRecords({
      read: async () => ({ exists: false, records: {} }),
      write: async (key, body) => { writes.push([key, body]); },
      legacy: memoryStorage(),
      fetchBackup: async () => backup
    });
    expect(JSON.parse(storage.getItem('ceoSchedule'))['2026-09-30'].required[0].id).toBe('a');
    expect(storage.getItem('ceoSchemaVersion')).toBe('4');
    expect(storage.getItem('ceoImportedBackupAt')).toBe('2026-09-30T05:04:10.824Z');
    expect(writes.some(([key]) => key === 'ceoSchedule')).toBe(true);
  });
});
