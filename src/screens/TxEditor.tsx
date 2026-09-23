import { useCallback, useState } from 'react';
import { Redirect, useLocation } from 'wouter';
import type { Account, Category, ID, Transaction } from '../db/types';
import {
  useAccounts, useCategories, useDefaultAccountId, useFrequentSubcategories, useLookups, useTransaction,
} from '../db/hooks';
import { deleteTransaction, getTransferFee, saveSimple, saveTransfer, type FeeKey } from '../db/txOps';
import { useLiveQuery } from 'dexie-react-hooks';
import { centsToInput, formatCents, parseToCents } from '../lib/money';
import { today } from '../lib/dates';
import { applyKey, displayAmount, type Key } from '../lib/keypad';
import Keypad from '../components/Keypad';
import CategoryPicker from '../components/CategoryPicker';
import { showToast } from '../components/Toast';
import { Loading, PageHeader } from '../components/ui';

type Kind = 'expense' | 'income' | 'transfer';

const feeOptions: { key: FeeKey; label: string }[] = [
  { key: 'fee_mobile', label: 'Mobile money' },
  { key: 'fee_imtt', label: 'IMTT' },
  { key: 'fee_bank', label: 'Bank' },
];

/** Route /add — new transaction (expense by default). */
export function AddScreen() {
  return <Loader />;
}

/** Route /tx/:id — edit an existing transaction. */
export function EditTxScreen({ params }: { params: { id: string } }) {
  const tx = useTransaction(params.id);
  const fee = useLiveQuery(() => getTransferFee(params.id).then((f) => f ?? null), [params.id]);
  if (tx === undefined || fee === undefined) return <><PageHeader title="Edit" /><Loading /></>;
  // A transfer fee is edited through its transfer, so both stay in step.
  if (tx.feeForTransferId) return <Redirect to={`/tx/${tx.feeForTransferId}`} replace />;
  return <Loader existing={tx} existingFee={fee ?? undefined} />;
}

function Loader({ existing, existingFee }: { existing?: Transaction; existingFee?: Transaction }) {
  const accounts = useAccounts();
  const defaultId = useDefaultAccountId();
  const lookups = useLookups();
  const frequent = useFrequentSubcategories();
  const incomeCats = useCategories('income');
  if (!accounts || defaultId === undefined || !lookups || !frequent || !incomeCats) {
    return <><PageHeader title={existing ? 'Edit' : 'Add'} /><Loading /></>;
  }
  return (
    <Editor existing={existing} existingFee={existingFee} accounts={accounts} defaultId={defaultId}
      categories={lookups.categories} frequent={frequent} incomeCats={incomeCats} />
  );
}

