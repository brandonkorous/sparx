'use client';

// The account app's appearance control — @piggles/ui's menu, bound to this app's
// icon family and storage key.
//
// It is a single self-contained control rather than something the chrome threads
// state into, because this app has no shell holding client state: every screen is
// server-rendered and the four of them wear four different frames (the auth
// shell, the account page's own header row, the consent card, onboarding). A
// control that owns its own hook can be dropped into all of them without giving
// any of them a client boundary they did not have.
//
// The words, the three states and the tick come from the shared component, so
// this says exactly what the marketing site and the console say.

import { faCheck, faDisplay, faMoon, faSun } from '@fortawesome/pro-solid-svg-icons';
import { AppearanceMenu, useAppearance, type AppearanceGlyphs } from '@piggles/ui';
import { THEME_CHANNEL, THEME_KEY } from '@/lib/theme';

const GLYPHS: AppearanceGlyphs = {
  system: faDisplay,
  light: faSun,
  dark: faMoon,
  check: faCheck,
};

export function AppearanceControl() {
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
