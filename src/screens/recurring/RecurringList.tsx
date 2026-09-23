import { Link } from 'wouter';
import { useLookups, useRecurringList } from '../../db/hooks';
import { formatCents } from '../../lib/money';
import { formatDay } from '../../lib/dates';
import { describeSchedule } from '../../lib/recurring';
import { recurringName } from '../../components/DueList';
import { Loading, PageHeader } from '../../components/ui';

export default function RecurringList() {
  const items = useRecurringList();
  const lookups = useLookups();

  if (!items || !lookups) return <><PageHeader title="Recurring" back="/more" /><Loading /></>;

  return (
    <>
      <PageHeader title="Recurring" back="/more" />
      <p className="muted small" style={{ marginTop: -8 }}>
        Nothing is recorded automatically. When one is due it appears on Home for you to confirm, skip or snooze.
      </p>

      {items.length === 0 ? (
        <p className="muted">No recurring items yet. Add rent, salary, subscriptions…</p>
      ) : (
        <ul className="list card flush">
          {items.map((r) => {
            const status = !r.active ? 'Paused'
              : r.nextDueDate ? `Next: ${formatDay(r.nextDueDate)}` : 'Ended';
            return (
              <li key={r.id} className="row">
                <Link href={`/more/recurring/${r.id}`} className="row-main">
                  <div className={r.active ? 'row-title' : 'row-title muted'}>{recurringName(r, lookups.categories)}</div>
                  <div className="muted small">
                    {describeSchedule(r.every, r.unit)} · {lookups.accounts.get(r.accountId)?.name ?? '?'} · {status}
                  </div>
                </Link>
                <span className={`row-amount ${r.kind}`}>
                  {r.kind === 'income' ? '+' : '−'}{formatCents(r.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/more/recurring/new" className="btn block">Add recurring</Link>
    </>
  );
}
