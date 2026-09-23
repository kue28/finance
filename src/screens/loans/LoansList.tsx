import { useState } from 'react';
import { Link } from 'wouter';
import { useLoans, type LoanWithSummary } from '../../db/hooks';
import { formatCents } from '../../lib/money';
import { formatDay } from '../../lib/dates';
import { personKey } from '../../lib/loans';
import { Loading, PageHeader } from '../../components/ui';

export default function LoansList() {
  const loans = useLoans();
  const [showSettled, setShowSettled] = useState(false);

  if (!loans) return <><PageHeader title="Money lent" back="/more" /><Loading /></>;

  const open = loans.filter((l) => l.status === 'open');
  const settled = loans.filter((l) => l.status !== 'open');
  const totalOwed = open.reduce((s, l) => s + l.outstanding, 0);
  const overdue = open.filter((l) => l.overdue);

  // Group open loans by person, biggest amount owed first.
  const groups = new Map<string, { name: string; owed: number; loans: LoanWithSummary[] }>();
  for (const l of open) {
    const k = personKey(l.person);
    const g = groups.get(k) ?? { name: l.person, owed: 0, loans: [] };
    g.owed += l.outstanding;
    g.loans.push(l);
    groups.set(k, g);
  }
  const people = [...groups.values()].sort((a, b) => b.owed - a.owed);

  return (
    <>
      <PageHeader title="Money lent" back="/more" />

      <section className="card">
        <div className="muted small">Owed to you</div>
        <div className="big-amount">{formatCents(totalOwed)}</div>
        {overdue.length > 0 && (
          <div className="warn-text small">{overdue.length} overdue loan{overdue.length > 1 ? 's' : ''}</div>
        )}
        <p className="muted small" style={{ marginBottom: 0 }}>
          Not part of net worth. Lending isn't spending and repayments aren't income, so neither affects budgets or reports.
        </p>
      </section>

      {people.length === 0 && <p className="muted">Nobody owes you anything right now.</p>}

      {people.map((p) => (
        <section key={p.name}>
          <h2 className="person-head"><span>{p.name}</span><span>{formatCents(p.owed)}</span></h2>
          <ul className="list card flush">
            {p.loans.map((l) => <LoanRow key={l.id} loan={l} />)}
          </ul>
        </section>
      ))}

      <Link href="/more/loans/new" className="btn block">Record money lent</Link>

      {settled.length > 0 && (
        <>
          <button className="link-btn" onClick={() => setShowSettled(!showSettled)}>
            {showSettled ? 'Hide' : 'Show'} settled ({settled.length})
          </button>
          {showSettled && (
            <ul className="list card flush">
              {settled.map((l) => <LoanRow key={l.id} loan={l} showPerson />)}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function LoanRow({ loan, showPerson }: { loan: LoanWithSummary; showPerson?: boolean }) {
  const detail = loan.status === 'repaid' ? 'Repaid in full'
    : loan.status === 'written_off' ? `Written off ${formatCents(loan.writtenOff)}`
    : loan.expectedRepayDate ? `Due back ${formatDay(loan.expectedRepayDate)}` : 'No due date';
  return (
    <li className="row">
      <Link href={`/more/loans/${loan.id}`} className="row-main">
        <div className="row-title">
          {showPerson ? `${loan.person} · ` : ''}{formatCents(loan.amount)} on {formatDay(loan.dateLent)}
          {loan.overdue && <span className="badge overdue">Overdue</span>}
        </div>
        <div className={loan.overdue ? 'small warn-text' : 'muted small'}>{detail}{loan.note ? ` · ${loan.note}` : ''}</div>
      </Link>
      <span className="row-amount">{loan.status === 'open' ? formatCents(loan.outstanding) : '—'}</span>
    </li>
  );
}
