import { BOARD_BYTE_LIMIT, boardByteLength, parseBoardFile } from '../../domain/ideas/board-scene.js';

function tauriAvailable() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
}

export function createMemoryBoardStore() {
  let text = '';
  return {
    async read() {
      return text;
    },
    async write(body) {
      if (boardByteLength(body) > BOARD_BYTE_LIMIT) throw new Error('这张图放不下');
      const parsed = parseBoardFile(body);
      if (!parsed.ok) throw new Error('这块画打不开');
      text = parsed.empty ? '' : body;
    },
    async quarantine() {
      text = '';
    }
  };
}

export function createBoardStore() {
  if (!tauriAvailable()) return createMemoryBoardStore();
  return {
    async read() {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke('read_board');
    },
    async write(body) {
      if (boardByteLength(body) > BOARD_BYTE_LIMIT) throw new Error('这张图放不下');
      const parsed = parseBoardFile(body);
      if (!parsed.ok) throw new Error('这块画打不开');
      const { invoke } = await import('@tauri-apps/api/core');
      if (parsed.empty) {
        await invoke('delete_board');
        return;
      }
      await invoke('write_board', { body });
    },
    async quarantine() {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('quarantine_board');
    }
  };
}
