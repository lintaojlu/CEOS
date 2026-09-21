import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const statusClass = {
  ready: 'idea-node-ready',
  waiting: 'idea-node-waiting',
  completed: 'idea-node-completed'
};

const statusChipClass = {
  ready: 'chip chip-accent',
  waiting: 'chip',
  completed: 'chip'
};

const statusLabel = {
  ready: '可捡起',
  waiting: '等待中',
  completed: '已完成'
};

function IdeaFlowNodeComponent({ id, data }) {
  const status = data.status || 'waiting';

  return (
    <div
      className={`idea-node ${statusClass[status] || statusClass.waiting}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (typeof data.onEdit === 'function') data.onEdit(id);
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-[#929a9e] !border !border-[#f8faf9] !z-10"
        isConnectable
      />
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <span className={statusChipClass[status] || 'chip'}>{statusLabel[status]}</span>
        {data.dueDate ? <span className="idea-node-ddl">DDL {data.dueDate}</span> : null}
      </div>
      <div className="idea-node-label truncate" title={data.label}>
        {data.label}
      </div>
      <div className="flex items-center gap-1 mt-2">
        {status === 'ready' ? (
          <button
            type="button"
            className="action action-mono px-1.5 py-0.5"
            onClick={(e) => {
              e.stopPropagation();
              if (typeof data.onPickUp === 'function') data.onPickUp(id);
            }}
          >
            列入今日
          </button>
        ) : null}
        <button
          type="button"
          className="action action-quiet action-mono px-1.5 py-0.5"
          onClick={(e) => {
            e.stopPropagation();
            if (typeof data.onEdit === 'function') data.onEdit(id);
          }}
        >
          编辑
        </button>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-[#929a9e] !border !border-[#f8faf9] !z-10"
        isConnectable
      />
    </div>
  );
}

export const IdeaFlowNode = memo(IdeaFlowNodeComponent);
