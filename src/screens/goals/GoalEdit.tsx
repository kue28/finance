import { useState } from 'react';
import { useLocation } from 'wouter';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Account, Goal } from '../../db/types';
import { db } from '../../db/db';
import { useAccounts } from '../../db/hooks';
import { goalTxCount, saveGoal } from '../../db/goalOps';
import { addAccount } from '../../db/ops';
import { centsToInput, parseToCents } from '../../lib/money';
import { nameTaken } from '../../lib/labels';
import { today } from '../../lib/dates';
import { showToast } from '../../components/Toast';
import { Loading, PageHeader } from '../../components/ui';

const NEW = '__new__';

/** Routes: /more/goals/new and /more/goals/:id/edit */
export default function GoalEdit({ params }: { params: { id?: string } }) {
  const id = params.id;
  const goal = useLiveQuery(() => (id ? db.goals.get(id) : undefined), [id]);
  const txCount = useLiveQuery(() => (id ? goalTxCount(id) : 0), [id]);
  const accounts = useAccounts();
  const title = id ? 'Edit goal' : 'New goal';
  const back = id ? `/more/goals/${id}` : '/more/goals';

  if (!accounts || txCount === undefined || (id && !goal)) return <><PageHeader title={title} back={back} /><Loading /></>;
  return (
    <>
      <PageHeader title={title} back={back} />
      <Form goal={goal} accounts={accounts} accountLocked={txCount > 0} back={back} />
    </>
  );
}

function Form({ goal, accounts, accountLocked, back }: {
  goal?: Goal; accounts: Account[]; accountLocked: boolean; back: string;
}) {
  const [, navigate] = useLocation();
  const usable = accounts.filter((a) => !a.archived || a.id === goal?.accountId);
  // Suggest a savings-type account first; otherwise offer to create one.
  const firstSavings = usable.find((a) => a.type === 'savings');

  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal ? centsToInput(goal.target) : '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [accountId, setAccountId] = useState(goal?.accountId ?? firstSavings?.id ?? NEW);
  const [newAccountName, setNewAccountName] = useState('');
  const [error, setError] = useState('');

  async function save() {
    const cents = parseToCents(target);
    if (!name.trim()) return setError('Give the goal a name.');
    if (!cents) return setError('Enter a target amount.');
    if (deadline && deadline < today()) return setError('The deadline is in the past.');
    let accId = accountId;
    if (accId === NEW) {
      const n = newAccountName.trim() || `${name.trim()} savings`;
      if (nameTaken(accounts, n)) return setError('You already have an account with that name.');
      accId = await addAccount(n, 'savings', 0);
    }
    try {
      const id = await saveGoal({ name, target: cents, deadline: deadline || undefined, accountId: accId }, goal?.id);
      showToast('Goal saved');
      navigate(goal ? back : `/more/goals/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  return (
    <div className="form">
      <label className="field">
        <span>Goal name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emergency fund, Laptop, School fees" autoFocus={!goal} />
      </label>
      <label className="field">
        <span>Target ($)</span>
        <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="0.00" />
      </label>
      <label className="field">
        <span>Deadline (optional)</span>
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <small className="muted">With a deadline, the app shows how much to save each month.</small>
      </label>

      <label className="field">
        <span>Where the money is kept</span>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={accountLocked}>
          {usable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          <option value={NEW}>+ New savings account…</option>
        </select>
        <small className="muted">
          {accountLocked
            ? 'Can\'t change: this goal already has contributions.'
            : 'A separate account or cash envelope keeps goal money physically apart.'}
        </small>
      </label>
      {accountId === NEW && (
        <label className="field">
          <span>New account name</span>
          <input value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)}
            placeholder={name.trim() ? `${name.trim()} savings` : 'e.g. Savings envelope'} />
        </label>
      )}

      {error && <p className="error">{error}</p>}
      <button className="btn block" onClick={save}>Save goal</button>
    </div>
  );
}
