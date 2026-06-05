// The in-repo blueprint catalog (docs/54 §9). Phase 1 ships one flagship; the
// marketplace later promotes these manifests into the `blueprint_versions` table
// so new templates publish without a deploy. Until then this registry is the
// source of truth the (future) installer + marketplace read from.

import type { Blueprint, BlueprintSummary } from './manifest';
import { toSummary } from './manifest';
import { retailStoreBlog } from './blueprints/retail-store-blog';

/** Every shipped blueprint, keyed by its stable `key`. */
export const BLUEPRINTS: Readonly<Record<string, Blueprint>> = {
  [retailStoreBlog.key]: retailStoreBlog,
};

/** One blueprint by key, or null. */
export function getBlueprint(key: string): Blueprint | null {
  return BLUEPRINTS[key] ?? null;
}

/** All blueprints (full manifests). */
export function listBlueprints(): Blueprint[] {
  return Object.values(BLUEPRINTS);
}

/** The catalog-row view for every blueprint — what a marketplace browse renders. */
export function listBlueprintSummaries(): BlueprintSummary[] {
  return listBlueprints().map(toSummary);
}
