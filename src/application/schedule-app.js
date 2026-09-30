import { LocalStorageAdapter } from '../infrastructure/storage/local-storage-adapter.js';
import { ScheduleRepository } from '../infrastructure/storage/schedule-repository.js';
import { WorkspaceRepository } from '../infrastructure/storage/workspace-repository.js';
import { IdeaRepository } from '../infrastructure/storage/idea-repository.js';
import { MilestoneRepository } from '../infrastructure/storage/milestone-repository.js';
import { MigrationRunner } from '../infrastructure/migration/migration-runner.js';
import { EventBus, Events } from './event-bus.js';
import { ScheduleService } from './schedule-service.js';
import { IdeaInboxService } from './idea-inbox-service.js';
import { MilestoneService } from './milestone-service.js';
import { ExportService } from './export-service.js';
import { DailyTasksView } from '../ui/views/daily-tasks-view.js';
import { IdeaInboxView } from '../ui/views/idea-inbox-view.js';
import { MilestonesView } from '../ui/views/milestones-view.js';
import { ReflectionView } from '../ui/views/reflection-view.js';
import { ProjectsView } from '../ui/views/projects-view.js';
import { TaskModal } from '../ui/components/task-modal.js';
import { getDateKey } from '../domain/shared/date-key.js';

export class ScheduleApp {
  constructor() {
    this.adapter = new LocalStorageAdapter();
    this.scheduleRepo = new ScheduleRepository(this.adapter);
    this.workspaceRepo = new WorkspaceRepository(this.adapter);
    this.ideaRepo = new IdeaRepository(this.adapter);
    this.milestoneRepo = new MilestoneRepository(this.adapter);
    this.eventBus = new EventBus();

    this.scheduleService = new ScheduleService({
      scheduleRepo: this.scheduleRepo,
      workspaceRepo: this.workspaceRepo,
      eventBus: this.eventBus
    });

    this.ideaInboxService = new IdeaInboxService({
      scheduleService: this.scheduleService,
      eventBus: this.eventBus
    });

    this.milestoneService = new MilestoneService({
      scheduleService: this.scheduleService,
      eventBus: this.eventBus
    });

    this.exportService = new ExportService({
      scheduleService: this.scheduleService,
      ideaInboxService: this.ideaInboxService,
      milestoneService: this.milestoneService,
      getSchemaVersion: () => this.adapter.getSchemaVersion()
    });

    this.dailyTasksView = new DailyTasksView(this);
    this.ideaInboxView = new IdeaInboxView(this);
    this.milestonesView = new MilestonesView(this);
    this.reflectionView = new ReflectionView(this);
    this.projectsView = new ProjectsView(this);
    this.taskModal = new TaskModal(this);

    this.editingMilestoneId = null;
    /** @type {'list'|'canvas'} */
    this.ideasViewMode = this._loadIdeasViewMode();
    this._ideaDagRoot = null;
  }

  _loadIdeasViewMode() {
    try {
      const v = localStorage.getItem('ceoIdeasViewMode');
      if (v === 'list' || v === 'canvas') return v;
    } catch {
      /* ignore */
    }
    return 'canvas';
  }

