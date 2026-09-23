import type { Account, Cents, ID, Transaction } from '../db/types';

// ============================================================================
// THE MONEY RULES — the single place that decides how each kind of
// transaction affects balances, budgets and reports.
//
//  kind       | account balance     | budgets | spending report | income report
//  -----------|---------------------|---------|-----------------|--------------
//  expense    | − accountId         |   yes   |      yes        |
//  income     | + accountId         |         |                 |     yes
//  transfer   | − accountId,        |   no    |      no         |     no
//             | + toAccountId       |         |                 |
//  lend       | − accountId         |   no    |      no         |
//  repayment  | + accountId         |         |                 |     no
//  writeoff   | NO CHANGE (*)       |   yes   |      yes        |
//
// (*) A write-off records that lent money will never come back. That money
// already left the account when the loan was made (the 'lend' transaction),
// so the write-off must not subtract it a second time. It only turns the loss
// into a real expense for budgets and reports.
//
// Transfer fees are stored as a separate 'expense' (with feeForTransferId set),
// so they follow the expense row above automatically.
// Savings goal contributions/withdrawals are plain transfers (with goalId set).
// ============================================================================

/** How a transaction changes account balances: list of [accountId, delta]. */
export function balanceEffects(tx: Transaction): [ID, Cents][] {
  switch (tx.kind) {
    case 'expense':
    case 'lend':
      return [[tx.accountId, -tx.amount]];
    case 'income':
    case 'repayment':
      return [[tx.accountId, tx.amount]];
    case 'transfer':
      return tx.toAccountId
        ? [[tx.accountId, -tx.amount], [tx.toAccountId, tx.amount]]
        : [[tx.accountId, -tx.amount]];
    case 'writeoff':
      return [];
  }
}

/** True if the transaction counts toward budgets and spending reports. */
export function isSpending(tx: Transaction): boolean {
  return tx.kind === 'expense' || tx.kind === 'writeoff';
}

/** True if the transaction counts as income in reports. */
export function isIncome(tx: Transaction): boolean {
  return tx.kind === 'income';
}

/**
 * Current balance of every account = opening balance + effect of every
 * transaction. Nothing is cached, so balances can never drift out of sync
 * after edits or deletes. (Fast enough for many thousands of transactions.)
 */
export function computeBalances(accounts: Account[], txs: Transaction[]): Map<ID, Cents> {
  const balances = new Map<ID, Cents>();
  for (const a of accounts) balances.set(a.id, a.openingBalance);
  for (const tx of txs) {
    for (const [id, delta] of balanceEffects(tx)) {
      // Unknown ids are ignored (should not happen: accounts are archived, never deleted).
      if (balances.has(id)) balances.set(id, balances.get(id)! + delta);
    }
  }
  return balances;
}
