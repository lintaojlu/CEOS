import { describe, it, expect } from 'vitest';
import { validateDependsOn } from './dag-validator.js';
import { createIdeaNode } from './idea-node.js';

describe('validateDependsOn', () => {
  it('rejects self dependency', () => {
    const nodes = [createIdeaNode({ id: 'a', text: 'A' })];
    const result = validateDependsOn(nodes, 'a', [{ scope: 'idea', id: 'a' }]);
    expect(result.ok).toBe(false);
  });

  it('rejects cycle A→B→A', () => {
    const nodes = [
      createIdeaNode({ id: 'a', text: 'A', dependsOn: [{ scope: 'idea', id: 'b' }] }),
      createIdeaNode({ id: 'b', text: 'B', dependsOn: [] })
    ];
    const result = validateDependsOn(nodes, 'b', [{ scope: 'idea', id: 'a' }]);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/环/);
  });

  it('allows acyclic idea deps', () => {
    const nodes = [
      createIdeaNode({ id: 'a', text: 'A' }),
      createIdeaNode({ id: 'b', text: 'B' })
    ];
    const result = validateDependsOn(nodes, 'a', [{ scope: 'idea', id: 'b' }]);
    expect(result.ok).toBe(true);
  });

  it('ignores daily refs for cycle detection', () => {
    const nodes = [createIdeaNode({ id: 'a', text: 'A' })];
    const result = validateDependsOn(nodes, 'a', [
      { scope: 'daily', dateKey: '2026-01-01', list: 'required', id: 't1' }
    ]);
    expect(result.ok).toBe(true);
  });
});
