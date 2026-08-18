// artifactService — immutable, content-addressed publish artifacts and the releases
// that name them (docs/126 §5.3, resolving docs/125 §6 + §7).
//
// The problem this fixes: publishing used to be a one-way overwrite. `silica_published_tree`
// held exactly one state — whatever was published last — so there was no answer to "what
// did the site look like yesterday", and no way back from a publish that broke something
// except re-authoring it by hand. For a non-technical owner who has just published a
// mistake to their live site, that is the worst possible moment to have no undo.
//
// Two tables, both APPEND-ONLY:
//   · builder_page_artifacts — the published bytes, addressed by SHA-256 of their
//     canonical form. Republishing an unchanged page finds the existing row, so storage
//     tracks what CHANGED rather than how often Publish was pressed.
//   · builder_releases — one row per publish, holding the manifest of hashes that made
//     up the whole site at that moment.
//
// Why the release is the restorable unit and a single page is not: `publish()` is atomic
// across pages, chrome, theme and the symbol library, and those parts are COUPLED. A page
// authored against a saved component that a later release deleted does not stand on its
// own. Rolling one page back to yesterday while the symbols stay at today reproduces
// precisely the corruption these tables exist to prevent.

import { createHash } from 'node:crypto';

import { Prisma, type TxClient } from '@wizeworks/db';
import { withTenant } from '@wizeworks/db';

import { BuilderNotFoundError, type PropertyContext } from '../errors';

/** Which of a silica `Site`'s four parts an artifact holds. `symbols` and `theme` are
 *  site-global, so their `ownerId` is the property id. */
export type ArtifactOwnerKind = 'page' | 'layout' | 'symbols' | 'theme';

/** One entry in a release manifest: which tree, and which version of it. */
export interface ManifestEntry {
  ownerKind: ArtifactOwnerKind;
  ownerId: string;
  hash: string;
}

/**
 * Deterministic JSON encoding — the thing actually hashed.
 *
 * `JSON.stringify` is NOT content-addressable on its own: it preserves insertion order,
 * so two structurally identical trees built by different code paths (a fresh author edit
 * vs. a tree round-tripped through the database) stringify differently and would hash to
 * different addresses. That would defeat the dedupe silently — storage would grow on every
 * publish and history would show phantom changes. Sorting object keys removes the only
 * degree of freedom JSON has here; array order is meaningful (it is document order) and is
 * deliberately preserved.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    // `undefined` members vanish under JSON.stringify, so they must not contribute a key
    // here either — otherwise the canonical form disagrees with what round-trips.
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/** The content address of a tree. */
export function hashTree(tree: unknown): string {
  return createHash('sha256').update(canonicalJson(tree), 'utf8').digest('hex');
}

/**
 * Record one published tree, inside the caller's transaction, and return its address.
 *
 * Insert-if-absent rather than upsert-with-update: an artifact is immutable, so the only
 * correct response to "this hash already exists" is to do nothing and reuse it. `skipDuplicates`
 * makes that a single statement and closes the race between two concurrent publishes of the
 * same content — both get the same hash back, which is the whole point of addressing by content.
 */
export async function recordArtifactTx(
  tx: TxClient,
  ctx: PropertyContext,
  ownerKind: ArtifactOwnerKind,
  ownerId: string,
  tree: unknown
): Promise<string> {
  const hash = hashTree(tree);
  await tx.builderPageArtifact.createMany({
    data: [
      {
        tenantId: ctx.tenantId,
        propertyId: ctx.propertyId,
        ownerKind,
        ownerId,
        hash,
        tree: tree as Prisma.InputJsonValue,
      },
    ],
    skipDuplicates: true,
  });
  return hash;
}

/**
 * Seal a manifest into a release, inside the caller's transaction.
 *
 * The release's own hash addresses the MANIFEST, not any one tree — it is the single value
 * identifying this state of the whole site. Sorting the entries before hashing keeps that
 * address stable regardless of the order `publish()` happened to walk the pages in, so two
 * publishes that changed nothing produce the same release hash and "nothing actually
 * changed" becomes detectable rather than another indistinguishable row.
 */
