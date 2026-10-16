import { AGENT_SYSTEM } from '../domain/agent/prompt.js';
import { READ_NAMES, WRITE_NAMES, toolsForTurn } from '../domain/agent/catalog.js';
import { classifyTurn } from '../domain/agent/turn.js';
import { tagDirective } from '../domain/agent/tag-intent.js';
import { formatMentions } from '../domain/agent/transcript.js';
import { redact } from '../domain/agent/redact.js';
import { AgentRuntime, dropStaged, editStaged, moveStaged, rowFromCall } from './agent-runtime.js';

const MAX_ROUNDS = 8;

export class AgentSession {
  /**
   * @param {object} deps
   * @param {AgentRuntime} deps.runtime
   * @param {(input: { messages: any[], tools: any[], model?: string }) => Promise<{ content: string, reasoning?: string, toolCalls: any[] }>} deps.complete
   * @param {(record: any) => Promise<void>|void} [deps.log]
   * @param {(event: any) => Promise<void>|void} [deps.onEvent]
   * @param {number} [deps.maxRounds]
   */
  constructor({ runtime, complete, log, onEvent, maxRounds = MAX_ROUNDS }) {
    this.runtime = runtime;
    this.complete = complete;
    this.log = log || (() => {});
    this.onEvent = onEvent || null;
    this.maxRounds = maxRounds;
    this.permission = 'default';
    this.model = '';
    /** @type {{ role: 'user'|'assistant', text: string, mentions?: any[], events?: any[] }[]} */
    this.messages = [];
    /** @type {{ role: 'user'|'assistant', text: string }[]} */
    this.transcript = [];
    /** @type {any[]} */
    this.staged = [];
    /** @type {string[]} */
    this.detailDates = [];
    /** @type {any[]} */
    this.modelMessages = [{ role: 'system', content: AGENT_SYSTEM }];
  }

  /** @param {any} event */
  async emit(event) {
    if (this.onEvent) await this.onEvent(event);
  }

  /** @param {string} kind @param {any} payload */
  async record(kind, payload) {
    await this.log(redact({ time: new Date().toISOString(), kind, ...payload }));
  }

  ensureAssistant() {
    const last = this.messages[this.messages.length - 1];
    if (last && last.role === 'assistant') return last;
    const created = { role: 'assistant', text: '', events: [] };
    this.messages.push(created);
    return created;
  }

  /** @param {{ messages?: any[], staged?: any[], modelMessages?: any[], permission?: string, model?: string }} state */
  restore(state) {
    this.messages = state?.messages || [];
    this.transcript = this.messages
      .filter((item) => item.text)
      .map((item) => ({ role: item.role, text: item.text }));
    this.staged = Array.isArray(state?.staged) ? state.staged : [];
    this.detailDates = [];
    this.modelMessages = [{ role: 'system', content: AGENT_SYSTEM }, ...(state?.modelMessages || [])];
    this.permission = state?.permission || 'default';
    this.model = state?.model || '';
  }

  rows() {
    return this.staged.map(rowFromCall);
  }

  async persistStaged() {
    await this.emit({ type: 'staged', calls: this.staged });
  }

  /**
   * @param {string} id
   * @param {Record<string, any>} patch
   */
  async editRow(id, patch) {
    this.staged = editStaged(this.staged, id, patch);
    await this.record('proposal_edit', { id, patch });
    await this.persistStaged();
    return this.rows();
  }

  /** @param {string} id */
  async dropRow(id) {
    this.staged = dropStaged(this.staged, id);
    await this.record('proposal_edit', { id, dropped: true });
    await this.persistStaged();
    return this.rows();
  }

  /** @param {string} id @param {-1|1} direction */
  async moveRow(id, direction) {
    this.staged = moveStaged(this.staged, id, direction);
    await this.record('proposal_edit', { id, direction });
    await this.persistStaged();
    return this.rows();
  }

  async cancel() {
    this.staged = [];
    await this.record('cancel', {});
    await this.persistStaged();
    return this.rows();
  }

  async confirm() {
    const result = this.runtime.commit(this.staged);
    if (!result.ok) {
      const row = this.rows()[result.index] || null;
      await this.record('commit_rejected', { error: result.error, row });
      return { ok: false, error: result.error, row, rows: this.rows() };
    }
    this.staged = [];
    await this.record('commit_ok', {});
    await this.persistStaged();
    return { ok: true, rows: [] };
  }

  /**
   * @param {any} message
   */
  async pushModel(message) {
    this.modelMessages.push(message);
    await this.emit({ type: 'model', message });
  }

