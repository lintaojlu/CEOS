/**
 * 日程是一份全局清单。任务是否出现在某一天，只由开始日和截止日决定。
 * 分组没有日期，只决定列上的框。
 */

import { normalizeNotes, normalizeTagIds } from './daily-task.js';
import { fallbackGroupTitle } from './task-group.js';
import { shiftDateKey } from '../shared/date-key.js';

/**
 * @typedef {Object} ScheduleTask
 * @property {string} id
 * @property {string} text
 * @property {boolean} completed
 * @property {boolean} pinned
 * @property {string} recurrence
 * @property {string[]} tagIds
 * @property {import('./daily-task.js').TaskNote[]} notes
 * @property {'required'|'optional'} list
 * @property {string} start
 * @property {string} due
 * @property {number} minutes
 * @property {string} groupId
 */

/**
 * @typedef {Object} ScheduleGroup
 * @property {string} id
 * @property {string} title
 * @property {'required'|'optional'} list
 * @property {string[]} childIds
 */

/**
 * @typedef {Object} ScheduleDocument
 * @property {ScheduleTask[]} tasks
 * @property {ScheduleGroup[]} groups
 * @property {{ required: string[], optional: string[] }} order
 */

/** @returns {ScheduleDocument} */
export function emptyScheduleDocument() {
  return { tasks: [], groups: [], order: { required: [], optional: [] } };
}

/** @param {any} raw */
export function isScheduleDocument(raw) {
  return !!raw && Array.isArray(raw.tasks) && raw.order && typeof raw.order === 'object';
}

/** @returns {string} */
export function newScheduleId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {number|undefined} time
 * @returns {number}
 */
