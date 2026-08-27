// pageService — the Builder page catalog and draft/publish lifecycle (docs/41).
//
// One row per page (BuilderPage); the editor edits the DRAFT tree, publishing
// snapshots it. Trees are validated against @wizeworks/builder-schemas on every
// write so every transport stores the same shape. Tenant-scoped via
// withTenant() — a callsite that forgets it sees nothing (FORCE RLS).
//
// One service, many transports: REST mounts these today; MCP + Server Actions
// reuse them unchanged.

import {
  CreatePageInput,
  ReorderPagesInput,
  UpdatePageInput,
  blankPageTree,
  type BuilderNode,
  type BuilderPageDto,
  type BuilderPageKind,
  type BuilderPageSummaryDto,
  type PublishedPageDto,
} from '@wizeworks/builder-schemas';
import type { BuilderPage, Prisma } from '@wizeworks/db';
import { withTenant, type TxClient } from '@wizeworks/db';
import { starterPages, type SiteChromeOptions } from '@wizeworks/silica-catalog';
import type { Node as SilicaNode } from '@wizeworks/silicaui-html';

import { writeAuditLog } from '../audit';
import { atAddress, isLive } from './page-liveness';
import { publishBuilderEvent } from '../events';
import { invalidatePublishedStylesheet } from './surface-css-service';
import type { PropertyContext, ServiceContext } from '../errors';
import { BuilderConflictError, BuilderNotFoundError, BuilderValidationError } from '../errors';
import { getSchema } from './binding-service';
import { expandTreeForPublish } from './component-service';
import { syncFormDefinitions } from './form-definition-service';

/** The columns a SUMMARY read needs — everything but the four tree columns
 *  (docs/127 §3). `publishedTree` is excluded too: `published` is derived from it,
 *  so the boolean is computed from a cheap `publishedAt` check instead of hauling
 *  the tree back to test it for null. */
