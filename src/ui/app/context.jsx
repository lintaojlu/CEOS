import React, { createContext, useContext, useEffect, useState } from 'react';
import { Events } from '../../application/event-bus.js';

const AppContext = createContext(null);
const ShellContext = createContext(null);

/**
 * 把组合根和界面壳状态交给整棵 React 树。
 * 任一领域事件都会抬高 revision，让正在显示的页面读到新数据。
 */
export function AppProvider({ app, children }) {
  const [revision, setRevision] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const offs = Object.values(Events).map((event) =>
      app.eventBus.on(event, () => setRevision((value) => value + 1))
    );
    return () => offs.forEach((off) => off());
  }, [app]);

  return (
    <AppContext.Provider value={app}>
      <ShellContext.Provider
        value={{
          revision,
          settingsOpen,
          openSettings: () => setSettingsOpen(true),
          closeSettings: () => setSettingsOpen(false)
        }}
      >
        {children}
      </ShellContext.Provider>
    </AppContext.Provider>
  );
}

export function useApp() {
  const app = useContext(AppContext);
  if (!app) throw new Error('useApp 必须在 AppProvider 内使用');
  return app;
}

export function useShell() {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error('useShell 必须在 AppProvider 内使用');
  return shell;
}
