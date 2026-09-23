import { Link } from 'wouter';
import {
  useAccounts, useAllTransactions, useBalances, useBudgetCopyOffer, useBudgetMonth, useDueRecurring, useGoals, useLoans,
  useLookups,
} from '../db/hooks';
import DueList from '../components/DueList';
import GoalProgress from '../components/GoalProgress';
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
  const due = useDueRecurring();
  const goals = useGoals();
  const loans = useLoans();

  if (!accounts || !balances || !txs || !lookups || !budget || copyOffer === undefined || !due || !goals || !loans) {
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
  const activeGoals = goals.filter((g) => !g.completed);
  // Money owed to you is shown separately and NOT added to net worth.
  const openLoans = loans.filter((l) => l.status === 'open');
  const owed = openLoans.reduce((s, l) => s + l.outstanding, 0);
  const overdueLoans = openLoans.filter((l) => l.overdue).length;

  return (
    <>
      <h1>Home</h1>

      <section className="card">
        <div className="muted small">Net worth</div>
        <div className={netWorth < 0 ? 'big-amount expense' : 'big-amount'}>{formatCents(netWorth)}</div>
        {owed > 0 && (
          <Link href="/more/loans" className="owed-line small">
            Owed to you: <b>{formatCents(owed)}</b>
            {overdueLoans > 0 && <span className="warn-text"> · {overdueLoans} overdue</span>}
            <span className="muted"> ›</span>
          </Link>
        )}
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

      <DueList due={due} accounts={lookups.accounts} categories={lookups.categories} />

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

      {activeGoals.length > 0 && (
        <>
          <h2>Savings goals</h2>
          <Link href="/more/goals" className="card link-card stack">
            {activeGoals.slice(0, 3).map((g) => <GoalProgress key={g.id} goal={g} saved={g.saved} compact />)}
            {activeGoals.length > 3 && <span className="muted small">+{activeGoals.length - 3} more</span>}
          </Link>
        </>
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
