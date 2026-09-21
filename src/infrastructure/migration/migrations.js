import { createIdeaNode } from '../../domain/ideas/idea-node.js';
import { SCHEDULE_KEY } from '../storage/schedule-repository.js';
import { IDEAS_KEY } from '../storage/idea-repository.js';
import { MILESTONES_KEY } from '../storage/milestone-repository.js';
import { normalizeScheduleDay } from '../../domain/schedule/schedule-day.js';
import { getDateKey } from '../../domain/shared/date-key.js';

/**
 * v0 → v1 (legacy no-op keep): previously extracted ideas to ceoIdeas.
 * Now we only bump the version; per-day ideas stay on the day.
 * Real reshaping happens in v2.
 */
export function migrateV0ToV1(adapter, scheduleRepo, ideaRepo) {
  const raw = adapter.getJson(SCHEDULE_KEY, {}) || {};
  const cleaned = {};
  Object.keys(raw).forEach((dateKey) => {
    cleaned[dateKey] = normalizeScheduleDay(raw[dateKey]);
  });
  scheduleRepo.save(cleaned);
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
    days[dateKey] = normalizeScheduleDay(raw[dateKey]);
  });

  const ensure = (dateKey) => {
    if (!days[dateKey]) days[dateKey] = normalizeScheduleDay({});
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

  scheduleRepo.save(days);
  adapter.remove(IDEAS_KEY);
  adapter.remove(MILESTONES_KEY);
  adapter.setSchemaVersion(2);
}

export const MIGRATIONS = [
  { to: 1, run: migrateV0ToV1 },
  {
    to: 2,
    run: (adapter, scheduleRepo, ideaRepo) => {
      // milestoneRepo not in old signature — read via adapter inside
      migrateV1ToV2(adapter, scheduleRepo, ideaRepo, null);
    }
  }
];