const PAGE_SUMMARY_SELECT = {
  id: true,
  name: true,
  slug: true,
  kind: true,
  recordType: true,
  recordSubtype: true,
  publishedAt: true,
  position: true,
  isDefault: true,
  // A scalar pointer at the chrome catalog, not a tree — free on a summary read.
  frameId: true,
  seoTitle: true,
  seoDescription: true,
  canonical: true,
  ogImage: true,
  noindex: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PageSummaryRow = Pick<BuilderPage, keyof typeof PAGE_SUMMARY_SELECT>;

function toSummaryDto(row: PageSummaryRow, modules: SiteChromeOptions = {}): BuilderPageSummaryDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind: row.kind as BuilderPageKind,
    recordType: row.recordType,
    recordSubtype: row.recordSubtype,
    // A page is published iff it has been published — `publishedAt` answers that
    // without reading the tree it would otherwise be tested against.
    published: row.publishedAt != null,
    live: isLive(row, modules),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    position: row.position,
    isDefault: row.isDefault,
    frameId: row.frameId,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    canonical: row.canonical,
    ogImage: row.ogImage,
    noindex: row.noindex,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDto(row: BuilderPage, modules: SiteChromeOptions = {}): BuilderPageDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind: row.kind as BuilderPageKind,
    recordType: row.recordType,
    recordSubtype: row.recordSubtype,
    // Stored validated on write; the editor depends on a well-formed tree.
    tree: row.draftTree as unknown as BuilderNode,
    published: row.publishedTree != null,
    live: isLive(row, modules),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    position: row.position,
    isDefault: row.isDefault,
    frameId: row.frameId,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    canonical: row.canonical,
    ogImage: row.ogImage,
    noindex: row.noindex,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Shared SEO read projection for the public PublishedPageDto reads. */
function publishedSeo(row: BuilderPage) {
  return {
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    canonical: row.canonical,
    ogImage: row.ogImage,
    noindex: row.noindex,
  };
}

const asSilicaJson = (tree: SilicaNode): Prisma.InputJsonValue =>
  tree as unknown as Prisma.InputJsonValue;

const asJson = (tree: BuilderNode): Prisma.InputJsonValue =>
  tree as unknown as Prisma.InputJsonValue;

// SEO text fields store null (not '') when blank, so a cleared field falls back
// to the page name on the storefront. `??` can't express this (it keeps ''), so
// this explicit empty-to-null helper carries the intent.
const emptyToNull = (v: string | null | undefined): string | null =>
  v != null && v.length > 0 ? v : null;

/** First-class link integrity (docs/51 §6): a collection template's `recordType`
 *  must name a REAL source — a tenant/platform content type or a code-defined
 *  Commerce/CRM source — so the template↔content link can't drift to a key that
 *  no longer resolves (the seed-drift bug docs/51 was written to kill). Reads the
 *  binding catalog (its own withTenant) BEFORE the caller's transaction, so it
 *  never nests transactions. */
async function assertValidRecordType(ctx: ServiceContext, recordType: string): Promise<void> {
  const { sources } = await getSchema(ctx);
  if (!sources.some((s) => s.key === recordType)) {
    throw new BuilderValidationError('Unknown record type for this template.', [
      { field: 'recordType', message: `No content type or source matches "${recordType}".` },
    ]);
  }
}

/** The HOME starter — the site-root singleton, taken from the SAME silica starter
 *  `listOrSeed` seeds and the storefront falls back to, so an injected default is
 *  identical to a freshly-seeded site's home and is editable on arrival. */
const homeStarter = (modules: SiteChromeOptions) =>
  starterPages(modules).find((p) => p.slug === '/' || p.slug === '') ?? null;

// ── WHAT COUNTS AS THE HOME PAGE ────────────────────────────────────────────
//
// A page with no address of its own IS the site root, and the store spells that
// THREE ways: a sparx-seeded home writes NULL, a blueprint-installed one writes
// `''`, and a site imported from elsewhere can carry `'/'`. Every other reader in
// the platform already knows this — siteService.getPublishedHome matches all three,
// site-lint's `addressOf` folds them together, and blueprints/capture says so in as
// many words.
//
// This file matched NULL alone, and the cost was not a missing home but an EXTRA
// one: a site whose home came from a blueprint looked home-less to `listOrSeed`,
// which duly "healed" it by injecting the starter landing page beside the real one.
// Two pages then claimed `/`, the site check flagged it, and deleting the injected
// one brought it straight back on the very next list read — a delete that reported
// success and undid itself.
const HOME_SLUGS = ['', '/'] as const;

/** The home page as a query: a slugless singleton, in any of its three spellings. */
export const homeWhere = (propertyId: string) => ({
  kind: 'singleton',
  propertyId,
  OR: [{ slug: null }, { slug: { in: [...HOME_SLUGS] } }],
});

/** The home page as a test on a row already in hand. Same rule as `homeWhere`. */
export function isHomeRow(row: { kind: string; slug: string | null }): boolean {
  return row.kind === 'singleton' && (HOME_SLUGS as readonly string[]).includes(row.slug ?? '');
}

// Inject the slugless landing singleton (the site's `/`, getPublishedHome) when the
// property has none. `listOrSeed` seeds it on an EMPTY property, but any path that
// creates pages FIRST — a blueprint shipping only collection templates, a fixture,
// or deleting the home — would otherwise leave the property permanently home-less
// (listOrSeed only seeds when the table is empty). A site with no `/` has no front
// door and the Builder can't author one. Idempotent: a no-op once a slugless
// singleton exists. Returns the row it created, or null if a home already existed.
async function ensureHomeTx(
  tx: TxClient,
  ctx: PropertyContext,
  modules: SiteChromeOptions
): Promise<BuilderPage | null> {
  const existing = await tx.builderPage.findFirst({
    where: homeWhere(ctx.propertyId),
    select: { id: true },
  });
  const starter = homeStarter(modules);
  if (existing || !starter) return null;
  // Land the home FIRST in the catalog — shift any existing pages down one.
  await tx.builderPage.updateMany({
    where: { propertyId: ctx.propertyId },
    data: { position: { increment: 1 } },
  });
  const home = await tx.builderPage.create({
    data: {
      tenantId: ctx.tenantId,
      propertyId: ctx.propertyId,
      name: starter.name,
      kind: 'singleton',
      recordType: null,
      slug: starter.slug,
      draftTree: asJson(blankPageTree()),
      silicaDraftTree: asSilicaJson(starter.root),
      position: 0,
    },
  });
  await writeAuditLog({
    tx,
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: 'user',
    action: 'builder.pages.home_ensured',
    entityType: 'BuilderPage',
    entityId: home.id,
    diff: { after: { name: home.name } },
  });
  return home;
}

/**
 * The starter pages this property holds no row for — pure and exported for tests, the
 * same way `recordPagePlan` is, so the transaction below is a transcription of the
 * answer rather than the place the answer is decided.
 *
 * Compared BY ADDRESS, not by stored slug. Both spellings are in the store and they
 * are the same page to a visitor, so an `about` row must count as holding `/about`;
 * matching on the raw string would mint a second About page beside the real one on the
 * very next list read.
 */
export function missingStarterPages(
  rows: readonly { slug: string | null }[],
  modules: SiteChromeOptions
): { name: string; slug: string; root: SilicaNode }[] {
  const held = new Set(rows.map((r) => atAddress(r.slug)));
  return starterPages(modules)
    .filter((p) => !held.has(atAddress(p.slug)))
    .map((p) => ({ name: p.name, slug: p.slug, root: p.root }));
}

/**
 * Give the property a row for every ORDINARY page its site is already serving.
 *
 * The twin of `siteService.ensureRecordPagesTx`, and it exists for the same reason.
 * The storefront falls back to the code starter PER SLUG (wizeworks/apps/site
 * lib/silica.ts `getPublishedSilicaPage` → `starterPageDtoForSlug`), so an address in
 * the starter set is LIVE whether or not the property has a page there. `listOrSeed`
 * writes the whole starter set only when the table is EMPTY, so any path that creates
 * pages first — a blueprint whose page set is narrower than the starter, a fixture, an
 * import — leaves the difference serving and unreachable: live to every visitor,
 * absent from the one screen its owner would go to to change it.
 *
 * Juniper Row is what that looks like from the owner's chair. Her blueprint shipped no
 * Journal, so `/blog` served the platform's own words — "News, notes, and what we have
 * been working on" — over her three articles, under her name, with nothing in her list
 * of pages to open (issue 274). Naming a new page "Journal" built a second, blank one
 * at `/journal`, because the address she needed was already answered by something that
 * did not exist as far as the console was concerned.
 *
 * The row carries the starter BODY, exactly as `ensureRecordPagesTx` does, so opening
 * it shows what visitors see rather than a blank page to rebuild from. Appended at the
 * end, so no existing page's position moves. Idempotent: a no-op once every starter
 * address is held.
 *
 * NOT a way to resurrect a page someone deleted on purpose — but it will, and that is
 * honest rather than a bug: deleting the row never took the address down, so a list
 * that shows it again is the first screen to tell the truth about it.
 */
async function ensureStarterPagesTx(
  tx: TxClient,
  ctx: PropertyContext,
  modules: SiteChromeOptions
): Promise<boolean> {
  const rows = await tx.builderPage.findMany({
    where: { propertyId: ctx.propertyId },
    select: { slug: true },
  });
  const missing = missingStarterPages(rows, modules);
  if (missing.length === 0) return false;

  const last = await tx.builderPage.findFirst({
    where: { propertyId: ctx.propertyId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  let position = last ? last.position + 1 : 0;
  for (const page of missing) {
    await tx.builderPage.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: ctx.propertyId,
        name: page.name,
        kind: 'singleton',
        recordType: null,
        slug: page.slug,
        // The legacy column stays EMPTY rather than absent, same as the seed above:
        // `reset` reads a null `publishedTree` as "silica-only, safe to delete".
        draftTree: asJson(blankPageTree()),
        silicaDraftTree: asSilicaJson(page.root),
        position: position++,
      },
    });
  }
  await writeAuditLog({
    tx,
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: 'user',
    action: 'builder.pages.starter_backfilled',
    entityType: 'BuilderPage',
    entityId: null,
    diff: { after: { addresses: missing.map((p) => p.slug) } },
  });
  return true;
}

/** Ensure the property has a home page (the slugless landing singleton), injecting
 *  the default starter when absent — so no provisioning path (a blueprint that
 *  ships only collection templates, a fixture, a deleted home) can leave a site
 *  without a front door. Idempotent. Returns the created page, or null if a home
 *  already existed. */
export function ensureHome(
  ctx: PropertyContext,
  modules: SiteChromeOptions = {}
): Promise<BuilderPageDto | null> {
  return withTenant(ctx, async (tx) => {
    const home = await ensureHomeTx(tx, ctx, modules);
    return home ? toDto(home) : null;
  });
}

/** List the tenant's pages. On first use (zero rows) seed the curated starter
 *  set — the lazy-materialization idiom (cf. getOrCreateConfig). Also heals a
 *  home-less property (pages but no slugless singleton) by injecting the default
 *  home, so every site that's ever opened has a `/`. Idempotent. */
export function listOrSeed(
  ctx: PropertyContext,
  modules: SiteChromeOptions = {}
): Promise<BuilderPageSummaryDto[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderPage.findMany({
      where: { propertyId: ctx.propertyId },
      select: PAGE_SUMMARY_SELECT,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    if (rows.length > 0) {
      // Pages exist, but the property may hold fewer than the site SERVES. Two ways:
      // no home at all (a blueprint that shipped only collection templates), and any
      // other starter address it never got a page for. Both are live either way, so
      // both get a row here; a re-read follows so the caller sees them in order.
      const hasHome = rows.some(isHomeRow);
      const healedHome = !hasHome && (await ensureHomeTx(tx, ctx, modules)) !== null;
      const healedStarters = await ensureStarterPagesTx(tx, ctx, modules);
      if (healedHome || healedStarters) {
        const healed = await tx.builderPage.findMany({
          where: { propertyId: ctx.propertyId },
          select: PAGE_SUMMARY_SELECT,
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        });
        return healed.map((r) => toSummaryDto(r, modules));
      }
      return rows.map((r) => toSummaryDto(r, modules));
    }

    // SILICA rows, not `STARTER_PAGES`.
    //
    // The legacy tier is being retired (`ops:retire-legacy-tier`), and this seed was
    // still minting new sites into it. A legacy-only property is half broken in a way
    // that is easy to miss because each half looks fine alone: the storefront serves
    // the code starter (only silica reaches the renderer), the editor lists the rows
    // (only silica reaches the page switcher, so each one opens EMPTY), and no screen
    // says the two are different sites. Every path that creates pages FIRST — a
    // blueprint, a fixture — already writes silica; this branch, reached by a fresh
    // property and by the one after `reset`, was the last door back into the old tier.
    //
    // Record pages are deliberately NOT seeded here: `load`'s `ensureRecordPagesTx`
    // composes them once a site exists, and seeding them from two places is how a
    // property ends up with two rows claiming `/products/:handle`.
    const starters = starterPages(modules);
    await tx.builderPage.createMany({
      data: starters.map((p, i) => ({
        tenantId: ctx.tenantId,
        propertyId: ctx.propertyId,
        name: p.name,
        kind: 'singleton',
        recordType: null,
        slug: p.slug,
        // The legacy column stays EMPTY rather than absent: `reset` reads a null
        // `publishedTree` as "silica-only, safe to delete", which is what these are.
        draftTree: asJson(blankPageTree()),
        silicaDraftTree: asSilicaJson(p.root),
        position: i,
      })),
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.pages.seeded',
      entityType: 'BuilderPage',
      entityId: null,
      diff: { after: { count: starters.length } },
    });
    const seeded = await tx.builderPage.findMany({
      where: { propertyId: ctx.propertyId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return seeded.map((r) => toDto(r, modules));
  });
}

export function get(ctx: PropertyContext, id: string): Promise<BuilderPageDto> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderPage.findFirst({ where: { id, propertyId: ctx.propertyId } });
    if (!row) throw new BuilderNotFoundError('BuilderPage', id);
    return toDto(row);
  });
}

export async function create(ctx: PropertyContext, rawInput: unknown): Promise<BuilderPageDto> {
  const input = CreatePageInput.parse(rawInput);
  if (input.recordType) await assertValidRecordType(ctx, input.recordType);
  return withTenant(ctx, async (tx) => {
    const last = await tx.builderPage.findFirst({
      where: { propertyId: ctx.propertyId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = last ? last.position + 1 : 0;
    const created = await tx.builderPage.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: ctx.propertyId,
        name: input.name,
        kind: input.kind,
        recordType: input.recordType ?? null,
        recordSubtype: input.recordSubtype ?? null,
        slug: input.slug ?? null,
        draftTree: asJson(input.tree ?? blankPageTree()),
        position,
        seoTitle: emptyToNull(input.seoTitle),
        seoDescription: emptyToNull(input.seoDescription),
        canonical: emptyToNull(input.canonical),
        ogImage: emptyToNull(input.ogImage),
        noindex: input.noindex ?? false,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.page.created',
      entityType: 'BuilderPage',
      entityId: created.id,
      diff: { before: null, after: { name: created.name, kind: created.kind } },
    });
    return toDto(created);
  });
}

/** Rename and/or save the draft tree and/or retarget. Draft-tree saves are the
 *  high-frequency autosave path — deliberately NOT audited. */
export async function update(
  ctx: PropertyContext,
  id: string,
  rawInput: unknown
): Promise<BuilderPageDto> {
  const input = UpdatePageInput.parse(rawInput);
  // Retargeting at a real source keeps the template↔content link from drifting.
  if (input.recordType) await assertValidRecordType(ctx, input.recordType);
  return withTenant(ctx, async (tx) => {
    const existing = await tx.builderPage.findFirst({
      where: { id, propertyId: ctx.propertyId },
      select: { id: true },
    });
    if (!existing) throw new BuilderNotFoundError('BuilderPage', id);

    const data: Prisma.BuilderPageUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.tree !== undefined) data.draftTree = asJson(input.tree);
    if (input.recordType !== undefined) {
      data.recordType = input.recordType;
      // A page WITH a record type IS a collection template; clearing it returns the
      // page to a routable singleton. This keeps the (kind, recordType) invariant the
      // storefront's per-record resolver relies on (it filters `kind:'collection'`),
      // so retargeting a page — including a silica page first materialized as a
      // singleton — makes it a real product/entry template with no separate control.
      data.kind = input.recordType ? 'collection' : 'singleton';
    }
    // Retarget a product page to a product TYPE (docs/143 Option B). `null` clears it to
    // the default product page; a value makes it the per-type page (resolved by subtype).
    if (input.recordSubtype !== undefined) data.recordSubtype = input.recordSubtype;
    if (input.slug !== undefined) data.slug = input.slug;
    // SEO — empty strings clear the column (store null), so the storefront falls
    // back to the page name rather than rendering an empty <title>.
    if (input.seoTitle !== undefined) data.seoTitle = emptyToNull(input.seoTitle);
    if (input.seoDescription !== undefined) data.seoDescription = emptyToNull(input.seoDescription);
    if (input.canonical !== undefined) data.canonical = emptyToNull(input.canonical);
    if (input.ogImage !== undefined) data.ogImage = emptyToNull(input.ogImage);
    if (input.noindex !== undefined) data.noindex = input.noindex;
    // Chrome. `null` RESETS to the site default; the sentinel and a layout id are both
    // stored verbatim (docs/silicaui/01 §5). Distinct from `undefined`, which leaves it alone.
    if (input.frameId !== undefined) data.frameId = input.frameId;

    try {
      const updated = await tx.builderPage.update({ where: { id }, data });
      return toDto(updated);
    } catch (err) {
      // `(tenantId, propertyId, slug)` is UNIQUE, so renaming a page onto an address
      // another page already holds is a raw P2002. The builder error mapper knows only
      // its own error classes, so that fell through as a 500 and the studio — which
      // forwards 4xx messages only — showed "Nothing was saved. Try again in a moment"
      // with nothing naming the conflict. Same fix as `siteService.sync`.
      const code = (err as { code?: string })?.code;
      const target = (err as { meta?: { target?: unknown } })?.meta?.target;
      const onSlug =
        code === 'P2002' && (Array.isArray(target) ? target.includes('slug') : target === 'slug');
      if (!onSlug) throw err;
      throw new BuilderConflictError(
        `Another page already uses the address "${input.slug}". Two pages cannot share one address.`,
        'slug'
      );
    }
  });
}

export async function remove(ctx: PropertyContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.builderPage.findFirst({ where: { id, propertyId: ctx.propertyId } });
    if (!existing) throw new BuilderNotFoundError('BuilderPage', id);
    await tx.builderPage.delete({ where: { id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.page.deleted',
      entityType: 'BuilderPage',
      entityId: id,
      diff: { before: { name: existing.name }, after: null },
    });
  });
}

