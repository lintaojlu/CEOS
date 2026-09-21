import { ScheduleApp } from './application/schedule-app.js';
import { createAiEval } from './ai/ai-eval-client.js';
import { mountIdeaDag } from './ui/react/mount-idea-dag.jsx';

const app = new ScheduleApp();
window.app = app;

window.aiEval = createAiEval(() => app);

document.addEventListener('DOMContentLoaded', () => {
  app.bootstrap();
  const dagRoot = document.getElementById('ideasDagRoot');
  if (dagRoot) {
    mountIdeaDag(app, dagRoot);
    app.setIdeaDagMounted();
  }
});
