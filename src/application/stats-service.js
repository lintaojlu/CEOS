/**
 * 把日程和里程碑交给统计、日历的纯函数。页面不直接扫原始记录。
 */

import { summarizeDay } from '../domain/calendar/calendar-grid.js';
import { buildHeatmapWeeks, summarizeActivity } from '../domain/stats/activity-stats.js';
import { getDateKey } from '../domain/shared/date-key.js';

export class StatsService {
  /**
   * @param {object} deps
   * @param {import('./schedule-service.js').ScheduleService} deps.scheduleService
   * @param {import('./milestone-service.js').MilestoneService} deps.milestoneService
   */
  constructor({ scheduleService, milestoneService }) {
    this.scheduleService = scheduleService;
    this.milestoneService = milestoneService;
  }

  /** @param {string} [todayKey] */
  activity(todayKey = getDateKey(new Date())) {
    const schedule = this.scheduleService.data;
    return {
      summary: summarizeActivity(schedule, { today: todayKey }),
      weeks: buildHeatmapWeeks(schedule, { today: todayKey })
    };
  }

  /** @param {string} dateKey */
  daySummary(dateKey) {
    return summarizeDay(
      this.scheduleService.data[dateKey],
      this.milestoneService.milestones,
      dateKey
    );
  }
}
