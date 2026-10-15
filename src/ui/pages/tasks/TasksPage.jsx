import React, { useState } from 'react';
import { useApp } from '../../app/context.jsx';
import { TaskEditModal } from '../../modals/TaskEditModal.jsx';
import { DailyTasksCard } from './DailyTasksCard.jsx';
import { tagsVisibleOnDay } from '../../../domain/schedule/fixed-tags.js';
import { TagsCard } from './TagsCard.jsx';
import { SyncTasksModal } from './SyncTasksModal.jsx';

export function TasksPage() {
  const app = useApp();
  const [syncOpen, setSyncOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedTagIds, setSelectedTagIds] = useState(() => new Set());
  const tags = tagsVisibleOnDay(app.scheduleService.workspace.tags, app.scheduleService.getCurrentData());
  const liveSelected = [...selectedTagIds].filter((id) => tags.some((tag) => tag.id === id));

  function toggleTag(id) {
    setSelectedTagIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="page">
      <div className="stack">
        <DailyTasksCard
          selectedTagIds={liveSelected}
          onSync={() => setSyncOpen(true)}
          onEdit={(type, id) => setEditing({ type, id })}
        />
        <TagsCard
          tags={tags}
          selectedIds={liveSelected}
          onToggle={toggleTag}
        />
      </div>
      <SyncTasksModal open={syncOpen} onClose={() => setSyncOpen(false)} />
      <TaskEditModal type={editing?.type} id={editing?.id} onClose={() => setEditing(null)} />
    </div>
  );
}