/** Reorder the catalog. `orderedIds` must be exactly the tenant's page ids. */
export async function reorder(ctx: PropertyContext, rawInput: unknown): Promise<BuilderPageDto[]> {
  const input = ReorderPagesInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const owned = await tx.builderPage.findMany({
      where: { id: { in: input.orderedIds }, propertyId: ctx.propertyId },
      select: { id: true },
    });
    if (owned.length !== input.orderedIds.length) {
      throw new BuilderNotFoundError('BuilderPage', 'one or more pages');
    }
    // Sequential inside the interactive transaction (no concurrent tx queries).
    for (let i = 0; i < input.orderedIds.length; i += 1) {
      await tx.builderPage.update({ where: { id: input.orderedIds[i] }, data: { position: i } });
    }
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.pages.reordered',
      entityType: 'BuilderPage',
      entityId: null,
      diff: { after: { order: input.orderedIds } },
    });
    const rows = await tx.builderPage.findMany({
      where: { propertyId: ctx.propertyId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => toDto(r));
  });
}

/** Snapshot the draft tree into the published tree, expanding any tenant
 *  components into concrete primitives first (docs/53 §3). The publish event is
 *  emitted for the storefront render path. */
export async function publish(ctx: PropertyContext, id: string): Promise<BuilderPageDto> {
  const dto = await withTenant(ctx, async (tx) => {
    const existing = await tx.builderPage.findFirst({ where: { id, propertyId: ctx.propertyId } });
    if (!existing) throw new BuilderNotFoundError('BuilderPage', id);
    const expanded = await expandTreeForPublish(tx, existing.draftTree as unknown as BuilderNode);
    // Materialize any ContactForm's recipient addresses into server-only
    // FormDefinition rows and strip them from the tree we publish (docs/115).
    const published = await syncFormDefinitions(tx, ctx, existing.slug, expanded);
    const updated = await tx.builderPage.update({
      where: { id },
      data: {
        publishedTree: asJson(published),
        // The chrome pointer goes live with the body it wraps, matching the silica
        // site publish. Publishing one page's body while it kept the chrome of a
        // choice the author has since changed would show a shell nobody asked for.
        publishedFrameId: existing.frameId,
        publishedAt: new Date(),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.page.published',
      entityType: 'BuilderPage',
      entityId: id,
      diff: { after: { name: updated.name } },
    });
    return toDto(updated);
  });
  // Drop the memoized Surface stylesheet — this page's published tree just changed,
  // so its authored class set may have too (docs/127 §4).
  invalidatePublishedStylesheet(ctx);
  await publishBuilderEvent({
    tenantId: ctx.tenantId,
    topic: 'builder.page.published',
    payload: { pageId: dto.id, name: dto.name },
  });
  return dto;
}

/** Mark a collection template as the DEFAULT for its `recordType` (docs/51 §6) —
 *  the per-type winner the storefront resolves to when a record has no per-record
 *  override. Clears any prior default for the same recordType first, in the same
 *  transaction, so the partial unique index never trips. The page must be a
 *  collection WITH a recordType. */
export async function setDefault(ctx: PropertyContext, id: string): Promise<BuilderPageDto> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderPage.findFirst({ where: { id, propertyId: ctx.propertyId } });
    if (!row) throw new BuilderNotFoundError('BuilderPage', id);
    if (row.kind !== 'collection' || !row.recordType) {
      throw new BuilderValidationError(
        'Only a collection template that targets a record type can be made the default.'
      );
    }
    // Clear the prior default for this recordType on THIS property, then set this
    // one (one tx). Per-property: a sibling site's default is untouched.
    await tx.builderPage.updateMany({
      where: {
        propertyId: ctx.propertyId,
        recordType: row.recordType,
        isDefault: true,
        NOT: { id },
      },
      data: { isDefault: false },
    });
    const updated = await tx.builderPage.update({ where: { id }, data: { isDefault: true } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.page.set_default',
      entityType: 'BuilderPage',
      entityId: id,
      diff: { after: { recordType: row.recordType } },
    });
    return toDto(updated);
  });
}

