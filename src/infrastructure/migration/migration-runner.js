import { MIGRATIONS } from './migrations.js';

export class MigrationRunner {
  /**
   * @param {import('../storage/local-storage-adapter.js').LocalStorageAdapter} adapter
   * @param {object} repos
   * @param {import('../storage/schedule-repository.js').ScheduleRepository} repos.scheduleRepo
   * @param {import('../storage/idea-repository.js').IdeaRepository} repos.ideaRepo
   */
  constructor(adapter, repos) {
    this.adapter = adapter;
    this.repos = repos;
  }

  run() {
    let version = this.adapter.getSchemaVersion();

    for (const m of MIGRATIONS) {
      if (version < m.to) {
        m.run(this.adapter, this.repos.scheduleRepo, this.repos.ideaRepo);
        version = m.to;
      }
    }

    if (this.adapter.getSchemaVersion() < 2) {
      this.adapter.setSchemaVersion(2);
    }
  }
}
