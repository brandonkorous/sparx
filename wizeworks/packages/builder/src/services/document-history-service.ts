// documentHistoryService — one document's own history, derived rather than stored.
//
// The site already seals a whole-site snapshot on every save (`draft-version-service`)
// and on every publish (`artifact-service`), and each one carries a MANIFEST of
// `{ownerKind, ownerId, hash}`. That manifest is all a per-document history needs:
// walk the versions oldest-first, look at one owner's hash, and every point where it
// CHANGED is a point in that document's history. No new table, no new migration, and
// no second write path that could disagree with the first.
//
// Two deliberate asymmetries, both about what an author is risking:
//
//   · DRAFT restore is offered per document. It rewrites one draft tree and nothing
//     else; visitors see nothing until a publish, so it is private and reversible.
//   · PUBLISHED rollback is NOT offered per document, and that is a decision rather
//     than an omission. `artifact-service` says why: the published parts are coupled,
//     and rolling one page back to yesterday while the saved pieces stay at today can
//     leave a page standing on a master that release never had. The published list
//     here is READ-ONLY — it answers "when did this last change for visitors" — and
//     whole-site rollback stays where it is.
//
// A SAVED PIECE is a special case worth stating: there is no per-piece artifact,
// because the site stores all its pieces in one JSON column and the manifest names
// that column as a whole. So a piece's history is derived a level deeper — the
// `symbols` artifact is loaded and the ONE entry hashed — which is why a piece can
// be restored without dragging every other piece back with it.

import { withTenant, type Prisma, type TxClient } from '@wizeworks/db';

import { BuilderNotFoundError, type PropertyContext } from '../errors';
import { captureDraftVersionTx } from './draft-version-service';
import { hashTree, type ArtifactOwnerKind, type ManifestEntry } from './artifact-service';
import { reindexTreeTx } from './node-index-service';
import type { SilicaNode } from '@wizeworks/builder-schemas';

/** Which document a history is being asked for. `symbol` is a view over the site's
 *  one symbols artifact; the other three are artifacts in their own right. */
export type DocumentOwnerKind = 'page' | 'layout' | 'theme' | 'symbol';

export interface DocumentOwner {
  kind: DocumentOwnerKind;
  /** The page/layout/piece id. For a theme, the property id — it is site-global. */
  id: string;
}

/** One point in a document's history. */
export interface DocumentVersion {
  /** The draft-version (or release) row this state was sealed in. */
  id: string;
  /** The content address of THIS document at that point. */
  hash: string;
  /** `save` · `agent` · `restore` for a draft; `publish` · `restore` for a release. */
  source: string;
  actorId: string | null;
  createdAt: string;
  /** The newest entry — what the document is right now. */
  current: boolean;
}

export interface DocumentHistory {
  drafts: DocumentVersion[];
  /** Read-only: when this document last changed for visitors. Rollback is whole-site. */
  releases: DocumentVersion[];
}

/** A manifest row, narrowed to what the walk needs. */
interface HistoryRow {
  id: string;
  manifest: ManifestEntry[];
  source: string;
  actorId: string | null;
  createdAt: Date;
}

/** Which artifact holds this document — a piece lives inside the site's symbols map. */
function artifactKindFor(kind: DocumentOwnerKind): ArtifactOwnerKind {
  return kind === 'symbol' ? 'symbols' : kind;
}

/** Which artifact id holds this document. */
function artifactIdFor(owner: DocumentOwner, propertyId: string): string {
  return owner.kind === 'page' || owner.kind === 'layout' ? owner.id : propertyId;
}

/** The manifest entry naming the artifact this document lives in, if the version had one. */
function entryFor(
  row: HistoryRow,
  owner: DocumentOwner,
  propertyId: string
): ManifestEntry | undefined {
  const kind = artifactKindFor(owner.kind);
  const id = artifactIdFor(owner, propertyId);
  return row.manifest.find((e) => e.ownerKind === kind && e.ownerId === id);
}

/** One saved piece out of a stored symbols map, or undefined when it was not in it. */
function symbolFrom(tree: unknown, id: string): unknown {
  if (!tree || typeof tree !== 'object') return undefined;
  return (tree as Record<string, unknown>)[id];
}

/**
 * The content address of ONE document at one version.
 *
 * For a page, a layout or a theme that is the manifest entry's own hash. For a saved
 * piece it is the hash of that piece's entry inside the symbols artifact — so a
 * version where a DIFFERENT piece changed does not show up as a change to this one.
 */
