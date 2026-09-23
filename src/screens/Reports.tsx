import { useMemo, useState } from 'react';
import type { ID } from '../db/types';
import { useAllTransactions, useBudgetMonth, useLookups } from '../db/hooks';
import { formatCents } from '../lib/money';
import { formatRange, monthKey, monthLabel, monthShort, shiftMonth, today } from '../lib/dates';
import {
  buildReport, monthlySummaries, monthsEnding, periodLabels, periodRange, spendingByMonth, type Period,
} from '../lib/reports';
import { BarList, ColumnChart, type BarRow } from '../components/charts';
import BudgetBar from '../components/BudgetBar';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import { Loading } from '../components/ui';

type Tab = 'overview' | 'budget' | 'trends';

// Remember choices while switching between tabs/screens.
const memory = {
  tab: 'overview' as Tab,
  period: 'month' as Period,
  custom: [today(), today()] as [string, string],
  budgetMonth: monthKey(),
  trendCat: 'all' as ID | 'all',
  trendMonths: 6,
};

export default function Reports() {
  const [tab, setTabState] = useState<Tab>(memory.tab);
  const setTab = (t: Tab) => { memory.tab = t; setTabState(t); };

  return (
    <>
      <h1>Reports</h1>
      <div className="segmented" style={{ marginBottom: 16 }}>
        {(['overview', 'budget', 'trends'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'seg active' : 'seg'} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'budget' && <BudgetVsActual />}
      {tab === 'trends' && <Trends />}
    </>
  );
}

// ---------------------------------------------------------------- Overview

function Overview() {
  const txs = useAllTransactions();
  const lookups = useLookups();
  const [period, setPeriodState] = useState<Period>(memory.period);
  const [custom, setCustomState] = useState<[string, string]>(memory.custom);
  const [drill, setDrill] = useState<ID | null>(null);
  const setPeriod = (p: Period) => { memory.period = p; setPeriodState(p); setDrill(null); };
  const setCustom = (c: [string, string]) => { memory.custom = c; setCustomState(c); };

  const [from, to] = periodRange(period, today(), custom);
  const report = useMemo(
    () => (txs && lookups ? buildReport(txs, lookups.categories, lookups.goals, from, to) : null),
    [txs, lookups, from, to],
  );
  if (!report || !lookups) return <Loading />;

  const name = (id: ID) => lookups.categories.get(id)?.name ?? '?';
  const sortRows = (m: Map<ID, number>, label: (id: ID) => string): BarRow[] =>
    [...m.entries()].filter(([, v]) => v > 0).map(([id, value]) => ({ id, label: label(id), value }))
      .sort((a, b) => b.value - a.value);

  const mainRows = sortRows(report.spendByMain, name);
  const drillTotal = drill ? report.spendByMain.get(drill) ?? 0 : 0;
  const subRows = drill
    ? sortRows(new Map([...report.spendBySub].filter(([id]) => (lookups.categories.get(id)?.parentId ?? id) === drill)), name)
    : [];
  const incomeRows = sortRows(report.incomeByCategory, name);
  const net = report.income - report.spent;

  return (
    <>
      <div className="chips period-chips">
        {(Object.keys(periodLabels) as Period[]).map((p) => (
          <button key={p} className={p === period ? 'chip active' : 'chip'} onClick={() => setPeriod(p)}>
            {periodLabels[p]}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="tx-fields" style={{ marginTop: 12 }}>
          <label className="field compact"><span>From</span>
            <input type="date" value={custom[0]} onChange={(e) => e.target.value && setCustom([e.target.value, custom[1]])} /></label>
          <label className="field compact"><span>To</span>
            <input type="date" value={custom[1]} onChange={(e) => e.target.value && setCustom([custom[0], e.target.value])} /></label>
        </div>
      )}
      <p className="muted small">{formatRange(from, to)}</p>

      <div className="tiles">
        <div className="card tile"><div className="muted small">Income</div><div className="stat-value income">{formatCents(report.income)}</div></div>
        <div className="card tile"><div className="muted small">Spent</div><div className="stat-value expense">{formatCents(report.spent)}</div></div>
        <div className="card tile"><div className="muted small">Saved to goals</div><div className="stat-value">{formatCents(report.savedToGoals)}</div></div>
        <div className="card tile"><div className="muted small">Lent out</div><div className="stat-value">{formatCents(report.lentOut)}</div></div>
      </div>
      <p className="small">
        Income − spending: <b className={net < 0 ? 'expense' : 'income'}>{net < 0 ? '−' : '+'}{formatCents(Math.abs(net))}</b>
      </p>

      {drill ? (
        <>
          <h2 className="drill-head">
            <button className="icon-btn" onClick={() => setDrill(null)} aria-label="Back to all categories"><ChevronLeftIcon /></button>
            <span>{name(drill)} · {formatCents(drillTotal)}</span>
          </h2>
          <section className="card"><BarList rows={subRows} total={drillTotal} /></section>
        </>
      ) : (
        <>
          <h2>Spending by category</h2>
          <section className="card">
            <BarList rows={mainRows} total={report.spent} onPick={setDrill} />
            {mainRows.length > 0 && <p className="muted small" style={{ marginBottom: 0 }}>Tap a category for its subcategories.</p>}
          </section>
        </>
      )}

      <h2>Income by category</h2>
      <section className="card"><BarList rows={incomeRows} total={report.income} /></section>

      <p className="muted small">
        Spending includes transfer fees and loan write-offs. Transfers, savings and lending are never counted as spending or income.
      </p>
    </>
  );
}

// ---------------------------------------------------------------- Budget vs actual

function BudgetVsActual() {
  const [month, setMonthState] = useState(memory.budgetMonth);
  const setMonth = (m: string) => { memory.budgetMonth = m; setMonthState(m); };
  const data = useBudgetMonth(month);

  const nav = (
    <div className="month-nav">
      <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeftIcon /></button>
      <h2 style={{ margin: 0, color: 'var(--text)' }}>{monthLabel(month)}</h2>
      <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month"><ChevronRightIcon /></button>
    </div>
  );
  if (!data) return <>{nav}<Loading /></>;

  const budgeted = data.mains.filter((c) => data.limits.has(c.id));
  const others = data.mains.filter((c) => !data.limits.has(c.id) && (data.spent.get(c.id) ?? 0) > 0);
  let limit = 0, spent = 0;
  for (const c of budgeted) { limit += data.limits.get(c.id)!; spent += data.spent.get(c.id) ?? 0; }

  return (
    <>
      {nav}
      {budgeted.length === 0 ? (
        <p className="muted">No budget limits for {monthLabel(month)}. Set them on the Budget tab.</p>
      ) : (
        <>
          <section className="card"><BudgetBar name="All budgeted" spent={spent} limit={limit} /></section>
          <section className="card stack">
            {budgeted.map((c) => (
              <BudgetBar key={c.id} name={c.name} spent={data.spent.get(c.id) ?? 0} limit={data.limits.get(c.id)!} />
            ))}
          </section>
        </>
      )}
      {others.length > 0 && (
        <>
          <h2>Spending without a limit</h2>
          <ul className="list card flush">
            {others.map((c) => (
              <li key={c.id} className="row">
                <div className="row-main"><div className="row-title">{c.name}</div></div>
                <span className="row-amount">{formatCents(data.spent.get(c.id) ?? 0)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="muted small">All spending this month: <b>{formatCents(data.totalSpent)}</b></p>
    </>
  );
}

// ---------------------------------------------------------------- Trends

function Trends() {
  const txs = useAllTransactions();
  const lookups = useLookups();
  const [cat, setCatState] = useState<ID | 'all'>(memory.trendCat);
  const [n, setNState] = useState(memory.trendMonths);
  const setCat = (c: ID | 'all') => { memory.trendCat = c; setCatState(c); };
  const setN = (v: number) => { memory.trendMonths = v; setNState(v); };

  const months = useMemo(() => monthsEnding(monthKey(), n), [n]);
  const values = useMemo(
    () => (txs && lookups ? spendingByMonth(txs, lookups.categories, cat === 'all' ? null : cat, months) : null),
    [txs, lookups, cat, months],
  );
  const rows = useMemo(
    () => (txs && lookups ? monthlySummaries(txs, lookups.categories, lookups.goals, months).reverse() : null),
    [txs, lookups, months],
  );
  if (!values || !rows || !lookups) return <Loading />;

  const mains = [...lookups.categories.values()]
    .filter((c) => c.kind === 'expense' && c.parentId === null && !c.archived)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const title = cat === 'all' ? 'All spending' : lookups.categories.get(cat)?.name ?? '?';
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  return (
    <>
      <div className="tx-fields">
        <label className="field compact">
          <span>Category</span>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">All spending</option>
            {mains.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field compact">
          <span>Months</span>
          <select value={n} onChange={(e) => setN(Number(e.target.value))}>
            <option value={6}>Last 6</option>
            <option value={12}>Last 12</option>
          </select>
        </label>
      </div>

      <h2>{title} by month</h2>
      <section className="card">
        <ColumnChart title={`${title} by month`} values={values}
          labels={months.map(monthShort)} fullLabels={months.map(monthLabel)} />
        <p className="muted small" style={{ margin: 0 }}>Average: {formatCents(avg)} / month</p>
      </section>

      <h2>Monthly summary</h2>
      <ul className="list card flush">
        {rows.map((r) => (
          <li key={r.month} className="row column">
            <div className="row-title">{monthLabel(r.month)}</div>
            <div className="summary-grid small">
              <span className="muted">Income</span><span className="income">{formatCents(r.income)}</span>
              <span className="muted">Spent</span><span className="expense">{formatCents(r.spent)}</span>
              <span className="muted">Saved to goals</span><span>{formatCents(r.savedToGoals)}</span>
              <span className="muted">Lent out</span><span>{formatCents(r.lentOut)}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
