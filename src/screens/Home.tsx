import { Link } from 'wouter';
import { useAccounts, useBalances } from '../db/hooks';
import { formatCents } from '../lib/money';
import { accountTypeLabels } from '../lib/labels';
import { Loading } from '../components/ui';

export default function Home() {
  const accounts = useAccounts();
  const balances = useBalances();

  if (!accounts || !balances) return <><h1>Home</h1><Loading /></>;

  // Net worth is the sum of ALL accounts, including archived ones, so money
  // is never silently dropped. (Money lent out is shown separately, later.)
  let netWorth = 0;
  for (const v of balances.values()) netWorth += v;

  const active = accounts.filter((a) => !a.archived);

  return (
    <>
      <h1>Home</h1>
      <section className="card">
        <div className="muted small">Net worth</div>
        <div className={netWorth < 0 ? 'big-amount expense' : 'big-amount'}>{formatCents(netWorth)}</div>
      </section>

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
      <p className="muted small">Budgets and recent transactions will appear here in later phases.</p>
    </>
  );
}
