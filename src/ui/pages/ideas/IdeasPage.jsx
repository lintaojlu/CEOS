import React, { useEffect, useState } from 'react';
import { useApp, useShell } from '../../app/context.jsx';
import { Icon } from '../../library/index.js';
import { IdeaEditor } from './IdeaEditor.jsx';
import { IdeaListView } from './IdeaListView.jsx';
import { IdeaPickupModal } from './IdeaPickupModal.jsx';
import { IdeaStatusFilter } from './IdeaStatusFilter.jsx';

export function IdeasPage({ filter, onFilter }) {
  const app = useApp();
  useShell();
  const [selectedId, setSelectedId] = useState(null);
  const [pickupId, setPickupId] = useState(null);
  const selected = selectedId ? app.ideaInboxService.find(selectedId) : null;

  useEffect(() => {
    if (!selected?.id) return;
    document.getElementById(`idea-row-${selected.id}`)?.scrollIntoView({ block: 'nearest' });
  }, [selected?.id]);

  const { ready, completed } = app.ideaInboxService.partition();
  const total = ready.length + completed.length;
  const visible = filter === 'done' ? completed.length : filter === 'all' ? total : ready.length;

  let blank = '从左边选择一条灵感。';
  if (total === 0) blank = '还没有灵感。点左上角的新建开始写。';
  else if (visible === 0) blank = '当前筛选下没有灵感。';

  function createIdea() {
    const created = app.ideaInboxService.addIdea('');
    if (!created) return;
    if (filter === 'done') onFilter('open');
    setSelectedId(created.id);
  }

  return (
    <div className="ideas-split">
      <aside className="ideas-list" aria-label="灵感列表">
        <div className="ideas-list-head">
          <div className="ideas-list-tools">
            <IdeaStatusFilter value={filter} onChange={onFilter} />
            <button type="button" className="idea-compose" aria-label="新建灵感" onClick={createIdea}>
              <Icon name="compose" />
            </button>
          </div>
        </div>
        <div className="ideas-list-scroll">
          <IdeaListView filter={filter} selectedId={selected ? selected.id : null} onSelect={setSelectedId} />
        </div>
      </aside>
      <section className="ideas-pane" aria-label="灵感正文">
        {selected ? (
          <IdeaEditor ideaId={selected.id} onPickup={setPickupId} />
        ) : (
          <div className="ideas-blank">
            <p className="empty">{blank}</p>
          </div>
        )}
      </section>
      {pickupId ? <IdeaPickupModal ideaId={pickupId} onClose={() => setPickupId(null)} /> : null}
    </div>
  );
}
