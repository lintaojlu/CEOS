export class ReflectionView {
  /** @param {import('../../application/schedule-app.js').ScheduleApp} app */
  constructor(app) {
    this.app = app;
    this._reflectionJustDone = false;
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
    const raw = data.reflection || '';
    const input = document.getElementById('dailyReflection');
    const display = document.getElementById('dailyReflectionDisplay');
    const btn = document.getElementById('reflectionEditBtn');
    if (input) input.value = raw;
    if (display) display.innerHTML = this.renderMarkdown(raw);
    if (input) input.classList.add('hidden');
    if (display) display.classList.remove('hidden');
    if (btn) btn.textContent = '编辑';
    this.renderTags();

    const aiEl = document.getElementById('aiEvalResult');
    if (aiEl) {
      const ai = data.aiEval || '';
      aiEl.dataset.markdown = ai;
      aiEl.innerHTML = this.renderMarkdown(ai);
    }
  }

  renderTags() {
    const data = this.app.scheduleService.getCurrentData();
    const selected = data.reflectionTags || [];
    document.querySelectorAll('[data-reflection-tag]').forEach((btn) => {
      const tag = btn.getAttribute('data-reflection-tag');
      if (selected.indexOf(tag) >= 0) btn.classList.add('reflection-tag-active');
      else btn.classList.remove('reflection-tag-active');
    });
  }

  toggleEdit() {
    if (this._reflectionJustDone) {
      this._reflectionJustDone = false;
      return;
    }
    const display = document.getElementById('dailyReflectionDisplay');
    const input = document.getElementById('dailyReflection');
    const btn = document.getElementById('reflectionEditBtn');
    if (!display || !input) return;
    if (input.classList.contains('hidden')) {
      input.value = this.app.scheduleService.getCurrentData().reflection || '';
      input.classList.remove('hidden');
      display.classList.add('hidden');
      if (btn) btn.textContent = '完成';
      input.focus();
    } else {
      this.editDone();
    }
  }

  editDone() {
    const display = document.getElementById('dailyReflectionDisplay');
    const input = document.getElementById('dailyReflection');
    const btn = document.getElementById('reflectionEditBtn');
    if (!display || !input) return;
    this.app.scheduleService.setReflection(input.value);
    display.innerHTML = this.renderMarkdown(input.value);
    input.classList.add('hidden');
    display.classList.remove('hidden');
    if (btn) btn.textContent = '编辑';
    this._reflectionJustDone = true;
  }

  saveFromInput() {
    const input = document.getElementById('dailyReflection');
    if (input) this.app.scheduleService.setReflection(input.value);
  }
}
