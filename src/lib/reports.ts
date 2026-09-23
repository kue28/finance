import type { Category, Cents, DateStr, Goal, ID, Transaction } from '../db/types';
import { isIncome, isSpending } from './rules';
import { addDays, fromDateStr, monthBounds, monthRange, shiftMonth } from './dates';

// ============================================================================
// REPORT MATHS
// Spending = isSpending() from lib/rules.ts: expenses (including transfer
// fees) and loan write-offs. Transfers, savings contributions, lending and
// repayments are NEVER spending or income. Savings and lending are reported
// separately ("saved to goals", "lent out") so you can still see them.
// ============================================================================

export type Period = 'week' | 'month' | 'last_month' | 'last_3' | 'year' | 'custom';

export const periodLabels: Record<Period, string> = {
  week: 'This week', month: 'This month', last_month: 'Last month',
  last_3: 'Last 3 months', year: 'This year', custom: 'Custom',
};

/** Inclusive date range for a period. Weeks run Monday–Sunday. */
export function periodRange(p: Period, todayStr: DateStr, custom?: [DateStr, DateStr]): [DateStr, DateStr] {
  switch (p) {
    case 'week': {
      const dow = (fromDateStr(todayStr).getDay() + 6) % 7; // Mon=0 … Sun=6
      const start = addDays(todayStr, -dow);
      return [start, addDays(start, 6)];
    }
    case 'month': return monthRange(todayStr);
    case 'last_month': return monthRange(todayStr, -1);
    case 'last_3': return [monthRange(todayStr, -2)[0], monthRange(todayStr)[1]];
    case 'year': {
      const y = fromDateStr(todayStr).getFullYear();
      return [`${y}-01-01`, `${y}-12-31`];
    }
    case 'custom': {
      const [a, b] = custom ?? [todayStr, todayStr];
      return a <= b ? [a, b] : [b, a];
    }
  }
}

export interface PeriodReport {
  income: Cents;
  spent: Cents;
  /** Net: contributions minus withdrawals. */
  savedToGoals: Cents;
  lentOut: Cents;
  spendByMain: Map<ID, Cents>;
  spendBySub: Map<ID, Cents>;
  incomeByCategory: Map<ID, Cents>;
}

const add = (m: Map<ID, Cents>, k: ID, v: Cents) => m.set(k, (m.get(k) ?? 0) + v);

/** Everything the Overview tab shows, for transactions dated from..to (inclusive). */
export function buildReport(
  txs: Transaction[], categories: Map<ID, Category>, goals: Map<ID, Goal>, from: DateStr, to: DateStr,
): PeriodReport {
  const r: PeriodReport = {
    income: 0, spent: 0, savedToGoals: 0, lentOut: 0,
    spendByMain: new Map(), spendBySub: new Map(), incomeByCategory: new Map(),
  };
  for (const t of txs) {
    if (t.date < from || t.date > to) continue;
    if (isSpending(t)) {
      r.spent += t.amount;
      const sub = t.categoryId ? categories.get(t.categoryId) : undefined;
      if (sub) {
        add(r.spendBySub, sub.id, t.amount);
        add(r.spendByMain, sub.parentId ?? sub.id, t.amount);
      }
    } else if (isIncome(t)) {
      r.income += t.amount;
      if (t.categoryId) add(r.incomeByCategory, t.categoryId, t.amount);
    } else if (t.kind === 'transfer' && t.goalId) {
      const g = goals.get(t.goalId);
      if (g) r.savedToGoals += t.toAccountId === g.accountId ? t.amount : -t.amount;
    } else if (t.kind === 'lend') {
      r.lentOut += t.amount;
    }
  }
  return r;
}

/** The last `n` months ending with `endMonth`, oldest first ('YYYY-MM'). */
export function monthsEnding(endMonth: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftMonth(endMonth, i - n + 1));
}

/**
 * Spending per month for one main category (or all spending when mainId is
 * null), aligned with `months`.
 */
export function spendingByMonth(
  txs: Transaction[], categories: Map<ID, Category>, mainId: ID | null, months: string[],
): Cents[] {
  const idx = new Map(months.map((m, i) => [m, i]));
  const out = months.map(() => 0);
  for (const t of txs) {
    if (!isSpending(t)) continue;
    const i = idx.get(t.date.slice(0, 7));
    if (i === undefined) continue;
    if (mainId) {
      const c = t.categoryId ? categories.get(t.categoryId) : undefined;
      if (!c || (c.parentId ?? c.id) !== mainId) continue;
    }
    out[i] += t.amount;
  }
  return out;
}

export interface MonthSummary {
  month: string;
  income: Cents;
  spent: Cents;
  savedToGoals: Cents;
  lentOut: Cents;
}

/** One summary line per month: income, spent, saved to goals, lent out. */
export function monthlySummaries(
  txs: Transaction[], categories: Map<ID, Category>, goals: Map<ID, Goal>, months: string[],
): MonthSummary[] {
  return months.map((month) => {
    const [from, to] = monthBounds(month);
    const r = buildReport(txs, categories, goals, from, to);
    return { month, income: r.income, spent: r.spent, savedToGoals: r.savedToGoals, lentOut: r.lentOut };
  });
}