function documentHash(
  row: HistoryRow,
  owner: DocumentOwner,
  propertyId: string,
  trees: Map<string, unknown>
): string | undefined {
  const entry = entryFor(row, owner, propertyId);
  if (!entry) return undefined;
  if (owner.kind !== 'symbol') return entry.hash;

  const symbol = symbolFrom(trees.get(entry.hash), owner.id);
  return symbol === undefined ? undefined : hashTree(symbol);
}

/**
 * Collapse a newest-first run into the points where the document actually changed.
 *
 * The oldest row of each run wins — that is WHEN the document became this, which is
 * what someone scanning a history is looking for. Keeping the newest instead would
 * date every state to the last time anything else on the site was saved.
 */
function changePoints(rows: readonly (HistoryRow & { hash: string })[]): DocumentVersion[] {
  const kept: (HistoryRow & { hash: string })[] = [];
  // Oldest first, so "first appearance of this hash" is the natural test.
  for (const row of [...rows].reverse()) {
    if (kept.at(-1)?.hash === row.hash) continue;
    kept.push(row);
  }
  return kept.reverse().map((row, index) => ({
    id: row.id,
    hash: row.hash,
    source: row.source,
    actorId: row.actorId,
    createdAt: row.createdAt.toISOString(),
    current: index === 0,
  }));
}

/** Load the symbols artifacts a piece's history needs, keyed by hash. */
async function symbolTreesTx(
  tx: TxClient,
  ctx: PropertyContext,
  hashes: readonly string[]
): Promise<Map<string, unknown>> {
  if (!hashes.length) return new Map();
  const rows = await tx.builderPageArtifact.findMany({
    where: {
      propertyId: ctx.propertyId,
      ownerKind: 'symbols',
      ownerId: ctx.propertyId,
      hash: { in: [...new Set(hashes)] },
    },
    select: { hash: true, tree: true },
  });
  return new Map(rows.map((r) => [r.hash, r.tree] as const));
}

/** Turn a set of manifest-bearing rows into this document's own history. */
async function historyOf(
  tx: TxClient,
  ctx: PropertyContext,
  owner: DocumentOwner,
  rows: HistoryRow[]
): Promise<DocumentVersion[]> {
  const trees =
    owner.kind === 'symbol'
      ? await symbolTreesTx(
          tx,
          ctx,
          rows.flatMap((row) => entryFor(row, owner, ctx.propertyId)?.hash ?? [])
        )
      : new Map<string, unknown>();

  const withHash = rows.flatMap((row) => {
    const hash = documentHash(row, owner, ctx.propertyId, trees);
    return hash === undefined ? [] : [{ ...row, hash }];
  });
  return changePoints(withHash);
}

/**
 * One document's draft history and its published history, newest first.
 *
 * `limit` bounds the SNAPSHOTS examined, not the points returned — a document that
 * changed twice inside fifty site saves has two entries, which is the number an
 * author would expect to see.
 */
export function listDocumentHistory(
  ctx: PropertyContext,
  owner: DocumentOwner,
  limit = 100
): Promise<DocumentHistory> {
  const take = Math.min(Math.max(limit, 1), 200);
  return withTenant(ctx, async (tx) => {
    const [draftRows, releaseRows] = await Promise.all([
      tx.builderDraftVersion.findMany({
        where: { propertyId: ctx.propertyId },
        orderBy: { createdAt: 'desc' },
        take,
        select: { id: true, manifest: true, source: true, actorId: true, createdAt: true },
      }),
      tx.builderRelease.findMany({
        where: { propertyId: ctx.propertyId },
        orderBy: { createdAt: 'desc' },
        take,
        select: { id: true, manifest: true, source: true, actorId: true, createdAt: true },
      }),
    ]);

    const asRows = (rows: typeof draftRows): HistoryRow[] =>
      rows.map((r) => ({ ...r, manifest: r.manifest as unknown as ManifestEntry[] }));

    const [drafts, releases] = await Promise.all([
      historyOf(tx, ctx, owner, asRows(draftRows)),
      historyOf(tx, ctx, owner, asRows(releaseRows)),
    ]);
    return { drafts, releases };
  });
}

export interface DocumentRestoreResult {
  /** The new draft version this restore sealed — restoring is itself undoable. */
  versionId: string | null;
  /** The document's content address after the restore. */
  hash: string;
}

