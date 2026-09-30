import { formatTime, getDateKey } from '../domain/shared/date-key.js';
import { partitionIdeas } from '../domain/ideas/readiness.js';
import { todayKey } from '../domain/shared/date-key.js';

export class ExportService {
  /**
   * @param {object} deps
   * @param {import('./schedule-service.js').ScheduleService} deps.scheduleService
   * @param {import('./idea-inbox-service.js').IdeaInboxService} deps.ideaInboxService
   * @param {import('./milestone-service.js').MilestoneService} deps.milestoneService
   * @param {() => number} deps.getSchemaVersion
   */
  constructor({ scheduleService, ideaInboxService, milestoneService, getSchemaVersion }) {
    this.scheduleService = scheduleService;
    this.ideaInboxService = ideaInboxService;
    this.milestoneService = milestoneService;
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

    md += `## 🎯 目标里程碑\n\n`;
    if (this.milestoneService.milestones.length > 0) {
      this.milestoneService.milestones.forEach((m) => {
        md += `- [${m.completed ? 'x' : ' '}] ${m.date} - ${m.title}\n`;
      });
    } else {
      md += `> 暂无里程碑\n`;
    }
    md += `\n`;

    md += `## ✅ 任务清单\n\n`;
    md += `### 必做任务\n`;
    if (data.required.length > 0) {
      data.required.forEach((t) => {
        const time = formatTime(new Date(t.time));
        md += `- [${t.completed ? 'x' : ' '}] ${time} - ${this.scheduleService.taskTitle(t)}${t.note ? `\n  - 备注: ${t.note}` : ''}\n`;
      });
    } else {
      md += `> 暂无任务\n`;
    }
    md += `\n`;

    md += `### 选做任务\n`;
    if (data.optional.length > 0) {
      data.optional.forEach((t) => {
        const time = formatTime(new Date(t.time));
        md += `- [${t.completed ? 'x' : ' '}] ${time} - ${this.scheduleService.taskTitle(t)}${t.note ? `\n  - 备注: ${t.note}` : ''}\n`;
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
    const { ready, waiting, completed } = partitionIdeas(this.ideaInboxService.getNodes(), ctx);

    md += `## 💡 灵感收集箱\n\n`;
    const renderIdea = (t, status) => {
      const due = t.dueDate ? ` DDL:${t.dueDate}` : '';
      const deps =
        t.dependsOn && t.dependsOn.length
          ? ` 依赖:${t.dependsOn.map((d) => (d.scope === 'idea' ? `灵感#${d.id}` : `${d.dateKey}/${d.list}#${d.id}`)).join('; ')}`
          : '';
      md += `- [${t.completed ? 'x' : ' '}] [${status}] ${t.text}${due}${deps}${t.note ? `\n  - 备注: ${t.note}` : ''}\n`;
    };
    if (ready.length + waiting.length + completed.length === 0) {
      md += `> 暂无灵感\n`;
    } else {
      ready.forEach((t) => renderIdea(t, '可捡起'));
      waiting.forEach((t) => renderIdea(t, '等待中'));
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
    md += `\n\n`;

    md += `## 🤖 AI评估\n\n`;
    const aiEvalText = (data.aiEval || '').trim();
    md += aiEvalText ? aiEvalText : '> 暂无评估';
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
