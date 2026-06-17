'use client';

// ThemeController — switches the tenant site between light / dark / system
// (docs/46 §5.2). CLIENT component: it sets `data-theme` on a target element (the
// document root by default) and persists the choice — genuine browser state, the
// same justification as Carousel.
//
// This drives the EXACT mechanism `@sparx/site-themes` emits (docs/33,
// `buildThemeCssV2`): `:root[data-theme="dark"]` + a `prefers-color-scheme`
// fallback that an explicit `[data-theme="light"]` opts out of. So `system`
// removes the attribute (let the media query govern), `light`/`dark` set it.
//
// PERSISTENCE defaults to a **cookie** (`sparx_theme`, `light`/`dark`; `system`
// clears it) so the server resolves the same mode on the next request — this is the
// same contract the site's no-flash `<head>` script reads (apps/site/app/layout.tsx),
// making the control a drop-in for the hand-rolled `mode-toggle`. `localStorage` and
// `none` are also available.
//
// The chosen mode is external state — read via `useSyncExternalStore` (the
// React-recommended way to adopt external state) rather than a setState-in-effect.
// A module store mirrors the choice per storage key so a `persist='none'` selection
// still reflects, and multiple controllers for one key stay in sync.

import * as React from 'react';
import { cx } from '../utils/cx';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemePersist = 'cookie' | 'localStorage' | 'none';
export type ThemeControllerVariant = 'segmented' | 'select';

export interface ThemeControllerProps {
  /** Offered modes, in order. Defaults to `['light', 'dark', 'system']`. */
  modes?: ThemeMode[];
  /** Initial mode before any persisted value is read. Defaults to `system`. */
  defaultMode?: ThemeMode;
  /** Element to set `data-theme` on. Defaults to the document root (`<html>`). */
  target?: HTMLElement | null;
  /** How the choice is persisted. Defaults to `cookie` (matches the site's
   *  no-flash script). */
  persist?: ThemePersist;
  /** Cookie name / localStorage key. Defaults to `sparx_theme`. */
  storageKey?: string;
  /** Cookie lifetime in seconds. Defaults to one year. */
  cookieMaxAge?: number;
  /** Render style. Defaults to `segmented`. */
  variant?: ThemeControllerVariant;
  /** Per-mode display labels. */
  labels?: Partial<Record<ThemeMode, string>>;
  /** Fired after the mode changes. */
  onModeChange?: (mode: ThemeMode) => void;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  'aria-label'?: string;
}

const DEFAULT_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const isMode = (v: string | null): v is ThemeMode =>
  v === 'light' || v === 'dark' || v === 'system';

function applyTheme(mode: ThemeMode, el: HTMLElement): void {
  if (mode === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', mode);
}

function readPersisted(persist: ThemePersist, key: string): ThemeMode | null {
  if (persist === 'none' || typeof document === 'undefined') return null;
  if (persist === 'cookie') {
    const m = new RegExp(`(?:^|;\\s*)${key}=(light|dark|system)`).exec(document.cookie);
    return m ? (m[1] as ThemeMode) : null;
  }
  const v = window.localStorage.getItem(key);
  return isMode(v) ? v : null;
}

function writePersisted(
  persist: ThemePersist,
  key: string,
  mode: ThemeMode,
  cookieMaxAge: number
): void {
  if (persist === 'none' || typeof document === 'undefined') return;
  if (persist === 'cookie') {
    // `system` = no cookie, so the server falls back to the appearance policy.
    const maxAge = mode === 'system' ? 0 : cookieMaxAge;
    const value = mode === 'system' ? '' : mode;
    document.cookie = `${key}=${value}; path=/; max-age=${maxAge}; samesite=lax`;
    return;
  }
  if (mode === 'system') window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, mode);
}

// ── External store: the chosen mode per storage key ─────────────────────────────
// Mirrors the choice in memory so a `persist='none'` selection reflects and multiple
// controllers for one key stay in sync. `currentMode` prefers the persisted value so
// a fresh page (or another tab) is honoured over a stale in-memory entry.
const modeStore = new Map<string, ThemeMode>();
const modeListeners = new Set<() => void>();

function subscribeMode(onChange: () => void): () => void {
  modeListeners.add(onChange);
  return () => {
    modeListeners.delete(onChange);
  };
}

function currentMode(persist: ThemePersist, key: string, fallback: ThemeMode): ThemeMode {
  return readPersisted(persist, key) ?? modeStore.get(key) ?? fallback;
}

function setCurrentMode(key: string, mode: ThemeMode): void {
  modeStore.set(key, mode);
  for (const listener of modeListeners) listener();
}

export function ThemeController({
  modes = ['light', 'dark', 'system'],
  defaultMode = 'system',
  target,
  persist = 'cookie',
  storageKey = 'sparx_theme',
  cookieMaxAge = 31_536_000,
  variant = 'segmented',
  labels,
  onModeChange,
  className,
  style,
  id,
  ...aria
}: ThemeControllerProps): React.ReactElement {
  const resolveTarget = React.useCallback(
    (): HTMLElement | null =>
      target ?? (typeof document !== 'undefined' ? document.documentElement : null),
    [target]
  );

  // Server + hydration use `defaultMode` (matching the painted markup); after
  // hydration the client adopts the persisted/stored choice. No setState-in-effect.
  const mode = React.useSyncExternalStore(
    subscribeMode,
    () => currentMode(persist, storageKey, defaultMode),
    () => defaultMode
  );

  // Apply the chosen mode to the target on mount (a custom target may have no
  // no-flash script of its own). Reads the resolved choice directly — not the
  // hydration-phase `mode` — so it never clobbers an already-painted theme with the
  // default. Updating an external system with React state is the sanctioned effect.
  React.useEffect(() => {
    const el = resolveTarget();
    if (el) applyTheme(currentMode(persist, storageKey, defaultMode), el);
  }, [resolveTarget, persist, storageKey, defaultMode]);

  const select = React.useCallback(
    (next: ThemeMode) => {
      writePersisted(persist, storageKey, next, cookieMaxAge);
      setCurrentMode(storageKey, next);
      const el = resolveTarget();
      if (el) applyTheme(next, el);
      onModeChange?.(next);
    },
    [resolveTarget, persist, storageKey, cookieMaxAge, onModeChange]
  );

  const label = aria['aria-label'] ?? 'Theme';
  const labelFor = (m: ThemeMode): string => labels?.[m] ?? DEFAULT_LABELS[m];

  if (variant === 'select') {
    return (
      <select
        className={cx('st-theme-controller__select', 'st-input', className)}
        style={style}
        id={id}
        aria-label={label}
        value={mode}
        onChange={(e) => select(e.target.value as ThemeMode)}
      >
        {modes.map((m) => (
          <option key={m} value={m}>
            {labelFor(m)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('st-theme-controller', className)}
      style={style}
      id={id}
    >
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={m === mode}
          className={cx(
            'st-theme-controller__option',
            m === mode && 'st-theme-controller__option--active'
          )}
          onClick={() => select(m)}
        >
          {labelFor(m)}
        </button>
      ))}
    </div>
  );
}
ThemeController.displayName = 'ThemeController';
