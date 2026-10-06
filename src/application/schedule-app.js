/**
 * 组合根。组装仓库、领域服务和事件，不操作 DOM。
 */

import { LocalStorageAdapter } from '../infrastructure/storage/local-storage-adapter.js';
import { ScheduleRepository } from '../infrastructure/storage/schedule-repository.js';
import { WorkspaceRepository } from '../infrastructure/storage/workspace-repository.js';
import { IdeaRepository } from '../infrastructure/storage/idea-repository.js';
import { MilestoneRepository } from '../infrastructure/storage/milestone-repository.js';
import { LlmSettingsRepository } from '../infrastructure/storage/llm-settings-repository.js';
import { InsightsRepository } from '../infrastructure/storage/insights-repository.js';
import { UiPrefsRepository } from '../infrastructure/storage/ui-prefs-repository.js';
import { MigrationRunner } from '../infrastructure/migration/migration-runner.js';
import { EventBus, Events } from './event-bus.js';
import { ScheduleService } from './schedule-service.js';
import { IdeaInboxService } from './idea-inbox-service.js';
import { MilestoneService } from './milestone-service.js';
import { ExportService } from './export-service.js';
import { LlmService } from './llm-service.js';
import { StatsService } from './stats-service.js';
import { InsightService } from './insight-service.js';
import { DailyReportService } from './daily-report-service.js';
import { TaskTransferService } from './task-transfer-service.js';
import { UiPrefsService } from './ui-prefs-service.js';

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

    this.llmService = new LlmService({
      settingsRepo: new LlmSettingsRepository(this.adapter),
      eventBus: this.eventBus
    });

    this.statsService = new StatsService({
      scheduleService: this.scheduleService,
      milestoneService: this.milestoneService
    });

    this.insightService = new InsightService({
      scheduleService: this.scheduleService,
      llmService: this.llmService,
      insightsRepo: new InsightsRepository(this.adapter),
      eventBus: this.eventBus
    });

    this.dailyReportService = new DailyReportService({
      scheduleService: this.scheduleService,
      ideaInboxService: this.ideaInboxService,
      llmService: this.llmService,
      eventBus: this.eventBus
    });

    this.taskTransfer = new TaskTransferService({
      scheduleService: this.scheduleService,
      ideaInboxService: this.ideaInboxService
    });

    this.uiPrefs = new UiPrefsService({
      repo: new UiPrefsRepository(this.adapter),
      eventBus: this.eventBus
    });
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

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.persist();
    });
  }

  persist() {
    this.scheduleService.persist();
    this.ideaInboxService.persist();
    this.milestoneService.persist();
  }
}

export { Events };
