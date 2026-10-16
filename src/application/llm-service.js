/**
 * 读取本机 LLM 设置并发起补全。未配置时抛出 LlmRequestError。
 */

import { chatCompletion, listModels, LlmRequestError, streamChatCompletionWithTools } from '../infrastructure/llm/openai-compatible-client.js';
import { recordModelCall } from '../infrastructure/log/model-log.js';
import { resolveLlmModel } from '../infrastructure/storage/llm-settings-repository.js';
import { Events } from './event-bus.js';

export class LlmService {
  /**
   * @param {object} deps
   * @param {import('../infrastructure/storage/llm-settings-repository.js').LlmSettingsRepository} deps.settingsRepo
   * @param {import('./event-bus.js').EventBus} deps.eventBus
   * @param {typeof chatCompletion} [deps.chat]
   * @param {typeof listModels} [deps.listModels]
   * @param {(record: any) => Promise<void>|void} [deps.log]
   */
  constructor({ settingsRepo, eventBus, chat = chatCompletion, listModels: listModelsFn = listModels, log }) {
    this.settingsRepo = settingsRepo;
    this.eventBus = eventBus;
    this.chat = chat;
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
   * 不抛错。某一行空着时返回默认模型，默认也空着时返回空字符串。
   * @param {'model'|'agentModel'|'breakdownModel'|'tagModel'|'standardizeModel'} [field]
   * @returns {string}
   */
  modelFor(field = 'model') {
    return resolveLlmModel(this.load(), field);
  }

  /**
   * @param {{ system?: string, user: string, slot?: 'model'|'agentModel'|'breakdownModel'|'tagModel'|'standardizeModel', maxTokens?: number }} input
   * @returns {Promise<string>}
   */
  async complete({ system, user, slot = 'model', maxTokens }) {
    const settings = this.load();
    if (!settings.apiKey) {
      throw new LlmRequestError('请先在设置中填写 API Key', 'not-configured');
    }
    const model = resolveLlmModel(settings, slot);
    if (!model) {
      throw new LlmRequestError('请先在设置中填写默认模型', 'not-configured');
    }
    const started = Date.now();
    const request = { system: system || '', user };
    try {
      const text = await this.chat({
        baseUrl: settings.baseUrl,
        fullUrl: settings.fullUrl,
        apiKey: settings.apiKey,
        model,
        system,
        user,
        maxTokens
      });
      await this.record({
        provider: 'chat',
        slot,
        model,
        ok: true,
        ms: Date.now() - started,
        request,
        response: text
      });
      return text;
    } catch (error) {
      await this.record({
        provider: 'chat',
        slot,
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
   * 用这段对话里已经写下的模型，不在发送时再读设置。
   * @param {{ messages: any[], tools: any[], model?: string, signal?: AbortSignal, onDelta?: (delta: { type: 'content', text: string } | { type: 'tools' }) => void }} input
   */
  async completeWithTools({ messages, tools, model, signal, onDelta }) {
    const settings = this.load();
    if (!settings.apiKey) {
      throw new LlmRequestError('请先在设置中填写 API Key', 'not-configured');
    }
    const chosen = String(model || '').trim();
    if (!chosen) {
      throw new LlmRequestError('请先在设置中填写默认模型', 'not-configured');
    }
    const started = Date.now();
    try {
      const response = await streamChatCompletionWithTools({
        baseUrl: settings.baseUrl,
        fullUrl: settings.fullUrl,
        apiKey: settings.apiKey,
        model: chosen,
        messages,
        tools,
        signal,
        onDelta
      });
      await this.record({
        provider: 'chat',
        slot: 'agent',
        model: chosen,
        ok: true,
        ms: Date.now() - started
      });
      return response;
    } catch (error) {
      await this.record({
        provider: 'chat',
        slot: 'agent',
        model: chosen,
        ok: false,
        ms: Date.now() - started,
        error: error && error.message ? error.message : '模型请求失败'
      });
      throw error;
    }
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
