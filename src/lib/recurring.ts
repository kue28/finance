import type { DateStr, Recurring, RepeatUnit } from '../db/types';
import { addDays, fromDateStr, toDateStr } from './dates';

// ============================================================================
// RECURRING SCHEDULE MATHS (pure functions, no database)
//
// Occurrence k is always calculated from the START date, never from the
// previous occurrence. That way "monthly on the 31st" gives 31 Jan, 28 Feb,
// 31 Mar… instead of drifting to the 28th forever after February.
//
// Tracking what's been handled:
//   nextDueDate  = earliest occurrence not yet confirmed/skipped
//   handledAhead = later occurrences already confirmed/skipped out of order
// An occurrence is DUE when it's on/before today, on/after nextDueDate, not in
// handledAhead, not after endDate, and the item is active and not snoozed.
// ============================================================================

type Schedule = Pick<Recurring, 'startDate' | 'every' | 'unit' | 'endDate'>;

/** Add n months, clamping the day to the month's length (31 Jan + 1 → 28/29 Feb). */
export function addMonthsClamped(s: DateStr, n: number): DateStr {
  const d = fromDateStr(s);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1, 12);
  const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, daysInMonth));
  return toDateStr(target);
}

/** Date of occurrence k (k = 0 is the start date). */
export function occurrence(s: Schedule, k: number): DateStr {
  const step = s.every * k;
  switch (s.unit) {
    case 'day': return addDays(s.startDate, step);
    case 'week': return addDays(s.startDate, step * 7);
    case 'month': return addMonthsClamped(s.startDate, step);
  }
}

const MAX_STEPS = 20000; // safety net against bad data

/** First occurrence on or after `date` (null if the schedule has ended by then). */
export function firstOnOrAfter(s: Schedule, date: DateStr): DateStr | null {
  for (let k = 0; k < MAX_STEPS; k++) {
    const d = occurrence(s, k);
    if (s.endDate && d > s.endDate) return null;
    if (d >= date) return d;
  }
  return null;
}

/** First occurrence strictly after `date`. */
export function firstAfter(s: Schedule, date: DateStr): DateStr | null {
  return firstOnOrAfter(s, addDays(date, 1));
}

/**
 * Where a new (or rescheduled) item starts tracking: the first occurrence on
 * or after today. Occurrences before today are assumed already dealt with, so
 * setting up "rent on the 1st" on the 23rd doesn't create a due rent payment.
 */
export function initialNextDue(s: Schedule, todayStr: DateStr): DateStr | null {
  return firstOnOrAfter(s, s.startDate > todayStr ? s.startDate : todayStr);
}

/** Occurrences due now (oldest first), capped so a long-ignored item can't flood the list. */
export function dueOccurrences(r: Recurring, todayStr: DateStr, max = 12): DateStr[] {
  if (!r.active || !r.nextDueDate) return [];
  if (r.snoozedUntil && r.snoozedUntil > todayStr) return [];
  const out: DateStr[] = [];
  let d: DateStr | null = r.nextDueDate;
  while (d && d <= todayStr && out.length < max) {
    if (!r.handledAhead.includes(d)) out.push(d);
    d = firstAfter(r, d);
  }
  return out;
}

/**
 * Record that occurrence `date` was confirmed or skipped. Returns the new
 * tracking fields. If it was the earliest outstanding one, the pointer moves
 * forward past it and past any later ones already handled out of order.
 */
export function markHandled(r: Recurring, date: DateStr): Pick<Recurring, 'nextDueDate' | 'handledAhead'> {
  if (!r.nextDueDate || date < r.nextDueDate) return { nextDueDate: r.nextDueDate, handledAhead: r.handledAhead };
  if (date > r.nextDueDate) {
    return { nextDueDate: r.nextDueDate, handledAhead: [...new Set([...r.handledAhead, date])].sort() };
  }
  const ahead = new Set(r.handledAhead);
  let next = firstAfter(r, date);
  while (next && ahead.has(next)) {
    ahead.delete(next);
    next = firstAfter(r, next);
  }
  return { nextDueDate: next, handledAhead: [...ahead].sort() };
}

/** "Monthly", "Weekly", "Every 2 weeks", "Every 10 days"… */
export function describeSchedule(every: number, unit: RepeatUnit): string {
  if (every === 1) return { day: 'Daily', week: 'Weekly', month: 'Monthly' }[unit];
  return `Every ${every} ${unit}s`;
}
