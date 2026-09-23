import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import type { Account, ID, Loan } from '../../db/types';
import { useLoan, useLookups } from '../../db/hooks';
import { addRepayment, deleteLoan, deleteLoanEntry, writeOff } from '../../db/loanOps';
import { centsToInput, formatCents, parseToCents } from '../../lib/money';
import { formatDay, today } from '../../lib/dates';
import { describeTx, TxAmount } from '../../components/TxRow';
import { showToast } from '../../components/Toast';
import { Loading, PageHeader } from '../../components/ui';

/** Route: /more/loans/:id */
export default function LoanDetail({ params }: { params: { id: string } }) {
  const data = useLoan(params.id);
  const lookups = useLookups();
  const [, navigate] = useLocation();
  const [sheet, setSheet] = useState<'repay' | 'writeoff' | null>(null);

  if (data === null) return <><PageHeader title="Loan" back="/more/loans" /><p className="muted">Loan not found.</p></>;
  if (!data || !lookups) return <><PageHeader title="Loan" back="/more/loans" /><Loading /></>;

  const { loan, txs, repaid, writtenOff, outstanding, status, overdue } = data;
  const fromName = lookups.accounts.get(loan.fromAccountId)?.name ?? '?';
  const pct = loan.amount > 0 ? Math.min(100, Math.round(((repaid + writtenOff) / loan.amount) * 100)) : 0;

  async function removeLoan() {
    if (!window.confirm(`Delete this loan to ${loan.person}? The money lent and all repayments will be removed as if it never happened.`)) return;
    await deleteLoan(loan.id);
    showToast('Loan deleted');
    navigate('/more/loans');
  }

  async function removeEntry(id: ID, label: string) {
    if (!window.confirm(`Delete this ${label}?`)) return;
    await deleteLoanEntry(id);
    showToast('Deleted');
  }

  return (
    <>
      <PageHeader title={loan.person} back="/more/loans"
        action={<Link href={`/more/loans/${loan.id}/edit`} className="btn small ghost">Edit</Link>} />

      <section className="card">
        <div className="budget-top">
          <span className="muted small">Still owed</span>
          {overdue && <span className="badge overdue">Overdue</span>}
          {status === 'repaid' && <span className="badge">Repaid</span>}
          {status === 'written_off' && <span className="badge overdue">Written off</span>}
        </div>
        <div className="big-amount">{formatCents(outstanding)}</div>
        <div className="bar"><div className="bar-fill" style={{ width: `${pct}%`, background: 'var(--income)' }} /></div>
        <dl className="facts small">
          <dt>Lent</dt><dd>{formatCents(loan.amount)} on {formatDay(loan.dateLent)} from {fromName}</dd>
          <dt>Repaid</dt><dd>{formatCents(repaid)}</dd>
          {writtenOff > 0 && <><dt>Written off</dt><dd>{formatCents(writtenOff)}</dd></>}
          {loan.expectedRepayDate && (
            <><dt>Expected back</dt><dd className={overdue ? 'warn-text' : ''}>{formatDay(loan.expectedRepayDate)}</dd></>
          )}
          {loan.note && <><dt>Note</dt><dd>{loan.note}</dd></>}
        </dl>
      </section>

      {status === 'open' && (
        <div className="stat-row">
          <button className="btn" style={{ flex: 1 }} onClick={() => setSheet('repay')}>Record repayment</button>
          <button className="btn ghost" style={{ flex: 1 }} onClick={() => setSheet('writeoff')}>Write off</button>
        </div>
      )}

      <h2>History</h2>
      <ul className="list card flush">
        {txs.map((t) => {
          const { title, subtitle } = describeTx(t, lookups);
          const removable = t.kind === 'repayment' || t.kind === 'writeoff';
          return (
            <li key={t.id} className="row">
              <div className="row-main">
                <div className="row-title">{title}</div>
                <div className="muted small clamp">{formatDay(t.date)} · {subtitle}</div>
              </div>
              <TxAmount tx={t} />
              {removable && (
                <button className="icon-btn" aria-label="Delete entry"
                  onClick={() => removeEntry(t.id, t.kind === 'repayment' ? 'repayment' : 'write-off')}>✕</button>
              )}
            </li>
          );
        })}
      </ul>

      <button className="btn block ghost danger" style={{ marginTop: 24 }} onClick={removeLoan}>Delete loan</button>

      {sheet && (
        <EntrySheet loan={loan} outstanding={outstanding} mode={sheet}
          accounts={[...lookups.accounts.values()]} onClose={() => setSheet(null)} />
      )}
    </>
  );
}

/** Record a repayment (into any account) or write off some/all of what's owed. */
function EntrySheet({ loan, outstanding, mode, accounts, onClose }: {
  loan: Loan; outstanding: number; mode: 'repay' | 'writeoff'; accounts: Account[]; onClose: () => void;
}) {
  const choices = accounts.filter((a) => !a.archived).sort((a, b) => a.sortOrder - b.sortOrder);
  const [amount, setAmount] = useState(centsToInput(outstanding));
  const [accountId, setAccountId] = useState<ID>(
    choices.some((a) => a.id === loan.fromAccountId) ? loan.fromAccountId : choices[0]?.id ?? '');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  async function save() {
    const cents = parseToCents(amount);
    if (!cents) return setError('Enter an amount.');
    try {
      if (mode === 'repay') await addRepayment(loan.id, { amount: cents, accountId, date, note });
      else await writeOff(loan.id, { amount: cents, date, note });
      showToast(mode === 'repay' ? `Repayment of ${formatCents(cents)} recorded` : `Wrote off ${formatCents(cents)}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet form" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0 }}>{mode === 'repay' ? `Repayment from ${loan.person}` : `Write off ${loan.person}'s loan`}</h2>
        <p className="muted small" style={{ margin: 0 }}>
          {mode === 'repay'
            ? `${formatCents(outstanding)} still owed. A repayment is not income.`
            : 'Only a write-off counts as an expense (Other › Bad debts). It doesn\'t change any account balance: the money already left when you lent it.'}
        </p>
        <label className="field">
          <span>Amount ($)</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        </label>
        <div className="tx-fields">
          {mode === 'repay' && (
            <label className="field compact">
              <span>Paid into</span>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {choices.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          )}
          <label className="field compact">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
        {error && <p className="error">{error}</p>}
        <button className="btn block" onClick={save}>{mode === 'repay' ? 'Record repayment' : 'Write off'}</button>
        <button className="btn block ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
