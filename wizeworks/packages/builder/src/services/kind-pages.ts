// A page for each content KIND that has a web address — "Each article".
//
// The five record pages (`ensureRecordPagesTx`) come from a fixed list. A kind's page
// cannot: the kinds are the tenant's own, made and renamed in the content screens, and
// each one names its own address. So this reads the tenant's kinds and gives every one
// that can be served a page at its address, on the same read and with the same
// idempotence as the record pages. A kind with no page still renders on the live site,
// from the same composite this seeds; the page is what lets the owner open it and make
// it look the way she wants.

import { createHash } from 'node:crypto';

import {
  contentSiteVisibilityWhere,
  type BuilderPage,
  type Prisma,
  type TxClient,
} from '@wizeworks/db';
import { blankPageTree } from '@wizeworks/builder-schemas';
import { makePage, stampTree, stripIds, type Node } from '@wizeworks/silicaui-html';
import {
  contentKindPage,
  contentKindPageName,
  kindAddressAt,
  kindAddressFromPattern,
  type ContentKindLike,
  type KindAddress,
} from '@wizeworks/silica-catalog';

import type { PropertyContext } from '../errors';
import { canonicalJson } from './artifact-service';

/** A kind with an address its pieces can be served at. */
export interface ServedKind extends ContentKindLike {
  address: KindAddress;
}

/** The columns {@link kindPagePlan} decides from. */
export type KindPageRow = Pick<BuilderPage, 'id' | 'slug' | 'kind' | 'recordType' | 'position'>;

export interface KindPagePlan {
  /** Kinds with no page at all — created at their address. */
  creates: ServedKind[];
  /** Kind pages whose kind moved to a new address — the page moves with it. */
  moves: { id: string; slug: string }[];
  /** The `position` the first created page takes. */
  nextPosition: number;
}

/** The record type a kind's page renders — `cms.article`, the same key the blog post
 *  page uses for the built-in kind (`cms.blog_post`). */
export function kindRecordType(key: string): string {
  return `cms.${key}`;
}

const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

const normalize = (slug: string | null | undefined): string => (slug ?? '').replace(/^\/+/, '');

/**
 * Which kinds need a page, and which kind pages need to follow their kind.
 *
 * Pure and exported for tests, like `recordPagePlan`. Measured against EVERY row, so a
 * create never collides on `(tenant_id, property_id, slug)`: a kind whose address another
 * page already holds is skipped rather than written over. A page whose slug is not a
 * kind address any more (somebody else's design, an older import) is left where it is.
 */
export function kindPagePlan(
  rows: readonly KindPageRow[],
  kinds: readonly ServedKind[]
): KindPagePlan {
  const occupied = new Set(rows.map((r) => normalize(r.slug)));
  const creates: ServedKind[] = [];
  const moves: KindPagePlan['moves'] = [];
  for (const kind of kinds) {
    const recordType = kindRecordType(kind.key);
    const target = normalize(kind.address.slug);
    const page = rows.find((r) => r.kind === 'collection' && r.recordType === recordType);
    if (!page) {
      if (occupied.has(target)) continue;
      occupied.add(target);
      creates.push(kind);
      continue;
    }
    const current = normalize(page.slug);
    if (current === target || occupied.has(target)) continue;
    if (page.slug && !kindAddressAt(page.slug)) continue;
    occupied.delete(current);
    occupied.add(target);
    moves.push({ id: page.id, slug: kind.address.slug });
  }
  return {
    creates,
    moves,
    nextPosition: Math.max(0, ...rows.map((r) => r.position)) + 1,
  };
}

interface KindRow {
  key: string;
  name: string;
  pluralName: string;
  urlPattern: string | null;
  schemaJson: unknown;
  isBuiltIn: boolean;
  propertyId: string | null;
}

/**
 * The kinds this site serves pieces of.
 *
 * A kind the tenant made is served as soon as it has an address. A built-in kind
 * (Event, Job posting, …) only once it has a piece on the site: every tenant sees the
 * built-ins, and seeding seven pages for kinds nobody uses would bury the pages they do.
 * A kind scoped to another of the tenant's sites is not this site's. A tenant's own
 * kind shadows the built-in of the same key, as it does in the binding picker.
 */
export async function servedKindsTx(tx: TxClient, propertyId: string): Promise<ServedKind[]> {
  const rows: KindRow[] = await tx.contentType.findMany({
    where: { isSingleton: false, OR: [{ propertyId: null }, { propertyId }] },
    orderBy: [{ isBuiltIn: 'asc' }, { key: 'asc' }],
    select: {
      key: true,
      name: true,
      pluralName: true,
      urlPattern: true,
      schemaJson: true,
      isBuiltIn: true,
      propertyId: true,
    },
  });
  const seen = new Set<string>();
  const served: ServedKind[] = [];
  for (const row of rows) {
    if (seen.has(row.key)) continue;
    seen.add(row.key);
    const address = kindAddressFromPattern(row.urlPattern);
    if (!address) continue;
    if (row.isBuiltIn) {
      const used = await tx.contentEntry.count({
        where: { typeKey: row.key, deletedAt: null, ...contentSiteVisibilityWhere(propertyId) },
      });
      if (used === 0) continue;
    }
    const fields = (row.schemaJson as { fields?: ContentKindLike['fields'] } | null)?.fields ?? [];
    served.push({ key: row.key, name: row.name, pluralName: row.pluralName, fields, address });
  }
  return served;
}