  /**
   * @param {{ id: string, name: string, arguments: any }} call
   * @param {ReturnType<typeof classifyTurn>} turn
   */
  async handleTool(call, turn) {
    await this.record('tool_call', { name: call.name, arguments: call.arguments || {} });
    this.ensureAssistant().events.push({
      kind: 'tool_call',
      id: call.id,
      name: call.name,
      arguments: call.arguments || {}
    });
    await this.emit({ type: 'tool_call', id: call.id, name: call.name, arguments: call.arguments || {} });

    /** @type {any} */
    let payload;
    if (READ_NAMES.has(call.name)) {
      const result = this.runtime.read(call.name, call.arguments || {}, this.detailDates);
      this.detailDates = result.detailDates || this.detailDates;
      payload = result.ok ? result.data : { error: result.error };
      await this.finishTool(call, result.ok, payload);
      return payload;
    }
    if (WRITE_NAMES.has(call.name)) {
      if (this.permission === 'read') {
        payload = { error: '当前是只读，不能改日程' };
        await this.finishTool(call, false, payload);
        return payload;
      }
      if (this.permission === 'auto') {
        const staged = this.runtime.stage([], call.name, call.arguments || {}, turn);
        if (!staged.ok) {
          payload = { error: staged.error };
          await this.finishTool(call, false, payload);
          return payload;
        }
        const only = staged.staged[staged.staged.length - 1];
        const committed = this.runtime.commit([only]);
        payload = committed.ok ? { ok: true } : { error: committed.error };
        await this.finishTool(call, committed.ok, payload);
        return payload;
      }
      const result = this.runtime.stage(this.staged, call.name, call.arguments || {}, turn);
      if (result.ok) this.staged = result.staged;
      payload = result.ok ? { ok: true } : { error: result.error };
      await this.finishTool(call, result.ok, payload);
      if (result.ok) await this.persistStaged();
      return payload;
    }
    payload = { error: '没有这个函数' };
    await this.finishTool(call, false, payload);
    return payload;
  }

  /**
   * @param {{ id: string, name: string }} call
   * @param {boolean} ok
   * @param {any} payload
   */
  async finishTool(call, ok, payload) {
    this.ensureAssistant().events.push({
      kind: 'tool_result',
      id: call.id,
      name: call.name,
      ok,
      payload
    });
    await this.record('tool_result', { name: call.name, ok, payload });
    await this.emit({ type: 'tool_result', id: call.id, name: call.name, ok, payload });
  }

  /**
   * @param {string} text
   * @param {{ mentions?: any[] }} [extras]
   */
  async submit(text, extras = {}) {
    const raw = String(text || '').trim();
    if (!raw) return { ok: false, error: '先写一句话', rows: this.rows() };
    const mentions = Array.isArray(extras.mentions) ? extras.mentions : [];
    const world = this.runtime.world();
    const turn = classifyTurn(raw, { viewedKey: world.viewedKey, today: world.today });
    turn.tagDirective = tagDirective(raw, world.tags);
    this.detailDates = [];
    this.messages.push({ role: 'user', text: raw, mentions });
    this.transcript.push({ role: 'user', text: raw });
    await this.record('user_message', { text: raw, turn });
    const proposalNote = this.staged.length ? `\n\n当前方案：\n${JSON.stringify(this.rows())}` : '';
    const context = this.runtime.contextFor(turn);
    const mentionNote = formatMentions(mentions);
    const spoken = mentionNote ? `${raw}\n\n${mentionNote}` : raw;
    const modelContent = `${context}\n\n${spoken}${proposalNote}`;
    await this.emit({ type: 'user', text: raw, mentions, modelContent });
    await this.pushModel({ role: 'user', content: modelContent });
    const tools = toolsForTurn(turn, this.permission);
    let assistantText = '';

    for (let round = 0; round < this.maxRounds; round += 1) {
      await this.record('model_request', {
        round,
        messages: this.modelMessages,
        tools: tools.map((item) => item.function.name)
      });
      let response;
      try {
        response = await this.complete({
          messages: this.modelMessages,
          tools,
          model: this.model || undefined
        });
      } catch (error) {
        const message = error && error.message ? error.message : '模型请求失败';
        return this.fail(message);
      }
      if (!response) return this.fail('模型没有返回文本');
      const toolCalls = response.toolCalls || [];
      await this.record('model_response', { content: response.content || '', toolCalls });
      if (response.reasoning) {
        this.ensureAssistant().events.push({ kind: 'reasoning', text: response.reasoning });
        await this.emit({ type: 'reasoning', text: response.reasoning });
      }
      if (!toolCalls.length) {
        assistantText = response.content || '';
        break;
      }
      const assistantMessage = {
        role: 'assistant',
        content: response.content || '',
        tool_calls: toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: JSON.stringify(call.arguments || {}) }
        }))
      };
      await this.pushModel(assistantMessage);
      for (const call of toolCalls) {
        const payload = await this.handleTool(call, turn);
        await this.pushModel({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(payload)
        });
      }
      if (response.content) assistantText = response.content;
      if (round === this.maxRounds - 1 && !assistantText) {
        assistantText = this.staged.length ? '方案在下面，确认后写入。' : '这次没有改动。';
      }
    }

    if (!assistantText) assistantText = this.staged.length ? '方案在下面，确认后写入。' : '这次没有改动。';
    return this.finish(assistantText);
  }

  /** @param {string} message */
  async fail(message) {
    await this.record('model_response', { error: message });
    this.ensureAssistant().text = message;
    this.transcript.push({ role: 'assistant', text: message });
    await this.emit({ type: 'assistant', text: message });
    return { ok: false, error: message, rows: this.rows() };
  }

  /** @param {string} assistantText */
  async finish(assistantText) {
    this.ensureAssistant().text = assistantText;
    this.transcript.push({ role: 'assistant', text: assistantText });
    await this.emit({ type: 'assistant', text: assistantText });
    await this.record('assistant_message', { text: assistantText });
    const last = this.modelMessages[this.modelMessages.length - 1];
    const already = last && last.role === 'assistant' && !last.tool_calls && last.content === assistantText;
    if (!already) await this.pushModel({ role: 'assistant', content: assistantText });
    return { ok: true, text: assistantText, rows: this.rows() };
  }
}