  bootstrap() {
    const runner = new MigrationRunner(this.adapter, {
      scheduleRepo: this.scheduleRepo,
      ideaRepo: this.ideaRepo
    });
    runner.run();

    this.scheduleService.load();
    this.ideaInboxService.load();
    this.milestoneService.load();
    this.ideaInboxService.subscribeToTaskCompletion();

    this.eventBus.on(Events.DATE_CHANGED, () => this.renderAll());
    this.eventBus.on(Events.TASKS_UPDATED, () => {
      this.dailyTasksView.render();
      this.dailyTasksView.updateStreak();
      this.ideaInboxView.render();
      this.projectsView.render();
    });
    this.eventBus.on(Events.IDEAS_UPDATED, () => {
      this.ideaInboxView.render();
      this.dailyTasksView.updateStreak();
    });
    this.eventBus.on(Events.MILESTONES_UPDATED, () => this.milestonesView.render());

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.scheduleService.persist();
        this.ideaInboxService.persist();
        this.milestoneService.persist();
      }
    });

    this.renderAll();
    this.applyIdeasViewMode();
  }

  /**
   * @param {'list'|'canvas'} mode
   */
  setIdeasViewMode(mode) {
    if (mode !== 'list' && mode !== 'canvas') return;
    this.ideasViewMode = mode;
    try {
      localStorage.setItem('ceoIdeasViewMode', mode);
    } catch {
      /* ignore */
    }
    this.applyIdeasViewMode();
    this.eventBus.emit(Events.IDEAS_VIEW_MODE, { mode });
  }

  applyIdeasViewMode() {
    const listWrap = document.getElementById('ideasListWrap');
    const canvasWrap = document.getElementById('ideasCanvasWrap');
    const canvasBtn = document.getElementById('ideasViewCanvasBtn');
    const listBtn = document.getElementById('ideasViewListBtn');
    const isCanvas = this.ideasViewMode === 'canvas';

    if (listWrap) {
      listWrap.classList.toggle('hidden', isCanvas);
      listWrap.setAttribute('aria-hidden', isCanvas ? 'true' : 'false');
    }
    if (canvasWrap) {
      canvasWrap.classList.toggle('hidden', !isCanvas);
      canvasWrap.setAttribute('aria-hidden', isCanvas ? 'false' : 'true');
    }

    // The .seg control styles itself from aria-pressed
    if (canvasBtn) canvasBtn.setAttribute('aria-pressed', isCanvas ? 'true' : 'false');
    if (listBtn) listBtn.setAttribute('aria-pressed', !isCanvas ? 'true' : 'false');

    // React Flow needs a resize after container becomes visible
    if (isCanvas) {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
      });
    }
  }

  setIdeaDagMounted() {
    this._ideaDagRoot = true;
  }

  renderAll() {
    this.dailyTasksView.updateDateDisplay();
    this.dailyTasksView.render();
    this.ideaInboxView.render();
    this.milestonesView.render();
    this.projectsView.render();
    this.reflectionView.render();
  }

  // --- Facade for HTML onclick / AI ---

  get currentDate() {
    return this.scheduleService.currentDate;
  }

  get data() {
    return this.scheduleService.data;
  }

  get milestones() {
    return this.milestoneService.milestones;
  }

  getDateKey(date) {
    return getDateKey(date || this.currentDate);
  }

  getCurrentData() {
    return this.scheduleService.getCurrentData();
  }

  getIdeas() {
    return this.ideaInboxService.getNodes();
  }

  saveData() {
    this.scheduleService.persist();
  }

  prevDay() {
    this.scheduleService.prevDay();
  }

  nextDay() {
    this.scheduleService.nextDay();
  }

  today() {
    this.scheduleService.goToday();
  }

  syncPrevDayTasks() {
    this.scheduleService.syncPrevDayTasks();
    this.renderAll();
  }

  clearTodayTasks() {
    if (!confirm('确定要清空当前日期的必做/选做任务吗？此操作不可撤销。（灵感收集箱不受影响）')) return;
    this.scheduleService.clearTodayTasks();
  }

  showTaskInput(type) {
    const el = document.getElementById(`${type}Input`);
    if (el) el.classList.remove('hidden');
    const input = document.getElementById(`${type}TaskInput`);
    if (input) input.focus();
  }

  hideTaskInput(type) {
    const wrapper = document.getElementById(`${type}Input`);
    if (wrapper) wrapper.classList.add('hidden');
  }

  handleTaskInput(event, type) {
    if (event.key !== 'Enter') return;
    const input = document.getElementById(`${type}TaskInput`);
    const text = input.value.trim();
    if (!text) return;
    if (type === 'ideas') {
      this.ideaInboxService.addIdea(text);
      this.ideaInboxView.render();
    } else {
      this.scheduleService.addTask(type, text);
      this.dailyTasksView.render();
    }
    input.value = '';
    input.blur();
    this.hideTaskInput(type);
  }

  toggleTask(type, id) {
    if (type === 'ideas') {
      this.toggleIdea(id);
      return;
    }
    this.scheduleService.toggleTask(type, id);
  }

  toggleIdea(id) {
    this.ideaInboxService.toggleComplete(id);
  }

  pinTask(type, id) {
    if (type === 'ideas') {
      this.pinIdea(id);
      return;
    }
    this.scheduleService.pinTask(type, id);
  }

  toggleTaskExpand(type, id) {
    this.dailyTasksView.toggleExpand(type, id);
  }

  toggleProjectTask(projectId, taskId) {
    this.scheduleService.toggleProjectTask(projectId, taskId);
  }

  toggleProjectTaskExpand(taskId) {
    this.projectsView.toggleTaskExpand(taskId);
  }

  toggleProjectSubtask(projectId, taskId, subId) {
    this.scheduleService.toggleProjectSubtask(projectId, taskId, subId);
  }

  deleteProjectSubtask(projectId, taskId, subId) {
    this.scheduleService.deleteProjectSubtask(projectId, taskId, subId);
  }

  handleProjectSubtaskInput(event, projectId, taskId) {
    if (event.key !== 'Enter') return;
    const input = event.target;
    const text = (input.value || '').trim();
    if (!text) return;
    this.projectsView.ensureTaskExpanded(taskId);
    this.scheduleService.addProjectSubtask(projectId, taskId, text);
  }

  addSubtask(type, taskId, text) {
    this.dailyTasksView.ensureExpanded(type, taskId);
    this.scheduleService.addSubtask(type, taskId, text);
  }

  toggleSubtask(type, taskId, subId) {
    this.scheduleService.toggleSubtask(type, taskId, subId);
    this.dailyTasksView.render();
  }

  deleteSubtask(type, taskId, subId) {
    this.scheduleService.deleteSubtask(type, taskId, subId);
    this.dailyTasksView.render();
  }

  handleSubtaskInput(event, type, taskId) {
    if (event.key !== 'Enter') return;
    const input = event.target;
    const text = (input.value || '').trim();
    if (!text) return;
    this.addSubtask(type, taskId, text);
    // render() rebuilds DOM; focus is lost intentionally
  }

  pinIdea(id) {
    this.ideaInboxService.pin(id);
  }

  pickUpIdea(id) {
    const result = this.ideaInboxService.pickUp(id, 'required');
    if (result && result.error) {
      alert(result.error);
      return;
    }
    this.renderAll();
  }

  dismissIdeasBanner() {
    this.ideaInboxView.dismissBanner();
  }

  openTaskModal(type, id) {
    this.taskModal.open(type, id);
  }

  closeTaskModal() {
    this.taskModal.close();
  }

  saveTaskFromModal() {
    this.taskModal.save();
  }

  deleteTaskFromModal() {
    this.taskModal.delete();
  }

  handleTaskDragStart(e, type, id) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ type, id }));
    e.dataTransfer.setData('text/plain', id);
    if (e.target.classList) e.target.classList.add('dragging');
  }

  handleIdeaDragStart(e, id) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'ideas', id }));
    e.dataTransfer.setData('text/plain', id);
    if (e.target.classList) e.target.classList.add('dragging');
  }

  handleTaskDragEnd(e) {
    if (e.target.classList) e.target.classList.remove('dragging');
    document.querySelectorAll('.task-drop-zone').forEach((el) => el.classList.remove('task-drop-zone-active'));
  }

  handleTaskDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  handleTaskDragEnter(e) {
    e.preventDefault();
    const zone = e.currentTarget;
    if (
      zone &&
      zone.id &&
      (zone.id === 'requiredTasks' ||
        zone.id === 'optionalTasks' ||
        zone.id === 'ideasTasks' ||
        zone.id === 'ideasCanvasWrap')
    ) {
      zone.classList.add('task-drop-zone-active');
    }
  }

  handleTaskDragLeave(e) {
    const zone = e.currentTarget;
    if (zone && zone.classList && !zone.contains(e.relatedTarget)) {
      zone.classList.remove('task-drop-zone-active');
    }
  }

  handleTaskDrop(e, targetType) {
    e.preventDefault();
    document.querySelectorAll('.task-drop-zone').forEach((el) => el.classList.remove('task-drop-zone-active'));
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const { type, id } = JSON.parse(raw);
      if (type === targetType) return;

      // Daily → ideas: defer
      if (targetType === 'ideas' && (type === 'required' || type === 'optional')) {
        const task = this.scheduleService.takeTask(type, id);
        if (task) this.ideaInboxService.deferFromDaily(task);
        this.renderAll();
        return;
      }

      // Ideas → daily: pick up
      if (type === 'ideas' && (targetType === 'required' || targetType === 'optional')) {
        const result = this.ideaInboxService.pickUp(id, targetType);
        if (result && result.error) {
          alert(result.error);
          return;
        }
        this.renderAll();
        return;
      }

      // required ↔ optional
      if ((type === 'required' || type === 'optional') && (targetType === 'required' || targetType === 'optional')) {
        this.scheduleService.moveTask(type, id, targetType);
      }
    } catch {
      /* ignore */
    }
  }

  setCurrentDayAiEval(text) {
    this.scheduleService.setAiEval(text);
    this.reflectionView.render();
  }

  handleProjectInput(event) {
    if (event.key !== 'Enter') return;
    const input = event.target;
    const name = (input.value || '').trim();
    if (!name) return;
    this.scheduleService.addProject(name);
    input.value = '';
  }

  toggleProjectExpand(id) {
    this.projectsView.toggleExpand(id);
  }

  handleProjectTaskInput(event, projectId) {
    if (event.key !== 'Enter') return;
    const input = event.target;
    const text = (input.value || '').trim();
    if (!text) return;
    this.projectsView.ensureExpanded(projectId);
    this.scheduleService.addProjectTask(projectId, text);
  }

  deleteProjectTask(projectId, taskId) {
    this.scheduleService.deleteProjectTask(projectId, taskId);
  }

  renameProject(id) {
    const project = (this.scheduleService.workspace.projects || []).find((p) => p.id === id);
    if (!project) return;
    const name = prompt('项目名称', project.name);
    if (name == null) return;
    const updated = this.scheduleService.renameProject(id, name);
    if (!updated) alert('名称无效，或已有同名项目');
  }

  deleteProject(id) {
    const project = (this.scheduleService.workspace.projects || []).find((p) => p.id === id);
    if (!project) return;
    if (!confirm(`删除项目「${project.name}」以及它在今日清单里的任务？`)) return;
    this.scheduleService.deleteProject(id);
  }

  addMilestone() {
    this.editingMilestoneId = null;
    document.getElementById('milestoneModalTitle').textContent = '添加里程碑';
    document.getElementById('milestoneTitle').value = '';
    document.getElementById('milestoneDate').value = getDateKey(new Date());
    const modal = document.getElementById('milestoneModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  closeMilestoneModal() {
    const modal = document.getElementById('milestoneModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.getElementById('milestoneTitle').value = '';
    this.editingMilestoneId = null;
  }

  saveMilestone() {
    const title = document.getElementById('milestoneTitle').value.trim();
    const date = document.getElementById('milestoneDate').value;
    if (!title || !date) return;
    if (this.editingMilestoneId) {
      this.milestoneService.update(this.editingMilestoneId, title, date);
    } else {
      this.milestoneService.add(title, date);
    }
    this.closeMilestoneModal();
  }

  editMilestone(id) {
    const milestone = this.milestoneService.milestones.find((m) => m.id === id);
    if (!milestone) return;
    this.editingMilestoneId = id;
    document.getElementById('milestoneModalTitle').textContent = '编辑里程碑';
    document.getElementById('milestoneTitle').value = milestone.title;
    document.getElementById('milestoneDate').value = milestone.date;
    const modal = document.getElementById('milestoneModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  deleteMilestoneFromModal() {
    if (!this.editingMilestoneId) return;
    this.milestoneService.delete(this.editingMilestoneId);
    this.closeMilestoneModal();
  }

  exportJSON() {
    this.exportService.downloadJSON();
  }

  exportMD() {
    this.exportService.downloadMD();
  }

  /** State snapshot for AI */
  getStateForAi() {
    const data = this.getCurrentData();
    return {
      required: data.required || [],
      optional: data.optional || [],
      ideas: this.getIdeas(),
      reflection: data.reflection || '',
      reflectionTags: data.reflectionTags || []
    };
  }
}
