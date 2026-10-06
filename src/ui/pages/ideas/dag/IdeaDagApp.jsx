import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Events } from '../../../../application/event-bus.js';
import { useApp } from '../../../app/context.jsx';
import { IdeaDagCanvas } from './IdeaDagCanvas.jsx';
import { mapIdeasToFlow } from './dag-mapper.js';

export function IdeaDagApp({ visible, filter, onEdit }) {
  const app = useApp();
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const offs = [Events.IDEAS_UPDATED, Events.TASK_COMPLETED, Events.TASKS_UPDATED, Events.DATE_CHANGED]
      .map((event) => app.eventBus.on(event, refresh));
    return () => offs.forEach((off) => off());
  }, [app, refresh]);

  const viewModel = useMemo(() => {
    const model = app.ideaInboxService.getDagViewModel(filter);
    const mapped = mapIdeasToFlow(model.ideas, model.edges, model.statusById);
    const total = app.ideaInboxService.getNodes().filter(Boolean).length;
    return { empty: model.ideas.length === 0, filteredOut: total > 0, nodes: mapped.nodes, edges: mapped.edges };
  }, [app, revision, filter]);

  const onPickUp = useCallback((id) => {
    const result = app.ideaInboxService.pickUp(id, 'required');
    if (result && result.error) window.alert(result.error);
  }, [app]);

  if (viewModel.empty) {
    return <div className="ideas-dag-canvas" style={{ display: 'grid', placeItems: 'center' }}><p className="empty">{viewModel.filteredOut ? '当前筛选下没有任务。' : '还没有灵感。添加后可以在图上把一条连到另一条，表示前序。'}</p></div>;
  }

  return (
    <IdeaDagCanvas
      initialNodes={viewModel.nodes}
      initialEdges={viewModel.edges}
      revision={revision}
      visible={visible}
      onPositionChange={(id, position) => app.ideaInboxService.updatePosition(id, position)}
      onConnectEdge={(source, target) => app.ideaInboxService.setIdeaDependency(source, target)}
      onRemoveEdge={(source, target) => app.ideaInboxService.removeIdeaDependency(source, target)}
      onPickUp={onPickUp}
      onEdit={onEdit}
    />
  );
}
