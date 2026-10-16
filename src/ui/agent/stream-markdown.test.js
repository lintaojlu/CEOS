import { describe, expect, it } from 'vitest';
import { repairStreamingMarkdown } from './stream-markdown.js';
import { isNearBottom } from './use-stick-to-bottom.js';

describe('repairStreamingMarkdown', () => {
  it('closes open marks for display and leaves finished text alone', () => {
    expect(repairStreamingMarkdown('**加粗')).toBe('**加粗**');
    expect(repairStreamingMarkdown('~~删掉')).toBe('~~删掉~~');
    expect(repairStreamingMarkdown('`代码')).toBe('`代码`');
    expect(repairStreamingMarkdown('*斜体')).toBe('*斜体*');
    expect(repairStreamingMarkdown('[说明](https://example.com')).toBe('[说明](https://example.com)');
    expect(repairStreamingMarkdown('已经**结束**')).toBe('已经**结束**');
  });

  it('closes a code fence without repairing markers inside it', () => {
    const source = '```\nconst x = 1;\n**未闭合';
    expect(repairStreamingMarkdown(source)).toBe(`${source}\n\`\`\``);
  });
});

describe('isNearBottom', () => {
  it('stays with the bottom until the reader has moved up', () => {
    expect(isNearBottom(400, 360, 40)).toBe(true);
    expect(isNearBottom(800, 100, 40)).toBe(false);
  });
});
