import { useLayoutEffect, useRef } from 'react';

/**
 * @param {number} scrollHeight
 * @param {number} scrollTop
 * @param {number} clientHeight
 * @param {number} [threshold]
 */
export function isNearBottom(scrollHeight, scrollTop, clientHeight, threshold = 48) {
  return scrollHeight - scrollTop - clientHeight < threshold;
}

/**
 * 停在底部时跟着新内容往下。已经往上翻过，就留在原地。
 * @param {import('react').RefObject<HTMLElement | null>} nodeRef
 * @param {string | number} token
 */
export function useStickToBottom(nodeRef, token) {
  const stick = useRef(true);
  const seen = useRef(/** @type {HTMLElement | null} */ (null));

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return undefined;
    if (seen.current !== node) {
      seen.current = node;
      stick.current = true;
    }
    function onScroll() {
      stick.current = isNearBottom(node.scrollHeight, node.scrollTop, node.clientHeight);
    }
    node.addEventListener('scroll', onScroll, { passive: true });
    if (stick.current) node.scrollTop = node.scrollHeight;
    return () => node.removeEventListener('scroll', onScroll);
  }, [nodeRef, token]);
}
