import React, { useState } from 'react';
import { useApp } from '../../app/context.jsx';
import { Card } from '../../library/index.js';
import { holdImeEnter, imeCompositionProps, useImeEnterGuard } from '../../keyboard/ime-enter.js';
import { TaskEditModal } from '../../modals/TaskEditModal.jsx';
import { IdeaDagApp } from './dag/IdeaDagApp.jsx';
import { IdeaListView } from './IdeaListView.jsx';

export function IdeasPage({ filter }) {
  const app = useApp();
  const ime = useImeEnterGuard();
  const mode = app.uiPrefs.get().ideasViewMode;
  const [editingId, setEditingId] = useState(null);

  return (
    <div className="page">
      <Card>
        <input
          className="field"
          placeholder="记录暂时做不了的灵感，回车添加"
          {...imeCompositionProps(ime)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || holdImeEnter(event, ime)) return;
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
