// The in-repo blueprint catalog (docs/54 §9). This registry is the LEGACY/fallback
// source: the runtime is data-first (docs/85) and resolves blueprints from the
// storage artifact + the thin `marketplace_blueprints` row that the ingest writes
// from the `marketplace-catalog/blueprints/<slug>/` bundles. The `/v1/blueprints`
// route only falls back to this map when the catalog table is genuinely empty (a
// fresh dev DB before the seed/ingest runs).
//
// It is intentionally EMPTY: first-party blueprints ship as marketplace-catalog
// bundles (authored per docs/guides/building-a-template.md), not as in-code
// manifests. Keep the package's schema/validation surface (`manifest.ts`,
// `validate.ts`, `refs.ts`) — the ingest and the bundle authoring both depend on
// it. Add an entry here only for a blueprint that must resolve WITHOUT a storage
// artifact (none today).

import type { Blueprint, BlueprintSummary } from './manifest';
import { toSummary } from './manifest';

/** Every shipped blueprint, keyed by its stable `key`. Empty — see the file note. */
export const BLUEPRINTS: Readonly<Record<string, Blueprint>> = {};

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
