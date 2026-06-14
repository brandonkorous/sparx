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
  const [mode, setMode] = React.useState<ThemeMode>(defaultMode);

  const resolveTarget = React.useCallback(
    (): HTMLElement | null =>
      target ?? (typeof document !== 'undefined' ? document.documentElement : null),
    [target]
  );

  // On mount, adopt any persisted choice and apply it.
  React.useEffect(() => {
    const el = resolveTarget();
    if (!el) return;
    const persisted = readPersisted(persist, storageKey);
    const initial = persisted ?? defaultMode;
    setMode(initial);
    applyTheme(initial, el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = React.useCallback(
    (next: ThemeMode) => {
      setMode(next);
      const el = resolveTarget();
      if (el) applyTheme(next, el);
      writePersisted(persist, storageKey, next, cookieMaxAge);
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
