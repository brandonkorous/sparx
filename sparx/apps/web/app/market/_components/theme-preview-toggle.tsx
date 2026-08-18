'use client';

// The DETAIL-page light/dark control for a live theme preview (docs/118). The scoped
// stylesheet already carries BOTH palettes (light on `.tp-<slug>`, dark on its
// `[data-theme="dark"]`), so switching modes only flips the wrapper's `data-theme` —
// no recompute. Kept minimal on purpose: the CSS is built on the SERVER and passed in,
// and the sample surface arrives as server-rendered `children`, so this island ships
// only the toggle's state + markup, not the theming code.

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@wizeworks/silicaui-react';

export interface ThemePreviewToggleProps {
  /** The `.tp-<slug>` scope class the server built the stylesheet against. */
  scope: string;
  /** The scoped stylesheet (light + dark), prebuilt server-side. */
  css: string;
  /** Google-Fonts href for the theme's faces, or null. */
  fontsHref: string | null;
  /** Whether the theme states a dark palette (else the toggle is hidden). */
  hasDark: boolean;
  /** The server-rendered sample surface. */
  children: ReactNode;
}

export function ThemePreviewToggle({
  scope,
  css,
  fontsHref,
  hasDark,
  children,
}: ThemePreviewToggleProps) {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  return (
    <div className="flex flex-col gap-3">
      {hasDark ? (
        <div className="border-base-300 inline-flex items-center gap-1 self-end rounded-full border p-1">
          {/* Selection is a FILLED shape in a real color, not a soft grey tint
              (RULE #4). The half that is on wears `primary`; the half that is
              off is a neutral ghost, which is the dismiss half of a pair and one
              of the places neutral is genuinely earned. */}
          <Button
            size="sm"
            color={mode === 'light' ? 'primary' : 'neutral'}
            variant={mode === 'light' ? 'solid' : 'ghost'}
            onClick={() => setMode('light')}
            aria-pressed={mode === 'light'}
          >
            Light
          </Button>
          <Button
            size="sm"
            color={mode === 'dark' ? 'primary' : 'neutral'}
            variant={mode === 'dark' ? 'solid' : 'ghost'}
            onClick={() => setMode('dark')}
            aria-pressed={mode === 'dark'}
          >
            Dark
          </Button>
        </div>
      ) : null}
      {fontsHref ? <link rel="stylesheet" href={fontsHref} /> : null}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="border-base-300 w-full overflow-hidden rounded-xl border">
        <div className={`${scope} bg-base-100 w-full overflow-hidden`} data-theme={mode}>
          {children}
        </div>
      </div>
    </div>
  );
}
