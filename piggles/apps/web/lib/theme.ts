// Light, dark, or the visitor's own machine — decided once and in one place.
//
// The MECHANISM lives in @piggles/ui (`src/appearance.ts`) and is shared with the
// account app and the console, so all three Piggles surfaces offer the same
// three choices, in the same words, with the same default. Read that file for
// why `system` is the default, why it follows the machine live, and why <html>
// must never carry `data-theme` as a JSX prop.
//
// What is this app's own is the storage key — localStorage is per origin, so the
// three surfaces cannot share one anyway — and the channel name, which lets two
// open tabs of the marketing site agree without any machinery of their own.
//
// The script below runs BEFORE the first paint, in <head>, which is the only
// moment that can stop a dark-mode visitor being shown a white page for a frame.
// Anything React does — an effect, a provider, a cookie read on the server — is
// necessarily later than that, so it is a raw string rather than a component.

import { appearanceScript, type Appearance, type ResolvedAppearance } from '@piggles/ui';

/** What the visitor picked. `system` is the default and is not a theme. */
export type ThemeChoice = Appearance;

/** What that resolves to — the only thing `data-theme` ever holds. */
export type Theme = ResolvedAppearance;

export const THEME_KEY = 'piggles-theme';

/** Two open tabs of this site keep the same appearance. Named for the site, so
 *  it can never collide with the console's bus on a shared localhost origin
 *  during development. */
export const THEME_CHANNEL = 'piggles-web-appearance';

/** Chosen, or the operating system's preference, in that order. Wrapped in
 *  try/catch inside: reading localStorage throws outright in some privacy modes,
 *  and an appearance is not worth a blank page. */
export const THEME_SCRIPT = appearanceScript(THEME_KEY);
