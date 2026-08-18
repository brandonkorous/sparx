// Appearance for the console.
//
// The MECHANISM lives in @piggles/ui (`src/appearance.ts`) and is shared with the
// marketing site and the account app — one rule, one vocabulary, one set of
// bugs to fix. Read that file for why `system` is the default, why it follows
// the machine live, and why <html> must never carry `data-theme` as a JSX prop.
//
// What is genuinely the console's own, and all that is left here:
//
//  • THE STORAGE KEY. `sparx-workbench-theme` in a Piggles customer's browser is
//    a small leak, but it is a real one — devtools, an exported profile, a
//    support session sharing a screen.
//
//  • THE CHANNEL. Appearance rides the console's EXISTING cross-window bus
//    (lib/bus.ts) rather than a second one, because the console is the only
//    Piggles surface with more than one window to keep in step: a torn-off pane
//    is a separate `document` with its own React root, so changing the
//    appearance here has to reach every popout. The bus already carries
//    `theme.changed`; the shared hook posts and reads exactly that shape.

import { appearanceScript, type Appearance, type ResolvedAppearance } from '@piggles/ui';

/** What the person picked. `system` is the default and is not a theme. */
export type ThemeChoice = Appearance;

/** What a choice resolves to — the only thing `data-theme` ever holds. */
export type Theme = ResolvedAppearance;

export const THEME_STORAGE_KEY = 'piggles-console-theme';

/**
 * Runs before paint in every window (main and popout) to avoid a flash of the
 * wrong appearance. A string so it can be injected two ways: via next/script
 * `beforeInteractive` in the server HTML for the main window, and via a literal
 * <script> written into a popout's document at open time.
 */
export const THEME_INIT_SCRIPT = appearanceScript(THEME_STORAGE_KEY);
