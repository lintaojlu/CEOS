/**
 * 桌面端的日程、标签、设置等记录。
 * 启动时整份读进内存，之后每次写入立刻回写对应文件。
 * 文件还不存在时，把当前窗口 localStorage 里的记录抄进去一次；两边都空才用开发备份。
 */

import { applyBackupToStorage } from './seed-tauri-storage.js';

export const USER_RECORD_KEYS = [
  'ceoSchedule',
  'ceoWorkspace',
  'ceoLlmSettings',
  'ceoUiPrefs',
  'ceoInsights',
  'ceoPomodoro',
  'ceoSchemaVersion',
  'ceoTagRepairApplied',
  'ceoImportedBackupAt'
];

const META_KEYS = new Set(['ceoSchemaVersion', 'ceoTagRepairApplied', 'ceoImportedBackupAt']);

/**
 * @param {Record<string, string>} initial
 * @param {(key: string, body: string | null) => Promise<void>} write
 */
export function createPersistingStorage(initial, write) {
  const data = { ...initial };
  /** @type {Map<string, Promise<void>>} */
  const jobs = new Map();

  function enqueue(key, body) {
    const lane = META_KEYS.has(key) ? 'meta' : key;
    const prev = jobs.get(lane) || Promise.resolve();
    const next = prev.catch(() => {}).then(() => write(key, body));
    jobs.set(lane, next);
    next.catch(() => {});
    return next;
  }

  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      const text = String(value);
      data[key] = text;
      enqueue(key, text);
    },
    removeItem(key) {
      delete data[key];
      enqueue(key, null);
    },
    flush() {
      return Promise.all([...jobs.values()]);
    }
  };
}

/**
 * @param {object} deps
 * @param {() => Promise<{ exists?: boolean, records?: Record<string, string> }>} deps.read
 * @param {(key: string, body: string | null) => Promise<void>} deps.write
 * @param {{ getItem: (key: string) => string | null } | null} [deps.legacy]
 * @param {(() => Promise<{ schemaVersion?: number, exportedAt?: string, schedule?: object, workspace?: object } | null>) | null} [deps.fetchBackup]
 */
export async function loadUserRecords({ read, write, legacy = null, fetchBackup = null }) {
  const snapshot = await read();
  /** @type {Record<string, string>} */
  const records = {};
  let copied = false;
  if (snapshot?.exists) {
    Object.assign(records, snapshot.records || {});
  } else if (legacy) {
    for (const key of USER_RECORD_KEYS) {
      const value = legacy.getItem(key);
      if (value != null) {
        records[key] = String(value);
        copied = true;
      }
    }
  }

  const storage = createPersistingStorage(records, write);
  if (copied) {
    for (const [key, body] of Object.entries(records)) storage.setItem(key, body);
    await storage.flush();
  }

  if (!snapshot?.exists && !copied && fetchBackup) {
    const backup = await fetchBackup();
    if (backup?.schedule) {
      applyBackupToStorage(storage, backup);
      storage.setItem('ceoImportedBackupAt', String(backup.exportedAt || 'seeded'));
      await storage.flush();
    }
  }

  return storage;
}
