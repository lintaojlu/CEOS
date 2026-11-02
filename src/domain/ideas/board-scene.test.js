import { describe, expect, it } from 'vitest';
import {
  parseBoardFile,
  sceneHasElements,
  scenePayload,
  topmostBoardText
} from './board-scene.js';

describe('board scene', () => {
  it('uses the uppermost text as the list label', () => {
    const scene = {
      elements: [
        { id: 'low', type: 'text', text: '下面', x: 0, y: 40, isDeleted: false },
        { id: 'high', type: 'text', text: '上面\n第二行', x: 12, y: 8, isDeleted: false },
        { id: 'gone', type: 'text', text: '删了', x: 0, y: 0, isDeleted: true }
      ]
    };
    expect(topmostBoardText(scene)).toBe('上面');
    expect(sceneHasElements(scene)).toBe(true);
  });

  it('treats a blank file as empty and a broken file as unreadable', () => {
    expect(parseBoardFile('')).toEqual({ ok: true, empty: true, scene: null });
    expect(parseBoardFile('{').ok).toBe(false);
    expect(parseBoardFile('[]').ok).toBe(false);
    const parsed = parseBoardFile(JSON.stringify({
      type: 'excalidraw',
      elements: [{ id: 'a', type: 'rectangle', isDeleted: false }]
    }));
    expect(parsed.ok).toBe(true);
    expect(parsed.empty).toBe(false);
  });

  it('drops images that no element still uses', () => {
    const scene = scenePayload(
      [{ id: 'img', type: 'image', fileId: 'keep', isDeleted: false }],
      { viewBackgroundColor: '#fff' },
      { keep: { dataURL: 'data:image/png;base64,YQ==' }, drop: { dataURL: 'data:image/png;base64,Yg==' } }
    );
    expect(Object.keys(scene.files)).toEqual(['keep']);
    expect(scene.elements).toHaveLength(1);
  });
});
