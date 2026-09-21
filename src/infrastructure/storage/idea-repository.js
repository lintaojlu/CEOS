import { createIdeaNode } from '../../domain/ideas/idea-node.js';

const KEY = 'ceoIdeas';

/**
 * @typedef {Object} IdeasStore
 * @property {number} version
 * @property {import('../../domain/ideas/idea-node.js').IdeaNode[]} nodes
 */

export class IdeaRepository {
  /** @param {import('./local-storage-adapter.js').LocalStorageAdapter} adapter */
  constructor(adapter) {
    this.adapter = adapter;
  }

  /** @returns {IdeasStore} */
  load() {
    const raw = this.adapter.getJson(KEY, null);
    if (!raw || !Array.isArray(raw.nodes)) {
      return { version: 1, nodes: [] };
    }
    return {
      version: raw.version || 1,
      nodes: raw.nodes.map((n) => createIdeaNode(n))
    };
  }

  /** @param {IdeasStore} store */
  save(store) {
    this.adapter.setJson(KEY, {
      version: store.version || 1,
      nodes: store.nodes || []
    });
  }

  exists() {
    return this.adapter.getJson(KEY, null) != null;
  }
}

export { KEY as IDEAS_KEY };
