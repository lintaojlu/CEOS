import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Events } from '../../../application/event-bus.js';
import { createIdeaId, MAX_IMAGE_CHARS, referencedImageIds } from '../../../domain/ideas/idea-document.js';
import { useApp, useShell } from '../../app/context.jsx';
import { flyTextToComposer } from '../../agent/fly-to-composer.js';
import { Checkbox, IconButton, Modal } from '../../library/index.js';
import { IdeaMarkdownEditor } from './IdeaMarkdownEditor.jsx';

const IdeaBoard = lazy(() => import('./IdeaBoard.jsx').then((mod) => ({ default: mod.IdeaBoard })));

/** 这次打开应用期间，每条灵感上次看的是正文还是画板。 */
const surfaceMemory = new Map();

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('图片读不出来'));
    reader.readAsDataURL(blob);
  });
}

export function IdeaEditor({ ideaId, wide, onWide }) {
  const app = useApp();
  useShell();
  const idea = app.ideaInboxService.find(ideaId);
  const boardRef = useRef(null);
  const breakRef = useRef(null);
  const previousId = useRef(ideaId);
  const [surface, setSurface] = useState(() => surfaceMemory.get(ideaId) || 'doc');
  const [boardView, setBoardView] = useState({ elements: false, corrupt: false });
  const [clearOpen, setClearOpen] = useState(false);
  const [note, setNote] = useState('');
  const [breaking, setBreaking] = useState(false);

  useEffect(() => {
    if (previousId.current === ideaId) return;
    const previous = surfaceMemory.get(previousId.current);
    const next = previous === 'board' ? 'board' : (surfaceMemory.get(ideaId) || 'doc');
    previousId.current = ideaId;
    surfaceMemory.set(ideaId, next);
    setSurface(next);
    setNote('');
    setClearOpen(false);
    if (next !== 'board') onWide(false);
  }, [ideaId, onWide]);

  if (!idea) return null;

  const ready = !idea.completed;
  const imageIds = [...referencedImageIds(idea.body)].filter((id) => idea.images?.[id]);
  const onBoard = surface === 'board';

  async function breakdown() {
    if (breaking) return;
    setBreaking(true);
    setNote('');
    try {
      const draft = app.ideaBreakdownService.prepareComposer(idea.id);
      const from = breakRef.current?.getBoundingClientRect();
      if (from) await flyTextToComposer(from, draft.flyText);
      app.eventBus.emit(Events.AGENT_COMPOSER_DRAFT, draft);
    } catch (error) {
      setNote(error?.message || '拆解失败');
    } finally {
      setBreaking(false);
    }
  }

  function show(next) {
    if (surface === 'board' && next !== 'board') {
      void boardRef.current?.flush();
      onWide(false);
    }
    surfaceMemory.set(ideaId, next);
    setSurface(next);
    setNote('');
  }

  async function insertBoard() {
    setNote('');
    try {
      const blob = await boardRef.current?.exportPng();
      if (!blob) return;
      const dataUrl = await blobToDataUrl(blob);
      const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
      if (!match || match[2].length > MAX_IMAGE_CHARS) {
        setNote('这张图放不下');
        return;
      }
      const imageId = createIdeaId();
      const images = { ...idea.images, [imageId]: { mime: match[1], base64: match[2] } };
      const body = `${idea.body || ''}${idea.body ? '\n\n' : ''}![](idea-image:${imageId})`;
      app.ideaInboxService.update(idea.id, { body, images });
      show('doc');
    } catch (err) {
      setNote(err && err.message ? err.message : '图片读不出来');
    }
  }

  async function placeImages() {
    const images = imageIds.map((id) => ({ id, ...idea.images[id] }));
    try {
      await boardRef.current?.placeImages(images);
    } catch (err) {
      setNote(err && err.message ? err.message : '图片读不出来');
    }
  }

  async function confirmClear() {
    setClearOpen(false);
    try {
      await boardRef.current?.clear();
    } catch (err) {
      setNote(err && err.message ? err.message : '画板没写上盘');
    }
  }

  return (
    <div className={onBoard ? 'idea-doc is-board' : 'idea-doc'}>
      <div className={wide ? 'idea-editor-tools is-wide' : 'idea-editor-tools'} data-tauri-drag-region="deep">
        <label className="idea-complete">
          <Checkbox checked={!!idea.completed} onChange={() => app.ideaInboxService.toggleComplete(idea.id)} />
          是否完成
        </label>
        {ready ? (
          <button
            ref={breakRef}
            type="button"
            className="chrome-label is-framed"
            disabled={breaking}
            onClick={breakdown}
          >
            {breaking ? '拆解…' : '拆解'}
          </button>
        ) : null}
        <div className="idea-surface" role="tablist" aria-label="灵感内容">
          <button type="button" role="tab" aria-selected={surface === 'doc'} className={surface === 'doc' ? 'is-on' : ''} onClick={() => show('doc')}>正文</button>
          <button type="button" role="tab" aria-selected={onBoard} className={onBoard ? 'is-on' : ''} onClick={() => show('board')}>画板</button>
        </div>
        {onBoard ? (
          <button
            type="button"
            className={wide ? 'chrome-label is-on' : 'chrome-label'}
            aria-pressed={wide}
            onClick={() => onWide(!wide)}
          >
            全宽
          </button>
        ) : null}
        {onBoard && imageIds.length && !boardView.corrupt ? (
          <button type="button" className="chrome-label" title="把正文里的图片放到画板上" onClick={placeImages}>放入图片</button>
        ) : null}
        {onBoard && boardView.elements && !boardView.corrupt ? (
          <button type="button" className="chrome-label" onClick={insertBoard}>插入正文</button>
        ) : null}
        {onBoard && boardView.elements && !boardView.corrupt ? (
          <button type="button" className="chrome-label" onClick={() => setClearOpen(true)}>清空</button>
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
      {note ? <p className="idea-board-note is-inline">{note}</p> : null}
      {onBoard ? (
        <Suspense fallback={<div className="idea-board-status"><p className="empty">正在打开画板…</p></div>}>
          <IdeaBoard key={idea.id} ref={boardRef} ideaId={idea.id} onState={setBoardView} />
        </Suspense>
      ) : (
        <IdeaMarkdownEditor
          key={idea.id}
          body={idea.body || ''}
          images={idea.images || {}}
          onChange={({ body, images }) => app.ideaInboxService.update(idea.id, { body, images })}
        />
      )}
      {clearOpen ? (
        <Modal title="清空画板" onClose={() => setClearOpen(false)}>
          <p>清空这块画板？正文不会动。</p>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={confirmClear}>清空</button>
            <button type="button" className="btn" onClick={() => setClearOpen(false)}>取消</button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
