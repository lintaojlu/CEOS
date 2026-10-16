import React, { useEffect, useState } from 'react';
import { useApp } from '../../app/context.jsx';
import { Modal } from '../../library/index.js';

export function IdeaPickupModal({ ideaId, onClose }) {
  const app = useApp();
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    app.ideaPickupService.preview(ideaId).then((result) => {
      if (cancelled) return;
      setTasks(result.tasks);
      setBusy(false);
    }).catch((err) => {
      if (cancelled) return;
      setError(err && err.message ? err.message : '拆不出来');
      setBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, [app, ideaId]);

  function confirm() {
    try {
      app.ideaPickupService.commit(ideaId, tasks);
      onClose();
    } catch (err) {
      setError(err && err.message ? err.message : '写入失败');
    }
  }

  return (
    <Modal title="列入今日" onClose={onClose}>
      {busy ? <p className="empty">正在拆解…</p> : null}
      {error ? <p className="empty">{error}</p> : null}
      {tasks ? (
        <ul className="idea-pickup-list">
          {tasks.map((task, index) => (
            <li key={`${task.title}-${index}`}>
              <strong>{task.title}</strong>
              {task.note ? <div className="card-note">{task.note}</div> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="form-actions">
        <button type="button" className="btn btn-primary" disabled={!tasks || busy} onClick={confirm}>写入今天的必做</button>
        <button type="button" className="btn" onClick={onClose}>取消</button>
      </div>
    </Modal>
  );
}
