'use client';

// Industry — the line of work a business is in, which changes the wording across
// sparx and the starting setup it hands you.
//
// The list is server-owned (/v1/industry-starters): each entry is a vertical
// resolved against the account's switched-on modules, with a flag for whichever
// one is currently chosen. Picking one and applying it records the industry AND
// stamps a tailored starting setup into the enabled modules — additive only, it
// never removes anything the business has already made.

import { useMutation, useQuery, useQueryClient } from '@sparx/query';
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
import type { WorkbenchModule } from '../../components/module-scope';

/** The dashboard-facing projection of an industry starter — mirrors
 *  `IndustryStarterView` from @sparx/modules (the wire shape). */
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

/** Plain-language name for a module slug, plus the hue it carries. A business
 *  owner reads "Online store", never "commerce". */
export const MODULE_META: Record<string, { label: string; module: WorkbenchModule }> = {
  commerce: { label: 'Online store', module: 'commerce' },
  crm: { label: 'Customers', module: 'crm' },
  cms: { label: 'Content', module: 'cms' },
  email: { label: 'Email', module: 'email' },
  ai: { label: 'AI', module: 'ai' },
  scheduling: { label: 'Bookings', module: 'scheduling' },
  invoicing: { label: 'Invoicing', module: 'invoicing' },
  b2b: { label: 'Wholesale', module: 'b2b' },
  inventory: { label: 'Stock', module: 'inventory' },
  finance: { label: 'Finance', module: 'finance' },
};

export function moduleLabel(slug: string): string {
  return MODULE_META[slug]?.label ?? slug;
}

export function moduleHue(slug: string): WorkbenchModule {
  return MODULE_META[slug]?.module ?? 'platform';
}
