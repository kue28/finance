import type { Cents, DateStr, Goal, Transaction } from '../db/types';
import { fromDateStr } from './dates';

// ============================================================================
// GOAL MATHS
// A goal's saved amount comes ONLY from transfers tagged with its goalId:
//   into the goal's account   → contribution (+)
//   out of the goal's account → withdrawal  (−)
// Other money sitting in the same account (e.g. an ordinary transfer, or
// another goal's savings) doesn't count toward this goal.
// ============================================================================

export function goalSaved(goal: Goal, txs: Transaction[]): Cents {
  let saved = 0;
  for (const t of txs) {
    if (t.goalId !== goal.id || t.kind !== 'transfer') continue;
    if (t.toAccountId === goal.accountId) saved += t.amount;
    else if (t.accountId === goal.accountId) saved -= t.amount;
  }
  return saved;
}

/**
 * Calendar months left to save, counting the current month and the deadline's
 * month: on 23 Sep with a 31 Dec deadline that's Sep, Oct, Nov, Dec = 4.
 * Returns 0 if the deadline has passed.
 */
export function monthsLeft(deadline: DateStr, todayStr: DateStr): number {
  if (deadline < todayStr) return 0;
  const d = fromDateStr(deadline), t = fromDateStr(todayStr);
  return (d.getFullYear() - t.getFullYear()) * 12 + (d.getMonth() - t.getMonth()) + 1;
}

/** Amount to save each month to reach the target by the deadline (rounded up to the cent). */
export function perMonthNeeded(target: Cents, saved: Cents, deadline: DateStr, todayStr: DateStr): Cents | null {
  const remaining = target - saved;
  if (remaining <= 0) return 0;
  const months = monthsLeft(deadline, todayStr);
  if (months === 0) return null; // deadline passed
  return Math.ceil(remaining / months);
}

export function goalPercent(saved: Cents, target: Cents): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.floor((saved / target) * 100));
}