function minutesFromTime(time) {
  if (typeof time !== 'number' || Number.isNaN(time)) return 0;
  const date = new Date(time);
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * @param {any} raw
 * @param {Set<string>} seen
 * @returns {ScheduleTask|null}
 */
function normalizeTask(raw, seen) {
  if (!raw || !raw.id) return null;
  const id = String(raw.id);
  if (seen.has(id)) return null;
  const list = raw.list === 'optional' ? 'optional' : 'required';
  const start = /^\d{4}-\d{2}-\d{2}$/.test(raw.start || '') ? raw.start : '';
  if (!start) return null;
  let due = /^\d{4}-\d{2}-\d{2}$/.test(raw.due || '') ? raw.due : '';
  if (due && due < start) due = start;
  const minutes = Number.isInteger(raw.minutes) ? Math.min(1439, Math.max(0, raw.minutes)) : 0;
  seen.add(id);
  return {
    id,
    text: String(raw.text || ''),
    completed: !!raw.completed,
    pinned: !!raw.pinned,
    recurrence: raw.recurrence || '',
    tagIds: normalizeTagIds(raw),
    notes: normalizeNotes(raw.notes, { note: raw.note, subtasks: raw.subtasks }),
    list,
    start,
    due,
    minutes,
    groupId: raw.groupId ? String(raw.groupId) : ''
  };
}

/**
 * @param {any} raw
 * @returns {ScheduleDocument}
 */
export function normalizeScheduleDocument(raw) {
  if (!isScheduleDocument(raw)) return migrateDaysToDocument(raw);
  const seen = new Set();
  /** @type {ScheduleTask[]} */
  const tasks = [];
  raw.tasks.forEach((item) => {
    const task = normalizeTask(item, seen);
    if (task) tasks.push(task);
  });
  const taskIds = new Set(tasks.map((task) => task.id));
  /** @type {ScheduleGroup[]} */
  const groups = [];
  const groupIds = new Set();
  (Array.isArray(raw.groups) ? raw.groups : []).forEach((item) => {
    if (!item || !item.id || groupIds.has(item.id)) return;
    const childIds = [];
    (Array.isArray(item.childIds) ? item.childIds : []).forEach((id) => {
      const task = tasks.find((row) => row.id === id);
      if (!task || childIds.includes(id)) return;
      childIds.push(id);
    });
    if (childIds.length < 2) return;
    const id = String(item.id);
    groupIds.add(id);
    const list = item.list === 'optional' ? 'optional' : 'required';
    childIds.forEach((childId) => {
      const task = tasks.find((row) => row.id === childId);
      if (!task) return;
      task.groupId = id;
      task.list = list;
    });
    groups.push({ id, title: String(item.title || ''), list, childIds });
  });
  tasks.forEach((task) => {
    if (task.groupId && !groupIds.has(task.groupId)) task.groupId = '';
  });
  /** @param {'required'|'optional'} list */
  const orderFor = (list) => {
    const seenIds = new Set();
    /** @type {string[]} */
    const ids = [];
    const source = Array.isArray(raw.order?.[list]) ? raw.order[list] : [];
    source.forEach((id) => {
      if (seenIds.has(id)) return;
      if (groupIds.has(id) && groups.find((group) => group.id === id)?.list === list) {
        seenIds.add(id);
        ids.push(id);
        return;
      }
      const task = tasks.find((row) => row.id === id);
      if (!task || task.groupId || task.list !== list) return;
      seenIds.add(id);
      ids.push(id);
    });
    groups.filter((group) => group.list === list && !seenIds.has(group.id)).forEach((group) => ids.push(group.id));
    tasks.filter((task) => task.list === list && !task.groupId && !seenIds.has(task.id)).forEach((task) => ids.push(task.id));
    return ids;
  };
  return { tasks, groups, order: { required: orderFor('required'), optional: orderFor('optional') } };
}

/**
 * 旧的按天清单收成全局任务。同一 id 出现多次时，后遇到的那份用新 id。
 * 反思不保留。
 * @param {any} raw
 * @returns {ScheduleDocument}
 */
export function migrateDaysToDocument(raw) {
  const doc = emptyScheduleDocument();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return doc;
  const dates = Object.keys(raw).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)).sort();
  const used = new Set();
  const claim = (id) => {
    const text = id ? String(id) : '';
    if (!text || used.has(text)) {
      const next = newScheduleId();
      used.add(next);
      return next;
    }
    used.add(text);
    return text;
  };
  dates.forEach((date) => {
    const day = raw[date];
    ['required', 'optional'].forEach((list) => {
      (Array.isArray(day?.[list]) ? day[list] : []).forEach((item) => {
        if (!item) return;
        const children = Array.isArray(item.children) ? item.children.filter((child) => child && child.id) : [];
        if (children.length >= 2) {
          const groupId = claim(item.id);
          /** @type {string[]} */
          const childIds = [];
          children.forEach((child) => {
            const id = claim(child.id);
            const task = normalizeTask({ ...child, id, list, start: date, due: date, minutes: minutesFromTime(child.time), groupId }, new Set());
            if (!task) return;
            used.add(task.id);
            doc.tasks.push(task);
            childIds.push(task.id);
          });
          if (childIds.length >= 2) {
            doc.groups.push({ id: groupId, title: String(item.text || ''), list, childIds });
            doc.order[list].push(groupId);
          } else if (childIds.length === 1) {
            const only = doc.tasks.find((task) => task.id === childIds[0]);
            if (only) only.groupId = '';
            doc.order[list].push(childIds[0]);
          }
          return;
        }
        const id = claim(item.id);
        const task = normalizeTask({
          ...item,
          id,
          list,
          start: date,
          due: date,
          minutes: minutesFromTime(item.time),
          groupId: ''
        }, new Set());
        if (!task || doc.tasks.some((row) => row.id === task.id)) return;
        used.add(task.id);
        doc.tasks.push(task);
        doc.order[list].push(task.id);
      });
    });
  });
  return doc;
}

/**
 * @param {ScheduleTask} task
 * @param {string} dateKey
 */
export function covers(task, dateKey) {
  if (!task?.start || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return false;
  if (!task.due) return task.start === dateKey;
  return task.start <= dateKey && dateKey <= task.due;
}

/** @param {ScheduleDocument} doc @param {string} id */
export function findScheduleTask(doc, id) {
  return (doc?.tasks || []).find((task) => task.id === id) || null;
}

/** @param {ScheduleDocument} doc @param {string} id */
export function findScheduleGroup(doc, id) {
  return (doc?.groups || []).find((group) => group.id === id) || null;
}

/**
 * @param {ScheduleDocument} doc
 * @param {string} dateKey
 */
export function projectDay(doc, dateKey) {
  /** @param {'required'|'optional'} list */
  const column = (list) => {
    /** @type {any[]} */
    const rows = [];
    (doc?.order?.[list] || []).forEach((id) => {
      const group = findScheduleGroup(doc, id);
      if (group && group.list === list) {
        const all = group.childIds.map((childId) => findScheduleTask(doc, childId)).filter(Boolean);
        if (all.length < 2) return;
        const visible = all.filter((task) => covers(task, dateKey));
        if (!visible.length) return;
        rows.push({
          id: group.id,
          text: group.title,
          completed: visible.every((task) => task.completed),
          pinned: false,
          recurrence: '',
          tagIds: [],
          notes: [],
          time: 0,
          minutes: 0,
          start: '',
          due: '',
          list,
          children: visible.map((task) => ({ ...task }))
        });
        return;
      }
      const task = findScheduleTask(doc, id);
      if (!task || task.groupId || task.list !== list || !covers(task, dateKey)) return;
      rows.push({ ...task });
    });
    return rows;
  };
  return { required: column('required'), optional: column('optional') };
}

/**
 * 读路径兼容旧的按天对象。
 * @param {any} schedule
 * @param {string} dateKey
 */
export function dayView(schedule, dateKey) {
  if (isScheduleDocument(schedule)) return projectDay(schedule, dateKey);
  return schedule?.[dateKey] || null;
}

/** @param {ScheduleDocument} doc */
export function earliestStart(doc) {
  const starts = (doc?.tasks || []).map((task) => task.start).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)).sort();
  return starts[0] || '';
}

