// draftVersionService — a restorable snapshot of the DRAFT site, sealed on every save
// (docs/126 §4.6).
//
// The publish artifacts (artifact-service) made any PUBLISHED state recoverable. This does
// the same for the DRAFT — the state the studio edits — so a save that overwrote work is no
// longer permanent. That is the safety net the concurrent-authoring model needs: the floor
// (§4.4) guarantees no page is DELETED, and this guarantees no page's CONTENT is lost either,
// because the version that held it is one row back.
//
// It reuses `builder_page_artifacts` verbatim for the trees — content-addressed, so an
// unchanged page dedupes to the existing row and a draft tree identical to a published one
// shares it. This table only names the manifest. A save that changed nothing produces the
// same manifest hash as the last version and is skipped, so history tracks real changes, not
// Save presses.
//
// Restore semantics are deliberately NON-DESTRUCTIVE (see `restoreDraftVersion`): it brings
// back the versioned content of pages that still exist, and touches nothing else — it never
// deletes a page you have since added, nor resurrects one you deleted. Least surprise for a
// non-technical owner clicking "restore", and it is itself sealed as a new version, so it is
// undoable like everything else here.

import { Prisma, withTenant, type BuilderPage, type TxClient } from '@wizeworks/db';

import { BuilderNotFoundError, type PropertyContext } from '../errors';
import { hashTree, recordArtifactTx, type ManifestEntry } from './artifact-service';

/** A silica page carries a draft tree; a legacy-only row does not. Inlined (rather than
 *  imported from site-service) so this module never forms an import cycle with the caller
 *  that wires `captureDraftVersionTx` into `sync`. */
const isSilica = (r: Pick<BuilderPage, 'silicaDraftTree'>): boolean => r.silicaDraftTree != null;

/** What produced a draft version, for the history to label + group. */
export type DraftVersionSource = 'save' | 'agent' | 'restore';

/** Retention: always keep at least the newest {@link KEEP_MIN} versions, PLUS everything
 *  saved within {@link KEEP_DAYS}. So a dormant site keeps real undo depth, and a site under
 *  heavy agent authoring keeps a full recent window without the rows growing without bound. */
const KEEP_MIN = 20;
const KEEP_DAYS = 30;

/**
 * Seal the property's CURRENT draft state as a version, inside the caller's transaction
 * (it rides `sync`'s transaction, so a rolled-back save leaves no orphan version). Returns
 * the new version, or null when there was nothing to snapshot (no silica pages) or the draft
 * is byte-identical to the last version (a no-op save — no new row).
 *
 * It walks every draft tree exactly as `publish` walks the published ones; the trees are
 * already loaded on the write path, and content-addressing keeps the writes cheap.
 */
