/**
 * 用设置里的 TypeSafe Key 做一次决策。
 * Key 空着时不发请求，两个判断都当成不需要。
 */

import { resolveJevModel } from '../infrastructure/storage/llm-settings-repository.js';
import { evaluateSystemOne, listSystemOneModels } from '../infrastructure/llm/typesafe-client.js';
import { recordModelCall } from '../infrastructure/log/model-log.js';
import { JEV_QUESTIONS, jevState, needsAction } from '../domain/schedule/task-jev.js';

/** @param {any} answer */
function noulSummary(answer) {
  return { type: answer?.type ?? null, noul: typeof answer?.noul === 'number' ? answer.noul : null };
}

export class JevService {
  /**
   * @param {object} deps
   * @param {import('../infrastructure/storage/llm-settings-repository.js').LlmSettingsRepository} deps.settingsRepo
   * @param {typeof evaluateSystemOne} [deps.evaluate]
   * @param {typeof listSystemOneModels} [deps.listModels]
   * @param {(record: any) => Promise<void>|void} [deps.log]
   */
  constructor({ settingsRepo, evaluate = evaluateSystemOne, listModels: listModelsFn = listSystemOneModels, log }) {
    this.settingsRepo = settingsRepo;
    this.evaluate = evaluate;
    this.listModelsFn = listModelsFn;
    this.log = log;
  }

  /** @param {any} record */
  record(record) {
    return recordModelCall(this.log, record);
  }

  load() {
    return this.settingsRepo.load();
  }

  /**
   * @param {{ title?: string, notes?: string[], projects?: string[] }} snapshot
   * @returns {Promise<{ standardize: boolean, breakdown: boolean }>}
   */
  async decide(snapshot) {
    const settings = this.load();
    const model = resolveJevModel(settings);
    const state = jevState(snapshot);
    const request = { state, questions: Object.keys(JEV_QUESTIONS) };
    if (!settings.jevApiKey) {
      await this.record({ provider: 'jev', model, ok: false, skipped: 'no-key', request });
      return { standardize: false, breakdown: false };
    }
    const started = Date.now();
    try {
      const response = await this.evaluate({
        baseUrl: settings.jevBaseUrl,
        apiKey: settings.jevApiKey,
        model,
        state,
        questions: JEV_QUESTIONS
      });
      const answers = response?.answers || {};
      const decision = {
        standardize: needsAction(answers.standardize),
        breakdown: needsAction(answers.breakdown)
      };
      await this.record({
        provider: 'jev',
        model,
        ok: true,
        ms: Date.now() - started,
        request,
        response: {
          standardize: noulSummary(answers.standardize),
          breakdown: noulSummary(answers.breakdown)
        },
        decision
      });
      return decision;
    } catch (error) {
      await this.record({
        provider: 'jev',
        model,
        ok: false,
        ms: Date.now() - started,
        error: error && error.message ? error.message : '模型请求失败',
        request
      });
      throw error;
    }
  }

  /**
   * @param {import('../infrastructure/storage/llm-settings-repository.js').LlmSettings} [settings]
   * @returns {Promise<string[]>}
   */
  listModels(settings = this.load()) {
    return this.listModelsFn({
      baseUrl: settings.jevBaseUrl,
      apiKey: settings.jevApiKey
    });
  }
}