/* ── An untouched kind page follows its kind ─────────────────────────────────
 *
 * The page is composed from the kind's fields when it is made. A journal that later
 * adds a field, or turns "Photograph by" into a credit to one of its authors, would
 * otherwise keep a page that never shows the change, with nothing to say why. So the
 * page carries the fingerprint of what the platform made (`data-kind-page` on its root).
 * While the page still matches it, nobody has touched it, and it is remade from the
 * kind as it is now. Once the owner edits it, it is hers. Only the DRAFT is remade:
 * visitors see the change when she publishes, and the Publish screen says so. */

const SEED_ATTR = 'data-kind-page';

/** What the platform made, without ids and without the fingerprint itself. */
export function kindPageFingerprint(tree: Node): string {
  const bare = stripIds(tree);
  if (bare.kind === 'element' && bare.attrs) {
    const { [SEED_ATTR]: _seed, ...rest } = bare.attrs;
    void _seed;
    if (Object.keys(rest).length > 0) bare.attrs = rest;
    else delete bare.attrs;
  }
  return createHash('sha256').update(canonicalJson(bare), 'utf8').digest('hex').slice(0, 32);
}

/** A kind's page as the platform makes it, fingerprinted and stamped. */
export function seededKindPage(kind: ContentKindLike): Node {
  const tree = contentKindPage(kind);
  if (tree.kind === 'element') {
    tree.attrs = { ...tree.attrs, [SEED_ATTR]: kindPageFingerprint(tree) };
  }
  return stampTree(tree);
}

/** Is this a kind page exactly as the platform made it? */
export function isUntouchedKindPage(stored: unknown): boolean {
  if (!stored || typeof stored !== 'object') return false;
  const tree = stored as Node;
  const seed = tree.kind === 'element' ? tree.attrs?.[SEED_ATTR] : undefined;
  return typeof seed === 'string' && kindPageFingerprint(tree) === seed;
}

/** The page remade from the kind as it is now, or null when the owner has edited it or
 *  it already matches. */
export function kindPageRefresh(stored: unknown, kind: ContentKindLike): Node | null {
  if (!isUntouchedKindPage(stored)) return null;
  const seed = (stored as { attrs?: Record<string, unknown> }).attrs?.[SEED_ATTR];
  if (kindPageFingerprint(contentKindPage(kind)) === seed) return null;
  return seededKindPage(kind);
}

/** Remake every untouched kind page whose kind has changed. True when it wrote. */
async function refreshKindPagesTx(
  tx: TxClient,
  ctx: PropertyContext,
  kinds: readonly ServedKind[]
): Promise<boolean> {
  const pages = await tx.builderPage.findMany({
    where: {
      propertyId: ctx.propertyId,
      kind: 'collection',
      recordType: { in: kinds.map((k) => kindRecordType(k.key)) },
    },
    select: { id: true, recordType: true, silicaDraftTree: true },
  });
  let wrote = false;
  for (const page of pages) {
    const kind = kinds.find((k) => kindRecordType(k.key) === page.recordType);
    const next = kind ? kindPageRefresh(page.silicaDraftTree, kind) : null;
    if (!next) continue;
    await tx.builderPage.update({
      where: { id: page.id },
      data: { silicaDraftTree: asJson(next) },
    });
    wrote = true;
  }
  return wrote;
}

/** Give this property a page for each kind it serves; move kind pages whose kind's
 *  address changed; remake untouched ones whose kind changed. True when it wrote. */
export async function ensureKindPagesTx(tx: TxClient, ctx: PropertyContext): Promise<boolean> {
  const kinds = await servedKindsTx(tx, ctx.propertyId);
  if (kinds.length === 0) return false;
  // EVERY row, not just silica ones: the unique index is on all of them.
  const rows = await tx.builderPage.findMany({
    where: { propertyId: ctx.propertyId },
    select: { id: true, slug: true, kind: true, recordType: true, position: true },
  });
  const plan = kindPagePlan(rows, kinds);
  const refreshed = await refreshKindPagesTx(tx, ctx, kinds);
  if (plan.creates.length === 0 && plan.moves.length === 0) return refreshed;

  for (const { id, slug } of plan.moves) {
    await tx.builderPage.update({ where: { id }, data: { slug } });
  }
  let position = plan.nextPosition;
  for (const kind of plan.creates) {
    const page = makePage(contentKindPageName(kind), kind.address.slug, seededKindPage(kind));
    await tx.builderPage.create({
      data: {
        id: page.id,
        tenantId: ctx.tenantId,
        propertyId: ctx.propertyId,
        name: page.name,
        kind: 'collection',
        recordType: kindRecordType(kind.key),
        slug: kind.address.slug,
        draftTree: asJson(blankPageTree()),
        silicaDraftTree: asJson(page.root),
        position: position++,
      },
    });
  }
  return true;
}
