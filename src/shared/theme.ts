// Light / dark theme shared by the site and the app.
// Preference is 'light' | 'dark' | 'auto' (follow the OS). The resolved theme is
// written to <html data-theme>, which base.css keys off. An inline snippet in each
// HTML <head> applies it before first paint so there is no flash.

export type ThemePref = 'light' | 'dark' | 'auto';
const KEY = 'dc.theme';

export function getPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'auto') return v;
  } catch { /* storage unavailable */ }
  return 'auto';
}

export function resolve(pref: ThemePref): 'light' | 'dark' {
  if (pref !== 'auto') return pref;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const listeners = new Set<(t: 'light' | 'dark') => void>();

export function apply(pref: ThemePref = getPref()) {
  const t = resolve(pref);
  document.documentElement.dataset.theme = t;
  listeners.forEach((l) => l(t));
}

export function setPref(pref: ThemePref) {
  try { localStorage.setItem(KEY, pref); } catch { /* ignore */ }
  apply(pref);
}

/** Flip between light and dark (an explicit choice; 'auto' is the untouched default). */
export function toggle() {
  setPref(resolve(getPref()) === 'dark' ? 'light' : 'dark');
}

export function current(): 'light' | 'dark' {
  return (document.documentElement.dataset.theme as 'light' | 'dark') || resolve(getPref());
}

export function onThemeChange(fn: (t: 'light' | 'dark') => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (getPref() === 'auto') apply('auto');
});
// Keep multiple open tabs in sync.
addEventListener('storage', (e) => { if (e.key === KEY) apply(); });
