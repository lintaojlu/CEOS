import React from 'react';
import { ActivityCard } from './ActivityCard.jsx';
import { InsightsCard } from './InsightsCard.jsx';

export function HomePage() {
  return (
    <div className="page">
      <InsightsCard />
      <ActivityCard />
    </div>
  );
}
