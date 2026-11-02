import { describe, expect, it } from 'vitest';
import { messageClock, parseUserMessage } from './user-message-doc.js';

describe('parseUserMessage', () => {
  it('keeps headings, blank lines, checks and indent', () => {
    const lines = parseUserMessage([
      '【离职交接 Todo】',
      '',
      '一、工作内容交接',
      '□ 知识挖掘项目',
      '  □ 整理并移交全部源码',
      '提醒接手同事 ▲ 务必改密码'
    ].join('\n'));
    expect(lines.map((line) => line.kind)).toEqual(['heading', 'gap', 'heading', 'check', 'check', 'text']);
    expect(lines[4]).toMatchObject({ kind: 'check', depth: 2, mark: '□', text: '整理并移交全部源码' });
    expect(lines[5]).toMatchObject({ kind: 'text', text: '提醒接手同事 ▲ 务必改密码' });
  });

  it('formats a clock without a leading zero on the hour', () => {
    expect(messageClock(new Date(2026, 9, 27, 14, 5).toISOString())).toBe('14:05');
    expect(messageClock('')).toBe('');
  });
});
