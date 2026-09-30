export class ReflectionView {
  /** @param {import('../../application/schedule-app.js').ScheduleApp} app */
  constructor(app) {
    this.app = app;
  }

  renderMarkdown(text) {
    if (!text) return '';
    if (typeof marked !== 'undefined' && marked.parse) {
      try {
        return marked.parse(text, { gfm: true });
      } catch {
        return text.replace(/\n/g, '<br>');
      }
    }
    return text.replace(/\n/g, '<br>');
  }

  render() {
    const data = this.app.scheduleService.getCurrentData();
    const aiEl = document.getElementById('aiEvalResult');
    if (!aiEl) return;
    const ai = data.aiEval || '';
    aiEl.dataset.markdown = ai;
    aiEl.innerHTML = this.renderMarkdown(ai);
  }
}
