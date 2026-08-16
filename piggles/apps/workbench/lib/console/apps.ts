'use client';

// The two app lists the chrome renders: what is on the rail, and everything
// there is. They are deliberately different questions — see ./rail.ts for why
// "on the rail" is a display choice and never an entitlement.

import { useMemo } from 'react';
import type { PigglesIcon } from '@piggles/ui';
import { APPS, appIcon, type PigglesAppDef } from '@piggles/config';
import type { PigglesGroup } from '@piggles/brand';
import { useConsoleNav, type ConsoleNavApp } from './nav';
import { isOnRail, useRailPreference } from './rail';

/**
 * The rail — every app this person can reach, minus the ones the business put
 * away.
 *
 * Filtered from `useConsoleNav()` rather than replacing it: what a person CAN
 * reach is an access question and stays where it was; this only decides what is
 * worth showing. An app in the preference that this person cannot reach was
 * never in the list to begin with, so a restriction still wins.
 */
export function useRailNav(): ConsoleNavApp[] {
  const all = useConsoleNav();
  const { data } = useRailPreference();

  return useMemo(() => {
    const chosen = data?.apps;
    if (!chosen) return all;
    return all.filter((entry) => isOnRail(entry.app.id, chosen));
  }, [all, data]);
}

/** Every app in the registry, whether or not it is on the rail. */
export interface ConsoleApp {
  app: PigglesAppDef;
  label: string;
  group: PigglesGroup;
  icon: PigglesIcon;
  /** Whether this app is on the business's rail. A DISPLAY choice — an app that
   *  is off is still fully paid for, fully working, and one tap away. */
  onRail: boolean;
  /** Whether this person can reach it at all. False means an access restriction
   *  or a provisioning gap, and putting it on the rail would show them a row
   *  that opens onto nothing. */
  available: boolean;
  /** Screens behind it, or 0 when this person cannot reach it. */
  count: number;
}

/**
 * The full catalogue — the answer to "what else is there?".
 *
 * "Not on the rail" must never read as "does not exist". Piggles has one plan
 * with everything in it, so an app the owner did not pick at signup is not
 * something they have to buy — it is something they have put away, and putting
 * it back is a tap with no price on it (RULE #2: the answer HIDES, it never
 * gates).
 *
 * Built from the REGISTRY rather than from the rail, because the whole point is
 * the apps the rail is not showing.
 */
export function useAllApps(): ConsoleApp[] {
  const live = useConsoleNav();
  const { data: rail } = useRailPreference();

  return useMemo(() => {
    const byId = new Map(live.map((entry) => [entry.app.id, entry]));
    return [...APPS]
      .sort((a, b) => a.navOrder - b.navOrder)
      .map((app) => {
        const entry = byId.get(app.id);
        return {
          app,
          label: app.label,
          group: app.group,
          icon: appIcon(app.id),
          onRail: isOnRail(app.id, rail?.apps),
          available: entry !== undefined,
          count: entry?.count ?? 0,
        };
      });
  }, [live, rail]);
}
