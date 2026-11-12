import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CaptureUpdateAction, Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { useApp } from '../../app/context.jsx';
import {
  BOARD_BYTE_LIMIT,
  BOARD_STORED_BACKGROUND,
  boardBackground,
  boardByteLength,
  parseBoardFile,
  sceneFingerprint,
  scenePayload
} from '../../../domain/ideas/board-scene.js';

const SAVE_DELAY = 600;

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
  return scenePayload([], { viewBackgroundColor: BOARD_STORED_BACKGROUND }, {});
}

function errorText(err) {
  if (typeof err === 'string' && err.trim()) return err.trim();
  if (err && typeof err.message === 'string' && err.message.trim()) return err.message.trim();
  return '画板没写上盘';
}

export function BoardPage() {
  const app = useApp();
  const apiRef = useRef(null);
  const savedFp = useRef('');
  const pending = useRef(null);
  const lastGood = useRef(emptyScene());
  const timer = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState('loading');
  const [scene, setScene] = useState(null);
  const [note, setNote] = useState('');

  async function writeScene(next) {
    await app.boardStore.write(JSON.stringify(next));
    savedFp.current = sceneFingerprint(next);
    pending.current = null;
    setNote('');
  }

  async function flush() {
    window.clearTimeout(timer.current);
    const next = pending.current;
    if (!next) return;
    const fp = sceneFingerprint(next);
    if (fp === savedFp.current) {
      pending.current = null;
      return;
    }
    try {
      await writeScene(next);
    } catch (err) {
      setNote(errorText(err));
    }
  }

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setNote('');
    app.boardStore.read().then((text) => {
      if (cancelled) return;
      const parsed = parseBoardFile(text);
      if (!parsed.ok) {
        setPhase('corrupt');
        return;
      }
      const payload = parsed.scene || emptyScene();
      savedFp.current = sceneFingerprint(payload);
      lastGood.current = payload;
      pending.current = null;
      setScene(payload);
      setPhase('ready');
    }).catch((err) => {
      if (cancelled) return;
      setNote(errorText(err));
      setPhase('failed');
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
      const next = pending.current;
      pending.current = null;
      if (!next || sceneFingerprint(next) === savedFp.current) return;
      void app.boardStore.write(JSON.stringify(next)).catch(() => {});
    };
  }, [app, attempt]);

  const onChange = useCallback((elements, appState, files) => {
    const next = scenePayload(elements, appState, files);
    const fp = sceneFingerprint(next);
    if (fp === savedFp.current) return;
    const json = JSON.stringify(next);
    if (boardByteLength(json) > BOARD_BYTE_LIMIT) {
      setNote('这张图放不下');
      const api = apiRef.current;
      const previous = lastGood.current;
      if (api && previous) {
        const kept = Object.values(previous.files || {});
        if (kept.length) api.addFiles(kept);
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
      viewBackgroundColor: boardBackground(scene?.appState?.viewBackgroundColor)
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
      await app.boardStore.quarantine();
      const blank = emptyScene();
      savedFp.current = sceneFingerprint(blank);
      lastGood.current = blank;
      pending.current = null;
      setScene(blank);
      setNote('');
      setPhase('ready');
    } catch (err) {
      setNote(errorText(err));
    }
  }

  if (phase === 'loading') {
    return <div className="board-page board-status"><p className="empty">正在打开画板…</p></div>;
  }
  if (phase === 'failed') {
    return (
      <div className="board-page board-status">
        <p>{note || '画板没写上盘'}</p>
        <button type="button" className="chrome-label is-framed" onClick={() => setAttempt((value) => value + 1)}>再试一次</button>
      </div>
    );
  }
  if (phase === 'corrupt') {
    return (
      <div className="board-page board-status">
        <p>这块画打不开</p>
        <button type="button" className="chrome-label is-framed" onClick={restart}>重新开始</button>
        {note ? <p className="board-note">{note}</p> : null}
      </div>
    );
  }

  return (
    <div className="board-page">
      {note ? <p className="board-note">{note}</p> : null}
      <div className="board-canvas">
        <Excalidraw
          langCode="zh-CN"
          theme="dark"
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
}
