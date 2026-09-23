import type { Goal } from '../db/types';
import { formatCents } from '../lib/money';
import { formatDay, today } from '../lib/dates';
import { goalPercent, perMonthNeeded } from '../lib/goals';

/** Goal name, saved / target, progress bar and (with a deadline) the monthly amount needed. */
export default function GoalProgress({ goal, saved, compact }: { goal: Goal; saved: number; compact?: boolean }) {
  const pct = goalPercent(saved, goal.target);
  const reached = saved >= goal.target;
  const perMonth = goal.deadline ? perMonthNeeded(goal.target, saved, goal.deadline, today()) : undefined;

  let hint: string | null = null;
  if (goal.completed) hint = 'Completed';
  else if (reached) hint = 'Target reached!';
  else if (goal.deadline && perMonth === null) hint = `Deadline passed (${formatDay(goal.deadline)}) · ${formatCents(goal.target - saved)} to go`;
  else if (goal.deadline && perMonth) hint = `Save ${formatCents(perMonth)}/month to reach it by ${formatDay(goal.deadline)}`;
  else hint = `${formatCents(goal.target - saved)} to go`;

  return (
    <div className={`budget-bar goal ${reached || goal.completed ? 'done' : ''}`}>
      <div className="budget-top">
        <span className="budget-name">{goal.name}</span>
        <span className="budget-nums">{formatCents(saved)} <span className="muted">/ {formatCents(goal.target)}</span></span>
      </div>
      <div className="bar" role="progressbar" aria-valuenow={Math.min(pct, 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="budget-bottom small">
        <span className={perMonth === null && !reached && !goal.completed ? 'warn-text' : 'muted'}>{hint}</span>
        {!compact && <span className="muted">{pct}%</span>}
      </div>
    </div>
  );
}
