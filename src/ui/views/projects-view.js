import { escapeHtml } from '../../domain/shared/escape-html.js';
import { normalizeSubtasks } from '../../domain/schedule/daily-task.js';

export class ProjectsView {
  /** @param {import('../../application/schedule-app.js').ScheduleApp} app */
  constructor(app) {
    this.app = app;
    /** @type {Set<string>} */
    this._expanded = new Set();
    /** @type {Set<string>} */
    this._taskExpanded = new Set();
  }

  /** @param {string} id */
  toggleExpand(id) {
    if (this._expanded.has(id)) this._expanded.delete(id);
    else this._expanded.add(id);
    this.render();
  }

  /** @param {string} id */
  ensureExpanded(id) {
    this._expanded.add(id);
  }

  /** @param {string} taskId */
  toggleTaskExpand(taskId) {
    if (this._taskExpanded.has(taskId)) this._taskExpanded.delete(taskId);
    else this._taskExpanded.add(taskId);
    this.render();
  }

  /** @param {string} taskId */
  ensureTaskExpanded(taskId) {
    this._taskExpanded.add(taskId);
  }

  render() {
    const container = document.getElementById('projectsList');
    if (!container) return;
    const projects = this.app.scheduleService.workspace.projects || [];
    if (!projects.length) {
      container.innerHTML =
        '<div class="text-xs text-zinc-500 py-2">暂无项目。输入名称后回车新建，拆出的任务会同时进入今日必做。</div>';
      return;
    }

    container.innerHTML = projects
      .map((project) => {
        const mine = project.tasks || [];
        const open = this._expanded.has(project.id);
        const done = mine.filter((t) => t.completed).length;
        const count =
          mine.length > 0
            ? `<span class="task-subtask-count">${done}/${mine.length}</span>`
            : '';
        const rows = mine.map((task) => this.renderProjectTask(project, task)).join('');

        return `
          <div class="project-block">
            <div class="flex items-center gap-2 py-2">
              <button type="button" class="${open ? 'task-chevron is-open' : 'task-chevron'}" title="展开任务"
                onclick="app.toggleProjectExpand('${project.id}')">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
              <span class="flex-1 min-w-0 text-sm truncate">${escapeHtml(project.name)}</span>
              ${count}
              <button type="button" class="action action-quiet action-mono" onclick="app.renameProject('${project.id}')">改名</button>
              <button type="button" class="action action-quiet action-mono action-danger" onclick="app.deleteProject('${project.id}')">删除</button>
            </div>
            ${
              open
                ? `<div class="task-subtasks mb-2">
                    ${rows || '<div class="text-[11px] text-zinc-500 px-2 py-1">还没有任务</div>'}
                    <div class="task-subtask-add flex items-center gap-2 px-2 pb-2 pt-1">
                      <input type="text" class="field flex-1 px-2 py-1 text-xs"
                        placeholder="添加任务，回车进入今日必做"
                        onkeydown="app.handleProjectTaskInput(event, '${project.id}')">
                    </div>
                  </div>`
                : ''
            }
          </div>`;
      })
      .join('');
  }

  /**
   * @param {import('../../data/workspace-record.js').ProjectRecord} project
   * @param {import('../../data/workspace-record.js').ProjectTaskRecord} task
   */
  renderProjectTask(project, task) {
    const list = task.list === 'optional' ? 'optional' : 'required';
    const listLabel = list === 'required' ? '必做' : '选做';
    const subtasks = normalizeSubtasks(task.subtasks);
    const doneCount = subtasks.filter((s) => s.completed).length;
    const expanded = this._taskExpanded.has(task.id);
    const countBadge =
      subtasks.length > 0
        ? `<span class="task-subtask-count" title="展开子任务" onclick="app.toggleProjectTaskExpand('${task.id}')">${doneCount}/${subtasks.length}</span>`
        : '';

    return `
      <div class="project-task">
        <div class="task-subtask-row flex items-center gap-2 py-1.5 px-2">
          <button type="button" class="${expanded ? 'task-chevron is-open' : 'task-chevron'}" title="展开子任务"
            onclick="app.toggleProjectTaskExpand('${task.id}')">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
          <input type="checkbox" class="checkbox-custom shrink-0"
            ${task.completed ? 'checked' : ''}
            onchange="app.toggleProjectTask('${project.id}', '${task.id}')">
          <span class="flex-1 min-w-0 text-xs ${task.completed ? 'line-through text-zinc-600' : 'text-zinc-300'}">${escapeHtml(task.text)}</span>
          ${countBadge}
          <span class="chip shrink-0">${listLabel}</span>
          <button type="button" class="action action-quiet action-icon action-danger" title="删除任务"
            onclick="app.deleteProjectTask('${project.id}', '${task.id}')">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </div>
        ${expanded ? this.renderSubtasksPanel(project, task, subtasks) : ''}
      </div>`;
  }

  /**
   * @param {import('../../data/workspace-record.js').ProjectRecord} project
   * @param {import('../../data/workspace-record.js').ProjectTaskRecord} task
   * @param {import('../../domain/schedule/daily-task.js').Subtask[]} subtasks
   */
  renderSubtasksPanel(project, task, subtasks) {
    const rows = subtasks
      .map(
        (s) => `
        <div class="task-subtask-row flex items-center gap-2 py-1.5 px-2">
          <input type="checkbox" class="checkbox-custom shrink-0"
            ${s.completed ? 'checked' : ''}
            onchange="app.toggleProjectSubtask('${project.id}', '${task.id}', '${s.id}')">
          <span class="flex-1 min-w-0 text-xs ${s.completed ? 'line-through text-zinc-600' : 'text-zinc-300'}">${escapeHtml(s.text)}</span>
          <button type="button" class="action action-quiet action-icon action-danger" title="删除子任务"
            onclick="app.deleteProjectSubtask('${project.id}', '${task.id}', '${s.id}')">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </div>`
      )
      .join('');

    return `
      <div class="task-subtasks">
        ${rows || '<div class="text-[11px] text-zinc-500 px-2 py-1">暂无子任务</div>'}
        <div class="task-subtask-add flex items-center gap-2 px-2 pb-2 pt-1">
          <input type="text" class="field flex-1 px-2 py-1 text-xs"
            placeholder="添加子任务，回车确认"
            onkeydown="app.handleProjectSubtaskInput(event, '${project.id}', '${task.id}')"
            onclick="event.stopPropagation()">
        </div>
      </div>`;
  }
}
