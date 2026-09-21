import { escapeHtml } from '../../domain/shared/escape-html.js';
import { formatTime } from '../../domain/shared/date-key.js';

export class DailyTasksView {
  /**
   * @param {import('../../application/schedule-app.js').ScheduleApp} app
   */
  constructor(app) {
    this.app = app;
  }

  render() {
    const data = this.app.scheduleService.getCurrentData();
    ['required', 'optional'].forEach((type) => {
      const container = document.getElementById(`${type}Tasks`);
      if (!container) return;
      container.innerHTML = (data[type] || []).map((task) => this.renderTaskItem(task, type)).join('');
    });
    this.updateProgress();
  }

  renderTaskItem(task, type) {
    const timeStr = formatTime(new Date(task.time));
    const pinClass = task.pinned ? 'text-accent-cyan' : 'text-zinc-600 hover:text-zinc-400';
    const noteIndicator = task.note ? `<span class="text-accent-cyan text-xs ml-2">●</span>` : '';
    const recurrence = task.recurrence || '';
    const recurrenceBadge =
      recurrence === 'daily'
        ? '<span class="chip shrink-0">每日</span>'
        : recurrence === 'weekdays'
          ? '<span class="chip shrink-0">工作日</span>'
          : '';
    const dragAttrs = `draggable="true" ondragstart="app.handleTaskDragStart(event, '${type}', '${task.id}')" ondragend="app.handleTaskDragEnd(event)"`;

    return `
      <div class="task-item flex items-center gap-3 py-2 px-2.5" ondblclick="app.openTaskModal('${type}', '${task.id}')" data-id="${task.id}" data-type="${type}" ${dragAttrs}>
        <input type="checkbox" class="checkbox-custom shrink-0"
          ${task.completed ? 'checked' : ''}
          onchange="app.toggleTask('${type}', '${task.id}')">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="task-time shrink-0">${timeStr}</span>
            <span class="text-sm truncate ${task.completed ? 'line-through text-zinc-600' : ''}">${escapeHtml(task.text)}</span>
            ${recurrenceBadge}
            ${noteIndicator}
          </div>
          ${task.note ? `<div class="text-xs text-zinc-500 mt-1 pl-14 leading-relaxed">${escapeHtml(task.note)}</div>` : ''}
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button onclick="app.pinTask('${type}', '${task.id}')" class="action action-quiet action-icon ${pinClass}" title="置顶">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14M5 12l7-7 7 7"/>
            </svg>
          </button>
          <button onclick="app.openTaskModal('${type}', '${task.id}')" class="action action-quiet action-icon" title="编辑任务">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
        </div>
      </div>`;
  }

  updateProgress() {
    const { total, percentage } = this.app.scheduleService.getProgress();
    const circle = document.getElementById('progressCircle');
    const radius = 14;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    if (circle) circle.style.strokeDashoffset = String(offset);
    const progressText = document.getElementById('progressText');
    if (progressText) progressText.textContent = `${percentage}%`;
    const labelEl = document.getElementById('progressLabel');
    if (labelEl) {
      if (total === 0) labelEl.textContent = '先加几个任务吧';
      else if (percentage === 0) labelEl.textContent = '开始行动吧～';
      else if (percentage === 100) labelEl.textContent = '全部搞定，厉害！';
      else if (percentage >= 50) labelEl.textContent = '过半了，继续加油！';
      else labelEl.textContent = '稳住，你能行～';
    }
  }

  updateDateDisplay() {
    const dateKey = this.app.scheduleService.getDateKey();
    const today = this.app.scheduleService.todayKey();
    const isToday = dateKey === today;
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const el = document.getElementById('currentDate');
    if (el) {
      el.textContent = this.app.scheduleService.currentDate.toLocaleDateString('zh-CN', options);
      el.className = `font-mono text-sm font-medium ${isToday ? 'text-accent-cyan' : 'text-zinc-200'}`;
    }
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const wd = document.getElementById('currentWeekday');
    if (wd) wd.textContent = weekdays[this.app.scheduleService.currentDate.getDay()];
    this.updateStreak();
  }

  updateStreak() {
    const el = document.getElementById('streakCount');
    if (el) el.textContent = String(this.app.scheduleService.getStreakDays());
  }
}
