import React from 'react';
import { useApp, useShell } from '../../app/context.jsx';
import { Checkbox, IconButton } from '../../library/index.js';
import { IdeaMarkdownEditor } from './IdeaMarkdownEditor.jsx';

export function IdeaEditor({ ideaId, onPickup }) {
  const app = useApp();
  useShell();
  const idea = app.ideaInboxService.find(ideaId);

  if (!idea) return null;

  const ready = !idea.completed;

  return (
    <div className="idea-doc">
      <div className="idea-editor-tools" data-tauri-drag-region="deep">
        <label className="idea-complete">
          <Checkbox checked={!!idea.completed} onChange={() => app.ideaInboxService.toggleComplete(idea.id)} />
          是否完成
        </label>
        {ready ? (
          <button type="button" className="chrome-label is-framed" onClick={() => onPickup(idea.id)}>列入今日</button>
        ) : null}
        <IconButton
          name="delete"
          label="删除"
          title="删除"
          size={18}
          danger
          className="idea-tool-end"
          onClick={() => app.ideaInboxService.delete(idea.id)}
        />
      </div>
      <IdeaMarkdownEditor
        key={idea.id}
        body={idea.body || ''}
        images={idea.images || {}}
        onChange={({ body, images }) => app.ideaInboxService.update(idea.id, { body, images })}
      />
    </div>
  );
}
