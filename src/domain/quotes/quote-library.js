/**
 * 格言库。pickQuote 按日期稳定选取；quoteForHour 让首页标题每个本地小时换一句。
 */

export const QUOTES = [
  { text: '今天只做今天能做完的事。', author: 'CEOS' },
  { text: '把一天当成一家公司来开。', author: 'CEOS' },
  { text: '先完成，再完善。', author: 'CEOS' },
  { text: '未写下来的优先级，只是一种心情。', author: 'CEOS' },
  { text: '少开一个会，多关上一件事。', author: 'CEOS' },
  { text: '精力是预算，不是天气。', author: 'CEOS' },
  { text: '重要的事很少碰巧发生。', author: 'CEOS' },
  { text: '选择做什么，就是选择不做什么。', author: 'CEOS' },
  { text: '进度来自关闭，不来自开始。', author: 'CEOS' },
  { text: '一个完成的小决定，好过十个悬着的大计划。', author: 'CEOS' },
  { text: '把灵感先放进箱子，别让它打断今天。', author: 'CEOS' },
  { text: '前序没完成时，后面的事只是焦虑。', author: 'CEOS' },
  { text: '日历是承诺，清单是执行。', author: 'CEOS' },
  { text: '连续的一天，比完美的一天更值钱。', author: 'CEOS' },
  { text: '看清这周的节奏，再谈这年的目标。', author: 'CEOS' },
  { text: '里程碑是日期，不是口号。', author: 'CEOS' },
  { text: '项目要有名字，任务要有今天。', author: 'CEOS' },
  { text: '做不完的事，写下来，而不是背下来。', author: 'CEOS' },
  { text: '复盘是给明天的自己留一张地图。', author: 'CEOS' },
  { text: '忙和推进不是同一件事。', author: 'CEOS' },
  { text: '把必做缩到能在今天结束。', author: 'CEOS' },
  { text: '选做是余地，不是第二份必做。', author: 'CEOS' },
  { text: '没有截止日期的想法，还只是兴趣。', author: 'CEOS' },
  { text: '依赖没解开之前，不要假装可以并行。', author: 'CEOS' },
  { text: '一天的质量，看你关掉了什么。', author: 'CEOS' },
  { text: '早晨决定三件事，晚上核对三件事。', author: 'CEOS' },
  { text: '深工作需要一段不被借走的时间。', author: 'CEOS' },
  { text: '别人的紧急，不一定是你的重要。', author: 'CEOS' },
  { text: '目标要能放上时间轴。', author: 'CEOS' },
  { text: '小步提交，大方向才看得见。', author: 'CEOS' },
  { text: '把「以后再说」改成一个具体的日子。', author: 'CEOS' },
  { text: '完成率下降时，先减任务，再加时间。', author: 'CEOS' },
  { text: '连续中断一天，比连续完美更需要被看见。', author: 'CEOS' },
  { text: '今天的必做，不替昨天辩护。', author: 'CEOS' },
  { text: '写给团队的日报，也是写给自己的。', author: 'CEOS' },
  { text: '一个项目如果七天没有进展，就该被问一句。', author: 'CEOS' },
  { text: '灵感滞留太久，就不再是机会，而是库存。', author: 'CEOS' },
  { text: '先保护做出决定的时间。', author: 'CEOS' },
  { text: '清楚的不，是进度的一部分。', author: 'CEOS' },
  { text: '把重复的事标成周期，把例外留在今天。', author: 'CEOS' },
  { text: '子任务是把大石头切成今天能搬的块。', author: 'CEOS' },
  { text: '置顶的应该很少。', author: 'CEOS' },
  { text: '数字只描述节奏，不代替判断。', author: 'CEOS' },
  { text: '一天结束时，清单应该比早晨短。', author: 'CEOS' },
  { text: '你经营的第一家公司，是你自己的一天。', author: 'CEOS' },
  { text: '开始很容易，收尾才算数。', author: 'CEOS' },
  { text: '把注意力当成只能花一次的预算。', author: 'CEOS' },
  { text: '下周的计划，从这周没做完的原因开始。', author: 'CEOS' },
  { text: '可见的进度，会减少无谓的焦虑。', author: 'CEOS' },
  { text: '一次只推进一条关键路径。', author: 'CEOS' },
  { text: '日期切换，不把未决的情绪也切换过去。', author: 'CEOS' },
  { text: '就绪的灵感，今天就要给它一个位置。', author: 'CEOS' },
  { text: '空的一天不是失败，没有记录才是。', author: 'CEOS' },
  { text: '把话说清楚，再把事做短。', author: 'CEOS' },
  { text: '长期目标靠一串短的今天撑住。', author: 'CEOS' },
  { text: '你不需要更多工具，你需要更少同时打开的事。', author: 'CEOS' },
  { text: '检查完成，比再加一条更重要。', author: 'CEOS' },
  { text: '今天的格子亮不亮，明天才看得懂。', author: 'CEOS' },
  { text: '做一个能被复述的决定。', author: 'CEOS' },
  { text: '把公司开在日历上，而不是开在脑子里。', author: 'CEOS' }
];

/**
 * @param {string} dateKey
 * @returns {number}
 */
export function hashDateKey(dateKey) {
  let hash = 0;
  const text = String(dateKey || '');
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/**
 * @param {string} dateKey
 * @param {number} [offset]
 * @returns {{ text: string, author: string, index: number }}
 */
export function pickQuote(dateKey, offset = 0) {
  const count = QUOTES.length;
  const index = (hashDateKey(dateKey) + Number(offset || 0)) % count;
  const normalized = (index + count) % count;
  return { ...QUOTES[normalized], index: normalized };
}

/**
 * 本地小时的序号。同一小时内不变，下一小时加一。
 * @param {Date} [date]
 * @returns {number}
 */
export function localHourIndex(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()) / 3600000);
}

/**
 * 距离下一个本地整点的毫秒数。
 * @param {Date} [date]
 * @returns {number}
 */
export function msUntilNextHour(date = new Date()) {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  next.setHours(date.getHours() + 1);
  const delta = next.getTime() - date.getTime();
  return delta > 0 ? delta : 3600000;
}

/**
 * 首页标题。同一个本地小时内是同一句，整点切换到下一句。
 * @param {Date} [date]
 * @returns {{ text: string, author: string, index: number }}
 */
export function quoteForHour(date = new Date()) {
  return pickQuote('hour', localHourIndex(date));
}

/**
 * 随机取一条，并避开刚刚显示过的那句。
 * @param {number} [previousIndex]
 * @param {() => number} [random]
 * @returns {{ text: string, author: string, index: number }}
 */
export function nextRandomQuote(previousIndex = -1, random = Math.random) {
  const count = QUOTES.length;
  let index = Math.floor(Number(random()) * count);
  if (!Number.isInteger(index) || index < 0 || index >= count) index = 0;
  if (count > 1 && index === previousIndex) index = (index + 1) % count;
  return { ...QUOTES[index], index };
}
