import React from 'react';
import { useApp, useShell } from '../../app/context.jsx';
import { IconButton } from '../../library/index.js';
import { IdeaMarkdownEditor } from './IdeaMarkdownEditor.jsx';

export function IdeaEditor({ ideaId }) {
  const app = useApp();
  useShell();
  const idea = app.ideaInboxService.find(ideaId);
  if (!idea) return null;

  return (
    <div className="idea-doc">
      <div className="idea-editor-tools" data-tauri-drag-region="deep">
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
