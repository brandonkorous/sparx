// Light, dark, or the person's own machine.
//
// This app had no appearance system at all: <html> carried a hardcoded
// `data-theme="light"` and there was no control anywhere, so somebody who set
// the marketing site and the console to dark hit a white page in the middle —
// on the screens where they hand over a password and a card, which are the worst
// places to look like a different product.
//
// The MECHANISM lives in @piggles/ui (`src/appearance.ts`) and is shared with the
// marketing site and the console, so all three surfaces offer the same three
// choices, in the same words, with the same default. Read that file for why
// `system` is the default, why it follows the machine live, and why <html> must
// never carry `data-theme` as a JSX prop.
//
// What is this app's own is the storage key — localStorage is per origin, so the
// three surfaces cannot share one — and the channel name, which lets two open
// tabs agree.

import { appearanceScript, type Appearance, type ResolvedAppearance } from '@piggles/ui';

/** What the person picked. `system` is the default and is not a theme. */
export type ThemeChoice = Appearance;

/** What that resolves to — the only thing `data-theme` ever holds. */
export type Theme = ResolvedAppearance;

export const THEME_KEY = 'piggles-account-theme';

export const THEME_CHANNEL = 'piggles-account-appearance';

/**
 * Runs before the first paint, in <head>. That is the only moment that can stop
 * a dark-mode visitor being shown a white sign-in page for a frame; anything
 * React does is necessarily later, which is why this is a raw string rather
 * than a component.
 */
export const THEME_SCRIPT = appearanceScript(THEME_KEY);
