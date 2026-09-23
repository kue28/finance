import { useState } from 'react';
import { Link } from 'wouter';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSetting } from '../db/db';
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme';
import { exportBackup } from '../lib/backup';
import { ChevronRightIcon } from '../components/icons';
import { showToast } from '../components/Toast';

const themeOptions: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const links = [
  { to: '/more/accounts', label: 'Accounts', hint: 'Add, rename, archive, reorder, default account' },
  { to: '/more/categories', label: 'Categories', hint: 'Expense and income categories' },
];

export default function More() {
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  const lastBackupAt = useLiveQuery(() => getSetting<number | null>('lastBackupAt', null), []);
  const [exporting, setExporting] = useState(false);

  async function backup() {
    setExporting(true);
    try {
      if (await exportBackup()) showToast('Backup exported');
    } catch {
      showToast('Export failed');
    } finally {
      setExporting(false);
    }
  }

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
        <div className="label">Backup</div>
        <p className="small" style={{ marginTop: 0 }}>
          Your data lives only on this phone. Export a backup and save it to Google Drive, WhatsApp or email.
        </p>
        <button className="btn block" onClick={backup} disabled={exporting}>Export backup (JSON)</button>
        <div className="muted small">
          {lastBackupAt ? `Last backup: ${new Date(lastBackupAt).toLocaleString()}` : 'No backup yet.'}
        </div>
      </section>

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
      <p className="muted small">Savings goals, loans and restore will live here in later phases.</p>
      <p className="muted small">Version {__APP_VERSION__}</p>
    </>
  );
}
