// pageService — the Builder page catalog and draft/publish lifecycle (docs/41).
//
// One row per page (BuilderPage); the editor edits the DRAFT tree, publishing
// snapshots it. Trees are validated against @sparx/builder-schemas on every
// write so every transport stores the same shape. Tenant-scoped via
// withTenant() — a callsite that forgets it sees nothing (FORCE RLS).
//
// One service, many transports: REST mounts these today; MCP + Server Actions
// reuse them unchanged.

import {
  CreatePageInput,
  ReorderPagesInput,
  STARTER_PAGES,
  UpdatePageInput,
  blankPageTree,
  type BuilderNode,
  type BuilderPageDto,
  type BuilderPageKind,
  type PublishedPageDto,
} from '@sparx/builder-schemas';
import type { BuilderPage, Prisma } from '@sparx/db';
import { withTenant } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishBuilderEvent } from '../events';
import type { PropertyContext, ServiceContext } from '../errors';
import { BuilderNotFoundError, BuilderValidationError } from '../errors';
import { getSchema } from './binding-service';
import { expandTreeForPublish } from './component-service';

function toDto(row: BuilderPage): BuilderPageDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind: row.kind as BuilderPageKind,
    recordType: row.recordType,
    // Stored validated on write; the editor depends on a well-formed tree.
    tree: row.draftTree as unknown as BuilderNode,
    published: row.publishedTree != null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    position: row.position,
    isDefault: row.isDefault,
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

/** List the tenant's pages. On first use (zero rows) seed the curated starter
 *  set — the lazy-materialization idiom (cf. getOrCreateConfig). Idempotent:
 *  only seeds when empty. */
export function listOrSeed(ctx: PropertyContext): Promise<BuilderPageDto[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderPage.findMany({
      where: { propertyId: ctx.propertyId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    if (rows.length > 0) return rows.map(toDto);

    await tx.builderPage.createMany({
      data: STARTER_PAGES.map((s, i) => ({
        tenantId: ctx.tenantId,
        propertyId: ctx.propertyId,
        name: s.name,
        kind: s.kind,
        recordType: s.recordType ?? null,
        draftTree: asJson(s.tree),
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
      diff: { after: { count: STARTER_PAGES.length } },
    });
    const seeded = await tx.builderPage.findMany({
      where: { propertyId: ctx.propertyId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return seeded.map(toDto);
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
    if (input.recordType !== undefined) data.recordType = input.recordType;
    if (input.slug !== undefined) data.slug = input.slug;
    // SEO — empty strings clear the column (store null), so the storefront falls
    // back to the page name rather than rendering an empty <title>.
    if (input.seoTitle !== undefined) data.seoTitle = emptyToNull(input.seoTitle);
    if (input.seoDescription !== undefined) data.seoDescription = emptyToNull(input.seoDescription);
    if (input.canonical !== undefined) data.canonical = emptyToNull(input.canonical);
    if (input.ogImage !== undefined) data.ogImage = emptyToNull(input.ogImage);
    if (input.noindex !== undefined) data.noindex = input.noindex;

    const updated = await tx.builderPage.update({ where: { id }, data });
    return toDto(updated);
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
    return rows.map(toDto);
  });
}

/** Snapshot the draft tree into the published tree, expanding any tenant
 *  components into concrete primitives first (docs/53 §3). The publish event is
 *  emitted for the storefront render path. */
export async function publish(ctx: PropertyContext, id: string): Promise<BuilderPageDto> {
  const dto = await withTenant(ctx, async (tx) => {
    const existing = await tx.builderPage.findFirst({ where: { id, propertyId: ctx.propertyId } });
    if (!existing) throw new BuilderNotFoundError('BuilderPage', id);
    const published = await expandTreeForPublish(tx, existing.draftTree as unknown as BuilderNode);
    const updated = await tx.builderPage.update({
      where: { id },
      data: {
        publishedTree: asJson(published),
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
