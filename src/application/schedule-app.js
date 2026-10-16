/**
 * 组合根。组装仓库、领域服务和事件，不操作 DOM。
 */

import { LocalStorageAdapter } from '../infrastructure/storage/local-storage-adapter.js';
import { ScheduleRepository } from '../infrastructure/storage/schedule-repository.js';
import { WorkspaceRepository } from '../infrastructure/storage/workspace-repository.js';
import { IdeaRepository } from '../infrastructure/storage/idea-repository.js';
import { MilestoneRepository } from '../infrastructure/storage/milestone-repository.js';
import { LlmSettingsRepository } from '../infrastructure/storage/llm-settings-repository.js';
import { UiPrefsRepository } from '../infrastructure/storage/ui-prefs-repository.js';
import { PomodoroRepository } from '../infrastructure/storage/pomodoro-repository.js';
import { MigrationRunner } from '../infrastructure/migration/migration-runner.js';
import { applyProjectTagRepair } from '../infrastructure/migration/project-tag-repair.js';
import { EventBus, Events } from './event-bus.js';
import { ScheduleService } from './schedule-service.js';
import { IdeaInboxService } from './idea-inbox-service.js';
import { IdeaPickupService } from './idea-pickup-service.js';
import { createIdeaStore } from '../infrastructure/storage/idea-file-store.js';
import { MilestoneService } from './milestone-service.js';
import { ExportService } from './export-service.js';
import { LlmService } from './llm-service.js';
import { StatsService } from './stats-service.js';
import { InsightService } from './insight-service.js';
import { DailyReportService } from './daily-report-service.js';
import { TaskBreakdownService } from './task-breakdown-service.js';
import { TaskTagService } from './task-tag-service.js';
import { TaskTransferService } from './task-transfer-service.js';
import { UiPrefsService } from './ui-prefs-service.js';
import { PomodoroService } from './pomodoro-service.js';
import { AgentRuntime } from './agent-runtime.js';
import { AgentThreads } from './agent-threads.js';
import { createAgentStore } from '../infrastructure/agent/transcript-store.js';
import { appendAgentLog } from '../infrastructure/log/agent-log.js';

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
      eventBus: this.eventBus,
      store: createIdeaStore()
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

    this.llmService = new LlmService({
      settingsRepo: new LlmSettingsRepository(this.adapter),
      eventBus: this.eventBus
    });

    this.statsService = new StatsService({
      scheduleService: this.scheduleService
    });

    this.insightService = new InsightService({
      scheduleService: this.scheduleService,
      ideaInboxService: this.ideaInboxService,
      eventBus: this.eventBus
    });

    this.dailyReportService = new DailyReportService({
      scheduleService: this.scheduleService,
      ideaInboxService: this.ideaInboxService,
      llmService: this.llmService,
      eventBus: this.eventBus
    });

    this.taskBreakdownService = new TaskBreakdownService({
      scheduleService: this.scheduleService,
      llmService: this.llmService
    });

    this.ideaPickupService = new IdeaPickupService({
      ideaInboxService: this.ideaInboxService,
      scheduleService: this.scheduleService,
      llmService: this.llmService
    });

    this.taskTagService = new TaskTagService({
      scheduleService: this.scheduleService,
      llmService: this.llmService
    });

    this.taskTransfer = new TaskTransferService({
      scheduleService: this.scheduleService,
      ideaInboxService: this.ideaInboxService
    });

    this.uiPrefs = new UiPrefsService({
      repo: new UiPrefsRepository(this.adapter),
      eventBus: this.eventBus
    });

    this.pomodoroService = new PomodoroService({
      pomodoroRepo: new PomodoroRepository(this.adapter),
      scheduleService: this.scheduleService,
      eventBus: this.eventBus
    });

    this.agentThreads = new AgentThreads({
      runtime: new AgentRuntime({
        scheduleService: this.scheduleService,
        ideaInboxService: this.ideaInboxService,
        milestoneService: this.milestoneService
      }),
      complete: (input) => this.llmService.completeWithTools(input),
      log: (record) => appendAgentLog(record).catch(() => {}),
      store: createAgentStore(),
      eventBus: this.eventBus,
      defaultModel: () => this.llmService.load().model
    });
  }

  async bootstrap() {
    const runner = new MigrationRunner(this.adapter, {
      scheduleRepo: this.scheduleRepo,
      ideaRepo: this.ideaRepo
    });
    runner.run();
    applyProjectTagRepair(this.adapter);

    this.scheduleService.load();
    try {
      await this.ideaInboxService.load();
    } catch {
      // 灵感文件读不到时先打开窗口，下次再迁。
    }
    this.milestoneService.load();
    this.pomodoroService.load();
    this.agentThreads.load().catch(() => {});

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.persist();
      else if (document.visibilityState === 'visible') this.pomodoroService.tick();
    });
  }

  persist() {
    this.scheduleService.persist();
    this.ideaInboxService.persist();
    this.milestoneService.persist();
    this.pomodoroService.persist();
  }
}

export { Events };
