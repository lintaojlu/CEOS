import React from 'react';

export function Icon({ name }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    width: 18,
    height: 18,
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
  if (name === 'calendar') {
    return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>;
  }
  if (name === 'pomodoro') {
    return (
      <svg {...common}>
        <circle cx="12" cy="13" r="7" />
        <path d="M9 4h6M12 4v2M12 10v3l2 1" />
      </svg>
    );
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
  if (name === 'pin') {
    return (
      <svg {...common} width="15" height="15">
        <circle className="pin-head" cx="12" cy="6" r="3" />
        <path d="M12 9v11" />
      </svg>
    );
  }
  return <svg {...common}><path d="M9 6l6 6-6 6" /></svg>;
}
