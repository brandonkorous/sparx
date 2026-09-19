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

/**
 * What a projector puts in `module` when the records belong to NO module.
 *
 * Some things a tenant owns are platform capabilities that cannot be switched
 * off. Automations are the worked example: the REST route says so in its own
 * header — "Automations are a PLATFORM CAPABILITY, not a gated module (docs/81
 * §3): there is no `automations` slug".
 *
 * The `module` field is not decoration. `searchAll` filters documents to the
 * tenant's ENABLED modules so a switched-off module's stale rows never surface,
 * which means a module NOBODY can enable matches nothing — silently, forever,
 * with the projector, the route binding and the write-time signal all correct.
 * Measured 2026-09-18 on one tenant: 57 automations and 7 websites indexed and
 * unreachable; she typed a rule's exact name and the box said her records held
 * nothing like it.
 *
 * So there is one reserved word, it lives beside the contract that uses it, and
 * the search route lets it THROUGH the module filter rather than looking it up.
 * It is deliberately not a `ModuleSlug`: it can never be enabled, disabled,
 * billed or required, and `isModuleEnabled` would answer false for it.
 *
 * Anything that is genuinely a module uses its real slug from `ALL_MODULES`.
 * Inventing a near-miss is the other half of this defect: `site` shipped as
 * `sitebuilder` when the slug is `builder`.
 */
export const PLATFORM_MODULE = 'platform';

export interface EntityProjector {
  /** Stable type tag — also the middle segment of the doc id. e.g. 'warehouse'. */
  entityType: string;
  /**
   * Owning module — used for grouping + module gating. e.g. 'commerce'.
   *
   * MUST be a real slug from `ALL_MODULES`, or `PLATFORM_MODULE` for records
   * that belong to no module. `check:search-entities` holds this, because a
   * wrong value here is invisible: everything else about the document is right
   * and it simply never appears. */
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
