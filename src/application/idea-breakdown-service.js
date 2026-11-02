/**
 * 把一条灵感整理成 agent 输入框草稿：上下文块 + 短正文 + 灵感 mention。
 * 真正的拆解由用户发送后走 agent。
 */

import { IDEA_BREAKDOWN_USER_PROMPT, buildIdeaBreakdownContext, ideaBreakdownMaterials } from '../domain/ideas/idea-breakdown.js';
import { todayKey } from '../domain/shared/date-key.js';

export class IdeaBreakdownService {
  /**
   * @param {object} deps
   * @param {import('./idea-inbox-service.js').IdeaInboxService} deps.ideaInboxService
   * @param {() => string} [deps.now]
   */
  constructor({ ideaInboxService, now = todayKey }) {
    this.ideaInboxService = ideaInboxService;
    this.now = now;
  }

  /**
   * @param {string} ideaId
   * @returns {{ context: string, body: string, mentions: any[], flyText: string, today: string }}
   */
  prepareComposer(ideaId) {
    const idea = this.ideaInboxService.find(ideaId);
    if (!idea) throw new Error('这条灵感已经不在了');
    if (idea.archived) throw new Error('已归档的灵感不能拆解');

    const today = this.now();
    const materials = ideaBreakdownMaterials(idea, today);
    const context = buildIdeaBreakdownContext(materials);
    const title = materials.title || '未命名';
    const body = IDEA_BREAKDOWN_USER_PROMPT;
    const mentions = [{
      kind: 'idea',
      id: idea.id,
      title,
      date: '',
      label: title
    }];
    return { context, body, mentions, flyText: body, today };
  }
}
