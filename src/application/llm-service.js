/**
 * 读取本机 LLM 设置并发起补全。未配置时抛出 LlmRequestError。
 */

import { chatCompletion, listModels, LlmRequestError } from '../infrastructure/llm/openai-compatible-client.js';
import { Events } from './event-bus.js';

export class LlmService {
  /**
   * @param {object} deps
   * @param {import('../infrastructure/storage/llm-settings-repository.js').LlmSettingsRepository} deps.settingsRepo
   * @param {import('./event-bus.js').EventBus} deps.eventBus
   * @param {typeof chatCompletion} [deps.chat]
   * @param {typeof listModels} [deps.listModels]
   */
  constructor({ settingsRepo, eventBus, chat = chatCompletion, listModels: listModelsFn = listModels }) {
    this.settingsRepo = settingsRepo;
    this.eventBus = eventBus;
    this.chat = chat;
    this.listModelsFn = listModelsFn;
  }

  load() {
    return this.settingsRepo.load();
  }

  isConfigured() {
    const settings = this.load();
    return Boolean(settings.baseUrl && settings.apiKey && settings.model);
  }

  /** @param {import('../infrastructure/storage/llm-settings-repository.js').LlmSettings} settings */
  save(settings) {
    const next = this.settingsRepo.save(settings);
    this.eventBus.emit(Events.LLM_SETTINGS_UPDATED, {});
    return next;
  }

  /**
   * @param {{ system?: string, user: string }} input
   * @returns {Promise<string>}
   */
  complete({ system, user }) {
    const settings = this.load();
    if (!settings.apiKey || !settings.model) {
      throw new LlmRequestError('请先在设置中填写默认模型和 API Key', 'not-configured');
    }
    return this.chat({
      baseUrl: settings.baseUrl,
      fullUrl: settings.fullUrl,
      apiKey: settings.apiKey,
      model: settings.model,
      system,
      user
    });
  }

  /** @param {import('../infrastructure/storage/llm-settings-repository.js').LlmSettings} [settings] @returns {Promise<string[]>} */
  listModels(settings = this.load()) {
    return this.listModelsFn({
      baseUrl: settings.baseUrl,
      fullUrl: settings.fullUrl,
      apiKey: settings.apiKey
    });
  }

  /** @returns {Promise<string>} */
  testConnection() {
    return this.complete({
      system: '你只回复两个字母 OK。',
      user: '请回复 OK'
    });
  }
}

export { LlmRequestError };
