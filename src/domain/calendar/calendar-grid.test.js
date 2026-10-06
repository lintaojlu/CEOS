import { describe, expect, it } from 'vitest';
import { monthGrid, summarizeDay, weekDays, yearMonths } from './calendar-grid.js';

describe('calendar grids', () => {
  it('starts October 2026 on the Sunday before the 1st', () => {
    const weeks = monthGrid(2026, 10);
    expect(weeks).toHaveLength(6);
    expect(weeks[0][0]).toEqual({ dateKey: '2026-09-27', inMonth: false });
    expect(weeks[0][4]).toEqual({ dateKey: '2026-10-01', inMonth: true });
  });

  it('returns the Sunday-Saturday week around a date', () => {
    expect(weekDays('2026-10-05')).toEqual([
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10'
    ]);
  });

  it('builds twelve months', () => {
    expect(yearMonths(2026)).toHaveLength(12);
    expect(yearMonths(2026)[0].month).toBe(1);
  });
});

describe('summarizeDay', () => {
  it('attaches that day\'s milestones and completion', () => {
    const summary = summarizeDay(
      { required: [{ completed: true }, { completed: false }], optional: [] },
      [
        { id: 'm1', title: '上线', date: '2026-10-05' },
        { id: 'm2', title: '别的', date: '2026-10-06' }
      ],
      '2026-10-05'
    );
    expect(summary.completed).toBe(1);
    expect(summary.total).toBe(2);
    expect(summary.rate).toBe(0.5);
    expect(summary.milestones.map((item) => item.id)).toEqual(['m1']);
  });
});
