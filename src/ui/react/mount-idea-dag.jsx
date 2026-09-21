import React from 'react';
import { createRoot } from 'react-dom/client';
import { IdeaDagApp } from './IdeaDagApp.jsx';

/**
 * @param {import('../../application/schedule-app.js').ScheduleApp} app
 * @param {HTMLElement} container
 */
export function mountIdeaDag(app, container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <IdeaDagApp app={app} />
    </React.StrictMode>
  );
  return root;
}
