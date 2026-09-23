import { useMemo, useState } from 'react';
import type { ID, Transaction, TransactionKind } from '../db/types';
import { useAllTransactions, useLookups } from '../db/hooks';
import { formatCents } from '../lib/money';
import { formatDay, monthRange, today } from '../lib/dates';
import { isIncome, isSpending } from '../lib/rules';
import TxRow, { describeTx, type Lookups } from '../components/TxRow';
import { Loading } from '../components/ui';
import { transactionsToCsv } from '../lib/csv';
import { shareOrDownload } from '../lib/backup';

type Period = 'all' | 'this_month' | 'last_month' | 'last_3' | 'custom';

interface Filters {
  search: string;
  kind: 'all' | TransactionKind;
  accountId: ID | 'all';
  categoryId: ID | 'all'; // a main category (matches all its subs) or a subcategory
  period: Period;
  from: string;
  to: string;
}

const emptyFilters: Filters = {
  search: '', kind: 'all', accountId: 'all', categoryId: 'all', period: 'all', from: '', to: '',
};

// Kept outside the component so filters survive opening a transaction and coming back.
let savedFilters = emptyFilters;

/** Pre-set the list's filters before navigating to it (e.g. from the Budget screen). */
export function presetTransactionFilters(patch: Partial<Filters>) {
  savedFilters = { ...emptyFilters, ...patch };
}

const PAGE = 150;

function periodRange(f: Filters): [string, string] | null {
  const t = today();
  switch (f.period) {
    case 'all': return null;
    case 'this_month': return monthRange(t);
    case 'last_month': return monthRange(t, -1);
    case 'last_3': return [monthRange(t, -2)[0], monthRange(t)[1]];
    case 'custom': return [f.from || '0000-01-01', f.to || '9999-12-31'];
  }
}

