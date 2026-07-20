'use client';

// The modules this operator can actually reach.
//
// Shared by every presentation — the desktop rail, the mobile drawer, and the
// launcher/command palette must never disagree about which modules exist, and
// they will the moment the gating rule is written down twice. (The launcher did
// disagree: it listed every registered surface straight out of the registry, so
// a tenant without Commerce was still offered Commerce surfaces by name.)

import { useMemo } from 'react';
import { buildNav, type NavModule } from './nav';
import { useModuleStates } from '../api/shell-data';

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

export function useVisibleNav(): NavModule[] {
  const nav = useMemo(() => buildNav(), []);
  const reachable = useReachableModules();
  const known = useKnownModules();

  return useMemo(
    () => nav.filter((entry) => moduleIsVisible(entry.module, reachable, known)),
    [nav, reachable, known]
  );
}
