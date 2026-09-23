import { Link } from 'wouter';
import type { Account, Category, Goal, ID, Loan, Transaction } from '../db/types';
import { formatCents } from '../lib/money';

export interface Lookups {
  accounts: Map<ID, Account>;
  categories: Map<ID, Category>;
  goals?: Map<ID, Goal>;
  loans?: Map<ID, Loan>;
}

/** Title and subtitle text for a transaction (also used by search). */
export function describeTx(tx: Transaction, { accounts, categories, goals, loans }: Lookups) {
  const acc = (id?: ID) => (id ? accounts.get(id)?.name ?? '?' : '?');
  const cat = tx.categoryId ? categories.get(tx.categoryId) : undefined;
  const main = cat?.parentId ? categories.get(cat.parentId) : undefined;

  let title: string;
  const sub: string[] = [];
  switch (tx.kind) {
    case 'transfer': {
      const goal = tx.goalId ? goals?.get(tx.goalId) : undefined;
      if (goal) {
        // Into the goal's account = contribution; out of it = withdrawal.
        title = tx.toAccountId === goal.accountId ? `Saved to ${goal.name}` : `Withdrawn from ${goal.name}`;
        sub.push(`${acc(tx.accountId)} → ${acc(tx.toAccountId)}`);
      } else {
        title = `${acc(tx.accountId)} → ${acc(tx.toAccountId)}`;
        sub.push('Transfer');
      }
      break;
    }
    case 'lend':
    case 'repayment': {
      const person = (tx.loanId && loans?.get(tx.loanId)?.person) || 'someone';
      title = tx.kind === 'lend' ? `Lent to ${person}` : `Repaid by ${person}`;
      sub.push(tx.kind === 'lend' ? 'Loan' : 'Loan repayment', acc(tx.accountId));
      break;
    }
    case 'writeoff': {
      const person = (tx.loanId && loans?.get(tx.loanId)?.person) || 'someone';
      title = `Written off: ${person}`;
      sub.push(cat?.name ?? 'Bad debts');
      break;
    }
    default:
      title = cat?.name ?? 'Uncategorised';
      if (main) sub.push(main.name);
      if (tx.feeForTransferId) sub.push('Transfer fee');
      sub.push(acc(tx.accountId));
  }
  if (tx.note) sub.push(tx.note);
  return { title, subtitle: sub.join(' · ') };
}

/**
 * Signed, coloured amount: expenses (and write-offs) red "−", income green "+".
 * Money that only moves (transfers, lending, repayments) is neutral grey.
 */
export function TxAmount({ tx }: { tx: Transaction }) {
  switch (tx.kind) {
    case 'income': return <span className="row-amount income">+{formatCents(tx.amount)}</span>;
    case 'transfer': return <span className="row-amount transfer">{formatCents(tx.amount)}</span>;
    case 'lend': return <span className="row-amount transfer">−{formatCents(tx.amount)}</span>;
    case 'repayment': return <span className="row-amount transfer">+{formatCents(tx.amount)}</span>;
    default: return <span className="row-amount expense">−{formatCents(tx.amount)}</span>;
  }
}

export default function TxRow({ tx, lookups }: { tx: Transaction; lookups: Lookups }) {
  const { title, subtitle } = describeTx(tx, lookups);
  // Loan entries are managed on their loan's screen.
  const href = tx.loanId ? `/more/loans/${tx.loanId}` : `/tx/${tx.id}`;
  return (
    <li className="row">
      <Link href={href} className="row-main">
        <div className="row-title">{title}</div>
        <div className="muted small clamp">{subtitle}</div>
      </Link>
      <TxAmount tx={tx} />
    </li>
  );
}
