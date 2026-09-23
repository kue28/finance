import { useState } from 'react';
import { useLocation } from 'wouter';
import type { Category } from '../db/types';
import { useBudgetCopyOffer, useBudgetMonth } from '../db/hooks';
import { copyBudgets, setBudget } from '../db/budgetOps';
import { setSetting } from '../db/db';
import { centsToInput, formatCents, parseToCents } from '../lib/money';
import { monthBounds, monthKey, monthLabel, shiftMonth } from '../lib/dates';
import BudgetBar from '../components/BudgetBar';
import { presetTransactionFilters } from './Transactions';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import { showToast } from '../components/Toast';
import { Loading } from '../components/ui';
import BudgetReportsSwitch from '../components/BudgetReportsSwitch';
import IconBadge from '../components/IconBadge';
import { categoryIcon } from '../lib/icons';

// Remember the month being viewed while moving between tabs.
let viewedMonth = monthKey();

export default function Budget() {
  const [month, setMonthState] = useState(viewedMonth);
  const setMonth = (m: string) => { viewedMonth = m; setMonthState(m); };
  const data = useBudgetMonth(month);
  const copyFrom = useBudgetCopyOffer(month);
  const [editing, setEditing] = useState<Category | null>(null);
  const isCurrent = month === monthKey();

  const noParents = new Map<string, Category>();
  const header = (
    <>
    <BudgetReportsSwitch current="budget" />
    <div className="month-nav">
      <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
        <ChevronLeftIcon />
      </button>
      <h1>{monthLabel(month)}</h1>
      <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
        <ChevronRightIcon />
      </button>
    </div>
    </>
  );

  if (!data || copyFrom === undefined) return <>{header}<Loading /></>;

  const { mains, limits, spent } = data;
  const budgeted = mains.filter((c) => limits.has(c.id));
  const unbudgeted = mains.filter((c) => !limits.has(c.id));

  let totalLimit = 0, totalSpentBudgeted = 0;
  for (const c of budgeted) {
    totalLimit += limits.get(c.id)!;
    totalSpentBudgeted += spent.get(c.id) ?? 0;
  }

  async function copy() {
    const n = await copyBudgets(copyFrom!, month);
    showToast(`Copied ${n} limit${n === 1 ? '' : 's'} from ${monthLabel(copyFrom!)}`);
  }

  return (
    <>
      {header}
      {!isCurrent && (
        <button className="link-btn" style={{ marginTop: -8 }} onClick={() => setMonth(monthKey())}>
          Back to this month
        </button>
      )}

      {copyFrom && (
        <section className="card notice-card">
          <p style={{ margin: '0 0 12px' }}>
            No limits set for {monthLabel(month)} yet. Copy last month's limits? You can adjust them after.
          </p>
          <div className="row-actions">
            <button className="btn" onClick={copy}>Copy {monthLabel(copyFrom).split(' ')[0]}'s limits</button>
            <button className="btn ghost" onClick={() => setSetting('budgetCopyDismissed', month)}>Not now</button>
          </div>
        </section>
      )}

      {budgeted.length > 0 && (
        <section className="card">
          <BudgetBar name="All budgeted categories" spent={totalSpentBudgeted} limit={totalLimit} />
        </section>
      )}

      <h2>Limits</h2>
      {budgeted.length === 0 ? (
        <p className="muted">No limits for this month. Tap a category below to set one.</p>
      ) : (
        <ul className="list card flush">
          {budgeted.map((c) => (
            <li key={c.id}>
              <button className="budget-row" onClick={() => setEditing(c)}>
                <BudgetBar name={c.name} icon={categoryIcon(c, noParents)} spent={spent.get(c.id) ?? 0} limit={limits.get(c.id)!} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2>No limit</h2>
      <ul className="list card flush">
        {unbudgeted.map((c) => (
          <li key={c.id} className="row">
            <IconBadge icon={categoryIcon(c, noParents)} size={36} />
            <button className="row-main plain" onClick={() => setEditing(c)}>
              <div className="row-title">{c.name}</div>
              <div className="muted small">Tap to set a limit</div>
            </button>
            <span className="row-amount">{formatCents(spent.get(c.id) ?? 0)}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">
        Only expenses count toward budgets. Transfers, savings and loans never do. Each month starts fresh.
      </p>

      {editing && (
        <LimitEditor category={editing} month={month} limit={limits.get(editing.id)}
          spent={spent.get(editing.id) ?? 0} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function LimitEditor({ category, month, limit, spent, onClose }: {
  category: Category; month: string; limit?: number; spent: number; onClose: () => void;
}) {
  const [, navigate] = useLocation();
  const [value, setValue] = useState(limit ? centsToInput(limit) : '');
  const [error, setError] = useState('');

  async function save() {
    const cents = parseToCents(value);
    if (!cents) return setError('Enter a limit greater than $0.');
    await setBudget(month, category.id, cents);
    onClose();
  }

  async function remove() {
    await setBudget(month, category.id, null);
    onClose();
  }

  function viewTransactions() {
    const [from, to] = monthBounds(month);
    presetTransactionFilters({ categoryId: category.id, period: 'custom', from, to });
    navigate('/transactions');
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={`${category.name} limit`} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>{category.name} · {monthLabel(month)}</h2>
        <p className="muted small" style={{ marginTop: 0 }}>Spent so far: {formatCents(spent)}</p>
        <label className="field">
          <span>Monthly limit ($)</span>
          <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal"
            placeholder="0.00" autoFocus onKeyDown={(e) => e.key === 'Enter' && save()} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="sheet-actions">
          <button className="btn block" onClick={save}>Save limit</button>
          {limit !== undefined && <button className="btn block ghost" onClick={remove}>Remove limit</button>}
          <button className="btn block ghost" onClick={viewTransactions}>View transactions</button>
        </div>
      </div>
    </div>
  );
}