/**
 * Put ONE document's draft back to an earlier version.
 *
 * Only that document. A whole-site restore is a different, blunter act and it already
 * exists; this is the one an author reaches for when they know exactly which page they
 * broke. The restored state is sealed as a new version, so it is undoable like any
 * other save.
 */
export function restoreDocumentDraft(
  ctx: PropertyContext,
  owner: DocumentOwner,
  versionId: string
): Promise<DocumentRestoreResult> {
  return withTenant(ctx, async (tx) => {
    const version = await tx.builderDraftVersion.findFirst({
      where: { id: versionId, propertyId: ctx.propertyId },
      select: { id: true, manifest: true },
    });
    if (!version) throw new BuilderNotFoundError('DraftVersion', versionId);

    const row: HistoryRow = {
      id: version.id,
      manifest: version.manifest as unknown as ManifestEntry[],
      source: 'restore',
      actorId: null,
      createdAt: new Date(),
    };
    const entry = entryFor(row, owner, ctx.propertyId);
    if (!entry) throw new BuilderNotFoundError('DocumentVersion', `${owner.kind}:${owner.id}`);

    const artifact = await tx.builderPageArtifact.findFirst({
      where: {
        propertyId: ctx.propertyId,
        ownerKind: entry.ownerKind,
        ownerId: entry.ownerId,
        hash: entry.hash,
      },
      select: { tree: true },
    });
    if (!artifact) throw new BuilderNotFoundError('BuilderPageArtifact', entry.hash);

    const tree = await writeDocumentTx(tx, ctx, owner, artifact.tree);
    const created = await captureDraftVersionTx(tx, ctx, 'restore', { restoredFromId: version.id });
    return { versionId: created?.id ?? null, hash: hashTree(tree) };
  });
}

/**
 * Write one document's draft tree, and return what was written.
 *
 * A saved piece is spliced into the CURRENT symbols map rather than replacing it —
 * restoring one piece must not take every other piece back with it, and the map is
 * the only place a piece is stored.
 */
async function writeDocumentTx(
  tx: TxClient,
  ctx: PropertyContext,
  owner: DocumentOwner,
  artifactTree: Prisma.JsonValue
): Promise<unknown> {
  if (owner.kind === 'page') {
    const updated = await tx.builderPage.updateMany({
      where: { id: owner.id, propertyId: ctx.propertyId },
      data: { silicaDraftTree: artifactTree as Prisma.InputJsonValue },
    });
    if (updated.count === 0) throw new BuilderNotFoundError('BuilderPage', owner.id);
    await reindexTreeTx(tx, ctx, {
      ownerKind: 'page',
      ownerId: owner.id,
      tree: artifactTree as unknown as SilicaNode,
    });
    return artifactTree;
  }

  if (owner.kind === 'layout') {
    const updated = await tx.builderLayout.updateMany({
      where: { id: owner.id, propertyId: ctx.propertyId },
      data: { silicaDraftTree: artifactTree as Prisma.InputJsonValue },
    });
    if (updated.count === 0) throw new BuilderNotFoundError('BuilderLayout', owner.id);
    await reindexTreeTx(tx, ctx, {
      ownerKind: 'layout',
      ownerId: owner.id,
      tree: artifactTree as unknown as SilicaNode,
    });
    return artifactTree;
  }

  if (owner.kind === 'theme') {
    await tx.builderSite.updateMany({
      where: { propertyId: ctx.propertyId },
      data: { silicaDraftTheme: artifactTree as Prisma.InputJsonValue },
    });
    return artifactTree;
  }

  const symbol = symbolFrom(artifactTree, owner.id);
  if (symbol === undefined) throw new BuilderNotFoundError('Symbol', owner.id);
  const site = await tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } });
  const current = (site?.silicaDraftSymbols ?? {}) as Record<string, unknown>;
  await tx.builderSite.updateMany({
    where: { propertyId: ctx.propertyId },
    data: {
      silicaDraftSymbols: { ...current, [owner.id]: symbol } as Prisma.InputJsonValue,
    },
  });
  const root = (symbol as { root?: unknown }).root;
  if (root) {
    await reindexTreeTx(tx, ctx, {
      ownerKind: 'symbol',
      ownerId: owner.id,
      tree: root as SilicaNode,
    });
  }
  return symbol;
}
