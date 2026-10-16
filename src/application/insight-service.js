/**
 * 洞察：数字和句子都在点首页时从日程算出来。
 */

import { INSIGHT_DEFS } from '../domain/insights/insight-definitions.js';
import { buildInsightSnapshot } from '../domain/insights/insight-snapshot.js';
import { getDateKey } from '../domain/shared/date-key.js';
import { Events } from './event-bus.js';

export class InsightService {
  /**
   * @param {object} deps
   * @param {import('./schedule-service.js').ScheduleService} deps.scheduleService
   * @param {import('./event-bus.js').EventBus} deps.eventBus
   */
  constructor({ scheduleService, ideaInboxService = null, eventBus }) {
    this.scheduleService = scheduleService;
    this.ideaInboxService = ideaInboxService;
    this.eventBus = eventBus;
    /** @type {{ dateKey: string, snapshot: ReturnType<typeof buildInsightSnapshot>, texts: Record<string, string> }|null} */
    this.view = null;
  }

  /** @param {string} [dateKey] */
  snapshot(dateKey = getDateKey(new Date())) {
    const fromFiles = this.ideaInboxService ? this.ideaInboxService.getNodes() : undefined;
    return buildInsightSnapshot({
      schedule: this.scheduleService.data,
      workspace: this.scheduleService.workspace,
      ideas: fromFiles,
      todayKey: dateKey
    });
  }

  /** 上次点首页（或首次进入首页）算出的结果。留在首页时不会自己变。 */
  getView() {
    return this.view;
  }

  /** @param {string} [dateKey] */
  refresh(dateKey = getDateKey(new Date())) {
    const snapshot = this.snapshot(dateKey);
    /** @type {Record<string, string>} */
    const texts = {};
    INSIGHT_DEFS.forEach((def) => {
      texts[def.id] = def.text(snapshot);
    });
    this.view = { dateKey, snapshot, texts };
    this.eventBus.emit(Events.INSIGHTS_UPDATED, { dateKey });
    return this.view;
  }
}
