import { describe, expect, it } from 'vitest';
import {
  parseBoardFile,
  sceneHasElements,
  scenePayload
} from './board-scene.js';

describe('board scene', () => {
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
    expect(sceneHasElements(parsed.scene)).toBe(true);
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