export async function createReleaseTx(
  tx: TxClient,
  ctx: PropertyContext,
  entries: ManifestEntry[],
  opts: { source?: 'publish' | 'restore'; restoredFromId?: string } = {}
): Promise<{ id: string; hash: string }> {
  const manifest = [...entries].sort((a, b) =>
    `${a.ownerKind}:${a.ownerId}` < `${b.ownerKind}:${b.ownerId}` ? -1 : 1
  );
  const hash = hashTree(manifest);
  const row = await tx.builderRelease.create({
    data: {
      tenantId: ctx.tenantId,
      propertyId: ctx.propertyId,
      hash,
      manifest: manifest as unknown as Prisma.InputJsonValue,
      pageCount: manifest.filter((e) => e.ownerKind === 'page').length,
      source: opts.source ?? 'publish',
      restoredFromId: opts.restoredFromId ?? null,
      actorId: ctx.userId ?? null,
    },
    select: { id: true, hash: true },
  });
  return row;
}

/** A release as the history list shows it. The manifest is deliberately NOT included —
 *  it can run to hundreds of entries and the list only needs the summary. */
export interface ReleaseSummary {
  id: string;
  hash: string;
  pageCount: number;
  source: string;
  restoredFromId: string | null;
  actorId: string | null;
  createdAt: string;
  /** True for the release the site is currently serving — the newest one. */
  current: boolean;
}

/** The property's publish history, newest first. */
export function listReleases(ctx: PropertyContext, limit = 50): Promise<ReleaseSummary[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderRelease.findMany({
      where: { propertyId: ctx.propertyId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      select: {
        id: true,
        hash: true,
        pageCount: true,
        source: true,
        restoredFromId: true,
        actorId: true,
        createdAt: true,
      },
    });
    return rows.map((r, i) => ({
      id: r.id,
      hash: r.hash,
      pageCount: r.pageCount,
      source: r.source,
      restoredFromId: r.restoredFromId,
      actorId: r.actorId,
      createdAt: r.createdAt.toISOString(),
      // Newest-first ordering means index 0 is live — but only on the first page of
      // results, so an offset read never mislabels a mid-history row as current.
      current: i === 0,
    }));
  });
}

/** What a restore actually did — surfaced so the UI can be specific rather than
 *  saying "restored" and leaving the author to discover the rest. */
export interface RestoreResult {
  releaseId: string;
  hash: string;
  /** Pages whose published tree was rewritten from the manifest. */
  pagesRestored: number;
  /** Pages that were live but are absent from the restored release — created after it,
   *  and therefore UNPUBLISHED by the restore. Their drafts are untouched. */
  pagesUnpublished: number;
  /** Manifest entries whose page/layout row no longer exists (deleted since). Their
   *  content survives in the artifact table but has nowhere to be restored to. */
  entriesSkipped: number;
}

/**
 * Republish a prior release.
 *
 * This publishes the old manifest FORWARD as a NEW release rather than rewinding — history
 * is append-only, so the act of undoing is itself recorded and is itself undoable. There is
 * no operation in this service that destroys a release.
 *
 * Two behaviours worth being explicit about, because both surprise people:
 *
 *   · A page that exists now but was NOT in the restored release gets UNPUBLISHED. It was
 *     created after that release, so leaving it live would mean "restore" produced a site
 *     that never existed. Only the PUBLISHED column is cleared — the author's draft is
 *     untouched, so nothing they wrote is lost and republishing brings it straight back.
 *   · A manifest entry whose page has since been DELETED is skipped. The bytes are still in
 *     the artifact table, but there is no row to restore them onto; recreating the page
 *     would resurrect something the author deliberately removed.
 *
 * Both counts come back in the result so the UI can say exactly what happened.
 */
