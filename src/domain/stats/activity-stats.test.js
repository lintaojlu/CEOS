import { describe, expect, it } from 'vitest';
import { buildHeatmapWeeks, heatColumnGap, heatmapSpan, summarizeActivity, visibleWeekCount } from './activity-stats.js';
import { activityRateLevel, dayCompletion, rateLevel, requiredCompletion } from './day-completion.js';

function day(completed, total) {
  const required = Array.from({ length: total }, (_, index) => ({
    id: `t${index}`,
    completed: index < completed
  }));
  return { required, optional: [] };
}

describe('dayCompletion', () => {
  it('returns null when a day has no tasks', () => {
    expect(dayCompletion({ required: [], optional: [] })).toBeNull();
    expect(dayCompletion(null)).toBeNull();
  });

  it('counts required and optional together', () => {
    expect(dayCompletion({
      required: [{ completed: true }],
      optional: [{ completed: false }]
    })).toEqual({ completed: 1, total: 2, rate: 0.5 });
  });
});

describe('rateLevel', () => {
  it('maps empty to 0 and a full day to 4', () => {
    expect(rateLevel(null)).toBe(0);
    expect(rateLevel(0)).toBe(1);
    expect(rateLevel(0.5)).toBe(2);
    expect(rateLevel(0.75)).toBe(3);
    expect(rateLevel(1)).toBe(4);
  });
});

describe('required activity rate', () => {
  it('ignores optional tasks', () => {
    expect(requiredCompletion({
      required: [{ completed: false }, { completed: true }],
      optional: [{ completed: true }, { completed: true }]
    })).toEqual({ completed: 1, total: 2, rate: 0.5 });
    expect(requiredCompletion({ required: [], optional: [{ completed: true }] })).toBeNull();
  });

  it('splits no data, zero, low, medium, and high', () => {
    expect(activityRateLevel(null)).toBe(0);
    expect(activityRateLevel(0)).toBe(1);
    expect(activityRateLevel(0.4)).toBe(2);
    expect(activityRateLevel(0.8)).toBe(3);
    expect(activityRateLevel(1)).toBe(4);
  });
});

describe('summarizeActivity', () => {
  const schedule = {
    '2026-10-01': day(1, 1),
    '2026-10-02': day(1, 1),
    '2026-10-03': day(0, 2),
    '2026-10-04': day(2, 2),
    '2026-10-05': day(0, 0)
  };

  it('counts active days and continues a streak from yesterday when today is idle', () => {
    expect(summarizeActivity(schedule, { today: '2026-10-05' })).toEqual({
      activeDays: 3,
      currentStreak: 1,
      longestStreak: 2
    });
  });

  it('includes today in the current streak when today has a completion', () => {
    const withToday = { ...schedule, '2026-10-05': day(1, 1) };
    expect(summarizeActivity(withToday, { today: '2026-10-05' }).currentStreak).toBe(2);
  });
});

describe('buildHeatmapWeeks', () => {
  it('ends on the week that contains today and marks later days as future', () => {
    const weeks = buildHeatmapWeeks(
      { '2026-10-05': day(1, 1) },
      { weeks: 2, today: '2026-10-05' }
    );
    expect(weeks).toHaveLength(2);
    expect(weeks[0].days).toHaveLength(7);
    const todayCell = weeks[1].days.find((cell) => cell.dateKey === '2026-10-05');
    expect(todayCell.level).toBe(4);
    expect(todayCell.future).toBe(false);
    const saturday = weeks[1].days[6];
    expect(saturday.dateKey).toBe('2026-10-10');
    expect(saturday.future).toBe(true);
    expect(weeks[0].monthLabel).toBe('10月');
  });
});

describe('heatmapSpan', () => {
  it('ends on the current week and keeps earlier weeks for paging', () => {
    const weeks = buildHeatmapWeeks({}, { today: '2026-10-05' });
    const last = weeks[weeks.length - 1];
    expect(last.days[0].dateKey).toBe('2026-10-04');
    expect(last.days[6].dateKey).toBe('2026-10-10');
    expect(last.days[6].future).toBe(true);
    expect(last.days.find((cell) => cell.dateKey === '2026-10-05').future).toBe(false);
    expect(weeks.length).toBe(heatmapSpan('2026-10-05').weeks);
    expect(weeks.length).toBeGreaterThan(52);
  });

  it('reaches a recorded day older than the default history', () => {
    const weeks = buildHeatmapWeeks({ '2018-01-03': day(1, 1) }, { today: '2026-10-05' });
    expect(weeks[0].days.some((cell) => cell.dateKey === '2018-01-03')).toBe(true);
  });
});

describe('visibleWeekCount', () => {
  it('keeps 16px cells and uses the leftover width as column gap', () => {
    expect(visibleWeekCount(30 + 764)).toBe(35);
    expect(heatColumnGap(30 + 764, 35)).toBe(6);
    expect(visibleWeekCount(30 + 16)).toBe(1);
  });
});

describe('required heatmap cells', () => {
  it('colors only required tasks and leaves optional-only days empty', () => {
    const weeks = buildHeatmapWeeks({
      '2026-10-05': {
        required: [{ completed: false }, { completed: false }],
        optional: [{ completed: true }]
      }
    }, { weeks: 1, today: '2026-10-05' });
    const todayCell = weeks[0].days.find((cell) => cell.dateKey === '2026-10-05');
    expect(todayCell.level).toBe(1);
    expect(todayCell.total).toBe(2);
  });
});
