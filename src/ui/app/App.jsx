import React, { useEffect, useRef, useState } from 'react';
import { AppProvider, useApp, useShell } from './context.jsx';
import { pageFromHash } from './router.js';
import { Sidebar } from './Sidebar.jsx';
import { Icon } from '../components/Icon.jsx';
import { DateNav } from '../components/DateNav.jsx';
import { SegmentedControl } from '../components/SegmentedControl.jsx';
import { SettingsModal } from '../modals/SettingsModal.jsx';
import { PomodoroOverlay } from '../components/PomodoroOverlay.jsx';
import { AgentDock } from '../agent/AgentDock.jsx';
import { HomePage } from '../pages/home/HomePage.jsx';
import { TasksPage } from '../pages/tasks/TasksPage.jsx';
import { IdeasPage } from '../pages/ideas/IdeasPage.jsx';
import { DEFAULT_IDEA_FILTER, IdeaStatusFilter } from '../pages/ideas/IdeaStatusFilter.jsx';

const PAGE_TITLE = { tasks: '任务', ideas: '收集箱' };

function TopBar({ page, sidebarHidden, onToggle, toggleRef, ideaFilter, onIdeaFilter }) {
  const app = useApp();
  useShell();
  const title = PAGE_TITLE[page] || '';
  const mode = app.uiPrefs.get().ideasViewMode;
  return (
    <header className="topbar" data-tauri-drag-region>
      <button
        ref={toggleRef}
        type="button"
        className="sidebar-toggle"
        aria-label={sidebarHidden ? '显示侧边栏' : '隐藏侧边栏'}
        onClick={onToggle}
      >
        <Icon name="sidebar" />
      </button>
      {title ? <h1 className="topbar-title">{title}</h1> : null}
      <div className="topbar-actions">
        {page === 'tasks' ? (
          <DateNav
            date={app.scheduleService.currentDate}
            onPrev={() => app.scheduleService.prevDay()}
            onNext={() => app.scheduleService.nextDay()}
            onToday={() => app.scheduleService.goToday()}
          />
        ) : null}
        {page === 'ideas' ? (
          <>
            <IdeaStatusFilter value={ideaFilter} onChange={onIdeaFilter} />
            <SegmentedControl
              label="收集箱视图"
              value={mode}
              options={[{ id: 'canvas', label: 'DAG' }, { id: 'list', label: '列表' }]}
              onChange={(next) => app.uiPrefs.update({ ideasViewMode: next })}
            />
          </>
        ) : null}
      </div>
    </header>
  );
}

function Shell() {
  const app = useApp();
  // 订阅界面壳上下文。事件只抬高 revision，页面作为 children 传入，必须读这个上下文才会跟着重绘。
  useShell();
  const [page, setPage] = useState(() => {
    const initial = pageFromHash(window.location.hash) || app.uiPrefs.get().page || 'home';
    if (initial === 'home') app.insightService.refresh();
    return initial;
  });

  useEffect(() => {
    const apply = () => {
      const fromHash = pageFromHash(window.location.hash);
      if (!fromHash) {
        const fallback = app.uiPrefs.get().page || 'home';
        const next = `#/${fallback}`;
        if (window.location.hash !== next) window.location.replace(next);
        setPage(fallback);
        return;
      }
      setPage(fromHash);
      if (app.uiPrefs.get().page !== fromHash) app.uiPrefs.update({ page: fromHash });
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [app]);

  const focusing = app.pomodoroService.getSnapshot().phase !== 'idle';
  const sidebarHidden = app.uiPrefs.get().sidebarHidden === true;
  const toggleRef = useRef(null);
  const sidebarHiddenRef = useRef(sidebarHidden);
  const [ideaFilter, setIdeaFilter] = useState(DEFAULT_IDEA_FILTER);

  useEffect(() => {
    if (sidebarHiddenRef.current === sidebarHidden) return;
    sidebarHiddenRef.current = sidebarHidden;
    toggleRef.current?.focus();
  }, [sidebarHidden]);

  function toggleSidebar() {
    app.uiPrefs.update({ sidebarHidden: !sidebarHidden });
  }

  return (
    <div className={sidebarHidden ? 'app-shell is-sidebar-hidden' : 'app-shell'}>
      <div className="app-frame" inert={focusing ? true : undefined}>
        <div className="window-drag" data-tauri-drag-region />
        <TopBar
          page={page}
          sidebarHidden={sidebarHidden}
          onToggle={toggleSidebar}
          toggleRef={toggleRef}
          ideaFilter={ideaFilter}
          onIdeaFilter={setIdeaFilter}
        />
        {sidebarHidden ? null : <Sidebar page={page} />}
        <main className="main">
          {page === 'home' ? <HomePage /> : null}
          {page === 'tasks' ? <TasksPage /> : null}
          {page === 'ideas' ? <IdeasPage filter={ideaFilter} /> : null}
        </main>
        <SettingsModal />
        <AgentDock />
      </div>
      <PomodoroOverlay />
    </div>
  );
}

export function App({ app }) {
  return (
    <AppProvider app={app}>
      <Shell />
    </AppProvider>
  );
}
