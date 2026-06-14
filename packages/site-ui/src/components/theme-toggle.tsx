'use client';

// ThemeToggle — a compact icon button that flips the tenant site between the
// light and dark theme authored in /builder/brand. It drives `[data-theme]` on
// <html> (the @sparx/site-themes mechanism, docs/33/46) and persists the choice
// in the `sparx_theme` cookie — the same contract the site's no-flash <head>
// script reads, so the next request resolves the same mode with no flash.
//
// AUTO-HIDE is the caller's job: the Builder renderer mounts this only when the
// site's appearance policy is `toggle` (both themes offered). When only one
// theme is available the node renders nothing.
//
// CLIENT component: flipping `[data-theme]` + writing a cookie is genuine browser
// state. The `inert` prop renders the button WITHOUT those side effects — for the
// dashboard editor canvas, where it's a preview and must not flip the admin
// shell's own theme.

import * as React from 'react';
import { cx } from '../utils/cx';

const COOKIE = 'sparx_theme';

export interface ThemeToggleProps {
  /** Mode to paint before the persisted choice is read on mount. Defaults to
   *  `light` (matches the layout's default `<html data-theme>`). */
  initial?: 'light' | 'dark';
  /** Render the control without side effects (no document / cookie writes) — for
   *  the editor canvas, where it's a static preview, not a live switch. */
  inert?: boolean;
  className?: string;
  'aria-label'?: string;
}

function readCookie(): 'light' | 'dark' | null {
  const m = /(?:^|;\s*)sparx_theme=(light|dark)/.exec(document.cookie);
  return m ? (m[1] as 'light' | 'dark') : null;
}

export function ThemeToggle({
  initial = 'light',
  inert = false,
  className,
  ...aria
}: ThemeToggleProps): React.ReactElement {
  const [mode, setMode] = React.useState<'light' | 'dark'>(initial);

  // Adopt whatever the no-flash script already resolved (cookie / data-theme
  // wins) so the icon matches the painted theme. Skipped when inert.
  React.useEffect(() => {
    if (inert) return;
    const current =
      (document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null) ??
      readCookie();
    if (current && current !== mode) setMode(current);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(): void {
    if (inert) return;
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    document.documentElement.setAttribute('data-theme', next);
    // 1-year cookie; Lax so it rides top-level navigations.
    document.cookie = `${COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  const next = mode === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className={cx('st-theme-toggle', className)}
      onClick={toggle}
      aria-label={aria['aria-label'] ?? `Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      {...(inert ? { tabIndex: -1, 'aria-hidden': true } : {})}
    >
      {mode === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
ThemeToggle.displayName = 'ThemeToggle';

function MoonIcon(): React.ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon(): React.ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}