export async function restoreRelease(
  ctx: PropertyContext,
  releaseId: string
): Promise<RestoreResult> {
  return withTenant(ctx, async (tx) => {
    const release = await tx.builderRelease.findFirst({
      where: { id: releaseId, propertyId: ctx.propertyId },
      select: { id: true, manifest: true },
    });
    if (!release) throw new BuilderNotFoundError('Release', releaseId);

    const entries = release.manifest as unknown as ManifestEntry[];
    const artifacts = await tx.builderPageArtifact.findMany({
      where: {
        propertyId: ctx.propertyId,
        OR: entries.map((e) => ({ ownerKind: e.ownerKind, ownerId: e.ownerId, hash: e.hash })),
      },
      select: { ownerKind: true, ownerId: true, hash: true, tree: true },
    });
    const treeOf = new Map(artifacts.map((a) => [`${a.ownerKind}:${a.ownerId}:${a.hash}`, a.tree]));

    const now = new Date();
    let pagesRestored = 0;
    let entriesSkipped = 0;
    const restoredPageIds: string[] = [];

    for (const e of entries) {
      const tree = treeOf.get(`${e.ownerKind}:${e.ownerId}:${e.hash}`);
      if (tree === undefined) {
        // The release names an artifact that isn't there. Only reachable if a row was
        // deleted out from under the append-only contract, so it is worth counting rather
        // than silently treating as an empty tree.
        entriesSkipped += 1;
        continue;
      }
      if (e.ownerKind === 'page') {
        // updateMany, not update: a page deleted since the release must be skipped, not throw.
        const res = await tx.builderPage.updateMany({
          where: { id: e.ownerId, propertyId: ctx.propertyId },
          data: { silicaPublishedTree: tree as Prisma.InputJsonValue, publishedAt: now },
        });
        if (res.count === 0) entriesSkipped += 1;
        else {
          pagesRestored += 1;
          restoredPageIds.push(e.ownerId);
        }
      } else if (e.ownerKind === 'layout') {
        const res = await tx.builderLayout.updateMany({
          where: { id: e.ownerId, propertyId: ctx.propertyId },
          data: { silicaPublishedTree: tree as Prisma.InputJsonValue, publishedAt: now },
        });
        if (res.count === 0) entriesSkipped += 1;
      } else if (e.ownerKind === 'symbols') {
        await tx.builderSite.updateMany({
          where: { propertyId: ctx.propertyId },
          data: { silicaPublishedSymbols: tree as Prisma.InputJsonValue, publishedAt: now },
        });
      } else {
        await tx.builderSite.updateMany({
          where: { propertyId: ctx.propertyId },
          data: { silicaPublishedTheme: tree as Prisma.InputJsonValue, publishedAt: now },
        });
      }
    }

    // A release with no theme entry meant "no authored theme was live" — restoring must
    // reproduce that, or the site keeps a theme the target release never had.
    if (!entries.some((e) => e.ownerKind === 'theme')) {
      await tx.builderSite.updateMany({
        where: { propertyId: ctx.propertyId },
        data: { silicaPublishedTheme: Prisma.DbNull },
      });
    }

    const orphaned = await tx.builderPage.updateMany({
      where: {
        propertyId: ctx.propertyId,
        id: {
          notIn: restoredPageIds.length
            ? restoredPageIds
            : // `notIn: []` matches nothing in Prisma, which would silently skip the
              // unpublish step entirely. A sentinel uuid keeps the predicate honest:
              // restore an empty release and every published page is correctly cleared.
              ['00000000-0000-0000-0000-000000000000'],
        },
        // A nullable Json column needs Prisma's runtime sentinel, not `!== null`.
        silicaPublishedTree: { not: Prisma.DbNull },
      },
      data: { silicaPublishedTree: Prisma.DbNull },
    });

    const created = await createReleaseTx(tx, ctx, entries, {
      source: 'restore',
      restoredFromId: release.id,
    });

    return {
      releaseId: created.id,
      hash: created.hash,
      pagesRestored,
      pagesUnpublished: orphaned.count,
      entriesSkipped,
    };
  });
}
