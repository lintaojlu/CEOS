import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IdeaDagCanvas } from './IdeaDagCanvas.jsx';
import { mapIdeasToFlow } from './dag-mapper.js';
import { Events } from '../../application/event-bus.js';

/**
 * React island root for ideas DAG.
 * @param {{ app: import('../../application/schedule-app.js').ScheduleApp }} props
 */
export function IdeaDagApp({ app }) {
  const [revision, setRevision] = useState(0);
  const [viewMode, setViewMode] = useState(() => app.ideasViewMode || 'canvas');

  const refresh = useCallback(() => {
    setRevision((r) => r + 1);
  }, []);

  useEffect(() => {
    const unsubIdeas = app.eventBus.on(Events.IDEAS_UPDATED, refresh);
    const unsubTasks = app.eventBus.on(Events.TASK_COMPLETED, refresh);
    const unsubMoved = app.eventBus.on(Events.TASKS_UPDATED, refresh);
    const unsubDate = app.eventBus.on(Events.DATE_CHANGED, refresh);
    const unsubMode = app.eventBus.on(Events.IDEAS_VIEW_MODE, (payload) => {
      if (payload && (payload.mode === 'list' || payload.mode === 'canvas')) {
        setViewMode(payload.mode);
      }
    });
    return () => {
      unsubIdeas();
      unsubTasks();
      unsubMoved();
      unsubDate();
      unsubMode();
    };
  }, [app, refresh]);

  const viewModel = useMemo(() => {
    const vm = app.ideaInboxService.getDagViewModel();
    const mapped = mapIdeasToFlow(vm.ideas, vm.edges, vm.statusById);
    return {
      empty: !vm.ideas.length,
      flowNodes: mapped.nodes,
      flowEdges: mapped.edges
    };
  }, [app, revision]);

  const onPositionChange = useCallback(
    (id, pos) => {
      app.ideaInboxService.updatePosition(id, pos);
    },
    [app]
  );

  const onConnectEdge = useCallback(
    (source, target) => app.ideaInboxService.setIdeaDependency(source, target),
    [app]
  );

  const onRemoveEdge = useCallback(
    (source, target) => {
      app.ideaInboxService.removeIdeaDependency(source, target);
    },
    [app]
  );

  const onPickUp = useCallback(
    (id) => {
      app.pickUpIdea(id);
    },
    [app]
  );

  const onEdit = useCallback(
    (id) => {
      app.openTaskModal('ideas', id);
    },
    [app]
  );

  const canvasVisible = viewMode === 'canvas';

  if (viewModel.empty) {
    return (
      <div className="ideas-dag-canvas h-[360px] flex items-center justify-center px-6 text-center text-xs text-zinc-500 leading-relaxed">
        暂无灵感。点 + 添加；翻日期只显示当天。在 DAG 上可连接当天的前驱 → 后继。
      </div>
    );
  }

  return (
    <IdeaDagCanvas
      initialNodes={viewModel.flowNodes}
      initialEdges={viewModel.flowEdges}
      revision={revision}
      visible={canvasVisible}
      onPositionChange={onPositionChange}
      onConnectEdge={onConnectEdge}
      onRemoveEdge={onRemoveEdge}
      onPickUp={onPickUp}
      onEdit={onEdit}
    />
  );
}
