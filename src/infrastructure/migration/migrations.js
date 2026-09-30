import { createIdeaNode } from '../../domain/ideas/idea-node.js';
import { SCHEDULE_KEY } from '../storage/schedule-repository.js';
import { IDEAS_KEY } from '../storage/idea-repository.js';
import { MILESTONES_KEY } from '../storage/milestone-repository.js';
import { normalizeScheduleDay } from '../../data/schedule-record.js';
import { normalizeWorkspace } from '../../data/workspace-record.js';
import { WorkspaceRepository } from '../storage/workspace-repository.js';
import { getDateKey } from '../../domain/shared/date-key.js';

/**
 * v0 → v1 (legacy no-op keep): previously extracted ideas to ceoIdeas.
 * Now we only bump the version; per-day ideas stay on the day.
 * Real reshaping happens in v2.
 */
function keepLegacyBuckets(raw, day) {
  return {
    ...day,
    ideas: Array.isArray(raw?.ideas) ? raw.ideas : [],
    milestones: Array.isArray(raw?.milestones) ? raw.milestones : [],
    projects: Array.isArray(raw?.projects) ? raw.projects : []
  };
}

export function migrateV0ToV1(adapter, scheduleRepo, ideaRepo) {
  const raw = adapter.getJson(SCHEDULE_KEY, {}) || {};
  const cleaned = {};
  Object.keys(raw).forEach((dateKey) => {
    cleaned[dateKey] = keepLegacyBuckets(raw[dateKey], normalizeScheduleDay(raw[dateKey]));
  });
  adapter.setJson(SCHEDULE_KEY, cleaned);
  // Do not create a global ceoIdeas shell — days own ideas.
  adapter.setSchemaVersion(1);
}

/**
 * v1 → v2: fold global ceoIdeas / ceoMilestones back onto each ScheduleDay.
 * Ideas go to the day of createdAt; milestones go to their target date.
 * After this, ceoIdeas / ceoMilestones are cleared — days own the data.
 */
export function migrateV1ToV2(adapter, scheduleRepo, ideaRepo, milestoneRepo) {
  const raw = adapter.getJson(SCHEDULE_KEY, {}) || {};
  /** @type {Record<string, any>} */
  const days = {};
  Object.keys(raw).forEach((dateKey) => {
    days[dateKey] = keepLegacyBuckets(raw[dateKey], normalizeScheduleDay(raw[dateKey]));
  });

  const ensure = (dateKey) => {
    if (!days[dateKey]) days[dateKey] = keepLegacyBuckets({}, normalizeScheduleDay({}));
    if (!Array.isArray(days[dateKey].ideas)) days[dateKey].ideas = [];
    if (!Array.isArray(days[dateKey].milestones)) days[dateKey].milestones = [];
    return days[dateKey];
  };

  // Global ideas → per-day by createdAt
  if (ideaRepo && ideaRepo.exists()) {
    const store = ideaRepo.load();
    (store.nodes || []).forEach((n) => {
      if (!n || !n.id) return;
      const ts = typeof n.createdAt === 'number' ? n.createdAt : Date.now();
      const dateKey = getDateKey(new Date(ts));
      const day = ensure(dateKey);
      if (day.ideas.some((x) => x.id === n.id)) return;
      day.ideas.push(
        createIdeaNode({
          id: n.id,
          text: n.text || '',
          note: n.note || '',
          completed: !!n.completed,
          pinned: !!n.pinned,
          createdAt: ts,
          dueDate: n.dueDate ?? null,
          dependsOn: Array.isArray(n.dependsOn) ? n.dependsOn : [],
          position: n.position ?? null
        })
      );
    });
  }

  // Global milestones → day of milestone.date
  const globalMs = adapter.getJson(MILESTONES_KEY, []);
  if (Array.isArray(globalMs)) {
    globalMs.forEach((m) => {
      if (!m || !m.id || !m.date) return;
      const day = ensure(m.date);
      if (day.milestones.some((x) => x.id === m.id)) return;
      day.milestones.push({
        id: m.id,
        title: m.title || '',
        date: m.date,
        completed: !!m.completed
      });
    });
  }

  adapter.setJson(SCHEDULE_KEY, days);
  adapter.remove(IDEAS_KEY);
  adapter.remove(MILESTONES_KEY);
  adapter.setSchemaVersion(2);
}

/**
 * v2 → v3: ideas, milestones, and projects become one global workspace.
 * Daily rows keep only tasks. A project task is the same id as its daily copies;
 * it is completed if any day completed that id. Text comes from the latest day.
 */
