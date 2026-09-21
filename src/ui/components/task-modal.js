import { taskRefKey } from '../../domain/ideas/idea-node.js';

export class TaskModal {
  /** @param {import('../../application/schedule-app.js').ScheduleApp} app */
  constructor(app) {
    this.app = app;
    this.editingTaskType = null;
    this.editingTaskId = null;
  }

  /**
   * @param {'required'|'optional'|'ideas'} type
   * @param {string} id
   */
  open(type, id) {
    this.editingTaskType = type;
    this.editingTaskId = id;

    const titleEl = document.getElementById('taskEditTitle');
    const timeEl = document.getElementById('taskEditTime');
    const noteEl = document.getElementById('taskEditNote');
    const recurrenceEl = document.getElementById('taskEditRecurrence');
    const timeRow = document.getElementById('taskEditTimeRow');
    const recurrenceRow = document.getElementById('taskEditRecurrenceRow');
    const ideasOnly = document.getElementById('taskEditIdeasOnly');
    const modalTitle = document.querySelector('#taskModal h3');

    if (type === 'ideas') {
      const idea = this.app.ideaInboxService.getNodes().find((n) => n.id === id);
      if (!idea) return;
      if (modalTitle) modalTitle.textContent = '编辑灵感';
      if (titleEl) titleEl.value = idea.text || '';
      if (noteEl) noteEl.value = idea.note || '';
      if (timeRow) timeRow.style.display = 'none';
      if (recurrenceRow) recurrenceRow.style.display = 'none';
      if (ideasOnly) {
        ideasOnly.classList.remove('hidden');
        const dueEl = document.getElementById('taskEditDueDate');
        if (dueEl) dueEl.value = idea.dueDate || '';
        this.renderPredecessorPicker(idea);
      }
    } else {
      const data = this.app.scheduleService.getCurrentData();
      const task = data[type].find((t) => t.id === id);
      if (!task) return;
      if (modalTitle) modalTitle.textContent = '编辑任务';
      if (titleEl) titleEl.value = task.text || '';
      if (timeEl) {
        const d = new Date(task.time);
        const hh = d.getHours().toString().padStart(2, '0');
        const mm = d.getMinutes().toString().padStart(2, '0');
        timeEl.value = `${hh}:${mm}`;
      }
      if (timeRow) timeRow.style.display = 'block';
      if (recurrenceRow) recurrenceRow.style.display = 'block';
      if (recurrenceEl) recurrenceEl.value = task.recurrence || '';
      if (noteEl) noteEl.value = task.note || '';
      if (ideasOnly) ideasOnly.classList.add('hidden');
    }

    const modal = document.getElementById('taskModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  /** @param {import('../../domain/ideas/idea-node.js').IdeaNode} idea */
  renderPredecessorPicker(idea) {
    const listEl = document.getElementById('taskEditPredecessors');
    if (!listEl) return;
    const selected = new Set((idea.dependsOn || []).map(taskRefKey));
    const candidates = this.app.ideaInboxService.listPredecessorCandidates(idea.id);
    if (!candidates.length) {
      listEl.innerHTML = '<div class="text-xs text-zinc-500 py-1">暂无可选前序（当日无其他未完成灵感或任务）</div>';
      return;
    }
    listEl.innerHTML = candidates
      .map((c) => {
        const key = taskRefKey(c);
        const checked = selected.has(key) ? 'checked' : '';
        const dataAttrs =
          c.scope === 'idea'
            ? `data-scope="idea" data-id="${c.id}"`
            : `data-scope="daily" data-date-key="${c.dateKey}" data-list="${c.list}" data-id="${c.id}"`;
        return `
          <label class="flex items-start gap-2 py-1.5 text-xs text-zinc-300 cursor-pointer hover:text-zinc-100 border-b border-dark-500 last:border-0">
            <input type="checkbox" class="checkbox-custom shrink-0 predecessor-cb !w-4 !h-4" ${checked} ${dataAttrs}>
            <span class="leading-snug">${escapeLabel(c.label)}</span>
          </label>`;
      })
      .join('');
  }

  collectDependsOn() {
    const listEl = document.getElementById('taskEditPredecessors');
    if (!listEl) return [];
    /** @type {import('../../domain/ideas/idea-node.js').TaskRef[]} */
    const deps = [];
    listEl.querySelectorAll('.predecessor-cb:checked').forEach((cb) => {
      const scope = cb.getAttribute('data-scope');
      const id = cb.getAttribute('data-id');
      if (scope === 'idea') {
        deps.push({ scope: 'idea', id });
      } else {
        deps.push({
          scope: 'daily',
          dateKey: cb.getAttribute('data-date-key'),
          list: /** @type {any} */ (cb.getAttribute('data-list')),
          id
        });
      }
    });
    return deps;
  }

  close() {
    const modal = document.getElementById('taskModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    this.editingTaskType = null;
    this.editingTaskId = null;
  }

  save() {
    if (!this.editingTaskType || !this.editingTaskId) return;
    const titleEl = document.getElementById('taskEditTitle');
    const text = (titleEl?.value || '').trim();
    if (!text) {
      alert('任务内容不能为空');
      return;
    }

    if (this.editingTaskType === 'ideas') {
      const noteEl = document.getElementById('taskEditNote');
      const dueEl = document.getElementById('taskEditDueDate');
      const dueDate = dueEl && dueEl.value ? dueEl.value : null;
      const dependsOn = this.collectDependsOn();
      const result = this.app.ideaInboxService.update(this.editingTaskId, {
        text,
        note: noteEl ? noteEl.value || '' : '',
        dueDate,
        dependsOn
      });
      if (result && result.error) {
        alert(result.error);
        return;
      }
      this.close();
      this.app.renderAll();
      return;
    }

    const timeEl = document.getElementById('taskEditTime');
    const noteEl = document.getElementById('taskEditNote');
    const recurrenceEl = document.getElementById('taskEditRecurrence');
    const patch = {
      text,
      note: noteEl ? noteEl.value || '' : '',
      recurrence: recurrenceEl && recurrenceEl.value ? recurrenceEl.value : ''
    };
    const timeVal = timeEl?.value || '';
    if (timeVal) {
      const parts = timeVal.split(':');
      if (parts.length === 2) {
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(h) && !isNaN(m)) {
          const base = new Date(this.app.scheduleService.currentDate);
          base.setHours(h, m, 0, 0);
          patch.time = base.getTime();
        }
      }
    }
    this.app.scheduleService.updateTask(this.editingTaskType, this.editingTaskId, patch);
    this.close();
    this.app.renderAll();
  }

  delete() {
    if (!this.editingTaskType || !this.editingTaskId) return;
    const type = this.editingTaskType;
    const id = this.editingTaskId;
    this.close();
    if (type === 'ideas') {
      this.app.ideaInboxService.delete(id);
    } else {
      this.app.scheduleService.deleteTask(type, id);
    }
    this.app.renderAll();
  }
}

function escapeLabel(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
