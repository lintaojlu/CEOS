import React, { useMemo } from 'react';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

export function Markdown({ text }) {
  const html = useMemo(() => (text ? marked.parse(text) : ''), [text]);
  if (!text) return <p className="empty">还没有内容。</p>;
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}
