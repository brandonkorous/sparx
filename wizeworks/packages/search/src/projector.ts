// Projector registry (docs/39 §5).
//
// Each module contributes `EntityProjector`s — one per searchable entity type
// — that know how to (a) enumerate a tenant's record ids for a full reindex
// and (b) project one record into a `UniversalSearchDocument`. Projectors live
// in their module package (they need that package's Prisma reader + domain
// knowledge); this file owns only the SHAPE and the registry assembler, so the
// commerce-indexer can dispatch by `entity_type` without knowing any module.

import type { UniversalSearchDocument } from './schemas';

/** Minimal tenant context a projector needs. Structurally compatible with the
 *  module packages' `ServiceContext` ({ tenantId, userId? }) so they can pass
 *  theirs straight through. */
export interface ProjectorContext {
  tenantId: string;
  userId?: string;
}

export interface EntityProjector {
  /** Stable type tag — also the middle segment of the doc id. e.g. 'warehouse'. */
  entityType: string;
  /** Owning module — used for grouping + module gating. e.g. 'commerce'. */
  module: string;
  /** Enumerate this tenant's record ids for a full reindex. */
  listIdsForTenant(ctx: ProjectorContext): Promise<string[]>;
  /** Project one record → universal doc, or null if it should be removed
   *  from the index (deleted / out of retention). */
  project(ctx: ProjectorContext, id: string): Promise<UniversalSearchDocument | null>;
}

export type ProjectorRegistry = Map<string, EntityProjector>;

/** Assemble a registry keyed by `entityType`. Throws on a duplicate type so a
 *  copy-paste collision fails loudly at boot rather than silently shadowing. */
export function buildRegistry(projectors: EntityProjector[]): ProjectorRegistry {
  const registry: ProjectorRegistry = new Map();
  for (const p of projectors) {
    if (registry.has(p.entityType)) {
      throw new Error(`duplicate EntityProjector for entity_type '${p.entityType}'`);
    }
    registry.set(p.entityType, p);
  }
  return registry;
}

/** Build the `${tenantId}:${entityType}:${recordId}` universal doc id. */
export function universalId(tenantId: string, entityType: string, recordId: string): string {
  return `${tenantId}:${entityType}:${recordId}`;
}
