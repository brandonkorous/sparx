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
import {
  faBriefcase,
  faCar,
  faDumbbell,
  faMicrochip,
  faScissors,
  faShirt,
  faShop,
  faUtensils,
  faWarehouse,
} from '@fortawesome/pro-solid-svg-icons';
import type { PigglesIcon } from '@piggles/ui';

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

/** Icon for each starter's `iconKey`, resolved client-side (the wire
 *  carries a key, never a component). A missing key falls back to a storefront. */
const ICONS: Record<string, PigglesIcon> = {
  shirt: faShirt,
  utensils: faUtensils,
  cpu: faMicrochip,
  car: faCar,
  scissors: faScissors,
  dumbbell: faDumbbell,
  briefcase: faBriefcase,
  warehouse: faWarehouse,
};

export function iconForStarter(iconKey: string): PigglesIcon {
  return ICONS[iconKey] ?? faShop;
}

/**
 * What this console calls a part of the platform, and the hue it carries.
 *
 * THIS FILE USED TO KEEP ITS OWN TABLE, and it drifted the way a second copy
 * always does. It read:
 *
 *     commerce: 'Online store'   crm: 'Customers'   email: 'Email'
 *     ai: 'AI'   invoicing: 'Invoicing'   b2b: 'Wholesale'
 *
 * and shipped under the comment "a business owner reads 'Online store', never
 * 'commerce'" — which is the right instinct pointed at the wrong table. Piggles
 * has no modules and does not name them: it has APPS, and the rail four inches
 * to the left of these chips says **Sell**, **Messages**, **Connections** and
 * **Invoices**. A shop owner reading "Online store · Email · AI" on this screen
 * is reading four names for things she cannot find anywhere else in her console.
 *
 * `lib/surfaces/nav.ts` already resolves this through the brand's app registry
 * (`moduleLabels` in `lib/console/product.tsx`), and it was one import away.
 * It also exported a function of the same name, so the console had two
 * `moduleLabel`s and this pane had the one that knew nothing about the brand.
 */
export { moduleLabel } from '../../lib/surfaces/nav';

/** The hue for a module slug. The slug IS the hue for every registered module;
 *  anything the registry does not know falls back to the platform's. */
export function moduleHue(slug: string): WorkbenchModule {
  return (WORKBENCH_MODULES as readonly string[]).includes(slug)
    ? (slug as WorkbenchModule)
    : 'platform';
}
