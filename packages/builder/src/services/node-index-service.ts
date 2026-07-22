// nodeIndexService — maintains and queries `builder_node_index` (docs/126 §5.4).
//
// The index is a CACHE over the silica trees a property owns. It exists because the
// trees are JSONB, so "where is this symbol used?" and "what shows this product?"
// would otherwise mean loading and walking every tree in the property on every ask.
//
// Two invariants make it safe to rely on:
//   · REBUILT PER OWNER, WHOLESALE. A write deletes one owner's rows and re-inserts
//     them in the same transaction, so the index is never half-updated for a tree.
//   · DERIVED, NEVER AUTHORITATIVE. Every row is reproducible by re-walking its tree.
//     A missed rebuild costs staleness, never correctness — nothing reads the index
//     to decide what to RENDER, only to answer questions ABOUT the content.
//
// Kept out of the sync hot path's critical section in spirit: the rebuild rides the
// same transaction (so it cannot drift), but only for the owners whose trees the
// payload actually carried — which, since docs/126 Phase 0, is the pages that changed
// rather than the whole site.

import { extractNodeIndex, type NodeIndexOwnerKind } from '@sparx/builder-schemas';
import type { SilicaNode } from '@sparx/builder-schemas';
import type { TxClient } from '@sparx/db';
import { withTenant } from '@sparx/db';

import type { PropertyContext } from '../errors';

/** One tree to (re)index, identified by which store it came from. */
export interface IndexableTree {
  ownerKind: NodeIndexOwnerKind;
  /** BuilderPage.id / BuilderLayout.id / the symbol key. */
  ownerId: string;
  tree: SilicaNode;
}

/**
 * Rebuild the index for one owner, inside the caller's transaction.
 *
 * Delete-then-insert rather than a diff: the row set for a tree is small (hundreds),
 * a diff would need a stable per-row identity that a silica node without an `id`
 * cannot provide, and "replace what this owner contributed" is the only operation
 * that cannot leave a stale row behind.
 */
export async function reindexTreeTx(
  tx: TxClient,
  ctx: PropertyContext,
  { ownerKind, ownerId, tree }: IndexableTree
): Promise<void> {
  await tx.builderNodeIndex.deleteMany({
    where: { propertyId: ctx.propertyId, ownerKind, ownerId },
  });
  const rows = extractNodeIndex(tree);
  if (rows.length === 0) return;
  await tx.builderNodeIndex.createMany({
    data: rows.map((r) => ({
      tenantId: ctx.tenantId,
      propertyId: ctx.propertyId,
      ownerKind,
      ownerId,
      nodeId: r.nodeId,
      kind: r.kind,
      type: r.type,
      symbolId: r.symbolId,
      bindingEntity: r.bindingEntity,
      bindingId: r.bindingId,
    })),
  });
}

/** Drop an owner's rows — for a deleted page, layout, or symbol. */
export function dropOwnerTx(
  tx: TxClient,
  ctx: PropertyContext,
  ownerKind: NodeIndexOwnerKind,
  ownerId: string
): Promise<unknown> {
  return tx.builderNodeIndex.deleteMany({
    where: { propertyId: ctx.propertyId, ownerKind, ownerId },
  });
}

/** Where one owner's tree references a thing — the shape every where-used answer
 *  takes. `ownerId` is a page/layout id or a symbol key, per `ownerKind`. */
export interface UsagePlacement {
  ownerKind: NodeIndexOwnerKind;
  ownerId: string;
  /** The owner's author-facing NAME — the page or layout title, or the symbol key.
   *  Resolved here rather than left to the caller: every consumer of a where-used
   *  answer is about to put it in a sentence for a person ("shown on About, Home"),
   *  and a bare row id is unusable for that. Falls back to the id if the row has
   *  vanished, which is only reachable mid-delete. */
  label: string;
  /** How many nodes in that tree reference it. */
  count: number;
}

/**
 * Attach author-facing names to a grouped where-used result.
 *
 * Two extra queries at most, both keyed by id, and only for the owners that actually
 * matched — which is normally a handful. Doing it here keeps every caller from
 * reimplementing the same join, and keeps the "symbol owners are named by their own
 * key" special case in one place.
 */
async function withLabels(
  tx: TxClient,
  ctx: PropertyContext,
  rows: { ownerKind: string; ownerId: string; _count: { _all: number } }[]
): Promise<UsagePlacement[]> {
  const idsOf = (kind: string) => rows.filter((r) => r.ownerKind === kind).map((r) => r.ownerId);
  const pageIds = idsOf('page');
  const layoutIds = idsOf('layout');

  const [pages, layouts] = await Promise.all([
    pageIds.length
      ? tx.builderPage.findMany({
          where: { id: { in: pageIds }, propertyId: ctx.propertyId },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    layoutIds.length
      ? tx.builderLayout.findMany({
          where: { id: { in: layoutIds }, propertyId: ctx.propertyId },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);
  const names = new Map([...pages, ...layouts].map((r) => [r.id, r.name]));

  return rows.map((r) => ({
    ownerKind: r.ownerKind as NodeIndexOwnerKind,
    ownerId: r.ownerId,
    // A symbol owner IS its key — there is no row to look up, and the key is what
    // the author named it.
    label: r.ownerKind === 'symbol' ? r.ownerId : (names.get(r.ownerId) ?? r.ownerId),
    count: r._count._all,
  }));
}

/**
 * Where a saved component (symbol) is placed.
 *
 * This is what makes "delete this symbol" an informed decision instead of a blind
 * write — deleting a master detaches every instance across every page, and until now
 * nothing could say how many that was or where.
 *
 * Note the extractor does NOT recurse into instances, so a count here is a count of
 * PLACEMENTS, not of the master's nodes multiplied by them.
 */
export function findSymbolUsage(ctx: PropertyContext, symbolId: string): Promise<UsagePlacement[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderNodeIndex.groupBy({
      by: ['ownerKind', 'ownerId'],
      where: { propertyId: ctx.propertyId, symbolId },
      _count: { _all: true },
    });
    return withLabels(tx, ctx, rows);
  });
}

/**
 * Where a specific bound record is shown — the impact of deleting a product, a
 * collection, or a CMS entry.
 *
 * Only ENTITY pins are indexed, so this answers "which trees pin THIS record",
 * not "which trees would show it via a collection query". A record that appears
 * only through a collection source has no placement here, correctly: deleting it
 * shrinks a list rather than blanking an authored node.
 */
export function findRecordUsage(
  ctx: PropertyContext,
  entity: string,
  recordId: string
): Promise<UsagePlacement[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderNodeIndex.groupBy({
      by: ['ownerKind', 'ownerId'],
      where: { propertyId: ctx.propertyId, bindingEntity: entity, bindingId: recordId },
      _count: { _all: true },
    });
    return withLabels(tx, ctx, rows);
  });
}

/** One node type present in the property's trees, with how often it occurs. */
export interface TypeCensusRow {
  type: string;
  count: number;
}

/**
 * Every node type present across the property, most-used first.
 *
 * The queryable half of the unknown-type problem (docs/125 §2.2): an unrecognized
 * type renders as nothing, and the renderer now logs it, but "which of my pages
 * contain a type this build can't draw" was still unanswerable without walking every
 * tree. Diff this against the renderer's known set to find them.
 */
export function typeCensus(ctx: PropertyContext): Promise<TypeCensusRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderNodeIndex.groupBy({
      by: ['type'],
      where: { propertyId: ctx.propertyId },
      _count: { _all: true },
      orderBy: { _count: { type: 'desc' } },
    });
    return rows.map((r) => ({ type: r.type, count: r._count._all }));
  });
}
