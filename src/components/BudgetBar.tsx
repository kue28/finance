import type { Cents } from '../db/types';
import { budgetFill, budgetState } from '../lib/budget';
import { formatCents } from '../lib/money';

/** Name, spent / limit, remaining (or "over by") and a coloured progress bar. */
export default function BudgetBar({ name, spent, limit }: { name: string; spent: Cents; limit: Cents }) {
  const state = budgetState(spent, limit);
  const remaining = limit - spent;
  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  return (
    <div className={`budget-bar ${state}`}>
      <div className="budget-top">
        <span className="budget-name">{name}</span>
        <span className="budget-nums">{formatCents(spent)} <span className="muted">/ {formatCents(limit)}</span></span>
      </div>
      <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="bar-fill" style={{ width: `${budgetFill(spent, limit) * 100}%` }} />
      </div>
      <div className="budget-bottom small">
        <span className="budget-left">
          {remaining >= 0 ? `${formatCents(remaining)} left` : `${formatCents(-remaining)} over budget`}
        </span>
        <span className="muted">{pct}%</span>
      </div>
    </div>
  );
}
