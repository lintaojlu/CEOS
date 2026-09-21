import { escapeHtml } from '../../domain/shared/escape-html.js';
import { taskRefKey } from '../../domain/ideas/idea-node.js';

const BANNER_DISMISS_KEY = 'ideasBannerDismissed';

export class IdeaInboxView {
  /**
   * @param {import('../../application/schedule-app.js').ScheduleApp} app
   */
  constructor(app) {
    this.app = app;
  }

  render() {
    const { ready, waiting, completed } = this.app.ideaInboxService.partition();
    this.updateBadge(ready.length);

    const bannerHost = document.getElementById('ideasBannerHost');
    if (bannerHost) {
      bannerHost.innerHTML = this.renderBanner(ready.length);
    }

    const container = document.getElementById('ideasTasks');
    if (!container) return;

    // List content always kept in sync (wrap may be hidden in canvas mode)
    const parts = [];
    if (ready.length) {
      parts.push(
        `<div class="group-label group-label-accent mb-1.5 mt-1 pb-1 border-b border-dark-500">可捡起来 (${ready.length})</div>`
      );
      ready.forEach((n) => parts.push(this.renderIdeaItem(n, 'ready')));
    }
    if (waiting.length) {
      parts.push(`<div class="group-label mb-1.5 mt-4 pb-1 border-b border-dark-500">等待中 (${waiting.length})</div>`);
      waiting.forEach((n) => parts.push(this.renderIdeaItem(n, 'waiting')));
    }
    if (completed.length) {
      parts.push(`<div class="group-label mb-1.5 mt-4 pb-1 border-b border-dark-500">已完成 (${completed.length})</div>`);
      completed.forEach((n) => parts.push(this.renderIdeaItem(n, 'completed')));
    }
    if (!ready.length && !waiting.length && !completed.length) {
      parts.push(`<div class="text-xs text-zinc-500 py-3 leading-relaxed">当天暂无灵感。把暂时做不了的事放这里；翻日期只看当天，互不影响。</div>`);
    }

    container.innerHTML = parts.join('');
  }

  renderBanner(readyCount) {
    if (readyCount <= 0) return '';
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(BANNER_DISMISS_KEY) === '1') {
      return '';
    }
    return `
      <div id="ideasReadyBanner" class="banner-accent mb-3 px-3 py-2.5 flex items-center justify-between gap-2">
        <span class="text-xs text-accent-cyan">有 ${readyCount} 条灵感可以捡起来了</span>
        <button type="button" onclick="app.dismissIdeasBanner()" class="action action-quiet action-mono shrink-0">知道了</button>
      </div>`;
  }

  updateBadge(readyCount) {
    const badge = document.getElementById('ideasReadyBadge');
    if (!badge) return;
    if (readyCount > 0) {
      badge.textContent = `可捡起 ${readyCount}`;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  dismissBanner() {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(BANNER_DISMISS_KEY, '1');
    }
    const el = document.getElementById('ideasReadyBanner');
    if (el) el.remove();
  }

  /**
   * @param {import('../../domain/ideas/idea-node.js').IdeaNode} idea
   * @param {'ready'|'waiting'|'completed'} status
   */
  renderIdeaItem(idea, status) {
    const pinClass = idea.pinned ? 'text-accent-cyan' : 'text-zinc-600 hover:text-zinc-400';
    const blockers = this.app.ideaInboxService.getBlockers(idea.id);
    const tags = [];
    if (status === 'waiting' && blockers) {
      if (blockers.waitingPreds.length) tags.push('<span class="chip">等前序</span>');
      if (blockers.waitingDueDate) tags.push(`<span class="chip">等 ${escapeHtml(blockers.waitingDueDate)}</span>`);
      if (blockers.missingPreds.length) tags.push('<span class="chip">前序已失效</span>');
    }
    if (idea.dueDate && status === 'ready') {
      tags.push(`<span class="chip chip-accent">DDL ${escapeHtml(idea.dueDate)}</span>`);
    }
    const noteIndicator = idea.note ? `<span class="text-accent-cyan text-xs ml-2">●</span>` : '';
    const ring = status === 'ready' ? 'is-ready' : '';
    const dragAttrs = `draggable="true" ondragstart="app.handleIdeaDragStart(event, '${idea.id}')" ondragend="app.handleTaskDragEnd(event)"`;

    const pickupBtn =
      status === 'ready'
        ? `<button onclick="app.pickUpIdea('${idea.id}')" class="action action-mono shrink-0" title="列入今日必做">列入今日</button>`
        : '';

    return `
      <div class="task-item flex items-center gap-3 py-2 px-2.5 ${ring}"
        ondblclick="app.openTaskModal('ideas', '${idea.id}')" data-id="${idea.id}" data-type="ideas" ${dragAttrs}>
        <input type="checkbox" class="checkbox-custom shrink-0"
          ${idea.completed ? 'checked' : ''}
          onchange="app.toggleIdea('${idea.id}')">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm truncate ${idea.completed ? 'line-through text-zinc-600' : ''}">${escapeHtml(idea.text)}</span>
            ${tags.join('')}
            ${noteIndicator}
          </div>
          ${idea.note ? `<div class="text-xs text-zinc-500 mt-1 leading-relaxed">${escapeHtml(idea.note)}</div>` : ''}
        </div>
        <div class="flex items-center gap-1 shrink-0">
          ${pickupBtn}
          <button onclick="app.pinIdea('${idea.id}')" class="action action-quiet action-icon ${pinClass}" title="置顶">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14M5 12l7-7 7 7"/>
            </svg>
          </button>
          <button onclick="app.openTaskModal('ideas', '${idea.id}')" class="action action-quiet action-icon" title="编辑灵感">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
        </div>
      </div>`;
  }
}

export { taskRefKey };
