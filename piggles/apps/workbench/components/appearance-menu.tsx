'use client';

// The console's appearance control — @piggles/ui's menu, bound to this app's
// icon family.
//
// The words, the three states, the tick and the trigger's glyph logic are all in
// the shared component, so this screen says what the marketing site and the
// account app say. All that is here is which glyphs to draw and where the
// choice comes from.

import { faCheck, faDisplay, faMoon, faSun } from '@fortawesome/pro-solid-svg-icons';
import {
  AppearanceMenu as SharedAppearanceMenu,
  AppearanceMenuItems as SharedAppearanceMenuItems,
  type AppearanceGlyphs,
  type Appearance,
  type ResolvedAppearance,
} from '@piggles/ui';

export const APPEARANCE_GLYPHS: AppearanceGlyphs = {
  system: faDisplay,
  light: faSun,
  dark: faMoon,
  check: faCheck,
};

interface Props {
  choice: Appearance;
  theme: ResolvedAppearance;
  onSetTheme: (choice: Appearance) => void;
}

/** The whole control, for the desktop top bar — where appearance sits with the
 *  other whole-window preferences. */
export function AppearanceMenu({ choice, theme, onSetTheme }: Props) {
  return (
    <SharedAppearanceMenu
      choice={choice}
      theme={theme}
      onChoose={onSetTheme}
      glyphs={APPEARANCE_GLYPHS}
    />
  );
}

/** The three items alone, for the compact header's account menu — a bar the
 *  height of a thumb has no room for a second trigger. */
export function AppearanceMenuItems({ choice, theme, onSetTheme }: Props) {
  return (
    <SharedAppearanceMenuItems
      choice={choice}
      theme={theme}
      onChoose={onSetTheme}
      glyphs={APPEARANCE_GLYPHS}
    />
  );
}
