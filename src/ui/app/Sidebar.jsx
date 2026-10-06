import React from 'react';
import { Icon } from '../components/Icon.jsx';
import { PAGES, navigate } from './router.js';
import { useApp, useShell } from './context.jsx';

export function Sidebar({ page }) {
  const app = useApp();
  const shell = useShell();
  const snap = app.pomodoroService.getSnapshot();
  const running = snap.phase !== 'idle';

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><img src="/logo.svg" alt="" /></div>
        <div className="brand-copy">
          <div className="brand-name">CEOS</div>
          <div className="brand-sub">每个人都是自己的 CEO</div>
        </div>
      </div>
      <nav className="nav" aria-label="页面">
        {PAGES.map((item) => {
          const isPomo = item.id === 'pomodoro';
          return (
            <button
              key={item.id}
              type="button"
              className={item.id === page ? 'nav-item is-active' : 'nav-item'}
              onClick={() => navigate(item.id)}
            >
              <span className="nav-icon-wrap">
                <Icon name={item.id} />
                {isPomo && running ? <span className="nav-pomo-dot" aria-hidden /> : null}
              </span>
              <span className="nav-label">{item.label}</span>
              {isPomo && running ? <span className="nav-pomo-time">{snap.remainingLabel}</span> : null}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <button type="button" className="nav-item" onClick={shell.openSettings}>
          <Icon name="settings" />
          <span>设置</span>
        </button>
      </div>
    </aside>
  );
}
