import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  CaptureUpdateAction,
  Excalidraw,
  MainMenu,
  convertToExcalidrawElements,
  exportToBlob,
  getCommonBounds
} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { useApp } from '../../app/context.jsx';
import {
  BOARD_BYTE_LIMIT,
  boardByteLength,
  parseBoardFile,
  sceneFingerprint,
  sceneHasElements,
  scenePayload
} from '../../../domain/ideas/board-scene.js';

const SAVE_DELAY = 600;
const IMAGE_EDGE = 480;

const BOARD_UI = {
  canvasActions: {
    loadScene: false,
    saveToActiveFile: false,
    clearCanvas: false,
    toggleTheme: false,
    export: { saveFileToDisk: false },
    saveAsImage: true
  },
  tools: { image: true }
};

function emptyScene() {
  return scenePayload([], { viewBackgroundColor: '#ffffff' }, {});
}

function errorText(err) {
  if (typeof err === 'string' && err.trim()) return err.trim();
  if (err && typeof err.message === 'string' && err.message.trim()) return err.message.trim();
  return '画板没写上盘';
}

/** @param {string} dataUrl */
function measureImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || IMAGE_EDGE, height: image.naturalHeight || IMAGE_EDGE });
    image.onerror = () => reject(new Error('图片读不出来'));
    image.src = dataUrl;
  });
}

/**
 * @param {import('react').Ref<{
 *   flush: () => Promise<void>,
 *   exportPng: () => Promise<Blob | null>,
 *   placeImages: (images: { id: string, mime: string, base64: string }[]) => Promise<void>,
 *   clear: () => Promise<void>
 * }>} ref
 */