/**
 * @param {ScheduleDocument} doc
 * @param {string} id
 */
function detach(doc, id) {
  ['required', 'optional'].forEach((list) => {
    doc.order[list] = (doc.order[list] || []).filter((item) => item !== id);
  });
  doc.groups.forEach((group) => {
    group.childIds = group.childIds.filter((item) => item !== id);
  });
}

/** @param {ScheduleDocument} doc */
function dissolveThinGroups(doc) {
  [...doc.groups].forEach((group) => {
    if (group.childIds.length >= 2) return;
    const index = doc.order[group.list].indexOf(group.id);
    const children = group.childIds.map((id) => findScheduleTask(doc, id)).filter(Boolean);
    doc.groups = doc.groups.filter((item) => item.id !== group.id);
    doc.order[group.list] = doc.order[group.list].filter((item) => item !== group.id);
    children.forEach((task, offset) => {
      task.groupId = '';
      const at = index < 0 ? doc.order[group.list].length : index + offset;
      doc.order[group.list].splice(at, 0, task.id);
    });
  });
}

/**
 * @param {ScheduleDocument} doc
 * @param {'required'|'optional'} list
 */
function settlePins(doc, list) {
  const pinned = [];
  const rest = [];
  (doc.order[list] || []).forEach((id) => {
    const task = findScheduleTask(doc, id);
    if (task?.pinned && !task.groupId) pinned.push(id);
    else rest.push(id);
  });
  doc.order[list] = [...pinned, ...rest];
}

/**
 * @param {ScheduleDocument} doc
 * @param {string} id
 */
export function removeScheduleTask(doc, id) {
  const task = findScheduleTask(doc, id);
  if (!task) return false;
  doc.tasks = doc.tasks.filter((item) => item.id !== id);
  detach(doc, id);
  dissolveThinGroups(doc);
  return true;
}

/**
 * @param {ScheduleDocument} doc
 * @param {string} groupId
 */
export function dissolveGroup(doc, groupId) {
  const group = findScheduleGroup(doc, groupId);
  if (!group) return false;
  group.childIds = [...group.childIds];
  const index = doc.order[group.list].indexOf(group.id);
  doc.groups = doc.groups.filter((item) => item.id !== group.id);
  doc.order[group.list] = doc.order[group.list].filter((item) => item !== group.id);
  group.childIds.forEach((id, offset) => {
    const task = findScheduleTask(doc, id);
    if (!task) return;
    task.groupId = '';
    const at = index < 0 ? doc.order[group.list].length : index + offset;
    doc.order[group.list].splice(at, 0, task.id);
  });
  return true;
}

/**
 * @param {ScheduleDocument} doc
 * @param {ScheduleTask} task
 */
export function insertScheduleTask(doc, task) {
  if (findScheduleTask(doc, task.id)) return false;
  doc.tasks.push(task);
  if (task.groupId) {
    const group = findScheduleGroup(doc, task.groupId);
    if (group) group.childIds.push(task.id);
    else task.groupId = '';
  }
  if (!task.groupId) {
    doc.order[task.list].unshift(task.id);
    settlePins(doc, task.list);
  }
  return true;
}

/**
 * @param {ScheduleDocument} doc
 * @param {'required'|'optional'} list
 * @param {string} targetId
 * @param {string} draggedId
 */
