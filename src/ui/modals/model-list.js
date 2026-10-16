/**
 * 把模型 ID 按「服务商/模型」分组，并按搜索词过滤。
 * 没有斜杠的 ID 单独列在前面。
 * @param {string[]} ids
 * @param {string} [query]
 * @returns {{ ungrouped: string[], groups: Array<{ label: string, ids: string[] }> }}
 */
export function groupModelIds(ids, query = '') {
  const needle = String(query || '').trim().toLowerCase();
  const ungrouped = [];
  /** @type {Array<{ label: string, ids: string[] }>} */
  const groups = [];
  const index = new Map();
  for (const raw of ids || []) {
    const id = String(raw || '').trim();
    if (!id || (needle && !id.toLowerCase().includes(needle))) continue;
    const slash = id.indexOf('/');
    if (slash <= 0) {
      ungrouped.push(id);
      continue;
    }
    const label = id.slice(0, slash);
    let bucket = index.get(label);
    if (!bucket) {
      bucket = { label, ids: [] };
      index.set(label, bucket);
      groups.push(bucket);
    }
    bucket.ids.push(id);
  }
  return { ungrouped, groups };
}
