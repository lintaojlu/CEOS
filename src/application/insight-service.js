/**
 * 洞察：数字来自领域快照，句子来自 LLM，按日缓存。
 */

import { INSIGHT_DEFS } from '../domain/insights/insight-definitions.js';
import { buildInsightSnapshot } from '../domain/insights/insight-snapshot.js';
import { getDateKey } from '../domain/shared/date-key.js';
import { Events } from './event-bus.js';

export class InsightService {
  /**
   * @param {object} deps
   * @param {import('./schedule-service.js').ScheduleService} deps.scheduleService
   * @param {import('./llm-service.js').LlmService} deps.llmService
   * @param {import('../infrastructure/storage/insights-repository.js').InsightsRepository} deps.insightsRepo
   * @param {import('./event-bus.js').EventBus} deps.eventBus
   */
  constructor({ scheduleService, llmService, insightsRepo, eventBus }) {
    this.scheduleService = scheduleService;
    this.llmService = llmService;
    this.insightsRepo = insightsRepo;
    this.eventBus = eventBus;
  }

  /** @param {string} [dateKey] */
  snapshot(dateKey = getDateKey(new Date())) {
    return buildInsightSnapshot({
      schedule: this.scheduleService.data,
      workspace: this.scheduleService.workspace,
      todayKey: dateKey
    });
  }

  /** @param {string} dateKey */
  getCached(dateKey) {
    return this.insightsRepo.getDay(dateKey);
  }

  /**
   * @param {string} dateKey
   * @param {{ force?: boolean }} [options]
   */
  async generate(dateKey, { force = false } = {}) {
    const snapshot = this.snapshot(dateKey);
    const cached = { ...this.getCached(dateKey) };
    const pending = INSIGHT_DEFS.filter((def) => force || !cached[def.id]?.text);
    if (pending.length === 0) return cached;

    const generatedAt = new Date().toISOString();
    const results = await Promise.all(
      pending.map(async (def) => {
        const text = await this.llmService.complete({
          system: def.system,
          user: def.prompt(snapshot)
        });
        return [def.id, { text, generatedAt }];
      })
    );
    results.forEach(([id, entry]) => {
      cached[id] = entry;
    });
    this.insightsRepo.saveDay(dateKey, cached);
    this.eventBus.emit(Events.INSIGHTS_UPDATED, { dateKey });
    return cached;
  }
}
