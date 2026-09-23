import { Link, useLocation } from 'wouter';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Plus } from 'lucide-react';
import {
  useAccounts, useAllTransactions, useBackupReminder, useBalances, useBudgetCopyOffer, useBudgetMonth, useDueRecurring,
  useGoals, useLoans, useLookups,
} from '../db/hooks';
import { exportBackup, snoozeBackupReminder } from '../lib/backup';
import { presetTransactionFilters } from './Transactions';
import { showToast } from '../components/Toast';
import DueList from '../components/DueList';
import GoalProgress from '../components/GoalProgress';
import { formatCents } from '../lib/money';
import { monthKey, monthShort } from '../lib/dates';
import { accountTypeLabels } from '../lib/labels';
import { accountIcons, categoryIcon } from '../lib/icons';
import { budgetState } from '../lib/budget';
import TxRow from '../components/TxRow';
import BudgetBar from '../components/BudgetBar';
import { Loading } from '../components/ui';

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** A section heading with an optional link on the right ("See all"). */
function Section({ title, to, action = 'See all' }: { title: string; to?: string; action?: string }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {to && <Link href={to} className="section-link">{action}<ChevronRight size={16} /></Link>}
    </div>
  );
}

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
  const reminder = useBackupReminder();
  const [, navigate] = useLocation();

  if (!accounts || !balances || !txs || !lookups || !budget || copyOffer === undefined || !due || !goals || !loans || !reminder) {
    return <Loading />;
  }

  // Net worth is the sum of ALL accounts, including archived ones, so money
  // is never silently dropped. Money lent out is shown separately below it.
  let netWorth = 0;
  for (const v of balances.values()) netWorth += v;

  const active = accounts.filter((a) => !a.archived);
  const monthName = monthShort(month); // 'Sep': keeps the hero labels on one line

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

  const openAccount = (id: string) => { presetTransactionFilters({ accountId: id }); navigate('/transactions'); };

  return (
    <>
      <header className="home-head">
        <div className="muted small">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1>{greeting()}</h1>
      </header>

      {reminder.days !== null && (
        <section className="card notice-card">
          <p style={{ marginTop: 0 }}>
            {reminder.neverBackedUp
              ? `You haven't backed up yet (${reminder.days} days of data). If this phone is lost, your data goes with it.`
              : `It's been ${reminder.days} days since your last backup.`}
          </p>
          <div className="row-actions">
            <button className="btn" onClick={async () => { if (await exportBackup()) showToast('Backup exported'); }}>Back up now</button>
            <button className="btn ghost" onClick={() => snoozeBackupReminder()}>Later</button>
          </div>
        </section>
      )}

      <section className="hero">
        <div className="hero-label">Net worth</div>
        <div className="hero-amount">{formatCents(netWorth)}</div>
        <div className="hero-stats">
          <Link href="/budget" className="hero-stat">
            <span className="hero-stat-icon"><ArrowDownRight size={16} /></span>
            <span>
              <span className="hero-stat-label">Spent in {monthName}</span>
              <span className="hero-stat-value">{formatCents(budget.totalSpent)}</span>
            </span>
          </Link>
          <Link href="/reports" className="hero-stat">
            <span className="hero-stat-icon"><ArrowUpRight size={16} /></span>
            <span>
              <span className="hero-stat-label">Income in {monthName}</span>
              <span className="hero-stat-value">{formatCents(budget.income)}</span>
            </span>
          </Link>
        </div>
        {owed > 0 && (
          <Link href="/more/loans" className="hero-owed">
            Owed to you: <b>{formatCents(owed)}</b>
            {overdueLoans > 0 && <> · {overdueLoans} overdue</>}
            <ChevronRight size={14} />
          </Link>
        )}
      </section>

      {/* Accounts: swipe sideways. Tap one to see its transactions. */}
      <Section title="Accounts" to="/more/accounts" action="Manage" />
      <div className="account-strip" role="list">
        {active.map((a) => {
          const Icon = accountIcons[a.type];
          const bal = balances.get(a.id) ?? 0;
          return (
            <button key={a.id} role="listitem" className="account-card" onClick={() => openAccount(a.id)}
              aria-label={`${a.name}, ${formatCents(bal)}. Show transactions`}>
              <span className="account-card-top"><Icon size={18} strokeWidth={1.9} /><span className="clamp">{a.name}</span></span>
              <span className={bal < 0 ? 'account-card-bal expense' : 'account-card-bal'}>{formatCents(bal)}</span>
              <span className="muted small">{accountTypeLabels[a.type]}</span>
            </button>
          );
        })}
        <Link href="/more/accounts/new" className="account-card add" aria-label="Add account">
          <Plus size={22} /><span className="small">Add account</span>
        </Link>
      </div>

      <DueList due={due} accounts={lookups.accounts} categories={lookups.categories} />

      {copyOffer && (
        <Link href="/budget" className="card notice-card link-card">
          New month: tap to copy last month's budget limits →
        </Link>
      )}

      {attention.length > 0 && (
        <>
          <Section title="Budgets needing attention" to="/budget" />
          <Link href="/budget" className="card link-card stack">
            {attention.map((b) => (
              <BudgetBar key={b.c.id} name={b.c.name} icon={categoryIcon(b.c, lookups.categories)} spent={b.spent} limit={b.limit} />
            ))}
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
          <Section title="Savings goals" to="/more/goals" />
          <Link href="/more/goals" className="card link-card stack">
            {activeGoals.slice(0, 3).map((g) => <GoalProgress key={g.id} goal={g} saved={g.saved} compact />)}
            {activeGoals.length > 3 && <span className="muted small">+{activeGoals.length - 3} more</span>}
          </Link>
        </>
      )}

      <Section title="Recent activity" to={txs.length > 0 ? '/transactions' : undefined} />
      {txs.length === 0 ? (
        <p className="muted">Nothing yet. Tap + below to log your first spend.</p>
      ) : (
        <ul className="list card flush">
          {txs.slice(0, 5).map((t) => <TxRow key={t.id} tx={t} lookups={lookups} />)}
        </ul>
      )}
    </>
  );
}
