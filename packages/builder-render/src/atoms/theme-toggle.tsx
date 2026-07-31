'use client';

// ThemeToggle — flips a tenant site between the light and dark theme authored in
// the Design inspector.
//
// silicaui ships `ThemeController`, which does most of this, but persists to
// localStorage. A storefront cannot use that: the no-flash `<head>` script has to
// resolve the mode SERVER-side on the next request, and the server can't read
// localStorage. So the persisted choice must be a cookie, and that is the gap
// this fills (root CLAUDE.md RULE #1) — the mechanism differs, not the look. The
// button itself is a real silica `btn btn-ghost btn-circle`.
//
// AUTO-HIDE is the caller's job: the Builder renderer mounts this only when the
// site's appearance policy is `toggle` (both themes offered). With only one theme
// available the node renders nothing.
//
// CLIENT component: flipping `[data-theme]` and writing a cookie is genuine
// browser state. `inert` renders the button WITHOUT those side effects — for the
// editor canvas, where it is a preview and must not flip the operator's own shell.
//
// The painted theme lives on `<html data-theme>` and the cookie, not in React, so
// it is read through `useSyncExternalStore` (the supported way to adopt external
// state) rather than synced with a setState-in-effect.

import * as React from 'react';
import { buttonClasses } from '@wizeworks/silicaui-react/server';

const COOKIE = 'sparx_theme';
// Dispatched after the toggle writes the theme, so every mounted control re-reads
// the painted theme (the external store) and stays in sync.
const THEME_EVENT = 'sparx:theme';

export interface ThemeToggleProps {
  /** Mode to paint before the persisted choice is read on mount. Defaults to
   *  `light` (matching the layout's default `<html data-theme>`). */
  initial?: 'light' | 'dark';
  /** Render the control without side effects (no document / cookie writes) — for
   *  the editor canvas, where it is a static preview, not a live switch. */
  inert?: boolean;
  className?: string;
  'aria-label'?: string;
}

function readCookie(): 'light' | 'dark' | null {
  const m = /(?:^|;\s*)sparx_theme=(light|dark)/.exec(document.cookie);
  return m ? (m[1] as 'light' | 'dark') : null;
}

function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

function readPaintedTheme(fallback: 'light' | 'dark'): 'light' | 'dark' {
  return (
    (document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null) ??
    readCookie() ??
    fallback
  );
}

export function ThemeToggle({
  initial = 'light',
  inert = false,
  className,
  ...aria
}: ThemeToggleProps): React.ReactElement {
  // Server + hydration render `initial` (matching the painted markup); after
  // hydration the client snapshot adopts the cookie / data-theme the no-flash
  // script resolved. No setState-in-effect, no flash.
  const painted = React.useSyncExternalStore(
    subscribeTheme,
    () => readPaintedTheme(initial),
    () => initial
  );
  const mode = inert ? initial : painted;

  function toggle(): void {
    if (inert) return;
    const next = mode === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    // 1-year cookie; Lax so it rides top-level navigations.
    document.cookie = `${COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    // Notify every mounted control to re-read the painted theme.
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  const next = mode === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className={buttonClasses({ variant: 'ghost', shape: 'circle', className })}
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
