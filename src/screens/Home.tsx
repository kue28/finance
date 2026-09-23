import { Link } from 'wouter';
import { useAccounts, useAllTransactions, useBalances, useBudgetCopyOffer, useBudgetMonth, useLookups } from '../db/hooks';
import { formatCents } from '../lib/money';
import { monthKey, monthLabel } from '../lib/dates';
import { accountTypeLabels } from '../lib/labels';
import { budgetState } from '../lib/budget';
import TxRow from '../components/TxRow';
import BudgetBar from '../components/BudgetBar';
import { Loading } from '../components/ui';

export default function Home() {
  const month = monthKey();
  const accounts = useAccounts();
  const balances = useBalances();
  const txs = useAllTransactions();
  const lookups = useLookups();
  const budget = useBudgetMonth(month);
  const copyOffer = useBudgetCopyOffer(month);

  if (!accounts || !balances || !txs || !lookups || !budget || copyOffer === undefined) {
    return <><h1>Home</h1><Loading /></>;
  }

  // Net worth is the sum of ALL accounts, including archived ones, so money
  // is never silently dropped. (Money lent out is shown separately, later.)
  let netWorth = 0;
  for (const v of balances.values()) netWorth += v;

  const active = accounts.filter((a) => !a.archived);

  // Budgets at 80% or more of their limit, worst first.
  const attention = budget.mains
    .filter((c) => budget.limits.has(c.id))
    .map((c) => ({ c, spent: budget.spent.get(c.id) ?? 0, limit: budget.limits.get(c.id)! }))
    .filter((b) => budgetState(b.spent, b.limit) !== 'ok')
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);
  const hasBudgets = budget.limits.size > 0;

  return (
    <>
      <h1>Home</h1>

      <section className="card">
        <div className="muted small">Net worth</div>
        <div className={netWorth < 0 ? 'big-amount expense' : 'big-amount'}>{formatCents(netWorth)}</div>
      </section>

      <div className="stat-row">
        <Link href="/budget" className="card stat">
          <div className="muted small">Spent in {monthLabel(month).split(' ')[0]}</div>
          <div className="stat-value expense">{formatCents(budget.totalSpent)}</div>
        </Link>
        <div className="card stat">
          <div className="muted small">Income in {monthLabel(month).split(' ')[0]}</div>
          <div className="stat-value income">{formatCents(budget.income)}</div>
        </div>
      </div>

      {copyOffer && (
        <Link href="/budget" className="card notice-card link-card">
          New month: tap to copy last month's budget limits →
        </Link>
      )}

      {attention.length > 0 && (
        <>
          <h2>Budgets needing attention</h2>
          <Link href="/budget" className="card link-card stack">
            {attention.map((b) => <BudgetBar key={b.c.id} name={b.c.name} spent={b.spent} limit={b.limit} />)}
          </Link>
        </>
      )}
      {hasBudgets && attention.length === 0 && (
        <p className="muted small">All budgets are under 80% this month. 👍</p>
      )}
      {!hasBudgets && !copyOffer && (
        <Link href="/budget" className="link-btn">Set monthly budget limits →</Link>
      )}

      <h2>Accounts</h2>
      <ul className="list card flush">
        {active.map((a) => {
          const bal = balances.get(a.id) ?? 0;
          return (
            <li key={a.id} className="row">
              <Link href={`/more/accounts/${a.id}`} className="row-main">
                <div className="row-title">{a.name}</div>
                <div className="muted small">{accountTypeLabels[a.type]}</div>
              </Link>
              <div className={bal < 0 ? 'row-amount expense' : 'row-amount'}>{formatCents(bal)}</div>
            </li>
          );
        })}
      </ul>

      <h2>Recent transactions</h2>
      {txs.length === 0 ? (
        <p className="muted">Nothing yet. Tap + to log your first spend.</p>
      ) : (
        <>
          <ul className="list card flush">
            {txs.slice(0, 5).map((t) => <TxRow key={t.id} tx={t} lookups={lookups} />)}
          </ul>
          <Link href="/transactions" className="link-btn">See all transactions</Link>
        </>
      )}
    </>
  );
}
