// Theme preference lives in localStorage (not IndexedDB) because it must be
// read synchronously before first paint. See the inline script in index.html.
export type ThemePref = 'system' | 'light' | 'dark';

export function getThemePref(): ThemePref {
  try {
    const t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') return t;
  } catch { /* storage unavailable: fall back to system */ }
  return 'system';
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', pref);
  } catch { /* ignore */ }
  if (pref === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = pref;
}
