import { useState } from 'react';
import { Link } from 'wouter';
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme';
import { ChevronRightIcon } from '../components/icons';

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
      <p className="muted small">Savings goals, loans and backup will live here in later phases.</p>
      <p className="muted small">Version {__APP_VERSION__}</p>
    </>
  );
}
