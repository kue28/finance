import type { Category, Cents, ID, Transaction } from '../db/types';
import { isSpending } from './rules';
import { monthBounds } from './dates';

// ============================================================================
// BUDGET MATHS
// - Budgets are per MAIN category, per month. Spending in any subcategory
//   counts toward its main category's limit.
// - Only "spending" counts (see lib/rules.ts): expenses, including transfer
//   fees, and loan write-offs. Transfers, savings contributions, lending and
//   repayments never count. Income never reduces spending.
// - No rollovers: only transactions dated inside the month are counted.
// ============================================================================

/** Total spending per main category for a 'YYYY-MM' month. */
export function spentByMainCategory(
  txs: Transaction[], categories: Map<ID, Category>, month: string,
): Map<ID, Cents> {
  const [from, to] = monthBounds(month);
  const spent = new Map<ID, Cents>();
  for (const tx of txs) {
    if (!isSpending(tx) || tx.date < from || tx.date > to || !tx.categoryId) continue;
    const cat = categories.get(tx.categoryId);
    if (!cat) continue;
    const mainId = cat.parentId ?? cat.id;
    spent.set(mainId, (spent.get(mainId) ?? 0) + tx.amount);
  }
  return spent;
}

export type BudgetState = 'ok' | 'warn' | 'over';

export const WARN_AT = 0.8;

/** ok below 80% of the limit, warn from 80% up to 100%, over when above 100%. */
export function budgetState(spent: Cents, limit: Cents): BudgetState {
  if (spent > limit) return 'over';
  if (spent >= limit * WARN_AT) return 'warn';
  return 'ok';
}

/** Fraction used, capped at 1 for drawing progress bars. */
export function budgetFill(spent: Cents, limit: Cents): number {
  if (limit <= 0) return spent > 0 ? 1 : 0;
  return Math.min(1, spent / limit);
}
