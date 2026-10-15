const SECRET_KEYS = new Set(['apikey', 'baseurl', 'fullurl', 'authorization', 'api_key']);

/**
 * @param {string} value
 * @returns {string}
 */
function redactString(value) {
  return value.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
}

/** 丢掉密钥和模型地址。 @param {any} value */
export function redact(value) {
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === 'object') {
    /** @type {Record<string, any>} */
    const out = {};
    Object.keys(value).forEach((key) => {
      if (SECRET_KEYS.has(key.toLowerCase())) return;
      out[key] = redact(value[key]);
    });
    return out;
  }
  if (typeof value === 'string') return redactString(value);
  return value;
}
