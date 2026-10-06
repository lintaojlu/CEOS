import { escapeHtml } from '../../domain/shared/escape-html.js';
import { normalizeSubtasks } from '../../domain/schedule/daily-task.js';
import { todayKey } from '../../domain/shared/date-key.js';

export class PomodoroView {
  /**
   * @param {import('../../application/schedule-app.js').ScheduleApp} app
   */
  constructor(app) {
    this.app = app;
  }

  render() {
    const host = document.getElementById('pomodoroPanel');
    if (!host || !this.app.pomodoroService) return;

    const snap = this.app.pomodoroService.getSnapshot();
    const incomplete = this.app.pomodoroService.listTodayIncomplete();
    const activeId = snap.session?.taskId || snap.selected?.taskId || '';
    const activeList = snap.session?.list || snap.selected?.list || '';
    const dockId = snap.session?.pendingTaskId || '';

    const task = snap.activeTask;
    const title = task
      ? this.app.scheduleService.taskTitle(task)
      : snap.phase === 'idle'
        ? '选择一条今天的未完成任务'
        : '任务已不存在';

    const phaseLabel =
      snap.phase === 'work' ? '专注中' : snap.phase === 'break' ? '休息中' : '待开始';

    const timerDisplay =
      snap.phase === 'idle' ? '25:00' : snap.remainingLabel;

    let actions = '';
    if (snap.phase === 'idle') {
      actions = `<button type="button" class="action action-primary" onclick="app.startPomodoro()" ${
        activeId ? '' : 'disabled'
      }>开始</button>`;
    } else if (snap.phase === 'work') {
      actions = `<button type="button" class="action action-danger" onclick="app.abandonPomodoro()">放弃</button>`;
    } else {
      actions = `
        <button type="button" class="action action-primary" onclick="app.skipPomodoroBreak()">跳过休息</button>
        <button type="button" class="action action-quiet" onclick="app.abandonPomodoro()">结束</button>`;
    }

    const subtasks = task ? normalizeSubtasks(task.subtasks) : [];
    const subRows = subtasks
      .map(
        (s) => `
        <div class="task-subtask-row flex items-center gap-2 py-1.5 px-2">
          <input type="checkbox" class="checkbox-custom shrink-0"
            ${s.completed ? 'checked' : ''}
            onchange="app.togglePomodoroSubtask('${activeList}', '${task.id}', '${s.id}')">
          <span class="flex-1 min-w-0 text-xs ${s.completed ? 'line-through text-zinc-600' : 'text-zinc-300'}">${escapeHtml(s.text)}</span>
        </div>`
      )
      .join('');

    const listHtml = incomplete.length
      ? incomplete
          .map(({ list, task: t }) => {
            const selected =
              t.id === activeId && list === activeList
                ? 'pomodoro-task is-selected'
                : 'pomodoro-task';
            const docked = t.id === dockId ? '<span class="chip shrink-0">休息后</span>' : '';
            const count =
              typeof t.pomodoros === 'number' && t.pomodoros > 0
                ? `<span class="pomodoro-count" title="今日番茄数">${t.pomodoros}</span>`
                : '';
            const kind = list === 'required' ? '必做' : '选做';
            return `
              <button type="button" class="${selected}" onclick="app.selectPomodoroTask('${list}', '${t.id}')">
                <span class="chip shrink-0">${kind}</span>
                <span class="flex-1 min-w-0 truncate text-sm text-left">${escapeHtml(this.app.scheduleService.taskTitle(t))}</span>
                ${docked}
                ${count}
              </button>`;
          })
          .join('')
      : `<div class="text-xs text-zinc-500 py-3 px-1">今天没有未完成的必做/选做。去任务清单添加后再回来专注。</div>`;

    host.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div class="pomodoro-focus paper-well p-4">
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="chip ${snap.phase === 'work' ? 'chip-accent' : snap.phase === 'break' ? 'chip-emerald' : ''}">${phaseLabel}</span>
            <span class="text-[10px] font-mono text-zinc-600 tracking-[.12em] uppercase">Today · ${escapeHtml(todayKey())}</span>
          </div>
          <div class="pomodoro-timer font-mono text-5xl md:text-6xl leading-none text-zinc-200 mb-3">${timerDisplay}</div>
          <div class="text-sm ${task ? '' : 'text-zinc-500'} mb-4 break-words">${escapeHtml(title)}</div>
          <div class="flex flex-wrap items-center gap-2 mb-4">${actions}</div>
          ${
            task
              ? `<div class="task-subtasks">
                  <div class="field-label mb-1.5 px-2">子任务</div>
                  ${subRows || '<div class="text-[11px] text-zinc-500 px-2 py-1">暂无子任务</div>'}
                </div>`
              : ''
          }
        </div>
        <div>
          <div class="group-label mb-2">今天的未完成任务</div>
          <div class="space-y-1 max-h-[320px] overflow-y-auto">${listHtml}</div>
        </div>
      </div>`;

    this.renderHeaderBadge(snap);
  }

  /** @param {ReturnType<import('../../application/pomodoro-service.js').PomodoroService['getSnapshot']>} snap */
  renderHeaderBadge(snap) {
    const el = document.getElementById('pomodoroHeaderBadge');
    if (!el) return;
    if (snap.phase === 'idle') {
      el.classList.add('hidden');
      el.textContent = '';
      el.removeAttribute('title');
      return;
    }
    el.classList.remove('hidden');
    const label = snap.phase === 'work' ? '专注' : '休息';
    el.textContent = `${label} ${snap.remainingLabel}`;
    el.title = snap.phase === 'work' ? '番茄钟进行中' : '休息进行中';
  }
}
