'use client';

// Light, dark, or match my computer — and it remembers.
//
// ── IT IS THE SAME CONTROL THE OTHER TWO APPS HAVE ──────────────────────────
//
// The words, the three states, the tick, and which glyph the trigger shows all
// come from @piggles/ui, so a visitor who signs up meets exactly this control
// again in the account app and again in the console. It was a two-state flip
// with its own copy of the mechanism, which is how the marketing site ended up
// honouring `prefers-color-scheme` while the console refused to.
//
// All that is here is which glyphs to draw — this package owns no icon set —
// and the storage key, which is per origin by necessity.
//
// ── THE STATE LIVES ON <html>, NOT IN REACT ─────────────────────────────────
//
// `data-theme` is set before first paint by the script in layout.tsx, long
// before React hydrates. The hook reads it back rather than keeping a second
// copy, so the button can never disagree with the page it is sitting on. The
// first render must match the server's, so the choice resolves one commit after
// mount — one frame of a possibly-wrong glyph against a whole page of wrong
// colors, which is the trade the pre-paint script exists to make.

import { faCheck, faDisplay, faMoon, faSun } from '@fortawesome/pro-solid-svg-icons';
import { AppearanceMenu, useAppearance, type AppearanceGlyphs } from '@piggles/ui';
import { THEME_CHANNEL, THEME_KEY } from '@/lib/theme';

const GLYPHS: AppearanceGlyphs = {
  system: faDisplay,
  light: faSun,
  dark: faMoon,
  check: faCheck,
};

export function ThemeToggle() {
  const { choice, theme, setChoice } = useAppearance({
    storageKey: THEME_KEY,
    channel: THEME_CHANNEL,
  });

  return (
    <AppearanceMenu
      choice={choice}
      theme={theme}
      onChoose={setChoice}
      glyphs={GLYPHS}
      shape="circle"
    />
  );
}
