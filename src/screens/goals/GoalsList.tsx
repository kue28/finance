import { useState } from 'react';
import { Link } from 'wouter';
import { useGoals } from '../../db/hooks';
import { formatCents } from '../../lib/money';
import GoalProgress from '../../components/GoalProgress';
import { Loading, PageHeader } from '../../components/ui';

export default function GoalsList() {
  const goals = useGoals();
  const [showDone, setShowDone] = useState(false);

  if (!goals) return <><PageHeader title="Savings goals" back="/more" /><Loading /></>;

  const active = goals.filter((g) => !g.completed);
  const done = goals.filter((g) => g.completed);
  const totalSaved = active.reduce((s, g) => s + g.saved, 0);

  return (
    <>
      <PageHeader title="Savings goals" back="/more" />

      {active.length > 0 && (
        <p className="muted small" style={{ marginTop: -8 }}>Saved across active goals: <b>{formatCents(totalSaved)}</b></p>
      )}

      {active.length === 0 ? (
        <p className="muted">No goals yet. Create one, link it to a savings account or cash envelope, and contribute to it.</p>
      ) : (
        <ul className="list card flush">
          {active.map((g) => (
            <li key={g.id}>
              <Link href={`/more/goals/${g.id}`} className="budget-row link-card">
                <GoalProgress goal={g} saved={g.saved} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/more/goals/new" className="btn block">New goal</Link>

      {done.length > 0 && (
        <>
          <button className="link-btn" onClick={() => setShowDone(!showDone)}>
            {showDone ? 'Hide' : 'Show'} completed ({done.length})
          </button>
          {showDone && (
            <ul className="list card flush">
              {done.map((g) => (
                <li key={g.id}>
                  <Link href={`/more/goals/${g.id}`} className="budget-row link-card">
                    <GoalProgress goal={g} saved={g.saved} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
