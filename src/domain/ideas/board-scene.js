export const BOARD_BYTE_LIMIT = 32 * 1024 * 1024;

/** @param {string} text */
export function boardByteLength(text) {
  return new TextEncoder().encode(String(text || '')).length;
}

/** @param {any} scene */
export function liveElements(scene) {
  const elements = scene && Array.isArray(scene.elements) ? scene.elements : [];
  return elements.filter((element) => element && element.isDeleted !== true);
}

/** @param {any} scene */
export function sceneHasElements(scene) {
  return liveElements(scene).length > 0;
}

/** 最靠上的一段文字，给没有正文的灵感当列表标题。 */
export function topmostBoardText(scene) {
  const texts = liveElements(scene).filter((element) => (
    element.type === 'text' && String(element.text || '').trim()
  ));
  texts.sort((a, b) => {
    const dy = (Number(a.y) || 0) - (Number(b.y) || 0);
    if (dy) return dy;
    return (Number(a.x) || 0) - (Number(b.x) || 0);
  });
  const first = texts[0];
  if (!first) return '';
  const line = String(first.text).trim().split(/\r?\n/).find((item) => item.trim()) || '';
  return line.trim().slice(0, 80);
}

/**
 * @param {string} text
 * @returns {{ ok: true, empty: boolean, scene: any } | { ok: false, empty: false, scene: null }}
 */
export function parseBoardFile(text) {
  const raw = String(text || '').trim();
  if (!raw) return { ok: true, empty: true, scene: null };
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, empty: false, scene: null };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.elements)) {
    return { ok: false, empty: false, scene: null };
  }
  return { ok: true, empty: !sceneHasElements(data), scene: data };
}

/**
 * 只留下还能画出来的元素，以及它们用到的图片。
 * @param {readonly any[]} elements
 * @param {any} appState
 * @param {Record<string, any>} files
 */
export function scenePayload(elements, appState, files) {
  const live = (elements || []).filter((element) => element && element.isDeleted !== true);
  /** @type {Record<string, any>} */
  const nextFiles = {};
  for (const element of live) {
    const fileId = element.fileId;
    if (fileId && files && files[fileId]) nextFiles[fileId] = files[fileId];
  }
  return {
    type: 'excalidraw',
    version: 2,
    source: 'ceo-schedule',
    elements: live,
    appState: {
      viewBackgroundColor: appState?.viewBackgroundColor || '#ffffff'
    },
    files: nextFiles
  };
}

/** @param {any} scene */
export function sceneFingerprint(scene) {
  const elements = liveElements(scene).map((element) => [
    element.id,
    element.version,
    element.x,
    element.y,
    element.width,
    element.height,
    element.angle,
    element.text || '',
    element.fileId || '',
    element.strokeColor || '',
    element.backgroundColor || ''
  ]);
  const files = Object.entries(scene?.files || {}).map(([id, file]) => [id, file?.dataURL?.length || 0]);
  return JSON.stringify({
    elements,
    files,
    background: scene?.appState?.viewBackgroundColor || '#ffffff'
  });
}
