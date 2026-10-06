import React from 'react';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function DateNav({ date, onPrev, onNext, onToday, subtitle }) {
  return (
    <div className="date-nav">
      <button type="button" className="btn btn-quiet btn-icon" onClick={onPrev} aria-label="上一段">‹</button>
      <div className="date-readout">
        <div className="date-main">{date.toLocaleDateString('zh-CN')}</div>
        <div className="date-sub">{subtitle || WEEKDAYS[date.getDay()]}</div>
      </div>
      <button type="button" className="btn btn-quiet btn-icon" onClick={onNext} aria-label="下一段">›</button>
      <button type="button" className="btn btn-mono" onClick={onToday}>今天</button>
    </div>
  );
}

export { WEEKDAYS };
