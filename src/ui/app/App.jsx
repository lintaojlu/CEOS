import React, { useEffect, useState } from 'react';
import { AppProvider, useApp, useShell } from './context.jsx';
import { pageFromHash } from './router.js';
import { Sidebar } from './Sidebar.jsx';
import { SettingsModal } from '../modals/SettingsModal.jsx';
import { HomePage } from '../pages/home/HomePage.jsx';
import { TasksPage } from '../pages/tasks/TasksPage.jsx';
import { PomodoroPage } from '../pages/pomodoro/PomodoroPage.jsx';
import { IdeasPage } from '../pages/ideas/IdeasPage.jsx';
import { CalendarPage } from '../pages/calendar/CalendarPage.jsx';

function Shell() {
  const app = useApp();
  // 订阅界面壳上下文。事件只抬高 revision，页面作为 children 传入，必须读这个上下文才会跟着重绘。
  useShell();
  const [page, setPage] = useState(() => pageFromHash(window.location.hash) || app.uiPrefs.get().page || 'home');

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

  return (
    <div className="app-shell">
      <Sidebar page={page} />
      <main className="main">
        {page === 'home' ? <HomePage /> : null}
        {page === 'tasks' ? <TasksPage /> : null}
        {page === 'pomodoro' ? <PomodoroPage /> : null}
        {page === 'ideas' ? <IdeasPage /> : null}
        {page === 'calendar' ? <CalendarPage /> : null}
      </main>
      <SettingsModal />
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
