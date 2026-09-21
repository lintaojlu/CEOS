import { escapeHtml } from '../../domain/shared/escape-html.js';
import { getDateKey } from '../../domain/shared/date-key.js';

export class MilestonesView {
  /** @param {import('../../application/schedule-app.js').ScheduleApp} app */
  constructor(app) {
    this.app = app;
  }

  render() {
    const container = document.getElementById('milestonesList');
    if (!container) return;
    const milestones = this.app.milestoneService.milestones;
    if (milestones.length === 0) {
      container.innerHTML = '<div class="text-xs text-zinc-500 py-3">暂无里程碑，点击右上角 + 添加</div>';
      return;
    }

    const todayKey = getDateKey(new Date());
    const sorted = [...milestones].sort((a, b) => {
      const aPast = a.date < todayKey;
      const bPast = b.date < todayKey;
      if (aPast && !bPast) return 1;
      if (!aPast && bPast) return -1;
      return a.date.localeCompare(b.date);
    });

    container.innerHTML = sorted
      .map((m) => {
        const isToday = m.date === todayKey;
        const mDateAtNoon = new Date(m.date + 'T12:00:00');
        const todayAtNoon = new Date(todayKey + 'T12:00:00');
        const daysLeft = Math.round((mDateAtNoon - todayAtNoon) / (1000 * 60 * 60 * 24));
        const isOverdue = daysLeft < 0 && !m.completed;

        let statusText = '';
        let statusChip = 'chip';
        if (m.completed) {
          statusText = '已完成';
          statusChip = 'chip chip-emerald';
        } else if (isOverdue) {
          statusText = `距今 ${Math.abs(daysLeft)} 天`;
          statusChip = 'chip chip-rose';
        } else if (isToday) {
          statusText = '今天';
          statusChip = 'chip chip-accent';
        } else {
          statusText = `还有 ${daysLeft} 天`;
          statusChip = daysLeft <= 3 ? 'chip chip-accent' : 'chip';
        }

        return `
          <div class="paper-well flex items-center gap-3 p-3 min-w-[260px] flex-shrink-0" data-id="${m.id}">
            <div class="w-2.5 h-2.5 rounded-full shrink-0 ${m.completed ? 'bg-accent-green' : isOverdue ? 'bg-accent-rose' : 'bg-accent-cyan'}"></div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium truncate ${m.completed ? 'line-through text-zinc-600' : 'text-zinc-200'}">${escapeHtml(m.title)}</span>
              </div>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-[11px] font-mono text-zinc-500">${m.date}</span>
                <span class="${statusChip}">${statusText}</span>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button onclick="app.editMilestone('${m.id}')" class="action action-quiet action-icon" title="编辑里程碑">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
            </div>
          </div>`;
      })
      .join('');
  }
}
