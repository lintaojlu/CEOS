import React from 'react';
import { createRoot } from 'react-dom/client';
import { ScheduleApp } from './application/schedule-app.js';
import { seedTauriLocalStorage } from './infrastructure/storage/seed-tauri-storage.js';
import { App } from './ui/app/App.jsx';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/components.css';

const scheduleApp = new ScheduleApp();

async function start() {
  await seedTauriLocalStorage({
    isTauri: typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
    storage: localStorage,
    fetchBackup: async () => {
      const response = await fetch('/ceos-data/bundle.json');
      if (!response.ok) return null;
      return response.json();
    }
  });
  scheduleApp.bootstrap();
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App app={scheduleApp} />
    </React.StrictMode>
  );
}

start();
