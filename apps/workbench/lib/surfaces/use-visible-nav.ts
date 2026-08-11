'use client';

// The modules this operator can actually reach.
//
// Shared by every presentation — the desktop rail, the mobile drawer, and the
// launcher/command palette must never disagree about which modules exist, and
// they will the moment the gating rule is written down twice. (The launcher did
// disagree: it listed every registered surface straight out of the registry, so
// a tenant without Commerce was still offered Commerce surfaces by name.)

import { useMemo } from 'react';
import { Boxes } from 'lucide-react';
import { buildNav, type NavModule } from './nav';
import { getSurface, type SurfaceDefinition } from './registry';
import { useModuleStates } from '../api/shell-data';
import { useObjectTypes } from '../../surfaces/crm/object-types-data';

/**
 * The set of module slugs to show, or `null` for "don't know yet".
 *
 * Two gates, composed:
 *
 *   • `enabled` — the ACCOUNT bought it. Modules are feature flags, never
 *     tiers: a module that is off runs no workers and stores no rows, so
 *     showing it advertises a door that opens onto a 404.
 *   • `reachable` — this PERSON may open it. An owner restricting a bookkeeper
 *     to Invoicing does not want the other ten modules in their rail; the API
 *     would refuse them anyway, and a refusal is a worse way to learn that than
 *     simply not being offered.
 *
 * `reachable` is treated as true when ABSENT rather than false. It is an
 * additive field on an endpoint shared with the dashboard, so an older or
 * partial response must not blank someone's navigation — and hiding is a
 * courtesy, not the enforcement. api-rest gates every module route
 * independently; this only decides what is worth offering.
 *
 * Returns `null` while the list is loading, which callers read as "show
 * everything": a briefly too-generous rail beats navigation that pops in group
 * by group.
 */
export function useReachableModules(): Set<string> | null {
  const { data: moduleStates } = useModuleStates();

  return useMemo(() => {
    if (!moduleStates) return null;
    return new Set(
      moduleStates
        .filter((state) => state.enabled && state.reachable !== false)
        .map((state) => state.slug)
    );
  }, [moduleStates]);
}

/**
 * Whether a given module should appear at all.
 *
 * Two deliberate exceptions. 'platform' is the workbench itself and cannot be
 * turned off or restricted — Settings and the Team screen are how someone would
 * FIX a wrong restriction, so hiding them is how an account locks itself out. A
 * module the activation list has never heard of has no server flag to be
 * disabled BY, so it shows.
 */
export function moduleIsVisible(
  module: string,
  reachable: Set<string> | null,
  known: Set<string>
): boolean {
  if (module === 'platform') return true;
  if (!reachable) return true;
  if (!known.has(module)) return true;
  return reachable.has(module);
}

/** Slugs the server told us about at all — distinct from the ones it approved. */
export function useKnownModules(): Set<string> {
  const { data: moduleStates } = useModuleStates();
  return useMemo(() => new Set(moduleStates?.map((state) => state.slug)), [moduleStates]);
}

/**
 * The record types THIS business invented, as navigation rows.
 *
 * A tenant defines "Projects" and it has to appear where they will look for it,
 * which is the Customers panel beside Companies and Deals — not only behind
 * Record types → Open. Inventing something and then being unable to find it
 * again is the difference between a feature and a demo.
 *
 * Every row points at the ONE generic records surface and carries the record
 * type in `defaultParams`. Registering a surface per type would put a tenant's
 * own vocabulary into the persisted layout keys, which is where surface keys are
 * required to be stable and universal.
 *
 * Built-ins are excluded: Companies, Customers, Deals and Requests already have
 * their own purpose-built surfaces, and a second row opening a generic table of
 * the same records would be two doors into one room, one of them worse.
 */
function useTenantRecordTypeRows(): SurfaceDefinition[] {
  const { data } = useObjectTypes({ kind: 'custom' });

  return useMemo(() => {
    const base = getSurface('crm.records.list');
    if (!base) return [];
    return (data?.items ?? [])
      .filter((type) => type.archivedAt === null)
      .map((type) => ({
        ...base,
        title: type.labelPlural || type.label,
        icon: Boxes,
        section: 'Your records',
        // After every built-in section, since these are additions to a CRM that
        // already works rather than the first thing anyone looks for.
        order: 900,
        defaultParams: { objectKey: type.key },
        createSurface: undefined,
        keywords: [type.label, type.labelPlural, type.key],
      }));
  }, [data]);
}

export function useVisibleNav(): NavModule[] {
  const nav = useMemo(() => buildNav(), []);
  const reachable = useReachableModules();
  const known = useKnownModules();
  const recordTypeRows = useTenantRecordTypeRows();

  return useMemo(
    () =>
      nav
        .filter((entry) => moduleIsVisible(entry.module, reachable, known))
        .map((entry) => {
          if (entry.module !== 'crm' || recordTypeRows.length === 0) return entry;
          return {
            ...entry,
            sections: [...entry.sections, { title: 'Your records', surfaces: recordTypeRows }],
            count: entry.count + recordTypeRows.length,
          };
        }),
    [nav, reachable, known, recordTypeRows]
  );
}
