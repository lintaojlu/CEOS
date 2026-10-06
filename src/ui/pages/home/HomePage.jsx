import React, { useEffect, useState } from 'react';
import { msUntilNextHour, quoteForHour } from '../../../domain/quotes/quote-library.js';
import { ActivityCard } from './ActivityCard.jsx';
import { DailyReportCard } from './DailyReportCard.jsx';
import { InsightsCard } from './InsightsCard.jsx';
import { MilestonesCard } from './MilestonesCard.jsx';

export function HomePage() {
  const [quote, setQuote] = useState(() => quoteForHour());

  useEffect(() => {
    let timer = 0;
    function showCurrentHour() {
      setQuote(quoteForHour());
      timer = window.setTimeout(showCurrentHour, msUntilNextHour());
    }
    timer = window.setTimeout(showCurrentHour, msUntilNextHour());
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title page-title-quote">{quote.text}</h1>
      </header>
      <MilestonesCard />
      <InsightsCard />
      <ActivityCard />
      <DailyReportCard />
    </div>
  );
}
