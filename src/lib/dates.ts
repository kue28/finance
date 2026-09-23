import type { DateStr } from '../db/types';

// Dates are local calendar days stored as 'YYYY-MM-DD'. We build them from the
// phone's local clock (not toISOString, which is UTC and would give the wrong
// day between midnight and 02:00 in Zimbabwe).

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): DateStr {
  return toDateStr(new Date());
}

/** Parse 'YYYY-MM-DD' as a local date (midday, to be safe around DST). */
export function fromDateStr(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(s: DateStr, days: number): DateStr {
  const d = fromDateStr(s);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

/** First and last day of the month containing `s`, shifted by `offset` months. */
export function monthRange(s: DateStr, offset = 0): [DateStr, DateStr] {
  const d = fromDateStr(s);
  const first = new Date(d.getFullYear(), d.getMonth() + offset, 1, 12);
  const last = new Date(d.getFullYear(), d.getMonth() + offset + 1, 0, 12);
  return [toDateStr(first), toDateStr(last)];
}

/** Whole days from a to b (positive if b is later). */
export function daysBetween(a: DateStr, b: DateStr): number {
  return Math.round((fromDateStr(b).getTime() - fromDateStr(a).getTime()) / 86400000);
}

/** 'YYYY-MM' for a date (defaults to today). */
export function monthKey(s: DateStr = today()): string {
  return s.slice(0, 7);
}

/** Shift a 'YYYY-MM' month by n months. */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1, 12);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** First and last day of a 'YYYY-MM' month. */
export function monthBounds(month: string): [DateStr, DateStr] {
  return monthRange(`${month}-01`);
}

/** "September 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${monthNames[m - 1]} ${y}`;
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const weekday =['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "1 Sep – 30 Sep 2026" (year shown once when both dates share it). */
export function formatRange(from: DateStr, to: DateStr): string {
  const a = fromDateStr(from), b = fromDateStr(to);
  const left = `${a.getDate()} ${month[a.getMonth()]}${a.getFullYear() !== b.getFullYear() ? ` ${a.getFullYear()}` : ''}`;
  return `${left} – ${b.getDate()} ${month[b.getMonth()]} ${b.getFullYear()}`;
}

/** "Sep" for a 'YYYY-MM' month. */
export function monthShort(m: string): string {
  return month[Number(m.slice(5, 7)) - 1];
}

/** "Today", "Yesterday", "Mon 21 Sep", or "Mon 21 Sep 2025" for other years. */
export function formatDay(s: DateStr): string {
  const t = today();
  if (s === t) return 'Today';
  if (s === addDays(t, -1)) return 'Yesterday';
  const d = fromDateStr(s);
  const base = `${weekday[d.getDay()]} ${d.getDate()} ${month[d.getMonth()]}`;
  return d.getFullYear() === fromDateStr(t).getFullYear() ? base : `${base} ${d.getFullYear()}`;
}
