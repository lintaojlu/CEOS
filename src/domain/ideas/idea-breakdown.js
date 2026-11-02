/**
 * 把一条灵感拆成今天的任务：整理 agent 上下文与短指令。
 * 真正的写入由用户发送后走 agent（create_task + update_idea）。
 */

import { ideaBody, ideaTitle, markdownForModel } from './idea-document.js';

/** 拆解经 agent 发出时，塞进输入框「上下文」块的规则。 */
export const IDEA_BREAKDOWN_AGENT_RULES = `你在把用户提到的那一条灵感拆成今天可做的任务。

用 create_task 新建 1 到 8 条任务。这次是在拆灵感，允许 create_task，不要用 pickup_idea（pickup_idea 会删掉灵感）。
每条任务：
- date 必须是下面给出的「今天」日期
- list 默认 required
- tagId：对照上下文里的标签名单，标题或说明明显属于某一个标签时填该标签的 id；对不上或多个都沾边时才留空。不要一律留空。
- text 是任务标题
- 可选说明放 note（或 subtasks）；不要写「人类任务」「AI任务」那两套标题

全部任务写完后，用 update_idea 把该灵感标为 completed=true。text / note 按灵感原文带上，只改完成状态。不要删除灵感。

信息不够、没法拆时，先调用 ask_choices 问清。不要猜。`;

/** 用户在输入框正文里看到、可编辑的短指令。 */
export const IDEA_BREAKDOWN_USER_PROMPT = '把这条灵感拆成今天可做的任务';

/**
 * @param {object} input
 * @param {string} input.title
 * @param {string} input.body
 * @param {string} input.today
 * @returns {string}
 */
export function buildIdeaBreakdownPrompt({ title, body, today }) {
  return [
    '当前灵感',
    `标题：${title || ''}`,
    `今天：${today || ''}`,
    '正文：',
    String(body || '').trim() || '（没有）'
  ].join('\n');
}

/**
 * @param {object} input
 * @param {string} [input.rules]
 * @param {string} input.title
 * @param {string} input.body
 * @param {string} input.today
 * @returns {string}
 */
export function buildIdeaBreakdownContext(input) {
  const rules = String(input?.rules || IDEA_BREAKDOWN_AGENT_RULES).trim();
  const materials = buildIdeaBreakdownPrompt(input);
  return `${rules}\n\n${materials}`;
}

/**
 * @param {any} idea
 * @param {string} today
 * @returns {{ title: string, body: string, today: string }}
 */
export function ideaBreakdownMaterials(idea, today) {
  return {
    title: ideaTitle(idea),
    body: markdownForModel(ideaBody(idea)),
    today: String(today || '')
  };
}
