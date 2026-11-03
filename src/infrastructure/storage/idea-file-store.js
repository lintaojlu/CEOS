import { isSafeIdeaId, toIdeaFile } from '../../domain/ideas/idea-document.js';

/**
 * 测试和浏览器里的内存仓储。不会写用户的 Application Support。
 */
export function createMemoryIdeaStore() {
  /** @type {Map<string, string>} */
  const files = new Map();
  return {
    async list() {
      return [...files.values()].map((text) => JSON.parse(text));
    },
    async listIds() {
      return [...files.keys()];
    },
    /** @param {string} id */
    async read(id) {
      return files.get(id) || '';
    },
    /** @param {any} doc */
    async write(doc) {
      const file = toIdeaFile(doc);
      if (!isSafeIdeaId(file.id)) throw new Error('灵感编号无效');
      files.set(file.id, JSON.stringify(file));
    },
    /** @param {string} id */
    async remove(id) {
      files.delete(id);
    }
  };
}

function tauriAvailable() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
}

/** 桌面端写到 app_data_dir/ideas/<id>.json。没有 Tauri 时退回内存。 */
export function createIdeaStore() {
  if (!tauriAvailable()) return createMemoryIdeaStore();
  return {
    async list() {
      const { invoke } = await import('@tauri-apps/api/core');
      const text = await invoke('list_idea_files');
      const parsed = text ? JSON.parse(String(text)) : [];
      return Array.isArray(parsed) ? parsed : [];
    },
    /** @param {string} id */
    async read(id) {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke('read_idea_file', { id });
    },
    /** @param {any} doc */
    async write(doc) {
      const file = toIdeaFile(doc);
      if (!isSafeIdeaId(file.id)) throw new Error('灵感编号无效');
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('write_idea_file', { id: file.id, body: JSON.stringify(file) });
    },
    /** @param {string} id */
    async remove(id) {
      if (!isSafeIdeaId(id)) return;
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_idea_file', { id });
    }
  };
}
