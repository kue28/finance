import { useState } from 'react';
import { Link } from 'wouter';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSetting } from '../db/db';
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme';
import { ChevronRightIcon } from '../components/icons';

const themeOptions: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function More() {
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  const lastBackupAt = useLiveQuery(() => getSetting<number | null>('lastBackupAt', null), []);
  // Whether Android has promised not to clear our data when storage runs low.
  const persisted = useLiveQuery(async () => (await navigator.storage?.persisted?.()) ?? null, []);

  const links = [
    { to: '/more/goals', label: 'Savings goals', hint: 'Targets, deadlines, contributions' },
    { to: '/more/loans', label: 'Money lent', hint: 'Who owes you, repayments, write-offs' },
    { to: '/more/recurring', label: 'Recurring', hint: 'Rent, salary, subscriptions and other repeats' },
    { to: '/more/accounts', label: 'Accounts', hint: 'Add, rename, archive, reorder, default account' },
    { to: '/more/categories', label: 'Categories', hint: 'Expense and income categories' },
    {
      to: '/more/backup', label: 'Backup & restore',
      hint: lastBackupAt ? `Last backup ${new Date(lastBackupAt).toLocaleDateString()} · CSV export` : 'No backup yet · CSV export',
    },
  ];

  return (
    <>
      <h1>More</h1>

      <ul className="list card flush">
        {links.map((l) => (
          <li key={l.to} className="row">
            <Link href={l.to} className="row-main">
              <div className="row-title">{l.label}</div>
              <div className="muted small">{l.hint}</div>
            </Link>
            <span className="muted"><ChevronRightIcon /></span>
          </li>
        ))}
      </ul>

      <section className="card">
        <div className="label">Theme</div>
        <div className="segmented" role="radiogroup" aria-label="Theme">
          {themeOptions.map((o) => (
            <button key={o.value} role="radio" aria-checked={theme === o.value}
              className={theme === o.value ? 'seg active' : 'seg'}
              onClick={() => { setThemePref(o.value); setTheme(o.value); }}>
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <p className="muted small">
        {persisted === true && 'Storage: protected. Android won\'t clear your data to free space. '}
        {persisted === false && 'Storage: not yet protected. Install the app to your home screen, and keep regular backups. '}
        Version {__APP_VERSION__}
      </p>
    </>
  );
}
