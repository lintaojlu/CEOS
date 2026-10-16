import React from 'react';
import { IconButton } from './IconButton.jsx';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function DateNav({ date, onPrev, onNext, subtitle }) {
  const day = subtitle || WEEKDAYS[date.getDay()];
  return (
    <div className="date-nav">
      <IconButton name="chevron-left" label="上一段" title="上一段" size={18} onClick={onPrev} />
      <div className="date-readout">{date.toLocaleDateString('zh-CN')} {day}</div>
      <IconButton name="chevron-right" label="下一段" title="下一段" size={18} onClick={onNext} />
    </div>
  );
}
