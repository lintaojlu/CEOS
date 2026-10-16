/**
 * 把日程交给首页活跃统计。页面不直接扫原始记录。
 */

import { buildHeatmapWeeks, summarizeActivity } from '../domain/stats/activity-stats.js';
import { getDateKey } from '../domain/shared/date-key.js';

export class StatsService {
  /**
   * @param {object} deps
   * @param {import('./schedule-service.js').ScheduleService} deps.scheduleService
   */
  constructor({ scheduleService }) {
    this.scheduleService = scheduleService;
  }

  /** @param {string} [todayKey] */
  activity(todayKey = getDateKey(new Date())) {
    const schedule = this.scheduleService.data;
    return {
      summary: summarizeActivity(schedule, { today: todayKey }),
      weeks: buildHeatmapWeeks(schedule, { today: todayKey })
    };
  }
}
