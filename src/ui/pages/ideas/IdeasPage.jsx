import React, { useState } from 'react';
import { useApp } from '../../app/context.jsx';
import { Card } from '../../components/Card.jsx';
import { SegmentedControl } from '../../components/SegmentedControl.jsx';
import { TaskEditModal } from '../../modals/TaskEditModal.jsx';
import { IdeaDagApp } from './dag/IdeaDagApp.jsx';
import { DEFAULT_IDEA_FILTER, IdeaStatusFilter } from './IdeaStatusFilter.jsx';
import { IdeaListView } from './IdeaListView.jsx';

export function IdeasPage() {
  const app = useApp();
  const mode = app.uiPrefs.get().ideasViewMode;
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState(DEFAULT_IDEA_FILTER);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="page-kicker">Ideas</p>
          <div className="page-title-with-action">
            <h1 className="page-title">收集箱</h1>
            <IdeaStatusFilter value={filter} onChange={setFilter} />
          </div>
        </div>
        <div className="card-actions">
          <SegmentedControl
            label="收集箱视图"
            value={mode}
            options={[{ id: 'canvas', label: 'DAG' }, { id: 'list', label: '列表' }]}
            onChange={(next) => app.uiPrefs.update({ ideasViewMode: next })}
          />
        </div>
      </header>
      <Card>
        <input
          className="field"
          placeholder="记录暂时做不了的灵感，回车添加"
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            const text = event.currentTarget.value.trim();
            if (!text) return;
            app.ideaInboxService.addIdea(text);
            event.currentTarget.value = '';
          }}
        />
        <div style={{ marginTop: 12 }} className={mode === 'canvas' ? '' : 'hidden'}>
          <IdeaDagApp visible={mode === 'canvas'} filter={filter} onEdit={setEditingId} />
        </div>
        <div className={mode === 'list' ? '' : 'hidden'}>
          <IdeaListView filter={filter} onEdit={setEditingId} />
        </div>
      </Card>
      <TaskEditModal type={editingId ? 'ideas' : null} id={editingId} onClose={() => setEditingId(null)} />
    </div>
  );
}
