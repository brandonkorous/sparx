'use client';

import { useEffect, useState } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { faMoon, faSun } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { readTheme, THEME_KEY, type Theme } from '@/lib/theme';

// Light or dark, and it remembers.
//
// ── THE STATE LIVES ON <html>, NOT IN REACT ─────────────────────────────────
//
// `data-theme` is set before first paint by the script in layout.tsx, which runs
// long before React hydrates. React reading it into state on mount and writing
// it back on click keeps one source of truth — the attribute — and means the
// button can never disagree with the page it is sitting on.
//
// The first render must therefore match the server's, or hydration mismatches:
// the state starts at the SSR default and `useEffect` corrects it after mount.
// That is one frame of a possibly-wrong icon against a whole page of wrong
// colors, which is the trade the pre-paint script exists to make.
//
// ── COLORLESS, DELIBERATELY ─────────────────────────────────────────────────
//
// No `color` prop. This is chrome — it does not distinguish A from B, it has no
// subject of its own, and it must not compete with "Get Piggles" two elements
// along, which is the one pink thing on the bar. A colorless `ghost` resolves to
// `base-content`, so it follows the very theme it is switching.
//
// ── SHAPE CARRIES IT, NOT COLOR ─────────────────────────────────────────────
//
// Sun and moon are different silhouettes, so the control reads at a glance
// without relying on a hue reaching anybody. The icon shows the theme you are
// SWITCHING TO — the one the button does — rather than the one you are in, which
// is the reading that matches the label a screen reader is given.

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => setTheme(readTheme()), []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  const flip = () => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private browsing, or storage full. The theme still changes for this
      // visit; it just will not be remembered, which is the right failure.
    }
    setTheme(next);
  };

  return (
    <Button variant="ghost" shape="circle" onClick={flip} aria-label={`Switch to ${next} mode`}>
      <Icon glyph={next === 'dark' ? faMoon : faSun} className="size-5" />
    </Button>
  );
}
