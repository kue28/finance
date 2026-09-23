import { useState } from 'react';
import { useLocation } from 'wouter';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Account, ID, Loan } from '../../db/types';
import { db } from '../../db/db';
import { useAccounts, useDefaultAccountId, useLoans } from '../../db/hooks';
import { createLoan, updateLoan } from '../../db/loanOps';
import { centsToInput, formatCents, parseToCents } from '../../lib/money';
import { today } from '../../lib/dates';
import { showToast } from '../../components/Toast';
import { Loading, PageHeader } from '../../components/ui';
import { haptic } from '../../lib/haptics';

/** Routes: /more/loans/new and /more/loans/:id/edit */
export default function LoanEdit({ params }: { params: { id?: string } }) {
  const id = params.id;
  const loan = useLiveQuery(() => (id ? db.loans.get(id) : undefined), [id]);
  const accounts = useAccounts();
  const defaultId = useDefaultAccountId();
  const loans = useLoans();
  const title = id ? 'Edit loan' : 'Money lent';
  const back = id ? `/more/loans/${id}` : '/more/loans';

  if (!accounts || defaultId === undefined || !loans || (id && !loan)) {
    return <><PageHeader title={title} back={back} /><Loading /></>;
  }
  const people = [...new Set(loans.map((l) => l.person))].sort();
  return (
    <>
      <PageHeader title={title} back={back} />
      <Form loan={loan} accounts={accounts} defaultId={defaultId} people={people} back={back} />
    </>
  );
}

function Form({ loan, accounts, defaultId, people, back }: {
  loan?: Loan; accounts: Account[]; defaultId: ID | null; people: string[]; back: string;
}) {
  const [, navigate] = useLocation();
  const usable = accounts.filter((a) => !a.archived || a.id === loan?.fromAccountId);
  const [person, setPerson] = useState(loan?.person ?? '');
  const [amount, setAmount] = useState(loan ? centsToInput(loan.amount) : '');
  const [dateLent, setDateLent] = useState(loan?.dateLent ?? today());
  const [fromAccountId, setFrom] = useState<ID>(loan?.fromAccountId ?? defaultId ?? usable[0]?.id ?? '');
  const [expected, setExpected] = useState(loan?.expectedRepayDate ?? '');
  const [note, setNote] = useState(loan?.note ?? '');
  const [error, setError] = useState('');

  async function save() {
    const cents = parseToCents(amount);
    if (!person.trim()) return setError('Enter who you lent to.');
    if (!cents) return setError('Enter the amount lent.');
    if (expected && expected < dateLent) return setError('The expected repayment date is before the date lent.');
    const input = { person, amount: cents, dateLent, fromAccountId, expectedRepayDate: expected || undefined, note };
    try {
      if (loan) {
        await updateLoan(loan.id, input);
        showToast('Loan updated');
        navigate(back);
      } else {
        const id = await createLoan(input);
        haptic();
        showToast(`Lent ${formatCents(cents)} to ${person.trim()}`);
        navigate(`/more/loans/${id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  return (
    <div className="form">
      <label className="field">
        <span>Lent to</span>
        <input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Name" list="people"
          autoComplete="off" autoFocus={!loan} maxLength={60} />
        <datalist id="people">{people.map((p) => <option key={p} value={p} />)}</datalist>
      </label>
      <label className="field">
        <span>Amount ($)</span>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
      </label>
      <div className="tx-fields">
        <label className="field compact">
          <span>From account</span>
          <select value={fromAccountId} onChange={(e) => setFrom(e.target.value)}>
            {usable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="field compact">
          <span>Date lent</span>
          <input type="date" value={dateLent} onChange={(e) => e.target.value && setDateLent(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Expect it back by (optional)</span>
        <input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
      </label>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={200} />
      <p className="muted small" style={{ margin: 0 }}>
        Lending moves money out of the account but isn't an expense, so it won't affect budgets or reports.
      </p>
      {error && <p className="error">{error}</p>}
      <button className="btn block" onClick={save}>Save</button>
    </div>
  );
}
