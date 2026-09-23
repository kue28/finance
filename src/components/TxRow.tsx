import { Link } from 'wouter';
import type { Account, Category, Goal, ID, Transaction } from '../db/types';
import { formatCents } from '../lib/money';

export interface Lookups {
  accounts: Map<ID, Account>;
  categories: Map<ID, Category>;
  goals?: Map<ID, Goal>;
}

/** Title and subtitle text for a transaction (also used by search). */
export function describeTx(tx: Transaction, { accounts, categories, goals }: Lookups) {
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
    default:
      title = cat?.name ?? 'Uncategorised';
      if (main) sub.push(main.name);
      if (tx.feeForTransferId) sub.push('Transfer fee');
      sub.push(acc(tx.accountId));
  }
  if (tx.note) sub.push(tx.note);
  return { title, subtitle: sub.join(' · ') };
}

/** Signed, coloured amount: expenses red "−", income green "+", transfers neutral. */
export function TxAmount({ tx }: { tx: Transaction }) {
  if (tx.kind === 'income') return <span className="row-amount income">+{formatCents(tx.amount)}</span>;
  if (tx.kind === 'transfer') return <span className="row-amount transfer">{formatCents(tx.amount)}</span>;
  return <span className="row-amount expense">−{formatCents(tx.amount)}</span>;
}

export default function TxRow({ tx, lookups }: { tx: Transaction; lookups: Lookups }) {
  const { title, subtitle } = describeTx(tx, lookups);
  return (
    <li className="row">
      <Link href={`/tx/${tx.id}`} className="row-main">
        <div className="row-title">{title}</div>
        <div className="muted small clamp">{subtitle}</div>
      </Link>
      <TxAmount tx={tx} />
    </li>
  );
}
