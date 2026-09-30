import { createEmptyWorkspace, normalizeWorkspace } from '../../data/workspace-record.js';

const KEY = 'ceoWorkspace';

export class WorkspaceRepository {
  /** @param {import('./local-storage-adapter.js').LocalStorageAdapter} adapter */
  constructor(adapter) {
    this.adapter = adapter;
  }

  /** @returns {import('../../data/workspace-record.js').WorkspaceRecord} */
  load() {
    return normalizeWorkspace(this.adapter.getJson(KEY, null));
  }

  /** @param {import('../../data/workspace-record.js').WorkspaceRecord} workspace */
  save(workspace) {
    this.adapter.setJson(KEY, normalizeWorkspace(workspace || createEmptyWorkspace()));
  }
}

export { KEY as WORKSPACE_KEY };
