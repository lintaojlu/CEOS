export const DRAG_MIME = 'application/x-ceos-task';

/** WebKit 的 dataTransfer 读不到自定义类型，同窗口拖放用这份兜底。 */
let pending = null;

/** @param {DragEvent} event @param {{ type: string, id: string }} payload */
export function writeDrag(event, payload) {
  pending = payload;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
  event.dataTransfer.setData('text/plain', payload.id);
}

/** @param {DragEvent} event */
export function readDrag(event) {
  const raw = event.dataTransfer.getData(DRAG_MIME);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      /* 落到同窗口记录 */
    }
  }
  return pending;
}

export function endDrag() {
  pending = null;
}
