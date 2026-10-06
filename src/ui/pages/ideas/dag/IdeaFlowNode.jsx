import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const statusClass = { ready: 'idea-node-ready', waiting: 'idea-node-waiting', completed: 'idea-node-completed' };
const statusLabel = { ready: '可捡起', waiting: '等待中', completed: '已完成' };

function IdeaFlowNodeComponent({ id, data }) {
  const status = data.status || 'waiting';
  return (
    <div
      className={`idea-node ${statusClass[status] || ''}`}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (data.onEdit) data.onEdit(id);
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="task-line" style={{ marginBottom: 6 }}>
        <span className={status === 'ready' ? 'chip chip-accent' : 'chip'}>{statusLabel[status]}</span>
        {data.dueDate ? <span className="idea-node-ddl">DDL {data.dueDate}</span> : null}
      </div>
      <div className="idea-node-label" title={data.label}>{data.label}</div>
      {status === 'ready' ? (
        <div className="task-line" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn-mono" onClick={(event) => { event.stopPropagation(); data.onPickUp?.(id); }}>列入今日</button>
        </div>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const IdeaFlowNode = memo(IdeaFlowNodeComponent);
