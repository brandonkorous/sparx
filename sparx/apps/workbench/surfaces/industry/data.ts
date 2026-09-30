'use client';

// Industry — the line of work a business is in, which changes the wording across
// sparx and the starting setup it hands you.
//
// The list is server-owned (/v1/industry-starters): each entry is a vertical
// resolved against the account's switched-on modules, with a flag for whichever
// one is currently chosen. Picking one and applying it records the industry AND
// stamps a tailored starting setup into the enabled modules — additive only, it
// never removes anything the business has already made.

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  Car,
  Cpu,
  Dumbbell,
  Scissors,
  Shirt,
  Store,
  Utensils,
  Warehouse,
} from 'lucide-react';
import { api } from '../../lib/api/client';
import { WORKBENCH_MODULES, type WorkbenchModule } from '../../components/module-scope';

/** The dashboard-facing projection of an industry starter — mirrors
 *  `IndustryStarterView` from @wizeworks/modules (the wire shape). */
export interface IndustryStarter {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  tags: string[];
  /** Every part of sparx this starter would set up. */
  modules: string[];
  /** Of those, the ones switched on now (the rest are skipped until enabled). */
  enabledModules: string[];
  /** How many pieces of starting setup would actually apply right now. */
  applicablePresetCount: number;
  totalPresetCount: number;
  /** Whether this is the account's currently-chosen industry. */
  active: boolean;
}

export interface InstallStarterResult {
  slug: string;
  installed: { module: string; slug: string }[];
  alreadyInstalled: { module: string; slug: string }[];
  skipped: { module: string; slug: string }[];
}

const KEY = ['industry-starters'] as const;

export function useIndustryStarters() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<IndustryStarter[]>('/v1/industry-starters'),
  });
}

export function useApplyIndustry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) =>
      api.post<InstallStarterResult>(`/v1/industry-starters/${slug}/install`),
    onSuccess: () => {
      // The chosen industry flips, and the starting setup it stamps shows up
      // across other modules — so the sample-data pack that would load changes
      // too. Refresh anything that reads the industry.
      void queryClient.invalidateQueries({ queryKey: KEY });
      void queryClient.invalidateQueries({ queryKey: ['sample-data'] });
    },
  });
}

/** lucide icon for each starter's `iconKey`, resolved client-side (the wire
 *  carries a key, never a component). A missing key falls back to a storefront. */
const ICONS: Record<string, LucideIcon> = {
  shirt: Shirt,
  utensils: Utensils,
  cpu: Cpu,
  car: Car,
  scissors: Scissors,
  dumbbell: Dumbbell,
  briefcase: Briefcase,
  warehouse: Warehouse,
};

export function iconForStarter(iconKey: string): LucideIcon {
  return ICONS[iconKey] ?? Store;
}

/**
 * What this console calls a part of the platform.
 *
 * ONE table, in `lib/surfaces/nav.ts`. This file kept its own, and so did five
 * others; measured 2026-09-25, `commerce` alone had SIX names across the two
 * consoles — Sell (the Piggles rail), Selling, Online store, Online stores,
 * Store, and the raw slug — and a shop owner could meet four of them on four
 * screens. Same defect as one order reading four ways on four screens (issue
 * 260), one level up: the apps themselves.
 */
export { moduleLabel } from '../../lib/surfaces/nav';

/** The hue for a module slug. The slug IS the hue for every registered module;
 *  anything the registry does not know falls back to the platform's. */
export function moduleHue(slug: string): WorkbenchModule {
  return (WORKBENCH_MODULES as readonly string[]).includes(slug)
    ? (slug as WorkbenchModule)
    : 'platform';
}