/** The storefront read (docs/44 §2.2): the PUBLISHED tree for a page by slug, or
 *  null when no page with that slug has been published. Returns the published
 *  snapshot — never the draft. Tenant-scoped via withTenant (the public route
 *  resolves the tenant by slug first). */
export function getPublishedBySlug(
  ctx: PropertyContext,
  slug: string
): Promise<PublishedPageDto | null> {
  return withTenant(ctx, async (tx) => {
    // slug is unique per (tenant, property); RLS scopes to the tenant, propertyId
    // to the site. Filter "published" in JS — the JSON column's NULL check needs a
    // Prisma runtime value, but Prisma here is imported as a type only.
    const row = await tx.builderPage.findFirst({ where: { slug, propertyId: ctx.propertyId } });
    if (row?.publishedTree == null) return null;
    return {
      name: row.name,
      slug: row.slug ?? slug,
      kind: row.kind as BuilderPageKind,
      recordType: row.recordType,
      tree: row.publishedTree as unknown as BuilderNode,
      ...publishedSeo(row),
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  });
}

/** The storefront HOME read (docs/49 multi-site): the PUBLISHED tree for the
 *  property's home page — the singleton with NO slug (a slugless singleton is the
 *  site root `/`; a singleton WITH a slug serves at `/{slug}`). Lowest position
 *  wins if more than one exists. Null when the property has published no home, so
 *  the storefront `/` falls through to its legacy composition. Per-property: each
 *  site resolves its OWN home, so a secondary site no longer inherits another
 *  site's (or the tenant-wide snapshot's) homepage. */
export function getPublishedHome(ctx: PropertyContext): Promise<PublishedPageDto | null> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderPage.findMany({
      where: homeWhere(ctx.propertyId),
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    const row = rows.find((r) => r.publishedTree != null);
    if (row?.publishedTree == null) return null;
    return {
      name: row.name,
      slug: '',
      kind: row.kind as BuilderPageKind,
      recordType: row.recordType,
      tree: row.publishedTree as unknown as BuilderNode,
      ...publishedSeo(row),
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  });
}

/** Draft counterpart of getPublishedHome for the site-preview tab — the home
 *  singleton's unsaved DRAFT tree (no published gate). */
export function getDraftHome(ctx: PropertyContext): Promise<PublishedPageDto | null> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderPage.findMany({
      where: homeWhere(ctx.propertyId),
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    const row = rows[0];
    if (!row) return null;
    return {
      name: row.name,
      slug: '',
      kind: row.kind as BuilderPageKind,
      recordType: row.recordType,
      tree: row.draftTree as unknown as BuilderNode,
      ...publishedSeo(row),
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  });
}

/** The DRAFT read for preview (docs/45 §2.6 — the site-preview path): the page's
 *  unsaved DRAFT tree by slug, or null when no page owns that slug. Mirrors
 *  getPublishedBySlug but returns `draftTree` with NO published gate, so the
 *  editor's "Preview" tab shows work that hasn't been published. The public route
 *  only calls this behind a valid site-preview token (the tenant's own draft). */
export function getDraftBySlug(
  ctx: PropertyContext,
  slug: string
): Promise<PublishedPageDto | null> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderPage.findFirst({ where: { slug, propertyId: ctx.propertyId } });
    if (!row) return null;
    return {
      name: row.name,
      slug: row.slug ?? slug,
      kind: row.kind as BuilderPageKind,
      recordType: row.recordType,
      tree: row.draftTree as unknown as BuilderNode,
      ...publishedSeo(row),
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  });
}