export function nestScheduleTasks(doc, list, targetId, draggedId) {
  const target = findScheduleTask(doc, targetId);
  const dragged = findScheduleTask(doc, draggedId);
  if (!target || !dragged || target.id === dragged.id) return null;
  if (target.groupId || dragged.groupId) return null;
  if (target.list !== list || dragged.list !== list) return null;
  const group = {
    id: newScheduleId(),
    title: fallbackGroupTitle([target.text, dragged.text]),
    list,
    childIds: [target.id, dragged.id]
  };
  target.groupId = group.id;
  dragged.groupId = group.id;
  doc.order[list] = doc.order[list].filter((id) => id !== dragged.id);
  const at = doc.order[list].indexOf(target.id);
  if (at >= 0) doc.order[list].splice(at, 1, group.id);
  else doc.order[list].unshift(group.id);
  doc.groups.push(group);
  settlePins(doc, list);
  return group;
}

/**
 * @param {ScheduleDocument} doc
 * @param {string} groupId
 * @param {string} taskId
 */
export function adoptScheduleTask(doc, groupId, taskId) {
  const group = findScheduleGroup(doc, groupId);
  const task = findScheduleTask(doc, taskId);
  if (!group || !task || task.groupId) return null;
  if (task.list !== group.list) return null;
  detach(doc, task.id);
  task.groupId = group.id;
  task.list = group.list;
  group.childIds.push(task.id);
  return group;
}

/**
 * @param {string[]} ids
 * @param {string} id
 * @param {string|null|undefined} beforeId
 * @param {string[]} visibleIds
 */
function placeId(ids, id, beforeId, visibleIds) {
  const rest = ids.filter((item) => item !== id);
  if (beforeId && rest.includes(beforeId)) {
    rest.splice(rest.indexOf(beforeId), 0, id);
    return rest;
  }
  let last = -1;
  rest.forEach((item, index) => {
    if (visibleIds.includes(item)) last = index;
  });
  rest.splice(last + 1, 0, id);
  return rest;
}

/**
 * @param {ScheduleDocument} doc
 * @param {'required'|'optional'} fromList
 * @param {string} id
 * @param {'required'|'optional'} toList
 * @param {string|null|undefined} beforeId
 * @param {string} dateKey
 */
export function placeScheduleTask(doc, fromList, id, toList, beforeId, dateKey) {
  const group = findScheduleGroup(doc, id);
  if (group) {
    if (group.list !== fromList) return false;
    if (fromList !== toList) {
      group.list = toList;
      group.childIds.forEach((childId) => {
        const child = findScheduleTask(doc, childId);
        if (child) child.list = toList;
      });
      doc.order[fromList] = doc.order[fromList].filter((item) => item !== group.id);
    }
    const visible = (doc.order[toList] || []).filter((item) => {
      if (item === group.id) return true;
      const row = findScheduleGroup(doc, item) || findScheduleTask(doc, item);
      if (!row) return false;
      if (row.childIds) return row.childIds.some((childId) => covers(findScheduleTask(doc, childId), dateKey));
      return !row.groupId && covers(row, dateKey);
    });
    doc.order[toList] = placeId(doc.order[toList], group.id, beforeId, visible);
    settlePins(doc, toList);
    return true;
  }
  const task = findScheduleTask(doc, id);
  if (!task || task.list !== fromList) return false;
  const fromGroup = task.groupId ? findScheduleGroup(doc, task.groupId) : null;
  const beforeTask = beforeId ? findScheduleTask(doc, beforeId) : null;
  const beforeGroup = beforeId ? findScheduleGroup(doc, beforeId) : null;
  if (fromGroup && beforeTask?.groupId === fromGroup.id && fromList === toList) {
    fromGroup.childIds = placeId(fromGroup.childIds, task.id, beforeId, fromGroup.childIds.filter((childId) => covers(findScheduleTask(doc, childId), dateKey)));
    return true;
  }
  if (fromGroup) {
    fromGroup.childIds = fromGroup.childIds.filter((childId) => childId !== task.id);
    task.groupId = '';
    dissolveThinGroups(doc);
  } else {
    doc.order[fromList] = doc.order[fromList].filter((item) => item !== task.id);
  }
  task.list = toList;
  if (beforeTask?.groupId && findScheduleGroup(doc, beforeTask.groupId)?.list === toList) {
    const host = findScheduleGroup(doc, beforeTask.groupId);
    task.groupId = host.id;
    host.childIds = placeId(host.childIds, task.id, beforeId, host.childIds);
    return true;
  }
  const visible = (doc.order[toList] || []).filter((item) => {
    const row = findScheduleGroup(doc, item);
    if (row) return row.childIds.some((childId) => covers(findScheduleTask(doc, childId), dateKey));
    const top = findScheduleTask(doc, item);
    return top && !top.groupId && covers(top, dateKey);
  });
  if (beforeGroup && beforeGroup.list === toList) {
    doc.order[toList] = placeId(doc.order[toList], task.id, beforeGroup.id, visible);
  } else {
    doc.order[toList] = placeId(doc.order[toList], task.id, beforeId, visible);
  }
  settlePins(doc, toList);
  return true;
}

