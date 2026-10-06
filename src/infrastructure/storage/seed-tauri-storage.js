/**
 * Copy the on-disk backup into the Tauri webview's localStorage once.
 * The browser keeps its own storage. After `ceoImportedBackupAt` is set,
 * later edits in the window are left alone.
 */

const SEED_KEY = 'ceoImportedBackupAt';

export function applyBackupToStorage(storage, backup) {
  storage.setItem('ceoSchedule', JSON.stringify(backup.schedule || {}));
  storage.setItem('ceoWorkspace', JSON.stringify(backup.workspace || {}));
  storage.setItem('ceoSchemaVersion', String(backup.schemaVersion ?? 4));
}

/**
 * @param {object} deps
 * @param {boolean} deps.isTauri
 * @param {Storage} deps.storage
 * @param {() => Promise<{ schemaVersion?: number, schedule?: object, workspace?: object } | null>} deps.fetchBackup
 * @returns {Promise<boolean>}
 */
export async function seedTauriLocalStorage({ isTauri, storage, fetchBackup }) {
  if (!isTauri) return false;
  if (storage.getItem(SEED_KEY)) return false;
  const backup = await fetchBackup();
  if (!backup || !backup.schedule) return false;
  applyBackupToStorage(storage, backup);
  storage.setItem(SEED_KEY, String(backup.exportedAt || 'seeded'));
  return true;
}
