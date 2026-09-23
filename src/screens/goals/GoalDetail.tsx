import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import type { Account, Goal, ID } from '../../db/types';
import { useGoal, useLookups } from '../../db/hooks';
import { contribute, deleteGoal, setGoalCompleted, withdraw } from '../../db/goalOps';
import { formatCents, parseToCents } from '../../lib/money';
import { today } from '../../lib/dates';
import GoalProgress from '../../components/GoalProgress';
import TxRow from '../../components/TxRow';
import { showToast } from '../../components/Toast';
import { Loading, PageHeader } from '../../components/ui';
import { haptic } from '../../lib/haptics';

/** Route: /more/goals/:id */
export default function GoalDetail({ params }: { params: { id: string } }) {
  const data = useGoal(params.id);
  const lookups = useLookups();
  const [, navigate] = useLocation();
  const [moving, setMoving] = useState<'in' | 'out' | null>(null);

  if (data === null) return <><PageHeader title="Goal" back="/more/goals" /><p className="muted">Goal not found.</p></>;
  if (!data || !lookups) return <><PageHeader title="Goal" back="/more/goals" /><Loading /></>;

  const { goal, saved, txs } = data;
  const account = lookups.accounts.get(goal.accountId);

  async function remove() {
    if (!window.confirm(`Delete "${goal.name}"? Its money stays in ${account?.name ?? 'its account'}, and its transfers become ordinary transfers.`)) return;
    await deleteGoal(goal.id);
    showToast('Goal deleted');
    navigate('/more/goals');
  }

  return (
    <>
      <PageHeader title={goal.name} back="/more/goals"
        action={<Link href={`/more/goals/${goal.id}/edit`} className="btn small ghost">Edit</Link>} />

      <section className="card">
        <GoalProgress goal={goal} saved={saved} />
        <p className="muted small" style={{ marginBottom: 0 }}>Kept in: <b>{account?.name ?? '?'}</b></p>
      </section>

      {!goal.completed && (
        <div className="stat-row">
          <button className="btn" style={{ flex: 1 }} onClick={() => setMoving('in')}>Contribute</button>
          <button className="btn ghost" style={{ flex: 1 }} onClick={() => setMoving('out')} disabled={saved <= 0}>Withdraw</button>
        </div>
      )}

      {!goal.completed && saved >= goal.target && (
        <section className="card notice-card" style={{ marginTop: 16 }}>
          <p style={{ marginTop: 0 }}>🎉 You've reached your target.</p>
          <button className="btn" onClick={() => setGoalCompleted(goal.id, true)}>Mark goal complete</button>
        </section>
      )}

      <h2>History</h2>
      {txs.length === 0 ? (
        <p className="muted">No contributions yet.</p>
      ) : (
        <ul className="list card flush">
          {txs.map((t) => <TxRow key={t.id} tx={t} lookups={lookups} />)}
        </ul>
      )}

      <div style={{ marginTop: 24 }}>
        {goal.completed ? (
          <>
            {saved > 0 && (
              <button className="btn block ghost" onClick={() => setMoving('out')}>Withdraw money</button>
            )}
            <button className="btn block ghost" onClick={() => setGoalCompleted(goal.id, false)}>Reopen goal</button>
          </>
        ) : saved < goal.target && (
          <button className="btn block ghost" onClick={() => setGoalCompleted(goal.id, true)}>Mark complete anyway</button>
        )}
        <button className="btn block ghost danger" onClick={remove}>Delete goal</button>
      </div>

      {moving && (
        <MoveSheet goal={goal} saved={saved} direction={moving} accounts={[...lookups.accounts.values()]}
          onClose={() => setMoving(null)} />
      )}
    </>
  );
}

/** Contribute (from another account into the goal) or withdraw (back out). Both are transfers. */
function MoveSheet({ goal, saved, direction, accounts, onClose }: {
  goal: Goal; saved: number; direction: 'in' | 'out'; accounts: Account[]; onClose: () => void;
}) {
  const choices = accounts.filter((a) => !a.archived && a.id !== goal.accountId).sort((a, b) => a.sortOrder - b.sortOrder);
  const [amount, setAmount] = useState('');
  const [otherId, setOtherId] = useState<ID>(choices[0]?.id ?? '');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const goalAccount = accounts.find((a) => a.id === goal.accountId)?.name ?? 'goal account';

  async function save() {
    const cents = parseToCents(amount);
    if (!cents) return setError('Enter an amount.');
    if (!otherId) return setError('Add another account first.');
    try {
      if (direction === 'in') await contribute(goal.id, otherId, { amount: cents, date, note });
      else await withdraw(goal.id, otherId, { amount: cents, date, note });
      haptic();
      showToast(`${direction === 'in' ? 'Saved' : 'Withdrew'} ${formatCents(cents)}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet form" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0 }}>{direction === 'in' ? `Contribute to ${goal.name}` : `Withdraw from ${goal.name}`}</h2>
        <p className="muted small" style={{ margin: 0 }}>
          {direction === 'in'
            ? `Moves money into ${goalAccount}. It's a transfer, not spending.`
            : `Moves money out of ${goalAccount}. ${formatCents(saved)} available.`}
        </p>
        <label className="field">
          <span>Amount ($)</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" autoFocus />
        </label>
        <div className="tx-fields">
          <label className="field compact">
            <span>{direction === 'in' ? 'From' : 'Into'}</span>
            <select value={otherId} onChange={(e) => setOtherId(e.target.value)}>
              {choices.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="field compact">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
        {error && <p className="error">{error}</p>}
        <button className="btn block" onClick={save}>{direction === 'in' ? 'Contribute' : 'Withdraw'}</button>
        <button className="btn block ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