/**
 * 勾选完成时，截止日期写成正在查看的那一天。取消勾选不改日期。
 * 分组只处理这一天看得到的成员。
 * @param {ScheduleDocument} doc
 * @param {string} id
 * @param {string} dateKey
 * @param {boolean} completed
 * @returns {string[]}
 */
export function setScheduleCompleted(doc, id, dateKey, completed) {
  const group = findScheduleGroup(doc, id);
  if (group) {
    const visible = group.childIds.map((childId) => findScheduleTask(doc, childId)).filter((task) => task && covers(task, dateKey));
    /** @type {string[]} */
    const done = [];
    visible.forEach((task) => {
      if (completed && !task.completed) {
        task.completed = true;
        task.due = dateKey;
        done.push(task.id);
      } else if (!completed && task.completed) {
        task.completed = false;
      }
    });
    return done;
  }
  const task = findScheduleTask(doc, id);
  if (!task) return [];
  if (completed && !task.completed) {
    task.completed = true;
    task.due = dateKey;
    return [task.id];
  }
  if (!completed && task.completed) task.completed = false;
  return [];
}

/**
 * @param {ScheduleTask} task
 * @param {string} dateKey
 */
export function extendScheduleRange(task, dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return false;
  if (covers(task, dateKey)) return false;
  if (task.start > dateKey) task.start = dateKey;
  if (!task.due || task.due < dateKey) task.due = dateKey;
  return true;
}

/**
 * @param {ScheduleDocument} doc
 * @param {string} sourceKey
 * @param {string} targetKey
 */
export function syncScheduleRange(doc, sourceKey, targetKey) {
  if (sourceKey === targetKey) return false;
  let changed = false;
  doc.tasks.forEach((task) => {
    if (task.completed || !covers(task, sourceKey)) return;
    if (extendScheduleRange(task, targetKey)) changed = true;
  });
  return changed;
}

/**
 * @param {ScheduleDocument} doc
 * @param {string} dateKey
 */
export function clearScheduleDay(doc, dateKey) {
  const next = shiftDateKey(dateKey, 1);
  const prev = shiftDateKey(dateKey, -1);
  [...doc.tasks].forEach((task) => {
    if (!covers(task, dateKey)) return;
    const due = task.due || task.start;
    if (task.start === dateKey && due === dateKey) {
      removeScheduleTask(doc, task.id);
      return;
    }
    if (task.start === dateKey && due > dateKey) {
      task.start = next;
      return;
    }
    if (due === dateKey && task.start < dateKey) {
      task.due = prev;
      return;
    }
    if (task.start < dateKey && due > dateKey) {
      const spawned = {
        ...task,
        id: newScheduleId(),
        notes: task.notes.map((note) => ({ ...note })),
        tagIds: [...task.tagIds],
        start: next,
        due: task.due
      };
      task.due = prev;
      doc.tasks.push(spawned);
      if (task.groupId) {
        const group = findScheduleGroup(doc, task.groupId);
        const at = group ? group.childIds.indexOf(task.id) : -1;
        if (group && at >= 0) group.childIds.splice(at + 1, 0, spawned.id);
        else spawned.groupId = '';
      } else {
        const order = doc.order[task.list];
        const at = order.indexOf(task.id);
        order.splice(at >= 0 ? at + 1 : order.length, 0, spawned.id);
      }
    }
  });
  dissolveThinGroups(doc);
}

/**
 * @param {ScheduleDocument} doc
 * @param {string} id
 */
export function toggleSchedulePin(doc, id) {
  const task = findScheduleTask(doc, id);
  if (!task) return null;
  task.pinned = !task.pinned;
  if (!task.groupId) settlePins(doc, task.list);
  return task;
}

/**
 * @param {ScheduleDocument} doc
 * @param {string} groupId
 * @param {string} title
 */
export function renameScheduleGroup(doc, groupId, title) {
  const group = findScheduleGroup(doc, groupId);
  if (!group) return null;
  const text = String(title || '').trim();
  if (!text) return group;
  group.title = text;
  return group;
}