function Editor({ existing, existingFee, accounts, defaultId, categories, frequent, incomeCats }: {
  existing?: Transaction; existingFee?: Transaction; accounts: Account[]; defaultId: ID | null;
  categories: Map<ID, Category>; frequent: ID[]; incomeCats: Category[];
}) {
  const [, navigate] = useLocation();

  // Accounts you can pick: active ones, plus an archived one if this transaction already uses it.
  const pickable = (id?: ID) => accounts.filter((a) => !a.archived || a.id === id);
  const active = accounts.filter((a) => !a.archived);
  const fallbackAccount = (defaultId && active.some((a) => a.id === defaultId) ? defaultId : active[0]?.id) ?? '';

  const [kind, setKind] = useState<Kind>((existing?.kind as Kind) ?? 'expense');
  const [amount, setAmount] = useState(existing ? centsToInput(existing.amount) : '');
  const [fee, setFee] = useState(existingFee ? centsToInput(existingFee.amount) : '');
  const [feeKey, setFeeKey] = useState<FeeKey>(
    (existingFee && (categories.get(existingFee.categoryId!)?.systemKey as FeeKey)) || 'fee_mobile');
  const [target, setTarget] = useState<'amount' | 'fee'>('amount');
  const [categoryId, setCategoryId] = useState<ID | undefined>(existing?.categoryId);
  const [accountId, setAccountId] = useState<ID>(existing?.accountId ?? fallbackAccount);
  const [toAccountId, setToAccountId] = useState<ID>(
    existing?.toAccountId ?? active.find((a) => a.id !== fallbackAccount)?.id ?? '');
  const [date, setDate] = useState(existing?.date ?? today());
  const [note, setNote] = useState(existing?.note ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // When editing, the saved amount starts "selected": the first digit or dot
  // replaces it (tap 4 on $3.50 → $4), while ⌫ first edits it in place.
  const [freshAmount, setFreshAmount] = useState(!!existing);
  const [freshFee, setFreshFee] = useState(!!existingFee);

  const onKey = useCallback((k: Key) => {
    const fresh = target === 'amount' ? freshAmount : freshFee;
    const set = target === 'amount' ? setAmount : setFee;
    if (fresh) {
      (target === 'amount' ? setFreshAmount : setFreshFee)(false);
      if (k !== 'back') return set(applyKey('', k));
    }
    set((v) => applyKey(v, k));
  }, [target, freshAmount, freshFee]);

  function switchKind(k: Kind) {
    setKind(k);
    setCategoryId(undefined);
    setTarget('amount');
    setError('');
  }

  const goBack = () => (window.history.length > 1 ? window.history.back() : navigate('/'));

  /** Chip label; "Other" is ambiguous on its own, so show its main category too. */
  const subLabel = (id: ID) => {
    const c = categories.get(id);
    if (!c) return '?';
    const main = c.parentId ? categories.get(c.parentId) : undefined;
    return c.name === 'Other' && main ? `${main.name} › Other` : c.name;
  };

  // Expense chips: most-used subcategories; the current pick is always shown.
  const expenseChips = categoryId && kind === 'expense' && !frequent.includes(categoryId)
    ? [categoryId, ...frequent.slice(0, -1)] : frequent;
  const incomeChips = incomeCats.filter((c) => !c.archived || c.id === categoryId);

  async function save() {
    const cents = parseToCents(amount);
    if (!cents) return setError('Enter an amount.');
    if (!accountId) return setError('Choose an account.');
    setBusy(true);
    try {
      if (kind === 'transfer') {
        const feeCents = fee === '' ? 0 : parseToCents(fee);
        if (feeCents === null) return setError('Fee must be an amount like 0.50.');
        if (!toAccountId || toAccountId === accountId) return setError('Choose two different accounts.');
        await saveTransfer({ date, amount: cents, accountId, toAccountId, note, fee: feeCents, feeKey }, existing?.id);
        const names = `${accounts.find((a) => a.id === accountId)?.name} → ${accounts.find((a) => a.id === toAccountId)?.name}`;
        showToast(`Saved ${formatCents(cents)} · ${names}${feeCents ? ` (+${formatCents(feeCents)} fee)` : ''}`);
      } else {
        if (!categoryId) return setError('Choose a category.');
        await saveSimple({ kind, date, amount: cents, accountId, categoryId, note }, existing?.id);
        showToast(`Saved ${formatCents(cents)} · ${categories.get(categoryId)?.name ?? ''}`);
      }
      goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    const extra = existingFee ? ' Its fee will be deleted too.' : '';
    if (!window.confirm(`Delete this ${existing.kind}?${extra}`)) return;
    await deleteTransaction(existing.id);
    showToast('Deleted');
    goBack();
  }

  const accountSelect = (value: ID, onChange: (id: ID) => void, label: string) => (
    <label className="field compact">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {pickable(value).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
    </label>
  );

  return (
    <div className="tx-editor">
      <PageHeader title={existing ? 'Edit' : 'Add'} action={
        <button className="btn small ghost" onClick={goBack}>Cancel</button>
      } />

      {!existing && (
        <div className="segmented kind-tabs">
          {(['expense', 'income', 'transfer'] as Kind[]).map((k) => (
            <button key={k} className={kind === k ? `seg active ${k}` : 'seg'} onClick={() => switchKind(k)}>
              {k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
      )}

      <button type="button" className={`amount-display ${kind} ${target === 'amount' ? 'targeted' : ''}`}
        onClick={() => setTarget('amount')} aria-label="Amount">
        <span className="currency">$</span>
        <span className={amount === '' ? 'placeholder' : freshAmount ? 'selected' : ''}>{displayAmount(amount)}</span>
      </button>

      {kind === 'transfer' && (
        <div className="fee-row">
          <button type="button" className={`fee-display ${target === 'fee' ? 'targeted' : ''}`}
            onClick={() => setTarget('fee')}>
            Fee: $<span className={freshFee && fee !== '' ? 'selected' : ''}>{displayAmount(fee)}</span> {target !== 'fee' && <span className="muted small">(tap to enter)</span>}
          </button>
          {fee !== '' && (
            <div className="segmented small-seg">
              {feeOptions.map((o) => (
                <button key={o.key} className={feeKey === o.key ? 'seg active' : 'seg'} onClick={() => setFeeKey(o.key)}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {kind === 'expense' && (
        <div className="chips">
          {expenseChips.map((id) => (
            <button key={id} className={id === categoryId ? 'chip active' : 'chip'} onClick={() => setCategoryId(id)}>
              {subLabel(id)}
            </button>
          ))}
          <button className="chip more" onClick={() => setPickerOpen(true)}>All categories…</button>
        </div>
      )}
      {kind === 'income' && (
        <div className="chips">
          {incomeChips.map((c) => (
            <button key={c.id} className={c.id === categoryId ? 'chip active' : 'chip'} onClick={() => setCategoryId(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="tx-fields">
        {kind === 'transfer' ? (
          <>
            {accountSelect(accountId, setAccountId, 'From')}
            {accountSelect(toAccountId, setToAccountId, 'To')}
          </>
        ) : accountSelect(accountId, setAccountId, kind === 'income' ? 'Into' : 'From')}
        <label className="field compact">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
      </div>
      <input className="note-input" value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)" maxLength={200} />

      {error && <p className="error">{error}</p>}

      <Keypad onKey={onKey} />
      <button className={`btn block save-btn ${kind}`} onClick={save} disabled={busy}>
        {existing ? 'Save changes' : `Save ${kind}`}
      </button>
      {existing && <button className="btn block ghost danger" onClick={remove}>Delete</button>}

      {pickerOpen && (
        <CategoryPicker selectedId={categoryId} onClose={() => setPickerOpen(false)}
          onPick={(id) => { setCategoryId(id); setPickerOpen(false); }} />
      )}
    </div>
  );
}