export const IdeaBoard = forwardRef(function IdeaBoard({ ideaId, onState }, ref) {
  const app = useApp();
  const apiRef = useRef(null);
  const savedFp = useRef('');
  const pending = useRef(null);
  const lastGood = useRef(emptyScene());
  const timer = useRef(0);
  const ideaRef = useRef(ideaId);
  ideaRef.current = ideaId;
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  const presence = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState('loading');
  const [scene, setScene] = useState(null);
  const [note, setNote] = useState('');

  function publish(elements, corrupt) {
    const next = { elements: !!elements, corrupt: !!corrupt };
    if (presence.current?.elements === next.elements && presence.current?.corrupt === next.corrupt) return;
    presence.current = next;
    onStateRef.current?.(next);
  }

  async function writeScene(id, next) {
    const json = JSON.stringify(next);
    await app.ideaInboxService.saveBoard(id, json);
    savedFp.current = sceneFingerprint(next);
    pending.current = null;
    setNote('');
    publish(sceneHasElements(next), false);
  }

  async function flush() {
    window.clearTimeout(timer.current);
    const next = pending.current;
    const id = ideaRef.current;
    if (!next) return;
    const fp = sceneFingerprint(next);
    if (fp === savedFp.current) {
      pending.current = null;
      return;
    }
    try {
      await writeScene(id, next);
    } catch (err) {
      setNote(errorText(err));
    }
  }

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setNote('');
    app.ideaInboxService.readBoard(ideaId).then((text) => {
      if (cancelled) return;
      const parsed = parseBoardFile(text);
      if (!parsed.ok) {
        setPhase('corrupt');
        onState?.({ elements: false, corrupt: true, note: '' });
        return;
      }
      const payload = parsed.scene || emptyScene();
      savedFp.current = sceneFingerprint(payload);
      lastGood.current = payload;
      pending.current = null;
      setScene(payload);
      setPhase('ready');
      onState?.({ elements: sceneHasElements(payload), corrupt: false, note: '' });
    }).catch((err) => {
      if (cancelled) return;
      setNote(errorText(err));
      setPhase('failed');
      onState?.({ elements: false, corrupt: true, note: '' });
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
      const next = pending.current;
      const id = ideaRef.current;
      pending.current = null;
      if (!next || sceneFingerprint(next) === savedFp.current) return;
      void app.ideaInboxService.saveBoard(id, JSON.stringify(next)).catch(() => {});
    };
  }, [app, ideaId, attempt]);

  useImperativeHandle(ref, () => ({
    flush,
    async exportPng() {
      const api = apiRef.current;
      if (!api) return null;
      const elements = api.getSceneElements();
      if (!elements.length) return null;
      return exportToBlob({
        elements,
        appState: { ...api.getAppState(), exportBackground: true },
        files: api.getFiles(),
        mimeType: 'image/png'
      });
    },
    async placeImages(images) {
      const api = apiRef.current;
      if (!api || !images?.length) return;
      const existing = new Set(api.getSceneElements().map((element) => element.fileId).filter(Boolean));
      const fresh = images.filter((image) => image?.id && !existing.has(image.id));
      if (!fresh.length) return;
      let x = 80;
      let y = 80;
      const current = api.getSceneElements();
      if (current.length) {
        const bounds = getCommonBounds(current);
        x = bounds[2] + 48;
        y = bounds[1];
      }
      /** @type {any[]} */
      const skeletons = [];
      /** @type {any[]} */
      const files = [];
      for (const image of fresh) {
        const dataURL = `data:${image.mime};base64,${image.base64}`;
        const size = await measureImage(dataURL);
        const edge = Math.max(size.width, size.height, 1);
        const scale = edge > IMAGE_EDGE ? IMAGE_EDGE / edge : 1;
        const width = Math.max(32, Math.round(size.width * scale));
        const height = Math.max(32, Math.round(size.height * scale));
        files.push({
          id: image.id,
          dataURL,
          mimeType: image.mime,
          created: Date.now()
        });
        skeletons.push({ type: 'image', x, y, width, height, fileId: image.id });
        x += width + 32;
      }
      api.addFiles(files);
      const created = convertToExcalidrawElements(skeletons, { regenerateIds: true });
      api.updateScene({
        elements: [...api.getSceneElements(), ...created],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY
      });
      if (created.length) api.scrollToContent(created, { fitToContent: false });
    },
    async clear() {
      const api = apiRef.current;
      window.clearTimeout(timer.current);
      pending.current = null;
      const blank = emptyScene();
      savedFp.current = sceneFingerprint(blank);
      lastGood.current = blank;
      if (api) {
        api.updateScene({
          elements: [],
          captureUpdate: CaptureUpdateAction.NEVER
        });
        api.history.clear();
      }
      await app.ideaInboxService.clearBoard(ideaRef.current);
      setNote('');
      onState?.({ elements: false, corrupt: false, note: '' });
    }
  }));

  const onChange = useCallback((elements, appState, files) => {
    const next = scenePayload(elements, appState, files);
    const fp = sceneFingerprint(next);
    publish(sceneHasElements(next), false);
    if (fp === savedFp.current) return;
    const json = JSON.stringify(next);
    if (boardByteLength(json) > BOARD_BYTE_LIMIT) {
      setNote('这张图放不下');
      const api = apiRef.current;
      const previous = lastGood.current;
      if (api && previous) {
        const files = Object.values(previous.files || {});
        if (files.length) api.addFiles(files);
        api.updateScene({
          elements: previous.elements,
          captureUpdate: CaptureUpdateAction.NEVER
        });
      }
      return;
    }
    lastGood.current = next;
    pending.current = next;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void flush();
    }, SAVE_DELAY);
  }, [app]);

  const initialData = useMemo(() => ({
    elements: scene?.elements || [],
    appState: {
      viewBackgroundColor: scene?.appState?.viewBackgroundColor || '#ffffff'
    },
    files: scene?.files || {}
  }), [scene]);

  const rememberApi = useCallback((api) => {
    apiRef.current = api;
    const opened = api.getSceneElements();
    if (!opened.length) return;
    try {
      api.scrollToContent(opened, { fitToContent: true });
    } catch {
      /* 空画布或尚未排好版时不用滚过去 */
    }
  }, []);

  async function restart() {
    try {
      await app.ideaInboxService.quarantineBoard(ideaId);
      const blank = emptyScene();
      savedFp.current = sceneFingerprint(blank);
      lastGood.current = blank;
      pending.current = null;
      setScene(blank);
      setNote('');
      setPhase('ready');
      onState?.({ elements: false, corrupt: false, note: '' });
    } catch (err) {
      setNote(errorText(err));
    }
  }

  if (phase === 'loading') {
    return <div className="idea-board-status"><p className="empty">正在打开画板…</p></div>;
  }
  if (phase === 'failed') {
    return (
      <div className="idea-board-status">
        <p>{note || '画板没写上盘'}</p>
        <button type="button" className="chrome-label is-framed" onClick={() => setAttempt((value) => value + 1)}>再试一次</button>
      </div>
    );
  }
  if (phase === 'corrupt') {
    return (
      <div className="idea-board-status">
        <p>这块画打不开</p>
        <button type="button" className="chrome-label is-framed" onClick={restart}>重新开始</button>
        {note ? <p className="idea-image-missing">{note}</p> : null}
      </div>
    );
  }

  return (
    <div className="idea-board">
      {note ? <p className="idea-board-note">{note}</p> : null}
      <div className="idea-board-canvas">
        <Excalidraw
          langCode="zh-CN"
          theme="light"
          name="画板"
          aiEnabled={false}
          UIOptions={BOARD_UI}
          initialData={initialData}
          excalidrawAPI={rememberApi}
          onChange={onChange}
        >
          <MainMenu>
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
        </Excalidraw>
      </div>
    </div>
  );
});
