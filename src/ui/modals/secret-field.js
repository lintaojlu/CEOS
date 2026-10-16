/**
 * 设置里的 Key。
 * 点保存时按钮会先让密码框失焦。WebKit 会在 click 之前把框清空，
 * 所以要在按下时把框里的字记下来，保存用这份，不用失焦之后的空字符串。
 */

/**
 * @param {HTMLInputElement | null | undefined} node
 * @param {string} [fallback]
 * @returns {string}
 */
export function readSecret(node, fallback = '') {
  if (node && typeof node.value === 'string') return node.value;
  return typeof fallback === 'string' ? fallback : '';
}

/**
 * 按下时记下的值优先，用户故意清空也算数。
 * 没有按下记录时，用现在输入框里的字。
 * @param {{ apiKey?: string, jevApiKey?: string } | null | undefined} pressed
 * @param {{ apiKey: string, jevApiKey: string }} live
 * @returns {{ apiKey: string, jevApiKey: string }}
 */
export function secretsToSave(pressed, live) {
  if (!pressed) return { apiKey: live.apiKey, jevApiKey: live.jevApiKey };
  return {
    apiKey: typeof pressed.apiKey === 'string' ? pressed.apiKey : live.apiKey,
    jevApiKey: typeof pressed.jevApiKey === 'string' ? pressed.jevApiKey : live.jevApiKey
  };
}
