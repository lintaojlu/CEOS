const AI_EVAL_PROXY_URL = 'http://localhost:2233/api/ai-eval';

function $(id) {
  return document.getElementById(id);
}

function renderMarkdown(text) {
  if (!text) return '';
  if (typeof marked !== 'undefined' && marked.parse) {
    try {
      return marked.parse(text, { gfm: true });
    } catch {
      return escapeHtml(text).replace(/\n/g, '<br>');
    }
  }
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

/**
 * @param {() => import('../application/schedule-app.js').ScheduleApp} getApp
 */
export function createAiEval(getApp) {
  function getCurrentDayData() {
    const app = getApp();
    if (!app || typeof app.getStateForAi !== 'function') {
      return {
        required: [],
        optional: [],
        ideas: [],
        reflection: '',
        reflectionTags: []
      };
    }
    try {
      const state = app.getStateForAi();
      const reflectionTextarea = $('dailyReflection');
      return {
        required: state.required || [],
        optional: state.optional || [],
        ideas: state.ideas || [],
        reflection: reflectionTextarea ? reflectionTextarea.value : state.reflection || '',
        reflectionTags: Array.isArray(state.reflectionTags) ? state.reflectionTags : []
      };
    } catch {
      return {
        required: [],
        optional: [],
        ideas: [],
        reflection: '',
        reflectionTags: []
      };
    }
  }

  function taskLabel(task) {
    const app = getApp();
    if (app && app.scheduleService && typeof app.scheduleService.taskTitle === 'function') {
      return app.scheduleService.taskTitle(task);
    }
    return (task && (task.text || task.title)) || '';
  }

  function formatTasks(list) {
    if (!list || list.length === 0) return '（无）';
    return list
      .map((t) => {
        const status = t.completed ? '已完成' : '未完成';
        let timeStr = '';
        if (t.time) {
          const d = new Date(t.time);
          if (!isNaN(d.getTime())) {
            timeStr = d.toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
          }
        }
        const note = t.note ? `（${t.note}）` : '';
        const timePart = timeStr ? ` @ ${timeStr}` : '';
        const content = taskLabel(t);
        const due = t.dueDate ? ` DDL:${t.dueDate}` : '';
        return `- [${status}] ${content}${timePart}${due}${note}`;
      })
      .join('\n');
  }

  function formatDoneTasks(list) {
    if (!list || list.length === 0) return '（今日暂无已完成任务）';
    const done = list.filter((t) => t && t.completed);
    if (!done.length) return '（今日暂无已完成任务）';
    return done
      .map((t) => {
        const content = taskLabel(t);
        const note = t.note ? `（${t.note}）` : '';
        return `- ${content}${note}`;
      })
      .join('\n');
  }

  function buildPrompt() {
    const data = getCurrentDayData();
    const app = getApp();
    const date = app && app.currentDate ? app.currentDate : new Date();
    const dateStr = date.toISOString().split('T')[0];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const mdStr = `${month}.${day}`;

    return [
      '你是一位擅长帮助 CEO 整理业务进展与投融资进展的高级助理，请用简洁、结构化的中文，把下面的信息整理成一篇可直接发送给团队的《AI吊坠BU 日报》。',
      '',
      '【期望输出格式示例（仅供格式参考，不要使用其中任何内容）】',
      `AI吊坠BU ${mdStr} 日报`,
      '左侧',
      '- 团队开年拉通会，完成时间线和工作重点的梳理',
      '右侧',
      '- 暂无进展',
      '【写作要求】',
      '1. 只输出日报正文，不要解释你的操作，也不要添加额外的小节或问候语。',
      '2. 标题第一行必须为：AI吊坠BU ' + mdStr + ' 日报（日期用当前日期的「月.日」格式）。',
      '3. 标题后空一行，输出一行“左侧”，下面用若干条以“- ”开头的项目符号，分别概括业务进展。',
      '4. 再空一行，输出一行“右侧”，下面用若干条以“- ”开头的项目符号，分别概括投融资 / 募资方面的进展；若没有，则只输出一条“- 暂无进展”。',
      '5. 只把“已完成”的任务整理成进展；未完成的任务只作为理解参考。',
      '',
      '【输入数据】',
      `日期（ISO）：${dateStr}`,
      '',
      '已完成的必做任务：',
      formatDoneTasks(data.required),
      '',
      '已完成的选做任务：',
      formatDoneTasks(data.optional),
      '',
      '灵感收集箱：',
      formatTasks(data.ideas),
      '',
      '每日感悟原文：',
      data.reflection || '（今日暂未填写感悟）'
    ].join('\n');
  }

  async function callViaProxy(prompt) {
    const res = await fetch(AI_EVAL_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`代理返回 ${res.status}: ${text}`);
    }
    const data = await res.json();
    if (data && typeof data.text === 'string') return data.text.trim();
    if (data && typeof data.content === 'string') return data.content.trim();
    throw new Error('代理返回格式需为 { text: "..." }');
  }

  async function evaluateToday() {
    const statusEl = $('aiEvalStatus');
    const resultEl = $('aiEvalResult');
    const btnEl = $('aiEvaluateBtn');
    if (!statusEl || !resultEl) return;
    const originalBtnText = btnEl ? btnEl.textContent : '';
    try {
      if (btnEl) {
        btnEl.disabled = true;
        btnEl.textContent = '生成中...';
        btnEl.classList.add('opacity-70', 'cursor-not-allowed');
      }
      statusEl.textContent = 'AI 正在根据今天的任务与感悟生成工作日报，请稍候...';
      resultEl.innerHTML = '';
      const prompt = buildPrompt();
      console.log('[AI 日报] 发送 Prompt:', prompt);
      const answer = await callViaProxy(prompt);
      console.log('[AI 日报] 接收 Answer:', answer);
      resultEl.dataset.markdown = answer || '';
      resultEl.innerHTML = renderMarkdown(answer);
      const app = getApp();
      if (app && typeof app.setCurrentDayAiEval === 'function') app.setCurrentDayAiEval(answer);
      statusEl.textContent = '生成完成。你可以直接复制这份日报，发送给团队或保存归档。';
    } catch (err) {
      console.error(err);
      statusEl.textContent = err && err.message ? `调用失败：${err.message}` : '调用 AI 日报生成失败，请稍后重试。';
    } finally {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.textContent = originalBtnText || '生成今日日报';
        btnEl.classList.remove('opacity-70', 'cursor-not-allowed');
      }
    }
  }

  async function copyTodayReport() {
    const resultEl = $('aiEvalResult');
    if (!resultEl) return;
    let textToCopy = '';
    if (resultEl.dataset && typeof resultEl.dataset.markdown === 'string') {
      textToCopy = resultEl.dataset.markdown.trim();
    }
    if (!textToCopy) textToCopy = (resultEl.innerText || resultEl.textContent || '').trim();
    if (!textToCopy) {
      alert('当前没有可复制的日报内容，请先生成今日日报。');
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      const statusEl = $('aiEvalStatus');
      if (statusEl) {
        const oldText = statusEl.textContent;
        statusEl.textContent = '已复制到剪贴板，可直接粘贴发送。';
        setTimeout(() => {
          if (statusEl.textContent === '已复制到剪贴板，可直接粘贴发送。') {
            statusEl.textContent = oldText;
          }
        }, 2000);
      }
    } catch (e) {
      console.error('[AI 日报] 复制失败:', e);
      alert('复制失败，请手动选择文本复制。');
    }
  }

  return { evaluateToday, copyTodayReport };
}
