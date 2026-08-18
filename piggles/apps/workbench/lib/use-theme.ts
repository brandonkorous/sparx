'use client';

// The console's appearance, applied to THIS document and kept in step with every
// other window.
//
// Every window that paints console chrome mounts this exactly once — the main
// shell and each detached popout, which is a separate `document` with its own
// React root and shares nothing by reference.
//
// The behaviour is @piggles/ui's `useAppearance`, shared with the marketing site
// and the account app; this only binds it to the two things the console owns —
// its storage key and its cross-window bus. It stays a named hook of its own
// rather than the apps calling `useAppearance` directly, so a caller cannot
// quietly point the console at a different key or a different channel.

import { useAppearance, type AppearanceState } from '@piggles/ui';
import { BUS_CHANNEL } from './bus';
import { THEME_STORAGE_KEY } from './theme';

export type ConsoleTheme = AppearanceState;

export function useConsoleTheme(): ConsoleTheme {
  return useAppearance({ storageKey: THEME_STORAGE_KEY, channel: BUS_CHANNEL });
}
