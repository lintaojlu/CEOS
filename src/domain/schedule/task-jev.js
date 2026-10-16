/**
 * 新建任务后，用 JEV 判断要不要标准化、要不要拆解。
 * 只整理文本状态和答案，不读存储、不发请求。
 * 状态里只有文字。图片要先在本机变成文字，再放进来。
 */

export const JEV_NEED_THRESHOLD = 0.5;

export const JEV_QUESTIONS = {
  standardize: {
    type: 'noul',
    instructions: '这条任务的标题是否需要标准化？',
    criteria: {
      true: '去掉首尾空白后超过 20 个字，或还夹着时间、对象、背景，不是一句能扫完的动宾短语。',
      false: '已经是不超过 20 个字的动宾短语。'
    }
  },
  breakdown: {
    type: 'noul',
    instructions: '这条任务是否需要拆成「人类任务」和「AI任务」？',
    criteria: {
      true: '既有要亲手做的部分，又有可以交给代理的部分，并且说明里还没有这两条。',
      false: '纯人手小事、已经有这两条说明、或没有可交给代理的部分。'
    }
  }
};

/**
 * @param {unknown} value
 * @returns {string}
 */
function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {object} [input]
 * @param {string} [input.title]
 * @param {string[]} [input.notes]
 * @param {string[]} [input.projects]
 * @returns {{ title: string, notes: string[], projects: string[] }}
 */
export function jevState({ title = '', notes = [], projects = [] } = {}) {
  return {
    title: text(title),
    notes: (Array.isArray(notes) ? notes : []).map(text).filter(Boolean),
    projects: (Array.isArray(projects) ? projects : []).map(text).filter(Boolean)
  };
}

/**
 * Noul 没有 confidence。只有类型正确、且「是」的概率不低于 0.5，才执行。
 * @param {any} answer
 * @returns {boolean}
 */
export function needsAction(answer) {
  const value = answer?.noul;
  return answer?.type === 'noul'
    && typeof value === 'number'
    && Number.isFinite(value)
    && value >= JEV_NEED_THRESHOLD;
}
