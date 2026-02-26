const app = {
    currentDate: new Date(),
    data: {},
    milestones: [],
    editingMilestoneId: null,
    editingTaskType: null,
    editingTaskId: null,

    init() {
        this.loadData();
        this.loadMilestones();
        this.render();
        this.updateDateDisplay();

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.saveData();
            }
        });
    },

    getDateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    },

    getCurrentData() {
        const key = this.getDateKey(this.currentDate);
        if (!this.data[key]) {
            this.data[key] = {
                required: [],
                optional: [],
                ideas: [],
                reflection: '',
                reflectionTags: [],
                aiEval: ''
            };
        }
        const data = this.data[key];
        if (!Array.isArray(data.reflectionTags)) {
            data.reflectionTags = data.reflectionTag ? [data.reflectionTag] : [];
        }
        return data;
    },

    syncPrevDayTasks() {
        const currentKey = this.getDateKey(this.currentDate);
        const prevDate = new Date(this.currentDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevKey = this.getDateKey(prevDate);

        const prevData = this.data[prevKey];
        if (!prevData) return;

        const data = this.getCurrentData();

        ['required', 'optional', 'ideas'].forEach(type => {
            const prevList = prevData[type] || [];
            if (!data[type]) data[type] = [];

            const existingIds = new Set(data[type].map(t => t.id));
            prevList.forEach(t => {
                const notCompleted = type === 'ideas' ? true : !t.completed;
                if (notCompleted && !existingIds.has(t.id)) {
                    data[type].push({ ...t });
                }
            });

            if (type !== 'ideas') this.sortTasks(data[type]);
        });

        this.saveData();
        this.renderTasks();
        this.updateProgress();
    },

    loadData() {
        const saved = localStorage.getItem('ceoSchedule');
        if (saved) this.data = JSON.parse(saved);
    },

    saveData() {
        localStorage.setItem('ceoSchedule', JSON.stringify(this.data));
    },

    loadMilestones() {
        const saved = localStorage.getItem('ceoMilestones');
        if (saved) this.milestones = JSON.parse(saved);
    },

    saveMilestones() {
        localStorage.setItem('ceoMilestones', JSON.stringify(this.milestones));
    },

    updateDateDisplay() {
        const dateKey = this.getDateKey(this.currentDate);
        const today = this.getDateKey(new Date());
        const isToday = dateKey === today;

        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        document.getElementById('currentDate').textContent = this.currentDate.toLocaleDateString('zh-CN', options);
        document.getElementById('currentDate').className = `font-mono text-sm font-medium ${isToday ? 'text-accent-cyan' : ''}`;

        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        document.getElementById('currentWeekday').textContent = weekdays[this.currentDate.getDay()];
        this.updateStreakDisplay();
    },

    getStreakDays() {
        const todayKey = this.getDateKey(new Date());
        let d = new Date();
        let count = 0;
        for (let i = 0; i < 365; i++) {
            const key = this.getDateKey(d);
            const dayData = this.data[key];
            const hasTasks = dayData && (
                (dayData.required && dayData.required.length > 0) ||
                (dayData.optional && dayData.optional.length > 0) ||
                (dayData.ideas && dayData.ideas.length > 0)
            );
            if (hasTasks) count++;
            else break;
            d.setDate(d.getDate() - 1);
        }
        return count;
    },

    updateStreakDisplay() {
        const el = document.getElementById('streakCount');
        if (el) el.textContent = this.getStreakDays();
    },

    prevDay() {
        this.currentDate.setDate(this.currentDate.getDate() - 1);
        this.updateDateDisplay();
        this.render();
    },

    nextDay() {
        this.currentDate.setDate(this.currentDate.getDate() + 1);
        this.updateDateDisplay();
        this.render();
    },

    today() {
        this.currentDate = new Date();
        this.updateDateDisplay();
        this.render();
    },

    parseTime(text) {
        const timePatterns = [
            /(\d{1,2}):(\d{2})/,
            /(\d{1,2})点/,
            /(\d{1,2})\s*(am|pm)/i
        ];

        for (const pattern of timePatterns) {
            const match = text.match(pattern);
            if (match) {
                let hours = parseInt(match[1]);
                let minutes = match[2] && !isNaN(parseInt(match[2])) ? parseInt(match[2]) : 0;

                if (match[3]) {
                    const period = match[3].toLowerCase();
                    if (period === 'pm' && hours < 12) hours += 12;
                    if (period === 'am' && hours === 12) hours = 0;
                }

                return { hours, minutes };
            }
        }
        return null;
    },

    formatTime(date) {
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    },

    showTaskInput(type) {
        document.getElementById(`${type}Input`).classList.remove('hidden');
        document.getElementById(`${type}TaskInput`).focus();
    },

    hideTaskInput(type) {
        const wrapper = document.getElementById(`${type}Input`);
        if (wrapper) wrapper.classList.add('hidden');
    },

    handleTaskInput(event, type) {
        if (event.key === 'Enter') {
            const input = document.getElementById(`${type}TaskInput`);
            const text = input.value.trim();
            if (text) {
                this.addTask(type, text);
                input.value = '';
                input.blur();
                this.hideTaskInput(type);
            }
        }
    },

    addTask(type, text) {
        const data = this.getCurrentData();
        const timeMatch = this.parseTime(text);
        let time;

        if (timeMatch) {
            const now = new Date(this.currentDate);
            now.setHours(timeMatch.hours, timeMatch.minutes, 0, 0);
            time = now.getTime();
        } else {
            time = Date.now();
        }

        const task = {
            id: Date.now().toString(),
            text: text,
            completed: false,
            time: time,
            pinned: false,
            note: ''
        };

        data[type].push(task);
        this.sortTasks(data[type]);
        this.saveData();
        this.renderTasks();
        this.updateProgress();
    },

    sortTasks(tasks) {
        tasks.sort((a, b) => {
            if (a.pinned !== b.pinned) return b.pinned - a.pinned;
            return a.time - b.time;
        });
    },

    toggleTask(type, id) {
        const data = this.getCurrentData();
        const task = data[type].find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            this.saveData();
            this.renderTasks();
            this.updateProgress();
        }
    },

    pinTask(type, id) {
        const data = this.getCurrentData();
        const task = data[type].find(t => t.id === id);
        if (task) {
            task.pinned = !task.pinned;
            this.sortTasks(data[type]);
            this.saveData();
            this.renderTasks();
        }
    },

    editTaskText(type, id) {
        const data = this.getCurrentData();
        const task = data[type].find(t => t.id === id);
        if (!task) return;
        const newText = prompt('编辑任务内容：', task.text || '');
        if (newText !== null) {
            const trimmed = newText.trim();
            if (trimmed) {
                task.text = trimmed;
                this.saveData();
                this.renderTasks();
            }
        }
    },

    editTaskTime(type, id) {
        const data = this.getCurrentData();
        const task = data[type].find(t => t.id === id);
        if (!task) return;
        const currentTime = this.formatTime(new Date(task.time));
        const input = prompt('编辑时间（如 14:00）：', currentTime);
        if (input !== null) {
            const text = input.trim();
            if (!text) return;
            const timeMatch = this.parseTime(text);
            if (timeMatch) {
                const base = new Date(this.currentDate);
                base.setHours(timeMatch.hours, timeMatch.minutes, 0, 0);
                task.time = base.getTime();
                this.sortTasks(data[type]);
                this.saveData();
                this.renderTasks();
            } else {
                alert('无法识别时间格式，请使用类似 14:00 的格式。');
            }
        }
    },

    deleteTask(type, id) {
        const data = this.getCurrentData();
        data[type] = data[type].filter(t => t.id !== id);
        this.saveData();
        this.renderTasks();
        this.updateProgress();
    },

    handleTaskDragStart(e, type, id) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify({ type, id }));
        e.dataTransfer.setData('text/plain', id);
        if (e.target.classList) e.target.classList.add('dragging');
    },

    handleTaskDragEnd(e) {
        if (e.target.classList) e.target.classList.remove('dragging');
        document.querySelectorAll('.task-drop-zone').forEach(el => el.classList.remove('task-drop-zone-active'));
    },

    handleTaskDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    },

    handleTaskDragEnter(e) {
        e.preventDefault();
        const zone = e.currentTarget;
        if (zone && zone.classList && zone.id && (zone.id === 'requiredTasks' || zone.id === 'optionalTasks' || zone.id === 'ideasTasks')) {
            zone.classList.add('task-drop-zone-active');
        }
    },

    handleTaskDragLeave(e) {
        const zone = e.currentTarget;
        if (zone && zone.classList && !zone.contains(e.relatedTarget)) {
            zone.classList.remove('task-drop-zone-active');
        }
    },

    handleTaskDrop(e, targetType) {
        e.preventDefault();
        document.querySelectorAll('.task-drop-zone').forEach(el => el.classList.remove('task-drop-zone-active'));
        try {
            const raw = e.dataTransfer.getData('application/json');
            if (!raw) return;
            const { type, id } = JSON.parse(raw);
            if (type !== targetType) this.moveTask(type, id, targetType);
        } catch (err) {}
    },

    moveTask(fromType, id, toType) {
        const data = this.getCurrentData();
        const list = data[fromType];
        if (!list) return;
        const idx = list.findIndex(t => t.id === id);
        if (idx === -1) return;
        const [task] = list.splice(idx, 1);
        data[toType].push(task);
        if (toType !== 'ideas') this.sortTasks(data[toType]);
        this.saveData();
        this.renderTasks();
        this.updateProgress();
    },

    clearTodayTasks() {
        if (!confirm('确定要清空当前日期的所有任务吗？此操作不可撤销。')) return;
        const data = this.getCurrentData();
        data.required = [];
        data.optional = [];
        data.ideas = [];
        this.saveData();
        this.renderTasks();
        this.updateProgress();
    },

    editTaskNote(type, id) {
        const data = this.getCurrentData();
        const task = data[type].find(t => t.id === id);
        if (task) {
            const note = prompt('添加/编辑任务说明：', task.note || '');
            if (note !== null) {
                task.note = note;
                this.saveData();
                this.renderTasks();
            }
        }
    },

    openTaskModal(type, id) {
        const data = this.getCurrentData();
        const task = data[type].find(t => t.id === id);
        if (!task) return;

        this.editingTaskType = type;
        this.editingTaskId = id;

        const titleEl = document.getElementById('taskEditTitle');
        const timeEl = document.getElementById('taskEditTime');
        const noteEl = document.getElementById('taskEditNote');

        if (titleEl) titleEl.value = task.text || '';

        if (timeEl) {
            const d = new Date(task.time);
            const hh = d.getHours().toString().padStart(2, '0');
            const mm = d.getMinutes().toString().padStart(2, '0');
            timeEl.value = `${hh}:${mm}`;
        }

        const timeRow = document.getElementById('taskEditTimeRow');
        if (timeRow) timeRow.style.display = type === 'ideas' ? 'none' : 'block';

        if (noteEl) noteEl.value = task.note || '';

        const modal = document.getElementById('taskModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeTaskModal() {
        const modal = document.getElementById('taskModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        this.editingTaskType = null;
        this.editingTaskId = null;
    },

    saveTaskFromModal() {
        if (!this.editingTaskType || !this.editingTaskId) return;
        const data = this.getCurrentData();
        const list = data[this.editingTaskType];
        if (!list) return;
        const task = list.find(t => t.id === this.editingTaskId);
        if (!task) return;

        const titleEl = document.getElementById('taskEditTitle');
        const timeEl = document.getElementById('taskEditTime');
        const noteEl = document.getElementById('taskEditNote');

        const text = (titleEl?.value || '').trim();
        if (!text) {
            alert('任务内容不能为空');
            return;
        }
        task.text = text;

        if (this.editingTaskType !== 'ideas') {
            const timeVal = timeEl?.value || '';
            if (timeVal) {
                const parts = timeVal.split(':');
                if (parts.length === 2) {
                    const h = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10);
                    if (!isNaN(h) && !isNaN(m)) {
                        const base = new Date(this.currentDate);
                        base.setHours(h, m, 0, 0);
                        task.time = base.getTime();
                        this.sortTasks(list);
                    }
                }
            }
        }

        if (noteEl) task.note = noteEl.value || '';

        this.saveData();
        this.renderTasks();
        this.updateProgress();
        this.closeTaskModal();
    },

    deleteTaskFromModal() {
        if (!this.editingTaskType || !this.editingTaskId) return;
        const type = this.editingTaskType;
        const id = this.editingTaskId;
        this.closeTaskModal();
        this.deleteTask(type, id);
    },

    renderTasks() {
        const data = this.getCurrentData();

        ['required', 'optional', 'ideas'].forEach(type => {
            const container = document.getElementById(`${type}Tasks`);
            container.innerHTML = data[type].map(task => this.renderTaskItem(task, type)).join('');
        });
        this.updateStreakDisplay();
    },

    renderTaskItem(task, type) {
        const time = new Date(task.time);
        const timeStr = this.formatTime(time);
        const showTime = type !== 'ideas';
        const pinClass = task.pinned ? 'text-accent-cyan' : 'text-zinc-600 hover:text-zinc-400';
        const noteIndicator = task.note ? `<span class="text-accent-cyan text-xs ml-2">●</span>` : '';
        const noteIndent = type === 'ideas' ? 'pl-0' : 'pl-14';
        const dragAttrs = `draggable="true" ondragstart="app.handleTaskDragStart(event, '${type}', '${task.id}')" ondragend="app.handleTaskDragEnd(event)"`;

        return `
                    <div class="task-item flex items-center gap-3 py-1.5 px-2.5 rounded-lg ${task.completed ? 'opacity-50' : ''}" ondblclick="app.openTaskModal('${type}', '${task.id}')" data-id="${task.id}" data-type="${type}" ${dragAttrs}>
                        <input type="checkbox" class="checkbox-custom shrink-0" 
                            ${task.completed ? 'checked' : ''} 
                            onchange="app.toggleTask('${type}', '${task.id}')">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                ${showTime ? `<span class="text-xs font-mono text-zinc-500 shrink-0">${timeStr}</span>` : ''}
                                <span class="text-sm truncate ${task.completed ? 'line-through text-zinc-500' : ''}">${this.escapeHtml(task.text)}</span>
                                ${noteIndicator}
                            </div>
                            ${task.note ? `<div class="text-xs text-zinc-500 mt-1 ${noteIndent}">${this.escapeHtml(task.note)}</div>` : ''}
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <button onclick="app.pinTask('${type}', '${task.id}')" class="p-1.5 rounded ${pinClass} transition-colors" title="置顶">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14M5 12l7-7 7 7"/>
                                </svg>
                            </button>
                            <button onclick="app.openTaskModal('${type}', '${task.id}')" class="p-1.5 rounded text-zinc-600 hover:text-accent-cyan transition-colors" title="编辑任务">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    updateProgress() {
        const data = this.getCurrentData();
        const allTasks = data.required || [];
        const total = allTasks.length;
        const completed = allTasks.filter(t => t.completed).length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        const circle = document.getElementById('progressCircle');
        const radius = 14;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;

        circle.style.strokeDashoffset = offset;
        document.getElementById('progressText').textContent = `${percentage}%`;

        const labelEl = document.getElementById('progressLabel');
        if (labelEl) {
            if (total === 0) labelEl.textContent = '先加几个任务吧';
            else if (percentage === 0) labelEl.textContent = '开始行动吧～';
            else if (percentage === 100) labelEl.textContent = '全部搞定，厉害！';
            else if (percentage >= 50) labelEl.textContent = '过半了，继续加油！';
            else labelEl.textContent = '稳住，你能行～';
        }
    },

    saveReflection() {
        const data = this.getCurrentData();
        const el = document.getElementById('dailyReflection');
        if (el) data.reflection = el.value;
        this.saveData();
    },

    renderMarkdown(text) {
        if (!text) return '';
        if (typeof marked !== 'undefined' && marked.parse) {
            try { return marked.parse(text, { gfm: true }); } catch (e) { return text.replace(/\n/g, '<br>'); }
        }
        return text.replace(/\n/g, '<br>');
    },

    toggleReflectionEdit() {
        if (this._reflectionJustDone) {
            this._reflectionJustDone = false;
            return;
        }
        const display = document.getElementById('dailyReflectionDisplay');
        const input = document.getElementById('dailyReflection');
        const btn = document.getElementById('reflectionEditBtn');
        if (!display || !input) return;
        if (input.classList.contains('hidden')) {
            input.value = this.getCurrentData().reflection || '';
            input.classList.remove('hidden');
            display.classList.add('hidden');
            if (btn) btn.textContent = '完成';
            input.focus();
        } else {
            this.reflectionEditDone();
        }
    },

    reflectionEditDone() {
        const display = document.getElementById('dailyReflectionDisplay');
        const input = document.getElementById('dailyReflection');
        const btn = document.getElementById('reflectionEditBtn');
        if (!display || !input) return;
        this.saveReflection();
        display.innerHTML = this.renderMarkdown(input.value);
        input.classList.add('hidden');
        display.classList.remove('hidden');
        if (btn) btn.textContent = '编辑';
        this._reflectionJustDone = true;
    },

    setReflectionTag(tag) {
        const data = this.getCurrentData();
        const tags = data.reflectionTags || [];
        const idx = tags.indexOf(tag);
        if (idx >= 0) tags.splice(idx, 1);
        else tags.push(tag);
        data.reflectionTags = tags;
        this.saveData();
        this.renderReflectionTags();
    },

    renderReflectionTags() {
        const data = this.getCurrentData();
        const selected = data.reflectionTags || [];
        document.querySelectorAll('[data-reflection-tag]').forEach(btn => {
            const tag = btn.getAttribute('data-reflection-tag');
            if (selected.indexOf(tag) >= 0) {
                btn.classList.add('reflection-tag-active');
            } else {
                btn.classList.remove('reflection-tag-active');
            }
        });
    },

    setCurrentDayAiEval(text) {
        const data = this.getCurrentData();
        data.aiEval = typeof text === 'string' ? text : '';
        this.saveData();
    },

    renderReflection() {
        const data = this.getCurrentData();
        const raw = data.reflection || '';
        const input = document.getElementById('dailyReflection');
        const display = document.getElementById('dailyReflectionDisplay');
        const btn = document.getElementById('reflectionEditBtn');
        if (input) input.value = raw;
        if (display) display.innerHTML = this.renderMarkdown(raw);
        input.classList.add('hidden');
        display.classList.remove('hidden');
        if (btn) btn.textContent = '编辑';
        this.renderReflectionTags();
    },

    addMilestone() {
        this.editingMilestoneId = null;
        document.getElementById('milestoneModalTitle').textContent = '添加里程碑';
        document.getElementById('milestoneTitle').value = '';
        document.getElementById('milestoneDate').value = this.getDateKey(new Date());
        document.getElementById('milestoneModal').classList.remove('hidden');
        document.getElementById('milestoneModal').classList.add('flex');
    },

    closeMilestoneModal() {
        document.getElementById('milestoneModal').classList.add('hidden');
        document.getElementById('milestoneModal').classList.remove('flex');
        document.getElementById('milestoneTitle').value = '';
        this.editingMilestoneId = null;
    },

    saveMilestone() {
        const title = document.getElementById('milestoneTitle').value.trim();
        const date = document.getElementById('milestoneDate').value;

        if (title && date) {
            if (this.editingMilestoneId) {
                const m = this.milestones.find(m => m.id === this.editingMilestoneId);
                if (m) {
                    m.title = title;
                    m.date = date;
                }
            } else {
                this.milestones.push({
                    id: Date.now().toString(),
                    title,
                    date,
                    completed: false
                });
            }
            this.milestones.sort((a, b) => new Date(a.date) - new Date(b.date));
            this.saveMilestones();
            this.renderMilestones();
            this.closeMilestoneModal();
        }
    },

    editMilestone(id) {
        const milestone = this.milestones.find(m => m.id === id);
        if (!milestone) return;
        this.editingMilestoneId = id;
        document.getElementById('milestoneModalTitle').textContent = '编辑里程碑';
        document.getElementById('milestoneTitle').value = milestone.title;
        document.getElementById('milestoneDate').value = milestone.date;
        document.getElementById('milestoneModal').classList.remove('hidden');
        document.getElementById('milestoneModal').classList.add('flex');
    },

    deleteMilestoneFromModal() {
        if (!this.editingMilestoneId) return;
        this.deleteMilestone(this.editingMilestoneId);
        this.closeMilestoneModal();
    },

    deleteMilestone(id) {
        this.milestones = this.milestones.filter(m => m.id !== id);
        this.saveMilestones();
        this.renderMilestones();
    },

    toggleMilestone(id) {
        const milestone = this.milestones.find(m => m.id === id);
        if (milestone) {
            milestone.completed = !milestone.completed;
            this.saveMilestones();
            this.renderMilestones();
        }
    },

    renderMilestones() {
        const container = document.getElementById('milestonesList');
        if (this.milestones.length === 0) {
            container.innerHTML = '<div class="text-sm text-zinc-600 text-center py-4">暂无里程碑，点击 + 添加</div>';
            return;
        }

        const todayKey = this.getDateKey(new Date());

        const sorted = [...this.milestones].sort((a, b) => {
            const aPast = a.date < todayKey;
            const bPast = b.date < todayKey;
            if (aPast && !bPast) return 1;
            if (!aPast && bPast) return -1;
            return a.date.localeCompare(b.date);
        });

        container.innerHTML = sorted.map((m, index) => {
            const isToday = m.date === todayKey;
            const mDateAtNoon = new Date(m.date + 'T12:00:00');
            const todayAtNoon = new Date(todayKey + 'T12:00:00');
            const daysLeft = Math.round((mDateAtNoon - todayAtNoon) / (1000 * 60 * 60 * 24));
            const isOverdue = daysLeft < 0 && !m.completed;

            let statusText = '';
            let statusColor = '';

            if (m.completed) {
                statusText = '已完成';
                statusColor = 'text-accent-green';
            } else if (isOverdue) {
                statusText = `距今 ${Math.abs(daysLeft)} 天`;
                statusColor = 'text-accent-rose';
            } else if (isToday) {
                statusText = '今天';
                statusColor = 'text-accent-cyan pulse-glow';
            } else {
                statusText = `还有 ${daysLeft} 天`;
                statusColor = daysLeft <= 3 ? 'text-accent-amber' : 'text-zinc-500';
            }

            return `
                        <div class="flex items-center gap-3 p-3 rounded-lg ${m.completed ? 'opacity-50' : 'bg-dark-700/30'} min-w-[260px] flex-shrink-0" data-id="${m.id}">
                            <div class="relative flex items-center">
                                <div class="w-3 h-3 rounded-full ${m.completed ? 'bg-accent-green' : isOverdue ? 'bg-accent-rose' : 'bg-accent-cyan'}"></div>
                                ${index < sorted.length - 1 ? '<div class="hidden sm:block ml-2 w-12 h-0.5 bg-dark-600"></div>' : ''}
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <span class="text-sm font-medium truncate ${m.completed ? 'line-through text-zinc-500' : ''}">${this.escapeHtml(m.title)}</span>
                                </div>
                                <div class="flex items-center gap-2 mt-0.5">
                                    <span class="text-xs font-mono text-zinc-500">${m.date}</span>
                                    <span class="text-xs ${statusColor}">${statusText}</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-1">
                                <button onclick="app.editMilestone('${m.id}')" class="p-1.5 rounded text-zinc-600 hover:text-accent-cyan transition-colors" title="编辑里程碑">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-7-7l5 5m-5-5L9 7"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    `;
        }).join('');
    },

    exportMD() {
        const data = this.getCurrentData();
        const dateStr = this.getDateKey(this.currentDate);
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const weekday = weekdays[this.currentDate.getDay()];

        let md = `# CEO 日程记录 - ${dateStr} ${weekday}\n\n`;

        md += `## 🎯 目标里程碑\n\n`;
        if (this.milestones.length > 0) {
            this.milestones.forEach(m => {
                md += `- [${m.completed ? 'x' : ' '}] ${m.date} - ${m.title}\n`;
            });
        } else {
            md += `> 暂无里程碑\n`;
        }
        md += `\n`;

        md += `## ✅ 任务清单\n\n`;

        md += `### 必做任务\n`;
        if (data.required.length > 0) {
            data.required.forEach(t => {
                const time = this.formatTime(new Date(t.time));
                md += `- [${t.completed ? 'x' : ' '}] ${time} - ${t.text}${t.note ? `\n  - 备注: ${t.note}` : ''}\n`;
            });
        } else {
            md += `> 暂无任务\n`;
        }
        md += `\n`;

        md += `### 选做任务\n`;
        if (data.optional.length > 0) {
            data.optional.forEach(t => {
                const time = this.formatTime(new Date(t.time));
                md += `- [${t.completed ? 'x' : ' '}] ${time} - ${t.text}${t.note ? `\n  - 备注: ${t.note}` : ''}\n`;
            });
        } else {
            md += `> 暂无任务\n`;
        }
        md += `\n`;

        md += `### 灵感收集\n`;
        if (data.ideas.length > 0) {
            data.ideas.forEach(t => {
                const time = this.formatTime(new Date(t.time));
                md += `- ${time} - ${t.text}\n`;
            });
        } else {
            md += `> 暂无灵感\n`;
        }
        md += `\n`;

        const allTasks = data.required || [];
        const completed = allTasks.filter(t => t.completed).length;
        const percentage = allTasks.length > 0 ? Math.round((completed / allTasks.length) * 100) : 0;
        md += `## 📊 完成率\n\n`;
        md += `- 总任务: ${allTasks.length}\n`;
        md += `- 已完成: ${completed}\n`;
        md += `- 完成率: ${percentage}%\n\n`;

        md += `## 📝 每日感悟\n\n`;
        const tags = data.reflectionTags && data.reflectionTags.length ? data.reflectionTags : (data.reflectionTag ? [data.reflectionTag] : []);
        if (tags.length) {
            md += `**今日标签**: ${tags.join('、')}\n\n`;
        }
        md += data.reflection || '> 暂无记录';
        md += `\n\n`;

        md += `## 🤖 AI评估\n\n`;
        const aiEvalText = (data.aiEval || '').trim();
        md += aiEvalText ? aiEvalText : '> 暂无评估（点击「生成今日评估」获取）';
        md += `\n`;

        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CEO_Schedule_${dateStr}.md`;
        a.click();
        URL.revokeObjectURL(url);
    },

    render() {
        this.renderTasks();
        this.renderReflection();
        this.renderMilestones();
        this.updateProgress();
        this.updateStreakDisplay();
        const aiEl = document.getElementById('aiEvalResult');
        if (aiEl) aiEl.innerHTML = this.renderMarkdown(this.getCurrentData().aiEval || '');
    }
};

window.app = app;

document.addEventListener('DOMContentLoaded', () => app.init());