export function migrateV2ToV3(adapter) {
  const raw = adapter.getJson(SCHEDULE_KEY, {}) || {};
  /** @type {any[]} */
  const ideas = [];
  const ideaIds = new Set();
  /** @type {any[]} */
  const milestones = [];
  const milestoneIds = new Set();
  /** @type {Map<string, { id: string, name: string, tasks: any[] }>} */
  const projectsById = new Map();

  const dates = Object.keys(raw).sort();
  dates.forEach((dateKey) => {
    const day = raw[dateKey] || {};
    (day.ideas || []).forEach((n) => {
      if (!n || !n.id || ideaIds.has(n.id)) return;
      ideaIds.add(n.id);
      ideas.push(n);
    });
    (day.milestones || []).forEach((m) => {
      if (!m || !m.id || milestoneIds.has(m.id)) return;
      milestoneIds.add(m.id);
      milestones.push(m);
    });
    (day.projects || []).forEach((p) => {
      if (!p || !p.id || !String(p.name || '').trim()) return;
      if (!projectsById.has(p.id)) {
        projectsById.set(p.id, { id: String(p.id), name: String(p.name).trim(), tasks: [] });
      }
    });
  });

  /** @type {Map<string, { dateKey: string, task: any, list: string, completed: boolean, projectId: string }>} */
  const taskBest = new Map();
  dates.forEach((dateKey) => {
    const day = raw[dateKey] || {};
    ['required', 'optional'].forEach((list) => {
      (day[list] || []).forEach((t) => {
        if (!t || !t.id || !t.projectId) return;
        const prev = taskBest.get(t.id);
        const completed = !!(prev && prev.completed) || !!t.completed;
        if (!prev || dateKey >= prev.dateKey) {
          taskBest.set(t.id, { dateKey, task: t, list, completed, projectId: t.projectId });
        } else {
          prev.completed = completed;
        }
      });
    });
  });

  taskBest.forEach((info) => {
    let project = projectsById.get(info.projectId);
    if (!project) {
      project = { id: info.projectId, name: '未命名项目', tasks: [] };
      projectsById.set(info.projectId, project);
    }
    if (project.tasks.some((t) => t.id === info.task.id)) return;
    project.tasks.push({
      id: info.task.id,
      text: info.task.text || '',
      completed: info.completed,
      note: info.task.note || '',
      time: info.task.time,
      pinned: !!info.task.pinned,
      recurrence: info.task.recurrence || '',
      subtasks: info.task.subtasks || [],
      list: info.list
    });
  });

  const merged = mergeProjectsByName([...projectsById.values()]);
  new WorkspaceRepository(adapter).save(
    normalizeWorkspace({
      ideas,
      milestones,
      projects: merged.projects
    })
  );

  /** @type {Record<string, any>} */
  const days = {};
  Object.keys(raw).forEach((dateKey) => {
    days[dateKey] = normalizeScheduleDay(raw[dateKey]);
    rewriteProjectIds(days[dateKey], merged.idMap);
  });
  adapter.setJson(SCHEDULE_KEY, days);
  adapter.setSchemaVersion(3);
}

/**
 * Same display name used to be a new project id on each day.
 * Keep the first id and fold every later copy's tasks into it.
 * @param {Array<{ id: string, name: string, tasks?: any[] }>} projects
 * @returns {{ projects: Array<{ id: string, name: string, tasks: any[] }>, idMap: Map<string, string> }}
 */
export function mergeProjectsByName(projects) {
  /** @type {Map<string, { id: string, name: string, tasks: any[] }>} */
  const byName = new Map();
  /** @type {Map<string, string>} */
  const idMap = new Map();
  (projects || []).forEach((project) => {
    const name = String(project?.name || '').trim();
    if (!project?.id || !name) return;
    let canonical = byName.get(name);
    if (!canonical) {
      canonical = { id: String(project.id), name, tasks: [] };
      byName.set(name, canonical);
    }
    idMap.set(String(project.id), canonical.id);
    (project.tasks || []).forEach((task) => {
      if (!task?.id) return;
      const existing = canonical.tasks.find((item) => item.id === task.id);
      if (!existing) {
        canonical.tasks.push({
          ...task,
          id: String(task.id),
          subtasks: Array.isArray(task.subtasks) ? task.subtasks.map((sub) => ({ ...sub })) : []
        });
        return;
      }
      existing.completed = !!existing.completed || !!task.completed;
      if (!Array.isArray(existing.subtasks)) existing.subtasks = [];
      (task.subtasks || []).forEach((sub) => {
        if (!sub?.id) return;
        const prev = existing.subtasks.find((item) => item.id === sub.id);
        if (!prev) existing.subtasks.push({ ...sub });
        else prev.completed = !!prev.completed || !!sub.completed;
      });
    });
  });
  return { projects: [...byName.values()], idMap };
}

/**
 * @param {any} day
 * @param {Map<string, string>} idMap
 */
function rewriteProjectIds(day, idMap) {
  if (!day) return;
  ['required', 'optional'].forEach((list) => {
    (day[list] || []).forEach((task) => {
      if (!task?.projectId) return;
      const next = idMap.get(String(task.projectId));
      if (next) task.projectId = next;
    });
  });
}

/**
 * v3 → v4: collapse projects that share a name. Daily tasks point at the kept id.
 */
export function migrateV3ToV4(adapter) {
  const workspace = normalizeWorkspace(adapter.getJson('ceoWorkspace', null));
  const merged = mergeProjectsByName(workspace.projects);
  workspace.projects = merged.projects;
  new WorkspaceRepository(adapter).save(workspace);

  const schedule = adapter.getJson(SCHEDULE_KEY, {}) || {};
  Object.keys(schedule).forEach((dateKey) => {
    rewriteProjectIds(schedule[dateKey], merged.idMap);
  });
  adapter.setJson(SCHEDULE_KEY, schedule);
  adapter.setSchemaVersion(4);
}

export const MIGRATIONS = [
  { to: 1, run: migrateV0ToV1 },
  {
    to: 2,
    run: (adapter, scheduleRepo, ideaRepo) => {
      migrateV1ToV2(adapter, scheduleRepo, ideaRepo, null);
    }
  },
  { to: 3, run: (adapter) => migrateV2ToV3(adapter) },
  { to: 4, run: (adapter) => migrateV3ToV4(adapter) }
];
