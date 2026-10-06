import React, { useState } from 'react';
import { useApp } from '../../app/context.jsx';
import { DateNav } from '../../components/DateNav.jsx';
import { TaskEditModal } from '../../modals/TaskEditModal.jsx';
import { DailyTasksCard } from './DailyTasksCard.jsx';
import { ProjectsCard } from './ProjectsCard.jsx';
import { SyncTasksModal } from './SyncTasksModal.jsx';

export function TasksPage() {
  const app = useApp();
  const [syncOpen, setSyncOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const date = app.scheduleService.currentDate;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="page-kicker">Tasks</p>
          <h1 className="page-title">任务</h1>
        </div>
        <DateNav
          date={date}
          onPrev={() => app.scheduleService.prevDay()}
          onNext={() => app.scheduleService.nextDay()}
          onToday={() => app.scheduleService.goToday()}
        />
      </header>
      <div className="stack">
        <DailyTasksCard onSync={() => setSyncOpen(true)} onEdit={(type, id) => setEditing({ type, id })} />
        <ProjectsCard />
      </div>
      <SyncTasksModal open={syncOpen} onClose={() => setSyncOpen(false)} />
      <TaskEditModal type={editing?.type} id={editing?.id} onClose={() => setEditing(null)} />
    </div>
  );
}
