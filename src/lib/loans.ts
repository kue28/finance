import type { Cents, DateStr, Loan, Transaction } from '../db/types';

// ============================================================================
// LOAN MATHS
//   outstanding = amount lent − repayments − amount written off
// Lending and repayments move money between your accounts and the borrower;
// they are NOT expenses or income. Only a write-off counts as spending (under
// Other › Bad debts), and it does not change any account balance because the
// money already left when it was lent. See lib/rules.ts.
// ============================================================================

export type LoanStatus = 'open' | 'repaid' | 'written_off';

export interface LoanSummary {
  repaid: Cents;
  writtenOff: Cents;
  outstanding: Cents;
  status: LoanStatus;
  overdue: boolean;
}

export function summarizeLoan(loan: Loan, txs: Transaction[], todayStr: DateStr): LoanSummary {
  let repaid = 0, writtenOff = 0;
  for (const t of txs) {
    if (t.loanId !== loan.id) continue;
    if (t.kind === 'repayment') repaid += t.amount;
    else if (t.kind === 'writeoff') writtenOff += t.amount;
  }
  const outstanding = Math.max(0, loan.amount - repaid - writtenOff);
  const status: LoanStatus = outstanding > 0 ? 'open' : writtenOff > 0 ? 'written_off' : 'repaid';
  const overdue = status === 'open' && !!loan.expectedRepayDate && loan.expectedRepayDate < todayStr;
  return { repaid, writtenOff, outstanding, status, overdue };
}

/** People are matched ignoring case and extra spaces ("tendai " = "Tendai"). */
export function personKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
