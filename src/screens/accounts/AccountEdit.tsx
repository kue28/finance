import { useState } from 'react';
import { useLocation } from 'wouter';
import type { Account, AccountType } from '../../db/types';
import { useAccount, useAccounts, useDefaultAccountId } from '../../db/hooks';
import { addAccount, setDefaultAccount, updateAccount } from '../../db/ops';
import { centsToInput, parseSignedToCents } from '../../lib/money';
import { accountTypeLabels, nameTaken } from '../../lib/labels';
import { Loading, PageHeader } from '../../components/ui';

const types = Object.keys(accountTypeLabels) as AccountType[];

/** Route: /more/accounts/new or /more/accounts/:id */
export default function AccountEdit({ params }: { params: { id: string } }) {
  const isNew = params.id === 'new';
  const account = useAccount(isNew ? undefined : params.id);
  const accounts = useAccounts();
  const defaultId = useDefaultAccountId();

  const title = isNew ? 'New account' : 'Edit account';
  // Wait for data, then mount the form so its initial state is filled in.
  if (!accounts || defaultId === undefined || (!isNew && !account)) {
    return <><PageHeader title={title} back="/more/accounts" /><Loading /></>;
  }
  return (
    <>
      <PageHeader title={title} back="/more/accounts" />
      <AccountForm key={account?.id ?? 'new'} account={account} accounts={accounts} defaultId={defaultId} />
    </>
  );
}

function AccountForm({ account, accounts, defaultId }: {
  account?: Account; accounts: Account[]; defaultId: string | null;
}) {
  const [, navigate] = useLocation();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'mobile_wallet');
  const [opening, setOpening] = useState(account ? centsToInput(account.openingBalance) : '');
  const [makeDefault, setMakeDefault] = useState(account ? account.id === defaultId : false);
  const [error, setError] = useState('');

  const isDefault = account?.id === defaultId;

  async function save() {
    const cents = opening.trim() === '' ? 0 : parseSignedToCents(opening);
    if (!name.trim()) return setError('Please enter a name.');
    if (nameTaken(accounts, name, account?.id)) return setError('You already have an account with that name.');
    if (cents === null) return setError('Opening balance must be an amount like 25 or 25.50.');

    let id = account?.id;
    if (account) await updateAccount(account.id, { name, type, openingBalance: cents });
    else id = await addAccount(name, type, cents);
    if (makeDefault && id) await setDefaultAccount(id);
    navigate('/more/accounts');
  }

  async function toggleArchive() {
    if (!account) return;
    if (!account.archived && isDefault) {
      return setError('This is your default account. Make another account the default first.');
    }
    await updateAccount(account.id, { archived: !account.archived });
    navigate('/more/accounts');
  }

  return (
    <div className="form">
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. OneMoney" autoFocus={!account} />
      </label>

      <div className="field">
        <span>Type</span>
        <div className="segmented wrap">
          {types.map((t) => (
            <button key={t} type="button" className={type === t ? 'seg active' : 'seg'} onClick={() => setType(t)}>
              {accountTypeLabels[t]}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>Opening balance ($)</span>
        <input value={opening} onChange={(e) => setOpening(e.target.value)}
          inputMode="decimal" placeholder="0.00" />
        <small className="muted">What was in this account before you started tracking. Use a minus sign if it was overdrawn.</small>
      </label>

      {!account?.archived && (
        <label className="check">
          <input type="checkbox" checked={makeDefault} disabled={isDefault}
            onChange={(e) => setMakeDefault(e.target.checked)} />
          <span>Default account for quick entry{isDefault && ' (current default)'}</span>
        </label>
      )}

      {error && <p className="error">{error}</p>}

      <button className="btn block" onClick={save}>Save</button>
      {account && (
        <button className="btn block ghost" onClick={toggleArchive}>
          {account.archived ? 'Unarchive account' : 'Archive account'}
        </button>
      )}
      {account && !account.archived && (
        <p className="muted small">Archiving hides the account from lists and quick entry. Its past transactions are kept.</p>
      )}
    </div>
  );
}
