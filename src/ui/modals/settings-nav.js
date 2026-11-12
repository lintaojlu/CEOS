/** 设置窗口左侧的分组和条目。keywords 只用于搜索，不显示。 */
export const SETTINGS_GROUPS = [
  {
    label: '设置',
    items: [
      { id: 'model', label: '模型', icon: 'model', keywords: ['API', 'Key', '地址', '请求', 'Agent', '拆解', '分类', '标准化', '连接', 'OpenAI'] },
      { id: 'jev', label: '决策', icon: 'decision', keywords: ['JEV', 'Key', '地址', '模型'] },
      { id: 'tags', label: '标签', icon: 'tag', keywords: ['钉住', '描述', '颜色', '新建', '删除'] }
    ]
  },
  {
    label: '数据与安全',
    items: [
      { id: 'data', label: '数据管理', icon: 'database', keywords: ['归档', '灵感', '恢复', '删除', '导出', 'JSON', '备份'] }
    ]
  }
];

export const DEFAULT_SETTINGS_SECTION = 'model';

/**
 * 搜索词对上条目名或关键词时保留该条目；整组都没对上就去掉这一组。
 * @param {string} query
 * @returns {typeof SETTINGS_GROUPS}
 */
export function filterSettingsGroups(query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return SETTINGS_GROUPS;
  return SETTINGS_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => [item.label, ...item.keywords]
        .some((word) => String(word).toLowerCase().includes(needle)))
    }))
    .filter((group) => group.items.length > 0);
}
