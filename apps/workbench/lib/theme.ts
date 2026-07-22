// Theme persistence for the workbench.
//
// Deliberately NOT imported from @sparx/ui: the workbench is a ground-up app and
// its theme has one requirement the dashboard's does not — it must stay in sync
// across DETACHED WINDOWS. A popout is a separate `document`, so toggling the
// theme in the main window has to reach every open window. `applyTheme` writes
// to every registered document and the change is broadcast on the workbench bus
// (see lib/bus.ts), which the popout bootstrap subscribes to.

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'sparx-workbench-theme';

/**
 * Runs before paint in every window (main and popout) to avoid a flash of the
 * wrong theme. Kept as a string so it can be injected two ways: via
 * next/script `beforeInteractive` in the server HTML for the main window, and
 * via a literal <script> written into a popout's document at open time.
 *
 * Matches the dashboard in deliberately NOT honouring prefers-color-scheme —
 * theme is an explicit, persisted user choice (docs/24 §7).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark')t='light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export function readTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'light';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'dark' ? 'dark' : 'light';
}

/** Applies `theme` to one document. Called once per open window. */
export function applyThemeToDocument(doc: Document, theme: Theme): void {
  doc.documentElement.setAttribute('data-theme', theme);
}
