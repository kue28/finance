import type { Transaction } from '../db/types';
import type { Lookups } from '../components/TxRow';

// Transactions as CSV for Excel / Google Sheets. Amounts are plain numbers
// (12.50, no $) so spreadsheets can add them up; "Signed amount" is how the
// transaction changed the "Account" balance (write-offs change nothing).

const typeLabels: Record<Transaction['kind'], string> = {
  income: 'Income', expense: 'Expense', transfer: 'Transfer',
  lend: 'Money lent', repayment: 'Loan repayment', writeoff: 'Write-off',
};

/** Quote a field if it contains a comma, quote or newline (RFC 4180). */
export function csvField(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function transactionsToCsv(txs: Transaction[], { accounts, categories, goals, loans }: Lookups): string {
  const header = ['Date', 'Type', 'Amount', 'Signed amount', 'Account', 'To account', 'Category', 'Subcategory',
    'Note', 'Savings goal', 'Loan person', 'Transfer fee'];
  const lines = [header.map(csvField).join(',')];
  for (const t of txs) {
    const cat = t.categoryId ? categories.get(t.categoryId) : undefined;
    const main = cat?.parentId ? categories.get(cat.parentId) : cat;
    const sub = cat?.parentId ? cat : undefined;
    const amount = (t.amount / 100).toFixed(2);
    const signed = t.kind === 'income' || t.kind === 'repayment' ? amount
      : t.kind === 'writeoff' ? '0.00' : `-${amount}`;
    lines.push([
      t.date, typeLabels[t.kind], amount, signed,
      accounts.get(t.accountId)?.name ?? '', t.toAccountId ? accounts.get(t.toAccountId)?.name ?? '' : '',
      main?.name ?? '', sub?.name ?? '', t.note ?? '',
      t.goalId ? goals?.get(t.goalId)?.name ?? '' : '',
      t.loanId ? loans?.get(t.loanId)?.person ?? '' : '',
      t.feeForTransferId ? 'Yes' : '',
    ].map(csvField).join(','));
  }
  // Byte-order mark so Excel opens the file as UTF-8 (keeps "›", "–" etc. intact).
  return '﻿' + lines.join('\r\n');
}
