import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { heatColumnGap, visibleWeekCount } from '../../domain/stats/activity-stats.js';

const DOW = ['日', '一', '二', '三', '四', '五', '六'];
const RATE_LABEL = ['没有数据', '0完成率', '低完成率', '中完成率', '高完成率'];

function dateLabel(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}

function detailLabel(cell) {
  if (cell.future) return '还没到';
  if (!cell.total) return '没有数据';
  const name = RATE_LABEL[cell.level] || '低完成率';
  const percent = Math.round((cell.rate || 0) * 100);
  return `${name} · 完成 ${cell.completed}/${cell.total}（${percent}%）`;
}

function monthText(week, index) {
  if (week.monthLabel) return week.monthLabel;
  if (index !== 0 || !week.days[0]) return '';
  return `${Number(week.days[0].dateKey.slice(5, 7))}月`;
}

function Chevron({ direction }) {
  const d = direction === 'prev' ? 'M14 6 L8 12 L14 18' : 'M10 6 L16 12 L10 18';
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Heatmap({ weeks }) {
  const frameRef = useRef(null);
  const tipRef = useRef(null);
  const [visible, setVisible] = useState(1);
  const [gap, setGap] = useState(6);
  const [fromEnd, setFromEnd] = useState(0);
  const [hover, setHover] = useState(null);

  useLayoutEffect(() => {
    const node = frameRef.current;
    if (!node) return undefined;
    const measure = () => {
      const width = node.clientWidth;
      const count = visibleWeekCount(width);
      setVisible(count);
      setGap(heatColumnGap(width, count));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const maxStart = Math.max(0, weeks.length - visible);
  const windowStart = maxStart - Math.min(fromEnd, maxStart);
  const slice = weeks.slice(windowStart, windowStart + visible);
  const columnsStyle = { gridAutoColumns: '16px', columnGap: `${gap}px` };

  function page(direction) {
    setHover(null);
    setFromEnd((current) => {
      const max = Math.max(0, weeks.length - visible);
      return Math.min(max, Math.max(0, current - direction * visible));
    });
  }

  function showTip(item, element) {
    const rect = element.getBoundingClientRect();
    setHover({
      key: item.dateKey,
      date: dateLabel(item.dateKey),
      detail: detailLabel(item),
      x: rect.left + rect.width / 2,
      y: rect.top,
      shift: 0
    });
  }

  useEffect(() => {
    if (!hover) return undefined;
    const hide = () => setHover(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [hover]);

  useEffect(() => {
    const tip = tipRef.current;
    if (!hover || !tip) return undefined;
    const box = tip.getBoundingClientRect();
    const margin = 16;
    let delta = 0;
    if (box.right > window.innerWidth - margin) delta -= box.right - (window.innerWidth - margin);
    if (box.left + delta < margin) delta += margin - (box.left + delta);
    if (Math.abs(delta) < 1) return undefined;
    setHover((current) => (current && current.key === hover.key ? { ...current, shift: current.shift + delta } : current));
    return undefined;
  }, [hover]);

  return (
    <div className="heatmap" ref={frameRef}>
      <div className="heatmap-block">
      <div className="heatmap-layout">
        <div className="heatmap-dows" aria-hidden="true">
          {DOW.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className="heatmap-cols" style={columnsStyle}>
          {slice.map((week, index) => (
            <div key={week.days[0]?.dateKey || index} className="heatmap-col">
              {week.days.map((day) => {
                const tone = day.future ? ' is-future' : (day.level ? ` heat-${day.level}` : '');
                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    className={`heat${tone}${hover?.key === day.dateKey ? ' is-hot' : ''}`}
                    aria-label={`${dateLabel(day.dateKey)} ${detailLabel(day)}`}
                    onMouseEnter={(event) => showTip(day, event.currentTarget)}
                    onFocus={(event) => showTip(day, event.currentTarget)}
                    onMouseLeave={() => setHover((current) => (current?.key === day.dateKey ? null : current))}
                    onBlur={() => setHover((current) => (current?.key === day.dateKey ? null : current))}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="heatmap-months" style={columnsStyle}>
          {slice.map((week, index) => (
            <span key={week.days[0]?.dateKey || index} className="heatmap-month">{monthText(week, index)}</span>
          ))}
        </div>
      </div>
      <div className="legend">
        <span className="heat" />没有数据
        <span className="heat heat-1" />0
        <span className="heat heat-2" />低
        <span className="heat heat-3" />中
        <span className="heat heat-4" />高
      </div>
      <div className="heatmap-pager">
        <button type="button" className="heatmap-nav" aria-label="更早" onClick={() => page(-1)} disabled={windowStart === 0}>
          <Chevron direction="prev" />
        </button>
        <button type="button" className="heatmap-nav" aria-label="更近" onClick={() => page(1)} disabled={windowStart >= maxStart}>
          <Chevron direction="next" />
        </button>
      </div>
      </div>
      {hover ? (
        <div ref={tipRef} className="heat-tip" style={{ left: hover.x, top: hover.y, '--tip-shift': `${hover.shift}px` }} role="tooltip">
          <div className="heat-tip-date">{hover.date}</div>
          <div className="heat-tip-detail">{hover.detail}</div>
        </div>
      ) : null}
    </div>
  );
}
