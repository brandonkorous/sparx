// Global search synonyms. Applied to the products collection so that, e.g.,
// "turbo" also matches "turbocharger" / "turbine" / "tc". Per docs/22 §6.
//
// IMPORTANT — why GLOBAL only, not per-tenant: Typesense synonyms are a
// collection-level resource, and sparx uses ONE shared `products` collection
// partitioned by a `tenant_id` filter (not a collection per tenant). A synonym
// added for one tenant would therefore apply to every tenant's queries — a
// cross-tenant leak of tenant-configured vocabulary. So we ship a curated
// global set (diesel/auto/industrial terms that help every catalog) and do
// NOT expose per-tenant custom synonyms. True per-tenant synonyms would
// require the per-tenant-collection model (a future infra change); until then
// this is the honest, safe scope.

import type { Client } from 'typesense';

import { getClient } from './client';
import { PRODUCTS_COLLECTION } from './schemas';

export interface SynonymGroup {
  id: string;
  synonyms: string[];
}

// Multi-way synonym groups — any term in a group matches the others. Curated
// for the diesel/auto/industrial catalogs sparx serves first (Gillett Diesel
// et al.); safe and useful across every tenant's product search.
export const GLOBAL_PRODUCT_SYNONYMS: SynonymGroup[] = [
  { id: 'turbo', synonyms: ['turbo', 'turbocharger', 'turbine', 'tc'] },
  { id: 'injector', synonyms: ['injector', 'fuel injector', 'nozzle'] },
  { id: 'filter', synonyms: ['filter', 'filtration', 'strainer'] },
  { id: 'pump', synonyms: ['pump', 'pumping unit'] },
  { id: 'alternator', synonyms: ['alternator', 'generator', 'genny'] },
  { id: 'glow-plug', synonyms: ['glow plug', 'glowplug', 'heater plug'] },
  { id: 'gasket', synonyms: ['gasket', 'seal', 'o-ring', 'oring'] },
  { id: 'brake-pad', synonyms: ['brake pad', 'brake pads', 'pads', 'brake shoe'] },
];

/**
 * Upsert the global synonym set onto the products collection. Idempotent —
 * `synonyms().upsert` overwrites by id. Called by the indexer at boot right
 * after ensureSchemas (collection must exist first). Best-effort: a failure
 * is logged by the caller, never fatal — search still works without synonyms.
 */
export async function ensureSynonyms(client: Client = getClient()): Promise<{ applied: string[] }> {
  const applied: string[] = [];
  for (const group of GLOBAL_PRODUCT_SYNONYMS) {
    await client
      .collections(PRODUCTS_COLLECTION)
      .synonyms()
      .upsert(group.id, { synonyms: group.synonyms });
    applied.push(group.id);
  }
  return { applied };
}
