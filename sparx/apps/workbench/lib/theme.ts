// Appearance for the workbench — light, dark, or whatever the machine is set to.
//
// Deliberately NOT imported from @wizeworks/ui: the workbench is a ground-up app
// and its appearance has one requirement the old dashboard's did not — it must
// stay in sync across DETACHED WINDOWS. A popout is a separate `document`, so
// changing the appearance in the main window has to reach every open one. The
// CHOICE travels on the workbench bus (lib/bus.ts) and each window resolves and
// applies it for itself; lib/use-theme.ts is the hook that does that, and every
// window mounts it.
//
// ── THERE IS EXACTLY ONE WRITER OF `data-theme` ─────────────────────────────
//
// The pre-paint script below and `applyThemeToDocument` are it. In particular
// <html> must NOT carry `data-theme` as a JSX prop: React owns every attribute
// it renders and re-asserts it whenever the element is created, so a hardcoded
// value on the root layout is a SECOND writer permanently pinned to `light`,
// racing the script. The failure it produces is a workbench whose stored choice
// says dark, whose toggle label agrees, and whose document is white — three
// answers to one question, and a control that looks broken because every click
// sets an attribute something else immediately puts back. See app/layout.tsx.
//
// ── SYSTEM IS THE DEFAULT, AND IT FOLLOWS ───────────────────────────────────
//
// This file used to say the opposite — that appearance is an explicit choice and
// `prefers-color-scheme` is not honoured (docs/24 §7). The surprise runs the
// other way: somebody whose machine is dark opens every other window dark and
// this one white, and has to go and find a control to repeat what their computer
// already said. `system` is the default and tracks the OS live; picking light or
// dark explicitly PINS it, and that is remembered.
//
// Two values, and they must not be confused:
//   • the CHOICE — 'system' | 'light' | 'dark', what the person picked, and the
//                  only thing persisted.
//   • the THEME  — 'light' | 'dark', what that resolves to right now, and the
//                  only thing ever written to `data-theme`.

/** What the person picked. `system` is the default and is not a theme. */
export type ThemeChoice = 'system' | 'light' | 'dark';

/** What a choice resolves to — the only thing `data-theme` ever holds. */
export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'sparx-workbench-theme';

/** The media query that answers `system`. One string, because the pre-paint
 *  script has to inline it and drift between the two would mean the first paint
 *  and every paint after it disagreed. */
const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Runs before paint in every window (main and popout) to avoid a flash of the
 * wrong appearance. Kept as a string so it can be injected two ways: via
 * next/script `beforeInteractive` in the server HTML for the main window, and
 * via a literal <script> written into a popout's document at open time.
 *
 * It resolves `system` itself rather than deferring to React, because React is
 * necessarily later than the first paint — which is the whole point of it.
 * Anything unreadable (a blocked localStorage, a browser with no matchMedia)
 * falls through to light rather than leaving the attribute unset: the theme
 * tokens hang off `[data-theme]`, so an absent attribute is an unpainted app,
 * which is a far worse failure than the wrong shade.
 */
export const THEME_INIT_SCRIPT = `(function(){var t='light';try{var c=localStorage.getItem('${THEME_STORAGE_KEY}');t=(c==='light'||c==='dark')?c:(matchMedia('${DARK_QUERY}').matches?'dark':'light');}catch(e){}document.documentElement.setAttribute('data-theme',t);})();`;

/**
 * The persisted choice. Anything absent or unrecognised is `system` — including
 * the value written by the version of this file that only knew two states, since
 * `light` and `dark` are still exactly what they were.
 */
export function readThemeChoice(): ThemeChoice {
  if (typeof localStorage === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    // Storage blocked. The workbench still themes for this session; it just
    // cannot remember, which is the right failure.
    return 'system';
  }
}

/** Remembers the choice. `system` is stored explicitly rather than by deleting
 *  the key, so "I went back to matching my computer" survives a reload the same
 *  way the other two do. */
export function writeThemeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // See above.
  }
}

/** What the machine is set to right now. */
export function systemTheme(): Theme {
  if (typeof matchMedia === 'undefined') return 'light';
  return matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * Calls back whenever the machine's preference flips. Every window subscribes,
 * not just the main one: a popout on a second monitor is its own document and
 * has to repaint itself.
 */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof matchMedia === 'undefined') return () => undefined;
  const query = matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

/** Applies a RESOLVED theme to one document. Never a choice — `data-theme` has
 *  no third value, and `[data-theme='system']` matches nothing. */
export function applyThemeToDocument(doc: Document, theme: Theme): void {
  doc.documentElement.setAttribute('data-theme', theme);
}