function matches(tx: Transaction, f: Filters, lookups: Lookups, range: [string, string] | null) {
  if (f.kind !== 'all' && tx.kind !== f.kind) return false;
  if (f.accountId !== 'all' && tx.accountId !== f.accountId && tx.toAccountId !== f.accountId) return false;
  if (f.categoryId !== 'all') {
    const c = tx.categoryId ? lookups.categories.get(tx.categoryId) : undefined;
    if (!c || (c.id !== f.categoryId && c.parentId !== f.categoryId)) return false;
  }
  if (range && (tx.date < range[0] || tx.date > range[1])) return false;
  if (f.search.trim()) {
    const q = f.search.trim().toLowerCase();
    const { title, subtitle } = describeTx(tx, lookups);
    const hay = `${title} ${subtitle} ${(tx.amount / 100).toFixed(2)}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export default function Transactions() {
  const txs = useAllTransactions();
  const lookups = useLookups();
  const [f, setF] = useState<Filters>(savedFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const set = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    savedFilters = next;
    setF(next);
    setLimit(PAGE);
  };

  const filtered = useMemo(() => {
    if (!txs || !lookups) return [];
    const range = periodRange(f);
    return txs.filter((t) => matches(t, f, lookups, range));
  }, [txs, lookups, f]);

  if (!txs || !lookups) return <><h1>Activity</h1><Loading /></>;

  const activeFilterCount = [f.kind !== 'all', f.accountId !== 'all', f.categoryId !== 'all', f.period !== 'all']
    .filter(Boolean).length;
  const filtering = activeFilterCount > 0 || f.search.trim() !== '';

  // Totals use the same rules as budgets/reports: transfers are neither in nor out.
  let spent = 0, income = 0;
  for (const t of filtered) {
    if (isSpending(t)) spent += t.amount;
    else if (isIncome(t)) income += t.amount;
  }

  const accounts = [...lookups.accounts.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  const cats = [...lookups.categories.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  const mains = cats.filter((c) => c.parentId === null);

  // Group the visible rows by day.
  const shown = filtered.slice(0, limit);
  const groups: { date: string; rows: Transaction[] }[] = [];
  for (const t of shown) {
    const g = groups[groups.length - 1];
    if (g && g.date === t.date) g.rows.push(t);
    else groups.push({ date: t.date, rows: [t] });
  }

  return (
    <>
      <h1>Activity</h1>

      <div className="search-row">
        <input type="search" value={f.search} onChange={(e) => set({ search: e.target.value })}
          placeholder="Search notes, categories, amounts" />
        <button className={activeFilterCount ? 'btn small' : 'btn small ghost'} onClick={() => setShowFilters(!showFilters)}>
          Filter{activeFilterCount ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {/* Opened from an account on Home: make the account filter visible and easy to clear. */}
      {f.accountId !== 'all' && !showFilters && (
        <div className="chips" style={{ marginBottom: 12 }}>
          <button className="chip active" onClick={() => set({ accountId: 'all' })} aria-label="Show all accounts">
            {lookups.accounts.get(f.accountId)?.name ?? 'Account'} ✕
          </button>
        </div>
      )}

      {showFilters && (
        <section className="card form filters">
          <label className="field compact">
            <span>Period</span>
            <select value={f.period} onChange={(e) => set({ period: e.target.value as Period })}>
              <option value="all">All time</option>
              <option value="this_month">This month</option>
              <option value="last_month">Last month</option>
              <option value="last_3">Last 3 months</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
          {f.period === 'custom' && (
            <div className="tx-fields">
              <label className="field compact"><span>From</span>
                <input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} /></label>
              <label className="field compact"><span>To</span>
                <input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} /></label>
            </div>
          )}
          <label className="field compact">
            <span>Type</span>
            <select value={f.kind} onChange={(e) => set({ kind: e.target.value as Filters['kind'] })}>
              <option value="all">All types</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
              <option value="transfer">Transfers</option>
              <option value="lend">Money lent</option>
              <option value="repayment">Loan repayments</option>
              <option value="writeoff">Write-offs</option>
            </select>
          </label>
          <label className="field compact">
            <span>Account</span>
            <select value={f.accountId} onChange={(e) => set({ accountId: e.target.value })}>
              <option value="all">All accounts</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.archived ? ' (archived)' : ''}</option>)}
            </select>
          </label>
          <label className="field compact">
            <span>Category</span>
            <select value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
              <option value="all">All categories</option>
              {mains.map((m) => (
                <optgroup key={m.id} label={m.kind === 'income' ? `Income: ${m.name}` : m.name}>
                  <option value={m.id}>{m.kind === 'income' ? m.name : `All ${m.name}`}</option>
                  {cats.filter((c) => c.parentId === m.id).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="row-actions">
            <button className="btn small ghost" onClick={() => set({ ...emptyFilters, search: f.search })}>
              Clear filters
            </button>
            <button className="btn small ghost" disabled={filtered.length === 0} onClick={async () => {
              // Oldest first reads more naturally in a spreadsheet.
              const csv = transactionsToCsv([...filtered].reverse(), lookups);
              await shareOrDownload(new File([csv], `finance-transactions-${today()}.csv`, { type: 'text/csv' }));
            }}>
              Export these as CSV
            </button>
          </div>
        </section>
      )}

      {filtering && (
        <div className="totals">
          <span>{filtered.length} found</span>
          <span className="expense">Spent {formatCents(spent)}</span>
          <span className="income">In {formatCents(income)}</span>
        </div>
      )}

      {txs.length === 0 && <p className="muted">No transactions yet. Tap + to add your first one.</p>}
      {txs.length > 0 && filtered.length === 0 && <p className="muted">Nothing matches these filters.</p>}

      {groups.map((g) => (
        <section key={g.date}>
          <h2>{formatDay(g.date)}</h2>
          <ul className="list card flush">
            {g.rows.map((t) => <TxRow key={t.id} tx={t} lookups={lookups} />)}
          </ul>
        </section>
      ))}

      {filtered.length > limit && (
        <button className="btn block ghost" onClick={() => setLimit(limit + PAGE)}>Show more</button>
      )}
    </>
  );
}
