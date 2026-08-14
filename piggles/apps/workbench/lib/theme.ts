// Theme persistence for the console.
//
// Deliberately the console's own rather than the shared workbench's, for exactly
// one reason: the storage key. `sparx-workbench-theme` in a Piggles customer's
// browser is a small leak, but it is a real one — devtools, an exported profile,
// a support session sharing a screen — and this file is four functions. The
// BEHAVIOUR is identical on purpose; if the shared one changes how theming
// works, this should follow it rather than diverge.
//
// The requirement that shapes it, and the reason neither app uses a library
// helper: the theme must stay in sync across DETACHED WINDOWS. A popout is a
// separate `document`, so toggling in the main window has to reach every open
// one. `applyThemeToDocument` writes to a document and the change is broadcast
// on the workbench bus, which the popout bootstrap subscribes to.
//
// Like sparx's, this deliberately does NOT honour `prefers-color-scheme`: theme
// is an explicit, persisted choice. @piggles/brand's `PIGGLES_APPEARANCE`
// includes a `system` option for surfaces that offer one; the console does not,
// because a workspace that changes appearance at sunset while somebody is
// working is a surprise, not a feature.

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'piggles-console-theme';

/**
 * Runs before paint in every window (main and popout) to avoid a flash of the
 * wrong theme. Kept as a string so it can be injected two ways: via next/script
 * `beforeInteractive` in the server HTML for the main window, and via a literal
 * <script> written into a popout's document at open time.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark')t='light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export function readTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'light';
  return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

/** Applies `theme` to one document. Called once per open window. */
export function applyThemeToDocument(doc: Document, theme: Theme): void {
  doc.documentElement.setAttribute('data-theme', theme);
}
