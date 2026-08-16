// Light or dark, decided once and in one place.
//
// The script below runs BEFORE the first paint, in <head>, which is the only
// moment that can stop a dark-mode visitor being shown a white page for a frame.
// Anything React does — an effect, a provider, a cookie read on the server — is
// necessarily later than that, so this is a raw string rather than a component.
//
// It is the ONE place in this app allowed to write `data-theme`; everything else
// reads it. layout.tsx renders it, theme-toggle.tsx flips it.

export const THEME_KEY = 'piggles-theme';

export type Theme = 'light' | 'dark';

/**
 * What the page is wearing right now, read off the element the script set.
 *
 * Client only, and never during render — the server has no <html> to ask, and
 * calling it while rendering would return a value the SSR markup disagrees with.
 */
export function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/**
 * Chosen, or the operating system's preference, in that order.
 *
 * Minified by hand because it ships inline on every page and there is no build
 * step that touches it. Wrapped in try/catch: reading localStorage throws
 * outright in some privacy modes, and a theme is not worth a blank page.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`;