/** The collection-template read (docs/44 §3 B — the generic record router): the
 *  PUBLISHED tree that renders a record of `recordType` (e.g. `commerce.product`,
 *  `cms.page`, `cms.blog_post`), or null when none resolves.
 *
 *  Resolution order (docs/51 §6) — the first PUBLISHED candidate wins:
 *    1. per-record OVERRIDE  (BuilderPageAssignment for `recordId`, if given)
 *    2. the type DEFAULT     (BuilderPage.isDefault for this recordType)
 *    3. FALLBACK             (lowest-position published — the prior behaviour)
 *
 *  An unpublished override/default falls through to the next candidate so the
 *  storefront always renders a published tree (never a draft). The caller binds
 *  the in-scope record into the tree (`product.*`, `post.*`). publishedTree's
 *  NULL check is in JS (Prisma is a type-only import here — cf. getPublishedBySlug). */
export function getPublishedByRecordType(
  ctx: PropertyContext,
  recordType: string,
  recordId?: string
): Promise<PublishedPageDto | null> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderPage.findMany({
      where: { recordType, kind: 'collection', propertyId: ctx.propertyId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    if (rows.length === 0) return null;

    // Per-record override (a specific template pinned to this exact record).
    let overrideId: string | null = null;
    if (recordId) {
      const assignment = await tx.builderPageAssignment.findFirst({
        where: { recordType, itemRef: recordId, propertyId: ctx.propertyId },
        select: { builderPageId: true },
      });
      overrideId = assignment?.builderPageId ?? null;
    }

    const isPublished = (r: (typeof rows)[number] | undefined): boolean => r?.publishedTree != null;
    const override = overrideId ? rows.find((r) => r.id === overrideId) : undefined;

    const chosen =
      (isPublished(override) ? override : undefined) ??
      rows.find((r) => r.isDefault && r.publishedTree != null) ??
      rows.find((r) => r.publishedTree != null);

    if (chosen?.publishedTree == null) return null;
    return {
      name: chosen.name,
      slug: chosen.slug ?? recordType,
      kind: chosen.kind as BuilderPageKind,
      recordType: chosen.recordType,
      tree: chosen.publishedTree as unknown as BuilderNode,
      ...publishedSeo(chosen),
      publishedAt: chosen.publishedAt ? chosen.publishedAt.toISOString() : null,
    };
  });
}
