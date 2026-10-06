import React from 'react';
import { Icon } from '../components/Icon.jsx';
import { PAGES, navigate } from './router.js';
import { useShell } from './context.jsx';

export function Sidebar({ page }) {
  const shell = useShell();
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
        {PAGES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === page ? 'nav-item is-active' : 'nav-item'}
            onClick={() => navigate(item.id)}
          >
            <Icon name={item.id} />
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
    </aside>
  );
}
