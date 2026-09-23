import { useState } from 'react';
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme';

const themeOptions: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function More() {
  const [theme, setTheme] = useState<ThemePref>(getThemePref);

  return (
    <>
      <h1>More</h1>
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
      <p className="muted small">Accounts, categories, savings goals, loans and backup will live here.</p>
      <p className="muted small">Version {__APP_VERSION__}</p>
    </>
  );
}
