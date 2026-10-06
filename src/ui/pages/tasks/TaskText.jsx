import React from 'react';
import { splitTimeMentions } from '../../../domain/schedule/daily-task.js';

export function TaskText({ text, done = false }) {
  const parts = splitTimeMentions(text);
  return (
    <span className={done ? 'task-title is-done' : 'task-title'}>
      {parts.map((part, index) => (
        part.time
          ? <span key={index} className="task-mention">{part.text}</span>
          : <span key={index}>{part.text}</span>
      ))}
    </span>
  );
}
