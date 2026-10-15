import { AGENT_SYSTEM } from '../domain/agent/prompt.js';
import { READ_NAMES, WRITE_NAMES, toolsForTurn } from '../domain/agent/catalog.js';
import { classifyTurn } from '../domain/agent/turn.js';
import { tagDirective } from '../domain/agent/tag-intent.js';
import { redact } from '../domain/agent/redact.js';
import { AgentRuntime, dropStaged, editStaged, moveStaged, rowFromCall } from './agent-runtime.js';

const MAX_ROUNDS = 8;

export class AgentSession {
  /**
   * @param {object} deps
   * @param {AgentRuntime} deps.runtime
   * @param {(input: { messages: any[], tools: any[] }) => Promise<{ content: string, toolCalls: any[] }>} deps.complete
   * @param {(record: any) => Promise<void>|void} [deps.log]
   * @param {number} [deps.maxRounds]
   */
  constructor({ runtime, complete, log, maxRounds = MAX_ROUNDS }) {
    this.runtime = runtime;
    this.complete = complete;
    this.log = log || (() => {});
    this.maxRounds = maxRounds;
    /** @type {{ role: 'user'|'assistant', text: string }[]} */
    this.transcript = [];
    /** @type {any[]} */
    this.staged = [];
    /** @type {string[]} */
    this.detailDates = [];
    /** @type {any[]} */
    this.modelMessages = [{ role: 'system', content: AGENT_SYSTEM }];
  }

  /** @param {string} kind @param {any} payload */
  async record(kind, payload) {
    await this.log(redact({ time: new Date().toISOString(), kind, ...payload }));
  }

  rows() {
    return this.staged.map(rowFromCall);
  }

  /**
   * @param {string} id
   * @param {Record<string, any>} patch
   */
  async editRow(id, patch) {
    this.staged = editStaged(this.staged, id, patch);
    await this.record('proposal_edit', { id, patch });
    return this.rows();
  }

  /** @param {string} id */
  async dropRow(id) {
    this.staged = dropStaged(this.staged, id);
    await this.record('proposal_edit', { id, dropped: true });
    return this.rows();
  }

  /** @param {string} id @param {-1|1} direction */
  async moveRow(id, direction) {
    this.staged = moveStaged(this.staged, id, direction);
    await this.record('proposal_edit', { id, direction });
    return this.rows();
  }

  async cancel() {
    this.staged = [];
    await this.record('cancel', {});
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
    return { ok: true, rows: [] };
  }

  /**
   * @param {{ id: string, name: string, arguments: any }} call
   * @param {ReturnType<typeof classifyTurn>} turn
   */
  async handleTool(call, turn) {
    await this.record('tool_call', { name: call.name, arguments: call.arguments || {} });
    if (READ_NAMES.has(call.name)) {
      const result = this.runtime.read(call.name, call.arguments || {}, this.detailDates);
      this.detailDates = result.detailDates || this.detailDates;
      const payload = result.ok ? result.data : { error: result.error };
      await this.record('tool_result', { name: call.name, ok: result.ok, payload });
      return payload;
    }
    if (WRITE_NAMES.has(call.name)) {
      const result = this.runtime.stage(this.staged, call.name, call.arguments || {}, turn);
      if (result.ok) this.staged = result.staged;
      const payload = result.ok ? { ok: true } : { error: result.error };
      await this.record('tool_result', { name: call.name, ok: result.ok, payload });
      return payload;
    }
    const payload = { error: '没有这个函数' };
    await this.record('tool_result', { name: call.name, ok: false, payload });
    return payload;
  }

  /** @param {string} text */
  async submit(text) {
    const raw = String(text || '').trim();
    if (!raw) return { ok: false, error: '先写一句话', rows: this.rows() };
    const world = this.runtime.world();
    const turn = classifyTurn(raw, { viewedKey: world.viewedKey, today: world.today });
    turn.tagDirective = tagDirective(raw, world.tags);
    this.detailDates = [];
    this.transcript.push({ role: 'user', text: raw });
    await this.record('user_message', { text: raw, turn });
    const proposalNote = this.staged.length ? `\n\n当前方案：\n${JSON.stringify(this.rows())}` : '';
    const context = this.runtime.contextFor(turn);
    this.modelMessages.push({ role: 'user', content: `${context}\n\n${raw}${proposalNote}` });
    const tools = toolsForTurn(turn);
    let assistantText = '';

    for (let round = 0; round < this.maxRounds; round += 1) {
      await this.record('model_request', {
        round,
        messages: this.modelMessages,
        tools: tools.map((item) => item.function.name)
      });
      let response;
      try {
        response = await this.complete({ messages: this.modelMessages, tools });
      } catch (error) {
        const message = error && error.message ? error.message : '模型请求失败';
        await this.record('model_response', { error: message });
        this.transcript.push({ role: 'assistant', text: message });
        return { ok: false, error: message, rows: this.rows() };
      }
      if (!response) {
        const message = '模型没有返回文本';
        await this.record('model_response', { error: message });
        this.transcript.push({ role: 'assistant', text: message });
        return { ok: false, error: message, rows: this.rows() };
      }
      const toolCalls = response.toolCalls || [];
      await this.record('model_response', { content: response.content || '', toolCalls });
      if (!toolCalls.length) {
        assistantText = response.content || '';
        break;
      }
      this.modelMessages.push({
        role: 'assistant',
        content: response.content || '',
        tool_calls: toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: JSON.stringify(call.arguments || {}) }
        }))
      });
      for (const call of toolCalls) {
        const payload = await this.handleTool(call, turn);
        this.modelMessages.push({
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
    this.transcript.push({ role: 'assistant', text: assistantText });
    await this.record('assistant_message', { text: assistantText });
    return { ok: true, text: assistantText, rows: this.rows() };
  }
}
