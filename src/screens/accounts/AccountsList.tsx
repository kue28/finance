import { useState } from 'react';
import { Link } from 'wouter';
import { useAccounts, useBalances, useDefaultAccountId } from '../../db/hooks';
import { move } from '../../db/ops';
import { formatCents } from '../../lib/money';
import { accountTypeLabels } from '../../lib/labels';
import { Loading, PageHeader, ReorderButtons } from '../../components/ui';
import { StarIcon } from '../../components/icons';
import IconBadge from '../../components/IconBadge';
import { accountIcons } from '../../lib/icons';

export default function AccountsList() {
  const accounts = useAccounts();
  const balances = useBalances();
  const defaultId = useDefaultAccountId();
  const [showArchived, setShowArchived] = useState(false);

  if (!accounts || !balances) return <><PageHeader title="Accounts" back="/more" /><Loading /></>;

  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  return (
    <>
      <PageHeader title="Accounts" back="/more" />

      <ul className="list card flush">
        {active.map((a, i) => (
          <li key={a.id} className="row">
            <IconBadge icon={accountIcons[a.type]} size={36} />
            <Link href={`/more/accounts/${a.id}`} className="row-main">
              <div className="row-title">
                {a.name}
                {a.id === defaultId && <span className="badge" title="Default account"><StarIcon size={12} /> Default</span>}
              </div>
              <div className="muted small">{accountTypeLabels[a.type]}</div>
            </Link>
            <div className="row-amount">{formatCents(balances.get(a.id) ?? 0)}</div>
            <ReorderButtons first={i === 0} last={i === active.length - 1}
              onUp={() => move('accounts', active, a.id, -1)}
              onDown={() => move('accounts', active, a.id, 1)} />
          </li>
        ))}
      </ul>

      <Link href="/more/accounts/new" className="btn block">Add account</Link>

      {archived.length > 0 && (
        <>
          <button className="link-btn" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="list card flush">
              {archived.map((a) => (
                <li key={a.id} className="row">
                  <Link href={`/more/accounts/${a.id}`} className="row-main">
                    <div className="row-title muted">{a.name}</div>
                    <div className="muted small">Archived</div>
                  </Link>
                  <div className="row-amount muted">{formatCents(balances.get(a.id) ?? 0)}</div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
