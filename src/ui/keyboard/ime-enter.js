import { useRef } from 'react';

/**
 * 候选还在时，回车只上屏。
 * WebKit 会在 compositionend 之后再派发一次 isComposing 已为 false 的 Enter，
 * 这一次仍然只算上屏。组字结束后，下一次回车才提交。
 */
export function createImeEnterGuard(schedule = (fn) => { setTimeout(fn, 0); }) {
  let composing = false;
  let suppressEnter = false;
  let generation = 0;

  return {
    onCompositionStart() {
      generation += 1;
      composing = true;
      suppressEnter = false;
    },
    onCompositionEnd() {
      generation += 1;
      composing = false;
      suppressEnter = true;
      const current = generation;
      schedule(() => {
        if (current !== generation) return;
        suppressEnter = false;
      });
    },
    blocksEnter(event) {
      return isImeComposition(event) || composing || suppressEnter;
    },
    shouldIgnoreSubmit() {
      return composing || suppressEnter;
    },
  };
}

export function isImeComposition(event) {
  if (!event) return false;
  const native = event.nativeEvent || event;
  return Boolean(
    event.isComposing ||
    native.isComposing ||
    event.keyCode === 229 ||
    native.keyCode === 229
  );
}

/** 组字中的回车留给输入法。组字刚结束的那次回车取消提交。 */
export function holdImeEnter(event, guard) {
  if (!event || event.key !== 'Enter') return false;
  if (!guard.blocksEnter(event)) return false;
  if (!isImeComposition(event)) event.preventDefault();
  return true;
}

export function imeCompositionProps(guard) {
  return {
    onCompositionStart: guard.onCompositionStart,
    onCompositionEnd: guard.onCompositionEnd,
  };
}

export function useImeEnterGuard() {
  const ref = useRef(null);
  if (!ref.current) ref.current = createImeEnterGuard();
  return ref.current;
}
