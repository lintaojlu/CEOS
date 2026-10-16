import React from 'react';
import { useApp, useShell } from '../../app/context.jsx';
import { IdeaMarkdownEditor } from './IdeaMarkdownEditor.jsx';

export function IdeaEditor({ ideaId, onPickup }) {
  const app = useApp();
  useShell();
  const idea = app.ideaInboxService.find(ideaId);

  if (!idea) return null;

  const ready = !idea.completed;

  return (
    <div className="idea-doc">
      <div className="idea-editor-tools">
        <label className="idea-tool">
          <input
            type="checkbox"
            className="checkbox"
            checked={!!idea.completed}
            onChange={() => app.ideaInboxService.toggleComplete(idea.id)}
          />
          已完成
        </label>
        <button
          type="button"
          className={idea.pinned ? 'btn is-on' : 'btn'}
          aria-pressed={!!idea.pinned}
          onClick={() => app.ideaInboxService.pin(idea.id)}
        >{idea.pinned ? '取消置顶' : '置顶'}</button>
        {ready ? (
          <button type="button" className="btn btn-mono" onClick={() => onPickup(idea.id)}>列入今日</button>
        ) : null}
        <button
          type="button"
          className="btn btn-danger idea-tool-end"
          onClick={() => app.ideaInboxService.delete(idea.id)}
        >删除</button>
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
