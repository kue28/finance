import { useState } from 'react';
import type { Account, Category, DateStr, ID, Recurring } from '../db/types';
import { confirmOccurrence, skipOccurrence, snooze } from '../db/recurringOps';
import { centsToInput, formatCents, parseToCents } from '../lib/money';
import { daysBetween, formatDay, today } from '../lib/dates';
import { showToast } from './Toast';

interface Due { rec: Recurring; date: DateStr }

export function recurringName(rec: Recurring, categories: Map<ID, Category>) {
  return rec.note || categories.get(rec.categoryId)?.name || 'Recurring';
}

function dueLabel(date: DateStr) {
  const late = daysBetween(date, today());
  if (late <= 0) return 'Due today';
  return `Due ${formatDay(date)} · ${late} day${late === 1 ? '' : 's'} late`;
}

/** Dashboard section: recurring items waiting to be confirmed, skipped or snoozed. */
export default function DueList({ due, accounts, categories }: {
  due: Due[]; accounts: Map<ID, Account>; categories: Map<ID, Category>;
}) {
  const [editing, setEditing] = useState<Due | null>(null);
  const [snoozing, setSnoozing] = useState<string | null>(null);
  if (due.length === 0) return null;

  const key = (d: Due) => `${d.rec.id}@${d.date}`;

  async function confirm(d: Due) {
    await confirmOccurrence(d.rec.id, d.date);
    showToast(`Recorded ${formatCents(d.rec.amount)} · ${recurringName(d.rec, categories)}`);
  }

  return (
    <>
      <h2>Due ({due.length})</h2>
      <ul className="list card flush">
        {due.map((d) => {
          const k = key(d);
          const sign = d.rec.kind === 'income' ? '+' : '−';
          return (
            <li key={k} className="row column">
              <div className="due-top">
                <div className="row-main">
                  <div className="row-title">{recurringName(d.rec, categories)}</div>
                  <div className={daysBetween(d.date, today()) > 0 ? 'small warn-text' : 'muted small'}>
                    {dueLabel(d.date)} · {accounts.get(d.rec.accountId)?.name ?? '?'}
                  </div>
                </div>
                <span className={`row-amount ${d.rec.kind}`}>{sign}{formatCents(d.rec.amount)}</span>
              </div>
              {snoozing === k ? (
                <div className="row-actions">
                  <span className="muted small">Snooze for</span>
                  {[1, 3, 7].map((days) => (
                    <button key={days} className="btn small ghost"
                      onClick={async () => { await snooze(d.rec.id, days); setSnoozing(null); showToast('Snoozed'); }}>
                      {days === 7 ? '1 week' : `${days} day${days > 1 ? 's' : ''}`}
                    </button>
                  ))}
                  <button className="btn small ghost" onClick={() => setSnoozing(null)}>Cancel</button>
                </div>
              ) : (
                <div className="row-actions">
                  <button className="btn small" onClick={() => confirm(d)}>Confirm</button>
                  <button className="btn small ghost" onClick={() => setEditing(d)}>Edit</button>
                  <button className="btn small ghost" onClick={async () => { await skipOccurrence(d.rec.id, d.date); showToast('Skipped'); }}>
                    Skip
                  </button>
                  <button className="btn small ghost" onClick={() => setSnoozing(k)}>Snooze</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {editing && (
        <ConfirmSheet due={editing} accounts={accounts} name={recurringName(editing.rec, categories)}
          onClose={() => setEditing(null)} />
      )}
    </>
  );
}

/** Confirm one occurrence after changing the amount, account, date or note. */
function ConfirmSheet({ due, accounts, name, onClose }: {
  due: Due; accounts: Map<ID, Account>; name: string; onClose: () => void;
}) {
  const { rec, date: dueDate } = due;
  const [amount, setAmount] = useState(centsToInput(rec.amount));
  const [accountId, setAccountId] = useState(rec.accountId);
  const [date, setDate] = useState(dueDate);
  const [note, setNote] = useState(rec.note ?? '');
  const [error, setError] = useState('');

  const choices = [...accounts.values()].filter((a) => !a.archived || a.id === accountId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  async function save() {
    const cents = parseToCents(amount);
    if (!cents) return setError('Enter an amount.');
    await confirmOccurrence(rec.id, dueDate, { amount: cents, accountId, date, note });
    showToast(`Recorded ${formatCents(cents)} · ${name}`);
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet form" role="dialog" aria-label={`Confirm ${name}`} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0 }}>Confirm {name}</h2>
        <p className="muted small" style={{ margin: 0 }}>This time only; the schedule stays the same.</p>
        <label className="field">
          <span>Amount ($)</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        </label>
        <div className="tx-fields">
          <label className="field compact">
            <span>{rec.kind === 'income' ? 'Into' : 'From'}</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
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
        <button className="btn block" onClick={save}>Confirm</button>
        <button className="btn block ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