export async function captureDraftVersionTx(
  tx: TxClient,
  ctx: PropertyContext,
  source: DraftVersionSource,
  opts: { restoredFromId?: string; now?: Date } = {}
): Promise<{ id: string; hash: string } | null> {
  const manifest: ManifestEntry[] = [];

  const allPages = await tx.builderPage.findMany({ where: { propertyId: ctx.propertyId } });
  const pages = allPages.filter(isSilica);
  // No silica draft to snapshot — an empty or legacy-only property. Nothing to version.
  if (pages.length === 0) return null;
  for (const r of pages) {
    const hash = await recordArtifactTx(tx, ctx, 'page', r.id, r.silicaDraftTree);
    manifest.push({ ownerKind: 'page', ownerId: r.id, hash });
  }

  const layout = await tx.builderLayout.findFirst({
    where: { propertyId: ctx.propertyId, isActive: true },
  });
  if (layout?.silicaDraftTree != null) {
    const hash = await recordArtifactTx(tx, ctx, 'layout', layout.id, layout.silicaDraftTree);
    manifest.push({ ownerKind: 'layout', ownerId: layout.id, hash });
  }

  const site = await tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } });
  if (site) {
    const symbolsHash = await recordArtifactTx(
      tx,
      ctx,
      'symbols',
      ctx.propertyId,
      site.silicaDraftSymbols
    );
    manifest.push({ ownerKind: 'symbols', ownerId: ctx.propertyId, hash: symbolsHash });
    // A null draft theme means "no authored theme" — recorded by its ABSENCE from the
    // manifest (mirroring publish), so restoring reproduces "brand-derived theme" exactly.
    if (site.silicaDraftTheme != null) {
      const themeHash = await recordArtifactTx(
        tx,
        ctx,
        'theme',
        ctx.propertyId,
        site.silicaDraftTheme
      );
      manifest.push({ ownerKind: 'theme', ownerId: ctx.propertyId, hash: themeHash });
    }
  }

  // Sort before hashing so the address is stable regardless of walk order — two saves that
  // changed nothing hash identically, which is how a no-op is recognized below.
  const sorted = [...manifest].sort((a, b) =>
    `${a.ownerKind}:${a.ownerId}` < `${b.ownerKind}:${b.ownerId}` ? -1 : 1
  );
  const hash = hashTree(sorted);

  const latest = await tx.builderDraftVersion.findFirst({
    where: { propertyId: ctx.propertyId },
    orderBy: { createdAt: 'desc' },
    select: { hash: true },
  });
  // Nothing changed since the last version — don't add a duplicate row (an editor Save with
  // no edits, or a re-sync of the same state).
  if (latest?.hash === hash) return null;

  const row = await tx.builderDraftVersion.create({
    data: {
      tenantId: ctx.tenantId,
      propertyId: ctx.propertyId,
      hash,
      manifest: sorted as unknown as Prisma.InputJsonValue,
      pageCount: sorted.filter((e) => e.ownerKind === 'page').length,
      source,
      restoredFromId: opts.restoredFromId ?? null,
      actorId: ctx.userId ?? null,
    },
    select: { id: true, hash: true },
  });

  await pruneDraftVersionsTx(tx, ctx, opts.now ?? new Date());
  return row;
}

/** Drop versions older than the window, keeping a recent floor so undo depth survives a
 *  dormant stretch. Rows only — the shared artifacts are content-addressed and GC'd
 *  separately (a pruned version's trees may still back a release or a newer version). */
async function pruneDraftVersionsTx(tx: TxClient, ctx: PropertyContext, now: Date): Promise<void> {
  const floor = await tx.builderDraftVersion.findMany({
    where: { propertyId: ctx.propertyId },
    orderBy: { createdAt: 'desc' },
    take: KEEP_MIN,
    select: { id: true },
  });
  const cutoff = new Date(now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000);
  await tx.builderDraftVersion.deleteMany({
    where: {
      propertyId: ctx.propertyId,
      createdAt: { lt: cutoff },
      // `floor` always contains the row we just inserted, so this notIn is never empty (the
      // Prisma `notIn: []` "matches nothing" footgun cannot bite here).
      id: { notIn: floor.map((r) => r.id) },
    },
  });
}

/** One draft version as the history list shows it. The manifest is omitted — the list only
 *  needs the summary. */
export interface DraftVersionSummary {
  id: string;
  hash: string;
  pageCount: number;
  source: string;
  restoredFromId: string | null;
  actorId: string | null;
  createdAt: string;
  /** True for the version matching the live draft right now — the newest one. */
  current: boolean;
}

/** The property's draft-save history, newest first. */
export function listDraftVersions(
  ctx: PropertyContext,
  limit = 50
): Promise<DraftVersionSummary[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderDraftVersion.findMany({
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
      current: i === 0,
    }));
  });
}

/** What a draft restore actually did, so the UI can be specific. */
export interface DraftRestoreResult {
  /** The NEW version the restore sealed (history is append-only). Null when the restore was
   *  a no-op — the draft already matched the target version. */
  versionId: string | null;
  hash: string | null;
  /** Pages whose draft body was rewritten from the version. */
  pagesRestored: number;
  /** Manifest entries whose page no longer exists (deleted since) — skipped, not resurrected. */
  entriesSkipped: number;
}

