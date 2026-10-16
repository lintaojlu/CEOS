import React from 'react';

/**
 * 界面里共用的符号。名字决定图形，尺寸用 size。
 * @param {{ name: string, size?: number }} props
 */
export function Symbol({ name, size = 18 }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    width: size,
    height: size,
    'aria-hidden': true
  };
  if (name === 'home') {
    return <svg {...common}><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" /></svg>;
  }
  if (name === 'tasks') {
    return <svg {...common}><path d="M8 6h11M8 12h11M8 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></svg>;
  }
  if (name === 'ideas') {
    return <svg {...common}><path d="M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M4 10 7 5h10l3 5" /><path d="M9 14h6" /></svg>;
  }
  if (name === 'agent') {
    return <svg {...common}><path d="M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" /></svg>;
  }
  if (name === 'open') {
    return <svg {...common}><path d="M14 5h5v5M19 5l-7 7M10 19H5v-5M5 19l7-7" /></svg>;
  }
  if (name === 'settings') {
    return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></svg>;
  }
  if (name === 'plus') {
    return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  }
  if (name === 'filter') {
    return <svg {...common}><path d="M4 7h16M7 12h10M10 17h4" /></svg>;
  }
  if (name === 'sidebar') {
    return (
      <svg {...common}>
        <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="4" />
        <path d="M8.1 7.2v9.6" strokeWidth="2.6" />
      </svg>
    );
  }
  if (name === 'pin') {
    return (
      <svg {...common} width="15" height="15">
        <circle className="pin-head" cx="12" cy="6" r="3" />
        <path d="M12 9v11" />
      </svg>
    );
  }
  if (name === 'delete') {
    return (
      <svg {...common}>
        <path d="M4 7h16" />
        <path d="M9 7V5h6v2" />
        <path d="M7 7l1 13h8l1-13" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    );
  }
  if (name === 'expand') {
    return <svg {...common}><path d="M6 9l6 6 6-6" /></svg>;
  }
  if (name === 'close') {
    return <svg {...common}><path d="M6 6l12 12M18 6 6 18" /></svg>;
  }
  if (name === 'chevron-left') {
    return <svg {...common}><path d="M15 6 9 12l6 6" /></svg>;
  }
  if (name === 'chevron-right') {
    return <svg {...common}><path d="M9 6l6 6-6 6" /></svg>;
  }
  if (name === 'send') {
    return <svg {...common} strokeWidth="2.2"><path d="M12 19V7M7 11l5-5 5 5" /></svg>;
  }
  if (name === 'eye') {
    return <svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
  }
  if (name === 'eye-off') {
    return <svg {...common}><path d="M3 3l18 18M10.5 10.7A2 2 0 0 0 13.3 13.5M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 9.3 3.1 11 7-1 2.2-2.6 4-4.6 5.3M6.1 6.7C4.2 8 2.7 9.8 2 12c1.7 3.9 6 7 10 7 1.1 0 2.2-.2 3.2-.5" /></svg>;
  }
  if (name === 'clock') {
    return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>;
  }
  if (name === 'copy') {
    return <svg {...common}><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M5 15V5h10" /></svg>;
  }
  if (name === 'check') {
    return <svg {...common}><path d="M5 12.5 9.5 17 19 7" /></svg>;
  }
  return <svg {...common}><path d="M9 6l6 6-6 6" /></svg>;
}

/** 侧栏等旧调用仍用 Icon 这个名字。 */
export function Icon(props) {
  return <Symbol {...props} />;
}
