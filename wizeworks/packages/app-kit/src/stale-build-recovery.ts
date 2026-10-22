'use client';

import { useEffect, useState } from 'react';
import { isStaleBuildError, reloadOnceForStaleBuild } from './chunk-error';

// The half of an error boundary that is the same in every app: if what it caught
// means "this tab is running the build before the release", reload once to fetch
// the current one, and say so while the tab navigates away. What the boundary
// SHOWS stays the app's own; only the decision lives here, so an app that adds a
// boundary cannot forget the stale-build case or spend a budget of its own.

export interface StaleBuildRecovery {
  /** The error came from an older build: a purged chunk or an unknown action. */
  readonly stale: boolean;
  /**
   * A reload is under way, so the boundary should show a short "getting the
   * latest version" line rather than flash its fallback behind the navigation.
   * False once the shared budget refuses: the build still fails after
   * reloading, and the boundary's own recover-able screen is the right answer.
   */
  readonly reloading: boolean;
}

export function useStaleBuildRecovery(error: unknown): StaleBuildRecovery {
  const stale = isStaleBuildError(error);
  const [reloading, setReloading] = useState(stale);

  useEffect(() => {
    if (stale) setReloading(reloadOnceForStaleBuild());
  }, [error, stale]);

  return { stale, reloading: stale && reloading };
}