/**
 * Restore the draft to an earlier version — NON-DESTRUCTIVELY.
 *
 * It rewrites the draft trees of pages the version held that STILL EXIST, and the site-global
 * frame/theme/symbols. It deliberately does NOT:
 *   · delete pages added since the version (you would lose newer work — and the point is to
 *     lose less, not more), nor
 *   · resurrect pages deleted since (that would undo a removal the author meant).
 * So a restore brings back overwritten CONTENT without disturbing anything else, then seals
 * itself as a new `restore` version — undoable like every other save.
 */
export async function restoreDraftVersion(
  ctx: PropertyContext,
  versionId: string
): Promise<DraftRestoreResult> {
  return withTenant(ctx, async (tx) => {
    const version = await tx.builderDraftVersion.findFirst({
      where: { id: versionId, propertyId: ctx.propertyId },
      select: { id: true, manifest: true },
    });
    if (!version) throw new BuilderNotFoundError('DraftVersion', versionId);

    const entries = version.manifest as unknown as ManifestEntry[];
    const artifacts = await tx.builderPageArtifact.findMany({
      where: {
        propertyId: ctx.propertyId,
        OR: entries.map((e) => ({ ownerKind: e.ownerKind, ownerId: e.ownerId, hash: e.hash })),
      },
      select: { ownerKind: true, ownerId: true, hash: true, tree: true },
    });
    const treeOf = new Map(
      artifacts.map((a) => [`${a.ownerKind}:${a.ownerId}:${a.hash}`, a.tree] as const)
    );

    let pagesRestored = 0;
    let entriesSkipped = 0;

    for (const e of entries) {
      const tree = treeOf.get(`${e.ownerKind}:${e.ownerId}:${e.hash}`);
      if (tree === undefined) {
        // The version names an artifact that isn't there — only reachable if a row was
        // deleted out from under the append-only contract. Count rather than treat as empty.
        entriesSkipped += 1;
        continue;
      }
      if (e.ownerKind === 'page') {
        // updateMany, not update: a page deleted since the version is skipped, not thrown on.
        const res = await tx.builderPage.updateMany({
          where: { id: e.ownerId, propertyId: ctx.propertyId },
          data: { silicaDraftTree: tree as Prisma.InputJsonValue },
        });
        if (res.count === 0) entriesSkipped += 1;
        else pagesRestored += 1;
      } else if (e.ownerKind === 'layout') {
        await tx.builderLayout.updateMany({
          where: { id: e.ownerId, propertyId: ctx.propertyId },
          data: { silicaDraftTree: tree as Prisma.InputJsonValue },
        });
      } else if (e.ownerKind === 'symbols') {
        await tx.builderSite.updateMany({
          where: { propertyId: ctx.propertyId },
          data: { silicaDraftSymbols: tree as Prisma.InputJsonValue },
        });
      } else {
        await tx.builderSite.updateMany({
          where: { propertyId: ctx.propertyId },
          data: { silicaDraftTheme: tree as Prisma.InputJsonValue },
        });
      }
    }

    // A version with no theme entry meant "no authored draft theme" — reproduce that, or the
    // draft keeps a theme the target version never had.
    if (!entries.some((e) => e.ownerKind === 'theme')) {
      await tx.builderSite.updateMany({
        where: { propertyId: ctx.propertyId },
        data: { silicaDraftTheme: Prisma.DbNull },
      });
    }

    // Seal the restored state as a new version (append-only — restoring is itself undoable).
    // A restore back to the current state is a no-op and returns null; still a success.
    const created = await captureDraftVersionTx(tx, ctx, 'restore', { restoredFromId: version.id });

    return {
      versionId: created?.id ?? null,
      hash: created?.hash ?? null,
      pagesRestored,
      entriesSkipped,
    };
  });
}
