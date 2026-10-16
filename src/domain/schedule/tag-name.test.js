import { describe, expect, it } from 'vitest';
import { TAG_NAME_SYSTEM, buildTagNamePrompt, tagNameFromModel } from './tag-name.js';

describe('tagNameFromModel', () => {
  it('reads the name from JSON and keeps at most 10 unicode characters', () => {
    expect(tagNameFromModel('{"name":"  日程 代理  "}')).toBe('日程代理');
    expect(tagNameFromModel('{"name":"一二三四五六七八九十十一"}')).toBe('一二三四五六七八九十');
    expect(tagNameFromModel('{"name":"🚀项目"}')).toBe('🚀项目');
  });

  it('uses the original title when the response is empty or not JSON', () => {
    expect(tagNameFromModel('', '写右键菜单')).toBe('写右键菜单');
    expect(tagNameFromModel('「」', '写菜单')).toBe('写菜单');
    expect(tagNameFromModel('{"name":""}', '一二三四五六七八九十十一')).toBe('一二三四五六七八九十');
  });

  it('asks for JSON and sends only the task title', () => {
    expect(TAG_NAME_SYSTEM).toContain('{"name":"项目名"}');
    expect(buildTagNamePrompt('  写右键菜单  ')).toBe('写右键菜单');
  });
});
