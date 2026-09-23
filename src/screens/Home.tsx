import { formatCents } from '../lib/money';

export default function Home() {
  return (
    <>
      <h1>Home</h1>
      <section className="card">
        <div className="muted small">Net worth</div>
        <div className="big-amount">{formatCents(0)}</div>
      </section>
      <p className="muted">Accounts, budgets and recent transactions will appear here as we build each phase.</p>
    </>
  );
}
