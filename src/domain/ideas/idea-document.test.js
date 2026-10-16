import { describe, expect, it } from 'vitest';
import {
  canonicalImageMarkdown,
  createIdeaDocument,
  firstLineTitle,
  ideaExcerpt,
  isSafeIdeaId,
  markdownForModel,
  migrateWorkspaceIdeas,
  pruneImages,
  referencedImageIds,
  toIdeaFile
} from './idea-document.js';
import { IdeaPickupParseError, parseIdeaPickup } from './idea-pickup.js';

describe('idea documents', () => {
  it('stores title, markdown body, and images without a data url prefix', () => {
    const doc = createIdeaDocument({
      id: 'idea-1',
      text: '标题',
      note: '见 ![](idea-image:pic1)',
      images: {
        pic1: { mime: 'image/png', base64: 'data:image/png;base64,aaaa' },
        loose: { mime: 'image/png', base64: 'bbbb' }
      }
    });
    const file = toIdeaFile(doc);
    expect(Object.keys(file)).toEqual(['id', 'body', 'images', 'completed', 'pinned', 'createdAt']);
    expect(file.title).toBeUndefined();
    expect(file.body).toBe('标题\n\n见 ![](idea-image:pic1)');
    expect(file.images.pic1).toEqual({ mime: 'image/png', base64: 'aaaa' });
    expect(file.images.loose).toBeUndefined();
    expect(JSON.stringify(file)).not.toContain('data:');
  });

  it('rejects unsafe ids and drops unreferenced images', () => {
    expect(isSafeIdeaId('../etc/passwd')).toBe(false);
    expect(isSafeIdeaId('ok-1')).toBe(true);
    const migrated = migrateWorkspaceIdeas([
      { id: '../etc/passwd', text: '旧标题', note: '旧正文', dependsOn: [{ scope: 'idea', id: 'x' }] }
    ]);
    expect(migrated).toHaveLength(1);
    expect(isSafeIdeaId(migrated[0].id)).toBe(true);
    expect(migrated[0].id).not.toBe('../etc/passwd');
    expect(migrated[0].title).toBe('旧标题');
    expect(migrated[0].body).toBe('旧标题\n\n旧正文');
    expect(migrated[0].dependsOn).toBeUndefined();
    expect(referencedImageIds('![](idea-image:pic1) 和 ![](<idea-image:pic2>)')).toEqual(new Set(['pic1', 'pic2']));
    expect(pruneImages('![](idea-image:pic1)', {
      pic1: { mime: 'image/gif', base64: 'ccc' },
      pic2: { mime: 'image/gif', base64: 'ddd' }
    })).toEqual({ pic1: { mime: 'image/gif', base64: 'ccc' } });
  });

  it('keeps image references for the model and strips embedded data urls', () => {
    const body = canonicalImageMarkdown('![](<idea-image:pic1>) ![](data:image/png;base64,zzzz)');
    expect(body).toBe('![](idea-image:pic1) ![](data:image/png;base64,zzzz)');
    const model = markdownForModel(body);
    expect(model).toContain('idea-image:pic1');
    expect(model).not.toContain('zzzz');
  });

  it('makes a one-line excerpt without markdown marks or image refs', () => {
    const excerpt = ideaExcerpt([
      '# 标题',
      '',
      '**加粗** 与 *斜体*',
      '',
      '见 ![](idea-image:pic1)',
      '',
      '- [ ] 待办',
      '- 列表',
      '',
      '[链接](https://example.com)',
      '',
      '`代码`',
      '',
      '```',
      '块',
      '```'
    ].join('\n'));
    expect(excerpt).toBe('标题 加粗 与 斜体 见 待办 列表 链接 代码 块');
    expect(excerpt).not.toMatch(/[#*`[\]]|idea-image:/);
    expect(ideaExcerpt('前文 ![](<idea-image:pic2>) 后文')).toBe('前文 后文');
    expect(ideaExcerpt('既然选择来这里，\\*\\*肯定\\*\\*是对的')).toBe('既然选择来这里，肯定是对的');
    expect(ideaExcerpt('![](data:image/png;base64,zzzz) idea-image:pic9')).toBe('');
    expect(ideaExcerpt('')).toBe('');
    expect(firstLineTitle('# 标题\n\n第二行')).toBe('标题');
    expect(firstLineTitle('![](idea-image:pic1)\n\n后面')).toBe('后面');
    expect(firstLineTitle('![](idea-image:pic1)')).toBe('');
  });
});

describe('parseIdeaPickup', () => {
  it('accepts one to eight tasks from an array or a tasks object', () => {
    expect(parseIdeaPickup('[{"title":"写提纲","note":"三节"}]')).toEqual([{ title: '写提纲', note: '三节' }]);
    expect(parseIdeaPickup('```json\n{"tasks":[{"title":"甲","note":""}]}\n```')).toEqual([{ title: '甲', note: '' }]);
  });

  it('fails on empty, too many, and unreadable replies', () => {
    expect(() => parseIdeaPickup('[]')).toThrow(IdeaPickupParseError);
    const nine = JSON.stringify(Array.from({ length: 9 }, (_, index) => ({ title: `t${index}`, note: '' })));
    expect(() => parseIdeaPickup(nine)).toThrow(IdeaPickupParseError);
    expect(() => parseIdeaPickup('不是 json')).toThrow(IdeaPickupParseError);
    expect(() => parseIdeaPickup('[{"title":"","note":"x"}]')).toThrow(IdeaPickupParseError);
    expect(() => parseIdeaPickup('[{"title":"甲"}]')).toThrow(IdeaPickupParseError);
  });
});
