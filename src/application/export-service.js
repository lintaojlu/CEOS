import { formatTime, getDateKey } from '../domain/shared/date-key.js';
import { partitionIdeas } from '../domain/ideas/readiness.js';
import { ideaBody, ideaTitle, markdownForModel } from '../domain/ideas/idea-document.js';
import { normalizeNotes } from '../domain/schedule/daily-task.js';
import { todayKey } from '../domain/shared/date-key.js';

/** @param {any} task */
function noteLines(task) {
  const notes = normalizeNotes(task?.notes, { note: task?.note, subtasks: task?.subtasks });
  if (!notes.length) return '\n';
  return `\n${notes.map((item) => `  - 说明: ${item.text}`).join('\n')}\n`;
}

export class ExportService {
  /**
   * @param {object} deps
   * @param {import('./schedule-service.js').ScheduleService} deps.scheduleService
   * @param {import('./idea-inbox-service.js').IdeaInboxService} deps.ideaInboxService
   * @param {() => number} deps.getSchemaVersion
   */
  constructor({ scheduleService, ideaInboxService, getSchemaVersion }) {
    this.scheduleService = scheduleService;
    this.ideaInboxService = ideaInboxService;
    this.getSchemaVersion = getSchemaVersion;
  }

  buildJSON() {
    return {
      schemaVersion: this.getSchemaVersion(),
      exportedAt: new Date().toISOString(),
      schedule: this.scheduleService.data,
      workspace: this.scheduleService.workspace
    };
  }

  downloadJSON() {
    const payload = this.buildJSON();
    const json = JSON.stringify(payload, null, 2);
    const dateStr = getDateKey(new Date());
    this._download(json, `CEO_Schedule_backup_${dateStr}.json`, 'application/json');
  }

  buildMD() {
    const data = this.scheduleService.getCurrentData();
    const dateStr = this.scheduleService.getDateKey();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[this.scheduleService.currentDate.getDay()];

    let md = `# CEO 日程记录 - ${dateStr} ${weekday}\n\n`;

    md += `## ✅ 任务清单\n\n`;
    md += `### 必做任务\n`;
    if (data.required.length > 0) {
      data.required.forEach((t) => {
        const time = formatTime(new Date(t.time));
        md += `- [${t.completed ? 'x' : ' '}] ${time} - ${this.scheduleService.taskTitle(t)}${noteLines(t)}`;
      });
    } else {
      md += `> 暂无任务\n`;
    }
    md += `\n`;

    md += `### 选做任务\n`;
    if (data.optional.length > 0) {
      data.optional.forEach((t) => {
        const time = formatTime(new Date(t.time));
        md += `- [${t.completed ? 'x' : ' '}] ${time} - ${this.scheduleService.taskTitle(t)}${noteLines(t)}`;
      });
    } else {
      md += `> 暂无任务\n`;
    }
    md += `\n`;

    const ctx = {
      schedule: this.scheduleService.data,
      ideas: this.ideaInboxService.getNodes(),
      todayKey: todayKey()
    };
    const { ready, completed } = partitionIdeas(this.ideaInboxService.getNodes(), ctx);

    md += `## 💡 灵感\n\n`;
    const renderIdea = (item, status) => {
      const body = markdownForModel(ideaBody(item));
      md += `- [${item.completed ? 'x' : ' '}] [${status}] ${ideaTitle(item)}${body ? `\n  - 备注: ${body}` : ''}\n`;
    };
    if (ready.length + completed.length === 0) {
      md += `> 暂无灵感\n`;
    } else {
      ready.forEach((t) => renderIdea(t, '未完成'));
      completed.forEach((t) => renderIdea(t, '已完成'));
    }
    md += `\n`;

    const allTasks = data.required || [];
    const done = allTasks.filter((t) => t.completed).length;
    const percentage = allTasks.length > 0 ? Math.round((done / allTasks.length) * 100) : 0;
    md += `## 📊 完成率\n\n`;
    md += `- 总任务: ${allTasks.length}\n`;
    md += `- 已完成: ${done}\n`;
    md += `- 完成率: ${percentage}%\n\n`;

    md += `## 📝 每日感悟\n\n`;
    const tags = data.reflectionTags && data.reflectionTags.length ? data.reflectionTags : [];
    if (tags.length) md += `**今日标签**: ${tags.join('、')}\n\n`;
    md += data.reflection || '> 暂无记录';
    md += `\n`;

    return md;
  }

  downloadMD() {
    const md = this.buildMD();
    const dateStr = this.scheduleService.getDateKey();
    this._download(md, `CEO_Schedule_${dateStr}.md`, 'text/markdown');
  }

  /** @private */
  _download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
