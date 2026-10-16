/**
 * 一段对话一个 JSONL，旁边一份索引。桌面端写在应用数据目录，测试用内存。
 */

export function createMemoryAgentStore() {
  /** @type {Map<string, string>} */
  const files = new Map();
  let index = '';
  return {
    async readIndex() {
      return index;
    },
    /** @param {string} body */
    async writeIndex(body) {
      index = String(body || '');
    },
    /** @param {string} id */
    async readSession(id) {
      return files.get(id) || '';
    },
    /**
     * @param {string} id
     * @param {string} line
     */
    async appendSession(id, line) {
      const single = String(line || '').replace(/[\n\r]/g, ' ');
      const prev = files.get(id) || '';
      files.set(id, prev ? `${prev}\n${single}` : single);
    },
    /** @param {string} id */
    async deleteSession(id) {
      files.delete(id);
    }
  };
}

function tauriAvailable() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
}

export function createAgentStore() {
  if (!tauriAvailable()) return createMemoryAgentStore();
  return {
    async readIndex() {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke('read_agent_index');
    },
    /** @param {string} body */
    async writeIndex(body) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('write_agent_index', { body });
    },
    /** @param {string} id */
    async readSession(id) {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke('read_agent_session', { id });
    },
    /**
     * @param {string} id
     * @param {string} line
     */
    async appendSession(id, line) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('append_agent_session', { id, line });
    },
    /** @param {string} id */
    async deleteSession(id) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_agent_session', { id });
    }
  };
}
