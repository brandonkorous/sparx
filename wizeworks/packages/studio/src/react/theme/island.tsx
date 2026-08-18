'use client';

// A patch of the theme being edited, sitting inside the console's own chrome.
//
// Everything that shows what a theme LOOKS like goes through this: the swatch on
// a color tile, the shape beside a corner slider, the whole brand board. Inside
// it, ordinary token classes (`bg-primary`, `rounded-box`) resolve to the theme
// under edit rather than the console's, because `ThemeStylesheet` has scoped that
// theme's tokens to this attribute.
//
// `data-theme` is always explicit. silica emits the dark delta under both
// `[data-theme="dark"]` AND a `prefers-color-scheme` media query for anything not
// marked light — so an island that omitted it would flip to the theme's night
// colors on an operator whose OS is dark, while the switch above it still said
// Daytime.

import type { ReactNode } from 'react';
import { buildSilicaThemeCssFromTheme } from '@wizeworks/site-themes';
import { buildCustomColorCss, buildDerivedContentCss } from '@wizeworks/silica-catalog';
import { SEMANTIC_ROLES, type Theme } from '@wizeworks/silicaui-html';
import type { ThemeMode } from './edit-context';

/** The attribute every island carries, and the stylesheet's scope. */
export const ISLAND_ATTRIBUTE = 'data-studio-theme-preview';

const SCOPE = `[${ISLAND_ATTRIBUTE}]`;

/**
 * One stylesheet for every island on the pane. Mount it once, high up.
 *
 * Three parts, and all three are needed for the board to be the truth:
 *
 *   1. the theme's own tokens;
 *   2. the MEASURED `-content` for every role that does not author one, so the ink
 *      the board paints is the ink the editor recommends rather than silicaui's
 *      last-resort lightness approximation;
 *   3. the component and utility rules for any color the author INVENTED, which no
 *      build-time `@plugin { colors: … }` list could have carried.
 *
 * `registered` is silicaui's own eight and nothing else: a role beyond them may or
 * may not be in the consuming app's bundle, and generating a rule it already has
 * costs a few bytes, while skipping one it lacks paints nothing at all.
 */
export function ThemeStylesheet({ theme }: { theme: Theme }) {
  return (
    <style>
      {buildSilicaThemeCssFromTheme(theme, { rootSelector: SCOPE }) +
        buildDerivedContentCss(theme, { rootSelector: SCOPE }) +
        buildCustomColorCss(theme, { rootSelector: SCOPE, registered: SEMANTIC_ROLES })}
    </style>
  );
}

export function ThemeIsland({
  mode,
  className,
  children,
}: {
  mode: ThemeMode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div {...{ [ISLAND_ATTRIBUTE]: '' }} data-theme={mode} className={className}>
      {children}
    </div>
  );
}

/** The same island as an inline element, for a swatch that sits in a row of text. */
export function ThemeChip({
  mode,
  className,
  children,
}: {
  mode: ThemeMode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span {...{ [ISLAND_ATTRIBUTE]: '' }} data-theme={mode} className={className}>
      {children}
    </span>
  );
}
