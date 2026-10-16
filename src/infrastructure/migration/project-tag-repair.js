import { createDailyTask } from '../../domain/schedule/daily-task.js';
import { nextTagColor } from '../../domain/schedule/tag-palette.js';
import { getDateKey } from '../../domain/shared/date-key.js';
import { SCHEDULE_KEY, ScheduleRepository } from '../storage/schedule-repository.js';
import { WorkspaceRepository } from '../storage/workspace-repository.js';

const bundled = import.meta.glob('./project-tag-repair.data.js', { eager: true });
const REPAIR_MARK = 'ceoTagRepairApplied';

/**
 * 一次性把已经从日程上摘掉的项目补回标签。
 * 没有随包附带的快照时什么都不做。
 * @param {import('../storage/local-storage-adapter.js').LocalStorageAdapter} adapter
 * @param {any} [payload]
 * @returns {boolean}
 */
export function applyProjectTagRepair(adapter, payload) {
  const data = payload === undefined ? bundledRepair() : payload;
  if (!data?.tags?.length) return false;
  if (adapter.storage?.getItem(REPAIR_MARK) === '1') return false;

  const raw = adapter.getJson('ceoWorkspace', {}) || {};
  const existing = Array.isArray(raw.tags) ? raw.tags : [];
  /** @type {Record<string, string>} */
  const alias = {};
  data.tags.forEach((tag) => {
    const dup = existing.find((item) => item && item.name === tag.name && item.id !== tag.id);
    if (dup?.id) alias[String(dup.id)] = String(tag.id);
  });

  const canonicalIds = new Set(data.tags.map((tag) => String(tag.id)));
  const alreadyThere = data.tags.every((tag) => existing.some((item) => item && String(item.id) === String(tag.id)));
  if (alreadyThere) {
    adapter.storage?.setItem(REPAIR_MARK, '1');
    return false;
  }
  /** @type {Array<{ id: string, name: string, color: string }>} */
  let merged = existing;
  if (!alreadyThere || Object.keys(alias).length > 0) {
    const extras = existing.filter((item) => {
      if (!item?.id) return false;
      if (canonicalIds.has(String(item.id)) || alias[String(item.id)]) return false;
      return !data.tags.some((tag) => tag.name === item.name);
    });
    merged = data.tags.map((tag) => ({
      id: String(tag.id),
      name: String(tag.name),
      color: String(tag.color || '')
    }));
    extras.forEach((item) => {
      const color = merged.some((tag) => tag.color === item.color)
        ? nextTagColor(merged)
        : String(item.color || '') || nextTagColor(merged);
      merged.push({ id: String(item.id), name: String(item.name), color });
    });
  }

  const schedule = adapter.getJson(SCHEDULE_KEY, {}) || {};
  const seen = new Set();
  let scheduleChanged = false;
  Object.keys(schedule).forEach((dateKey) => {
    ['required', 'optional'].forEach((list) => {
      (schedule[dateKey]?.[list] || []).forEach((task) => {
        if (!task?.id) return;
        seen.add(String(task.id));
        const current = typeof task.tagId === 'string' ? task.tagId : '';
        const copyKey = `${dateKey}|${list}|${task.id}`;
        const wanted = data.copies?.[copyKey];
        let next = alias[current] || current;
        if (wanted && !next) next = alias[wanted] || wanted;
        else if (!wanted && data.taskTag?.[task.id] && next === data.taskTag[task.id]) next = '';
        else if (!next && data.taskTag?.[task.id] && !data.copies) next = data.taskTag[task.id];
        if (next !== current) {
          task.tagId = next;
          scheduleChanged = true;
        }
        if (Object.prototype.hasOwnProperty.call(task, 'projectId')) {
          delete task.projectId;
          scheduleChanged = true;
        }
      });
    });
  });

  const today = getDateKey(new Date());
  (data.orphans || []).forEach((task) => {
    if (!task?.id || seen.has(String(task.id))) return;
    if (!schedule[today]) schedule[today] = { required: [], optional: [] };
    if (!Array.isArray(schedule[today].required)) schedule[today].required = [];
    schedule[today].required.push(createDailyTask(task.text || '', new Date(), {
      id: String(task.id),
      completed: !!task.completed,
      note: task.note || '',
      pinned: !!task.pinned,
      recurrence: task.recurrence || '',
      time: typeof task.time === 'number' ? task.time : Date.now(),
      tagId: task.tagId || '',
      subtasks: task.subtasks || []
    }));
    seen.add(String(task.id));
    scheduleChanged = true;
  });

  const tagsChanged = tagKey(existing) !== tagKey(merged);
  if (tagsChanged) {
    new WorkspaceRepository(adapter).save({
      ideas: raw.ideas,
      milestones: raw.milestones,
      tags: merged
    });
  }
  if (scheduleChanged) new ScheduleRepository(adapter).save(schedule);
  adapter.storage?.setItem(REPAIR_MARK, '1');
  return tagsChanged || scheduleChanged;
}

function bundledRepair() {
  const mod = Object.values(bundled)[0];
  return mod?.PROJECT_TAG_REPAIR || null;
}

/** @param {any[]} tags */
function tagKey(tags) {
  return JSON.stringify((tags || []).map((tag) => [tag?.id, tag?.name, tag?.color]));
}
