// Theme preference lives in localStorage (not IndexedDB) because it must be
// read synchronously before first paint. See the inline script in index.html.
export type ThemePref = 'system' | 'light' | 'dark';

const STATUS_BAR = { light: '#f5f6f8', dark: '#0f1115' };

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

  // Android's status bar colour: the two <meta> tags in index.html follow the
  // phone's setting; a forced theme overrides both.
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name=theme-color]');
  metas.forEach((m) => {
    const media = m.getAttribute('media') ?? '';
    const own = media.includes('dark') ? STATUS_BAR.dark : STATUS_BAR.light;
    m.content = pref === 'system' ? own : STATUS_BAR[pref];
  });
}
