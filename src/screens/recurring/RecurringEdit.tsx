import { useState } from 'react';
import { useLocation } from 'wouter';
import type { Account, Category, ID, Recurring, RepeatUnit } from '../../db/types';
import { useAccounts, useCategories, useDefaultAccountId, useLookups, useRecurringItem } from '../../db/hooks';
import { deleteRecurring, saveRecurring, setRecurringActive } from '../../db/recurringOps';
import { centsToInput, parseToCents } from '../../lib/money';
import { formatDay, today } from '../../lib/dates';
import CategoryPicker from '../../components/CategoryPicker';
import { showToast } from '../../components/Toast';
import { Loading, PageHeader } from '../../components/ui';

type Freq = 'weekly' | 'monthly' | 'custom';

/** Route: /more/recurring/new or /more/recurring/:id */
export default function RecurringEdit({ params }: { params: { id: string } }) {
  const isNew = params.id === 'new';
  const item = useRecurringItem(isNew ? undefined : params.id);
  const accounts = useAccounts();
  const defaultId = useDefaultAccountId();
  const lookups = useLookups();
  const incomeCats = useCategories('income');
  const title = isNew ? 'New recurring' : 'Edit recurring';

  if (!accounts || defaultId === undefined || !lookups || !incomeCats || (!isNew && !item)) {
    return <><PageHeader title={title} back="/more/recurring" /><Loading /></>;
  }
  return (
    <>
      <PageHeader title={title} back="/more/recurring" />
      <Form key={item?.id ?? 'new'} item={item} accounts={accounts} defaultId={defaultId}
        categories={lookups.categories} incomeCats={incomeCats} />
    </>
  );
}

function Form({ item, accounts, defaultId, categories, incomeCats }: {
  item?: Recurring; accounts: Account[]; defaultId: ID | null;
  categories: Map<ID, Category>; incomeCats: Category[];
}) {
  const [, navigate] = useLocation();
  const active = accounts.filter((a) => !a.archived || a.id === item?.accountId);
  const initialFreq: Freq = !item ? 'monthly'
    : item.every === 1 && item.unit === 'week' ? 'weekly'
    : item.every === 1 && item.unit === 'month' ? 'monthly' : 'custom';

  const [kind, setKind] = useState<'expense' | 'income'>(item?.kind ?? 'expense');
  const [name, setName] = useState(item?.note ?? '');
  const [amount, setAmount] = useState(item ? centsToInput(item.amount) : '');
  const [categoryId, setCategoryId] = useState<ID | undefined>(item?.categoryId);
  const [accountId, setAccountId] = useState<ID>(item?.accountId ?? defaultId ?? active[0]?.id ?? '');
  const [freq, setFreq] = useState<Freq>(initialFreq);
  const [every, setEvery] = useState(String(item?.every ?? 2));
  const [unit, setUnit] = useState<RepeatUnit>(item?.unit ?? 'week');
  const [startDate, setStartDate] = useState(item?.startDate ?? today());
  const [endDate, setEndDate] = useState(item?.endDate ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState('');

  const category = categoryId ? categories.get(categoryId) : undefined;
  const categoryMain = category?.parentId ? categories.get(category.parentId) : undefined;

  async function save() {
    const cents = parseToCents(amount);
    if (!cents) return setError('Enter an amount.');
    if (!categoryId) return setError('Choose a category.');
    if (!accountId) return setError('Choose an account.');
    const n = freq === 'custom' ? Number(every) : 1;
    if (!Number.isInteger(n) || n < 1 || n > 365) return setError('"Every" must be a whole number from 1 to 365.');
    const u: RepeatUnit = freq === 'weekly' ? 'week' : freq === 'monthly' ? 'month' : unit;
    if (endDate && endDate < startDate) return setError('End date must be after the start date.');
    await saveRecurring({
      kind, amount: cents, categoryId, accountId, note: name, every: n, unit: u, startDate, endDate: endDate || undefined,
    }, item?.id);
    showToast('Saved');
    navigate('/more/recurring');
  }

  async function remove() {
    if (!item || !window.confirm('Delete this recurring item? Transactions already recorded from it are kept.')) return;
    await deleteRecurring(item.id);
    showToast('Deleted');
    navigate('/more/recurring');
  }

  return (
    <div className="form">
      {item && (
        <p className="notice small" style={{ margin: 0 }}>
          {!item.active ? 'Paused.' : item.nextDueDate ? `Next due: ${formatDay(item.nextDueDate)}.` : 'This schedule has ended.'}
        </p>
      )}

      <div className="segmented">
        {(['expense', 'income'] as const).map((k) => (
          <button key={k} className={kind === k ? 'seg active' : 'seg'}
            onClick={() => { setKind(k); setCategoryId(undefined); }}>
            {k === 'expense' ? 'Expense' : 'Income'}
          </button>
        ))}
      </div>

      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder={kind === 'expense' ? 'e.g. Rent, Netflix, School fees' : 'e.g. Salary'} maxLength={60} />
      </label>

      <label className="field">
        <span>Amount ($)</span>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
      </label>

      <div className="field">
        <span>Category</span>
        {kind === 'expense' ? (
          <button className="picker-btn" onClick={() => setPickerOpen(true)}>
            {category ? `${categoryMain ? `${categoryMain.name} › ` : ''}${category.name}` : 'Choose category…'}
          </button>
        ) : (
          <div className="chips">
            {incomeCats.filter((c) => !c.archived || c.id === categoryId).map((c) => (
              <button key={c.id} className={c.id === categoryId ? 'chip active' : 'chip'} onClick={() => setCategoryId(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <label className="field">
        <span>{kind === 'income' ? 'Paid into' : 'Paid from'}</span>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {active.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>

      <div className="field">
        <span>Repeats</span>
        <div className="segmented">
          {(['weekly', 'monthly', 'custom'] as Freq[]).map((f) => (
            <button key={f} className={freq === f ? 'seg active' : 'seg'} onClick={() => setFreq(f)}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {freq === 'custom' && (
          <div className="add-inline-row" style={{ alignItems: 'center' }}>
            <span>Every</span>
            <input value={every} onChange={(e) => setEvery(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric" style={{ maxWidth: 80 }} />
            <select value={unit} onChange={(e) => setUnit(e.target.value as RepeatUnit)}>
              <option value="day">days</option>
              <option value="week">weeks</option>
              <option value="month">months</option>
            </select>
          </div>
        )}
      </div>

      <div className="tx-fields">
        <label className="field compact">
          <span>First due</span>
          <input type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
        </label>
        <label className="field compact">
          <span>Ends (optional)</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        Monthly on the 29th–31st falls on the last day of shorter months. Dates before today aren't added as due.
      </p>

      {error && <p className="error">{error}</p>}
      <button className="btn block" onClick={save}>Save</button>
      {item && (
        <>
          <button className="btn block ghost" onClick={() => setRecurringActive(item.id, !item.active)}>
            {item.active ? 'Pause' : 'Resume'}
          </button>
          <button className="btn block ghost danger" onClick={remove}>Delete</button>
        </>
      )}

      {pickerOpen && (
        <CategoryPicker selectedId={categoryId} onClose={() => setPickerOpen(false)}
          onPick={(id) => { setCategoryId(id); setPickerOpen(false); }} />
      )}
    </div>
  );
}
