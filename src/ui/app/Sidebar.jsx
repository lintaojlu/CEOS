import React from 'react';
import { version } from '../../../src-tauri/tauri.conf.json';
import { Icon } from '../library/index.js';
import { PAGES, navigate } from './router.js';
import { useApp, useShell } from './context.jsx';
import { SIDEBAR_WIDTH } from '../../infrastructure/storage/ui-prefs-repository.js';

export function Sidebar({ page, onOpenIdeas, width, onResizeStart }) {
  const app = useApp();
  const shell = useShell();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-copy">
          <div className="brand-name">
            CEOS
            <span className="brand-version">v{version}</span>
          </div>
          <div className="brand-sub">每个人都是自己的 CEO</div>
        </div>
      </div>
      <nav className="nav" aria-label="页面">
        {PAGES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === page ? 'nav-item is-active' : 'nav-item'}
            onClick={() => {
              if (item.id === 'home') app.insightService.refresh();
              if (item.id === 'ideas') onOpenIdeas();
              else navigate(item.id);
            }}
          >
            <span className="nav-icon-wrap">
              <Icon name={item.id} />
            </span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <button type="button" className="nav-item" onClick={shell.openSettings}>
          <Icon name="settings" />
          <span>设置</span>
        </button>
      </div>
      <div
        className="sidebar-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整侧边栏宽度"
        aria-valuemin={SIDEBAR_WIDTH.min}
        aria-valuemax={SIDEBAR_WIDTH.max}
        aria-valuenow={width}
        onPointerDown={onResizeStart}
      />
    </aside>
  );
}
