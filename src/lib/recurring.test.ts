import { describe, expect, it } from 'vitest';
import type { Recurring } from '../db/types';
import {
  addMonthsClamped, describeSchedule, dueOccurrences, firstOnOrAfter, initialNextDue, markHandled, occurrence,
} from './recurring';

const rec = (over: Partial<Recurring>): Recurring => ({
  id: 'r', kind: 'expense', amount: 100, categoryId: 'c', accountId: 'a', every: 1, unit: 'month',
  startDate: '2026-01-31', nextDueDate: '2026-01-31', handledAhead: [], active: true,
  createdAt: 0, updatedAt: 0, ...over,
});

describe('schedule maths', () => {
  it('clamps month ends without drifting', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29'); // leap year
    const r = rec({});
    expect([0, 1, 2, 3].map((k) => occurrence(r, k))).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('weekly, custom days and every-2-months', () => {
    expect(occurrence(rec({ unit: 'week', startDate: '2026-09-21' }), 2)).toBe('2026-10-05');
    expect(occurrence(rec({ unit: 'day', every: 10, startDate: '2026-09-25' }), 1)).toBe('2026-10-05');
    expect(occurrence(rec({ unit: 'month', every: 2, startDate: '2026-11-15' }), 1)).toBe('2027-01-15');
  });

  it('respects the end date', () => {
    const r = rec({ startDate: '2026-01-01', endDate: '2026-03-01' });
    expect(firstOnOrAfter(r, '2026-02-15')).toBe('2026-03-01');
    expect(firstOnOrAfter(r, '2026-03-02')).toBeNull();
  });

  it('a new item does not create past occurrences', () => {
    // Rent on the 1st, set up on 23 Sep → first due 1 Oct.
    expect(initialNextDue(rec({ startDate: '2026-09-01' }), '2026-09-23')).toBe('2026-10-01');
    // Due today counts.
    expect(initialNextDue(rec({ startDate: '2026-09-23' }), '2026-09-23')).toBe('2026-09-23');
    // Future start stays as is.
    expect(initialNextDue(rec({ startDate: '2026-12-25' }), '2026-09-23')).toBe('2026-12-25');
  });

  it('describes schedules', () => {
    expect(describeSchedule(1, 'month')).toBe('Monthly');
    expect(describeSchedule(2, 'week')).toBe('Every 2 weeks');
  });
});

describe('due list', () => {
  const weekly = rec({ unit: 'week', startDate: '2026-09-01', nextDueDate: '2026-09-01' });

  it('lists each missed occurrence up to today', () => {
    expect(dueOccurrences(weekly, '2026-09-23')).toEqual(['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22']);
  });

  it('hides paused and snoozed items', () => {
    expect(dueOccurrences({ ...weekly, active: false }, '2026-09-23')).toEqual([]);
    expect(dueOccurrences({ ...weekly, snoozedUntil: '2026-09-25' }, '2026-09-23')).toEqual([]);
    expect(dueOccurrences({ ...weekly, snoozedUntil: '2026-09-23' }, '2026-09-23')).toHaveLength(4);
  });

  it('handles occurrences in order and out of order', () => {
    let r = weekly;
    r = { ...r, ...markHandled(r, '2026-09-08') }; // second one first
    expect(r.nextDueDate).toBe('2026-09-01');
    expect(dueOccurrences(r, '2026-09-23')).toEqual(['2026-09-01', '2026-09-15', '2026-09-22']);
    r = { ...r, ...markHandled(r, '2026-09-01') }; // now the first → pointer jumps past the 8th
    expect(r.nextDueDate).toBe('2026-09-15');
    expect(r.handledAhead).toEqual([]);
    r = { ...r, ...markHandled(r, '2026-09-15') };
    r = { ...r, ...markHandled(r, '2026-09-22') };
    expect(r.nextDueDate).toBe('2026-09-29');
    expect(dueOccurrences(r, '2026-09-23')).toEqual([]);
  });

  it('ends after the last occurrence', () => {
    const r = rec({ startDate: '2026-08-01', nextDueDate: '2026-09-01', endDate: '2026-09-15' });
    expect(markHandled(r, '2026-09-01').nextDueDate).toBeNull();
  });
});
