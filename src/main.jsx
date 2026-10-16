import React from 'react';
import { createRoot } from 'react-dom/client';
import { ScheduleApp } from './application/schedule-app.js';
import { App } from './ui/app/App.jsx';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/components.css';

const scheduleApp = new ScheduleApp();

async function start() {
  await scheduleApp.bootstrap({
    fetchBackup: async () => {
      const response = await fetch('/ceos-data/bundle.json');
      if (!response.ok) return null;
      return response.json();
    }
  });
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App app={scheduleApp} />
    </React.StrictMode>
  );
}

start();
