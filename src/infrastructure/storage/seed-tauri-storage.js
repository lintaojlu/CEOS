/**
 * 把开发备份写进一份 Storage。桌面端只在应用数据文件和 localStorage 都空时调用。
 */

export function applyBackupToStorage(storage, backup) {
  storage.setItem('ceoSchedule', JSON.stringify(backup.schedule || {}));
  storage.setItem('ceoWorkspace', JSON.stringify(backup.workspace || {}));
  storage.setItem('ceoSchemaVersion', String(backup.schemaVersion ?? 4));
}
