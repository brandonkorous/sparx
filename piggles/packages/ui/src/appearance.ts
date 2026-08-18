// Light, dark, or whatever the computer is set to — the mechanism, shared by
// every Piggles app.
//
// ── WHY IT LIVES HERE AND NOT IN EACH APP ───────────────────────────────────
//
// There are three Piggles surfaces (the marketing site, the account app, the
// console) and each one paints the same control. Written three times it was
// three different products: two states in one place and three in another,
// different words for the same choice, and — the reason this file exists — the
// same bug fixable in one app and still live in the other two.
//
// So the RULE lives here and the apps supply only what genuinely differs: the
// storage key (localStorage is per-origin, so they cannot share one anyway) and
// which of their own icons to draw.
//
// ── THERE IS EXACTLY ONE WRITER OF `data-theme` ─────────────────────────────
//
// `appearanceScript` at load, `applyAppearance` afterwards. In particular <html>
// must NOT carry `data-theme` as a JSX prop: React owns every attribute it
// renders and re-asserts it whenever the element is created, which makes the
// root layout a second writer permanently pinned to whatever was typed there.
// That is not theoretical — it is the bug this was rewritten for. The symptom is
// an app whose stored choice says dark, whose control's label agrees, and whose
// document is white, with a control that looks broken because every click sets
// an attribute something else immediately puts back.
//
// ── SYSTEM IS THE DEFAULT, AND IT FOLLOWS ───────────────────────────────────
//
// The console used to argue that appearance should be an explicit choice and
// `prefers-color-scheme` ignored, because a workspace that changes at sunset is
// a surprise. The surprise runs the other way: somebody whose machine is dark
// opens every other window dark and this one white, and has to go and find a
// control to repeat what their computer already said. `system` is the default
// and tracks the machine live; light or dark PINS it, and that is remembered.
//
// Two values, and they must not be confused:
//   • the APPEARANCE — 'system' | 'light' | 'dark', what the person picked, and
//                      the only thing persisted.
//   • the THEME      — 'light' | 'dark', what that resolves to right now, and
//                      the only thing ever written to `data-theme`.

/** What the person picked. Mirrors `PIGGLES_APPEARANCE` in @piggles/brand, which
 *  is the vocabulary's declaration; this package does not depend on it. */
export type Appearance = 'system' | 'light' | 'dark';

/** What an appearance resolves to — the only thing `data-theme` ever holds. */
export type ResolvedAppearance = 'light' | 'dark';

/**
 * The three choices, in the order they are offered — the default first, because
 * it is the one most people should stay on and the one they come back to.
 *
 * Written the way this audience talks: "match my computer", not "system". A
 * business owner has a computer and knows whether it is set to dark; nobody
 * outside software calls that a system preference. The words are HERE rather
 * than in each app for the same reason the behaviour is: one setting, said one
 * way, wherever a person meets it.
 */
export const APPEARANCE_OPTIONS: { choice: Appearance; label: string }[] = [
  { choice: 'system', label: 'Match my computer' },
  { choice: 'light', label: 'Light' },
  { choice: 'dark', label: 'Dark' },
];

/** The media query that answers `system`. One string, because the pre-paint
 *  script has to inline it and drift between the two would mean the first paint
 *  and every paint after it disagreed. */
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function appearanceLabel(choice: Appearance): string {
  return APPEARANCE_OPTIONS.find((option) => option.choice === choice)?.label ?? 'Light';
}

/**
 * Said in full, for a tooltip and a screen reader — the choice AND, when it is
 * being followed rather than pinned, what it currently comes out as.
 */
export function describeAppearance(choice: Appearance, theme: ResolvedAppearance): string {
  if (choice === 'system') return `Matching your computer, which is ${theme} right now`;
  return `${appearanceLabel(choice)}, whatever your computer is set to`;
}

/**
 * The pre-paint script for one app, given its storage key.
 *
 * Runs before the first paint in every window to avoid a flash of the wrong
 * appearance. Returned as a string so it can be injected two ways: inline in a
 * root layout's server HTML, and as a literal <script> written into a detached
 * window's document at open time.
 *
 * It resolves `system` itself rather than deferring to React, because React is
 * necessarily later than the first paint — which is the whole point of it.
 * Anything unreadable (a blocked localStorage, a browser with no matchMedia)
 * falls through to light rather than leaving the attribute unset: every token in
 * @piggles/brand's theme.css hangs off `[data-theme]`, so an absent attribute is
 * an unpainted app, which is a far worse failure than the wrong shade.
 */
export function appearanceScript(storageKey: string): string {
  return `(function(){var t='light';try{var c=localStorage.getItem('${storageKey}');t=(c==='light'||c==='dark')?c:(matchMedia('${DARK_QUERY}').matches?'dark':'light');}catch(e){}document.documentElement.setAttribute('data-theme',t);})();`;
}

/**
 * The persisted choice. Anything absent or unrecognised is `system` — including
 * a value written by a version of an app that only knew two states, since
 * `light` and `dark` still mean exactly what they meant.
 */
export function readAppearance(storageKey: string): Appearance {
  if (typeof localStorage === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(storageKey);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    // Storage blocked. The app still themes for this session; it just cannot
    // remember, which is the right failure.
    return 'system';
  }
}

/** Remembers the choice. `system` is stored explicitly rather than by deleting
 *  the key, so "I went back to matching my computer" survives a reload the same
 *  way the other two do. */
export function writeAppearance(storageKey: string, choice: Appearance): void {
  try {
    localStorage.setItem(storageKey, choice);
  } catch {
    // See above.
  }
}

/** What the machine is set to right now. */
export function systemAppearance(): ResolvedAppearance {
  if (typeof matchMedia === 'undefined') return 'light';
  return matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * Calls back whenever the machine's preference flips. Every window subscribes,
 * not just the first one: a detached console pane on a second monitor is its own
 * document and has to repaint itself.
 */
export function watchSystemAppearance(onChange: () => void): () => void {
  if (typeof matchMedia === 'undefined') return () => undefined;
  const query = matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

/** Applies a RESOLVED theme to one document. Never an appearance — `data-theme`
 *  has no third value, and `[data-theme='system']` matches nothing. */
export function applyAppearance(doc: Document, theme: ResolvedAppearance): void {
  doc.documentElement.setAttribute('data-theme', theme);
}
