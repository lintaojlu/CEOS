import { describe, expect, it } from 'vitest';
import {
  STANDARDIZE_SYSTEM,
  buildStandardizePrompt,
  clipStandardTitle,
  prependOriginalTitle,
  titleFromModel
} from './task-standardize.js';

describe('task standardize prompt', () => {
  it('sends the title and each existing note as its own block', () => {
    const prompt = buildStandardizePrompt({
      title: '  下午对一下菜单  ',
      notes: ['  先画菜单  ', '', '再接保存']
    });
    expect(STANDARDIZE_SYSTEM).toContain('{"title":"<标题>"}');
    expect(prompt).toBe([
      '任务标题：',
      '下午对一下菜单',
      '',
      '已有说明：',
      '先画菜单',
      '',
      '再接保存'
    ].join('\n'));
  });

  it('writes 无 when there are no notes', () => {
    expect(buildStandardizePrompt({ title: '对一下', notes: ['  ', ''] })).toContain('已有说明：\n无');
  });

  it('keeps spaces inside a title and clips to 20 characters', () => {
    expect(clipStandardTitle('  对 一下菜单  ')).toBe('对 一下菜单');
    expect(clipStandardTitle('一二三四五六七八九十甲乙丙丁戊己庚辛额外多')).toBe('一二三四五六七八九十甲乙丙丁戊己庚辛额外');
  });

  it('reads only a JSON title', () => {
    expect(titleFromModel('{"title":"  对一下菜单  "}')).toBe('对一下菜单');
    expect(titleFromModel('')).toBe('');
    expect(titleFromModel('不是 JSON')).toBe('');
    expect(titleFromModel('{"title":"  "}')).toBe('');
    expect(titleFromModel('{"title":"一二三四五六七八九十甲乙丙丁戊己庚辛额外多"}')).toBe('一二三四五六七八九十甲乙丙丁戊己庚辛额外');
  });

  it('prepends the original title unless that note already exists', () => {
    const notes = prependOriginalTitle([{ id: 'n1', text: '已有' }], '下午对一下菜单');
    expect(notes.map((note) => note.text)).toEqual(['下午对一下菜单', '已有']);
    expect(notes[1].id).toBe('n1');
    const again = prependOriginalTitle(notes, '下午对一下菜单');
    expect(again.map((note) => note.text)).toEqual(['下午对一下菜单', '已有']);
  });
});
