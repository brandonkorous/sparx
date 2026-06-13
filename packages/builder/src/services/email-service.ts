// emailService — the Email Builder catalog and draft/publish lifecycle (docs/52).
//
// One row per email (BuilderEmail); the editor edits the DRAFT tree, publishing
// snapshots it. An email is ONE self-contained body tree — no site/page split,
// no Outlet, no layout tier. Two document fields the page model lacks: `subject`
// and `preheader`. Trees are validated against @sparx/builder-schemas on every
// write so every transport stores the same shape. Tenant-scoped via withTenant()
// — a callsite that forgets it sees nothing (FORCE RLS).
//
// One service, many transports: REST mounts these today; MCP + Server Actions
// reuse them unchanged. Mirrors pageService (docs/41).

import {
  CreateEmailInput,
  DEFAULT_EMAIL_TEMPLATES,
  ReorderEmailsInput,
  STARTER_EMAILS,
  UpdateEmailInput,
  blankEmailTree,
  getDefaultEmailTemplate,
  normalizeEmailTree,
  type BuilderEmailDto,
  type BuilderNode,
  type PublishedEmailDto,
} from '@sparx/builder-schemas';
import type { BuilderEmail, Prisma } from '@sparx/db';
import { withTenant } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishBuilderEvent } from '../events';
import type { ServiceContext } from '../errors';
import { BuilderNotFoundError } from '../errors';

function toDto(row: BuilderEmail): BuilderEmailDto {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    preheader: row.preheader,
    // Stored validated on write; the editor depends on a well-formed tree.
    // Normalized so the editor always receives the pinned wordmark header as the
    // first node (docs/52 §1) — legacy rows authored before it get it injected, and
    // the next save persists it. Idempotent for already-normalized trees.
    tree: normalizeEmailTree(row.draftTree as unknown as BuilderNode),
    published: row.publishedTree != null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    position: row.position,
    key: row.key,
    // property_id present ⇒ a per-site override/custom; absent ⇒ tenant-wide.
    scope: row.propertyId ? 'site' : 'tenant',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const asJson = (tree: BuilderNode): Prisma.InputJsonValue =>
  tree as unknown as Prisma.InputJsonValue;

/** The send/preview projection (PublishedEmailDto) of a row, or null when it has
 *  no published snapshot. Shared by getPublishedById / getPublishedByKey. */
function toPublished(row: BuilderEmail): PublishedEmailDto | null {
  if (row.publishedTree == null) return null;
  return {
    name: row.name,
    subject: row.subject,
    preheader: row.preheader,
    tree: normalizeEmailTree(row.publishedTree as unknown as BuilderNode),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}

// Preheader stores null (not '') when blank, so a cleared field is genuinely
// absent rather than an empty preview line.
const emptyToNull = (v: string | null | undefined): string | null =>
  v != null && v.length > 0 ? v : null;

/** The code-shipped fallback for a keyed default (docs/93 §2): a tenant that
 *  predates provisioning — or whose default row was dropped — still renders the
 *  default tree shipped in `@sparx/builder-schemas`, so a transactional send never
 *  has "no renderer". The 6-hour provisioning reconcile then back-fills the real
 *  row (which the tenant can edit). Only the keyed defaults have a fallback; an
 *  unknown key returns null. `publishedAt: null` marks it as not-yet-materialized. */
function defaultPublished(key: string): PublishedEmailDto | null {
  const def = getDefaultEmailTemplate(key);
  if (!def) return null;
  return {
    name: def.name,
    subject: def.subject,
    preheader: def.preheader,
    tree: normalizeEmailTree(def.tree),
    publishedAt: null,
  };
}

/** List the tenant's emails. On first use (zero rows) seed the curated starter
 *  set — the lazy-materialization idiom (cf. pageService.listOrSeed). Idempotent:
 *  only seeds when empty. */
export function listOrSeed(ctx: ServiceContext): Promise<BuilderEmailDto[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderEmail.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    if (rows.length > 0) return rows.map(toDto);

    await tx.builderEmail.createMany({
      data: STARTER_EMAILS.map((s, i) => ({
        tenantId: ctx.tenantId,
        name: s.name,
        subject: s.subject,
        preheader: s.preheader ?? null,
        draftTree: asJson(s.tree),
        position: i,
      })),
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.emails.seeded',
      entityType: 'BuilderEmail',
      entityId: null,
      diff: { after: { count: STARTER_EMAILS.length } },
    });
    const seeded = await tx.builderEmail.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return seeded.map(toDto);
  });
}

export function get(ctx: ServiceContext, id: string): Promise<BuilderEmailDto> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderEmail.findUnique({ where: { id } });
    if (!row) throw new BuilderNotFoundError('BuilderEmail', id);
    return toDto(row);
  });
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<BuilderEmailDto> {
  const input = CreateEmailInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const last = await tx.builderEmail.findFirst({
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = last ? last.position + 1 : 0;
    const created = await tx.builderEmail.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        subject: input.subject ?? '',
        preheader: emptyToNull(input.preheader),
        draftTree: asJson(input.tree ?? blankEmailTree()),
        position,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.email.created',
      entityType: 'BuilderEmail',
      entityId: created.id,
      diff: { before: null, after: { name: created.name } },
    });
    return toDto(created);
  });
}

/** Rename, set subject/preheader, and/or save the draft tree. Draft-tree saves
 *  are the high-frequency autosave path — deliberately NOT audited. */
export async function update(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<BuilderEmailDto> {
  const input = UpdateEmailInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const existing = await tx.builderEmail.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new BuilderNotFoundError('BuilderEmail', id);

    const data: Prisma.BuilderEmailUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.subject !== undefined) data.subject = input.subject;
    if (input.preheader !== undefined) data.preheader = emptyToNull(input.preheader);
    if (input.tree !== undefined) data.draftTree = asJson(input.tree);

    const updated = await tx.builderEmail.update({ where: { id }, data });
    return toDto(updated);
  });
}

export async function remove(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.builderEmail.findUnique({ where: { id } });
    if (!existing) throw new BuilderNotFoundError('BuilderEmail', id);
    await tx.builderEmail.delete({ where: { id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.email.deleted',
      entityType: 'BuilderEmail',
      entityId: id,
      diff: { before: { name: existing.name }, after: null },
    });
  });
}

/** Reorder the catalog. `orderedIds` must be exactly the tenant's email ids. */
export async function reorder(ctx: ServiceContext, rawInput: unknown): Promise<BuilderEmailDto[]> {
  const input = ReorderEmailsInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const owned = await tx.builderEmail.findMany({
      where: { id: { in: input.orderedIds } },
      select: { id: true },
    });
    if (owned.length !== input.orderedIds.length) {
      throw new BuilderNotFoundError('BuilderEmail', 'one or more emails');
    }
    for (let i = 0; i < input.orderedIds.length; i += 1) {
      await tx.builderEmail.update({ where: { id: input.orderedIds[i] }, data: { position: i } });
    }
    const rows = await tx.builderEmail.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toDto);
  });
}

/** Snapshot the draft tree into the published tree. A broadcast/authored template
 *  that references this email renders its published snapshot (docs/52 §6). Emits
 *  builder.email.published. */
export async function publish(ctx: ServiceContext, id: string): Promise<BuilderEmailDto> {
  const dto = await withTenant(ctx, async (tx) => {
    const existing = await tx.builderEmail.findUnique({ where: { id } });
    if (!existing) throw new BuilderNotFoundError('BuilderEmail', id);
    const updated = await tx.builderEmail.update({
      where: { id },
      data: {
        publishedTree: existing.draftTree as Prisma.InputJsonValue,
        publishedAt: new Date(),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.email.published',
      entityType: 'BuilderEmail',
      entityId: id,
      diff: { after: { name: updated.name } },
    });
    return toDto(updated);
  });
  await publishBuilderEvent({
    tenantId: ctx.tenantId,
    topic: 'builder.email.published',
    payload: { emailId: dto.id, name: dto.name },
  });
  return dto;
}

/** The send/preview read (docs/52 §6): the PUBLISHED tree of an email by id, or
 *  null when it hasn't been published. Used by the broadcast render path. The
 *  DRAFT counterpart (for the editor's live preview) is `getDraftById`. */
export function getPublishedById(
  ctx: ServiceContext,
  id: string
): Promise<PublishedEmailDto | null> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderEmail.findUnique({ where: { id } });
    return row ? toPublished(row) : null;
  });
}

/**
 * Resolve a built-in email by KEY for a send (docs/91 §6). The override join:
 * a PUBLISHED per-site row `(tenant, property, key)` wins; else the PUBLISHED
 * tenant-wide default `(tenant, null, key)`; else null. An unpublished site fork
 * deliberately falls back to the tenant default rather than blocking the send —
 * the override only takes effect once the site publishes it.
 *
 * This is the dispatch-time resolution point the automation send-by-key path AND
 * the direct send-by-key primitive (docs/93 §2, `sendTenantEmailByKey`) call, with
 * the per-site fallback baked in. When no published row exists for a keyed default,
 * the code-shipped tree (`defaultPublished`) is the last resort so a transactional
 * send never lacks a renderer; an unknown key still returns null.
 */
export function getPublishedByKey(
  ctx: ServiceContext,
  key: string,
  propertyId?: string | null
): Promise<PublishedEmailDto | null> {
  return withTenant(ctx, async (tx) => {
    if (propertyId) {
      const override = await tx.builderEmail.findFirst({ where: { key, propertyId } });
      const published = override && toPublished(override);
      if (published) return published;
    }
    const base = await tx.builderEmail.findFirst({ where: { key, propertyId: null } });
    const published = base && toPublished(base);
    if (published) return published;
    return defaultPublished(key);
  });
}

/**
 * Provision the tenant's default email templates (docs/91) — the 13 keyed,
 * tenant-wide (`property_id = null`) Builder emails that back the platform
 * automations. Published immediately (draft == published) so they're send-ready.
 * Idempotent: only the keys not already present are created (the
 * `(tenant, key) WHERE property_id IS NULL` partial unique is the backstop), so a
 * re-activation or duplicate `module.activated(email)` event is a safe no-op. Runs
 * alongside the automation module's own seed of the automation rows — different
 * tables, same event.
 */
export function provisionDefaultEmails(ctx: ServiceContext): Promise<{ provisioned: number }> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.builderEmail.findMany({
      where: { propertyId: null, key: { not: null } },
      select: { key: true },
    });
    const have = new Set(existing.map((e) => e.key));
    const missing = DEFAULT_EMAIL_TEMPLATES.filter((t) => !have.has(t.key));
    if (missing.length === 0) return { provisioned: 0 };

    const last = await tx.builderEmail.findFirst({
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    let position = last ? last.position : -1;
    const now = new Date();
    for (const t of missing) {
      position += 1;
      await tx.builderEmail.create({
        data: {
          tenantId: ctx.tenantId,
          propertyId: null,
          key: t.key,
          name: t.name,
          subject: t.subject,
          preheader: t.preheader,
          draftTree: asJson(t.tree),
          publishedTree: asJson(t.tree),
          publishedAt: now,
          position,
        },
      });
    }
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'system',
      action: 'builder.emails.provisioned',
      entityType: 'BuilderEmail',
      entityId: null,
      diff: { after: { count: missing.length, keys: missing.map((m) => m.key) } },
    });
    return { provisioned: missing.length };
  });
}

/**
 * List the emails a SITE authors (docs/49 Phase 7b): the tenant-wide rows (the 13
 * defaults + any tenant-level custom email) with each default **replaced by this
 * site's override** when one exists, plus the site's own custom emails. The
 * editor edits each row by its own id; only this list + the fork are
 * property-aware. `propertyId` null falls back to the tenant-wide view.
 */
export function listForProperty(
  ctx: ServiceContext,
  propertyId: string | null
): Promise<BuilderEmailDto[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderEmail.findMany({
      where: propertyId ? { OR: [{ propertyId: null }, { propertyId }] } : { propertyId: null },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    // Keys this site has overridden — the tenant-wide default with that key is
    // hidden in favour of the site row.
    const overriddenKeys = new Set(
      rows.filter((r) => r.propertyId === propertyId && r.key != null).map((r) => r.key)
    );
    const visible = rows.filter((r) => {
      if (r.propertyId === propertyId) return true; // this site's own rows
      return !(r.key != null && overriddenKeys.has(r.key)); // hide overridden defaults
    });
    return visible.map(toDto);
  });
}

/**
 * Fork a tenant-wide default into a per-site override (docs/49 Phase 7b — the
 * "Customize for this site" action). Copies the default's published look into a
 * new `(tenant, property, key)` draft the site edits independently; it stays draft
 * (the tenant default keeps sending for the site, via getPublishedByKey's
 * fallback) until the site publishes it. Idempotent — re-forking returns the
 * existing override rather than tripping the per-site partial unique.
 */
export function customizeForSite(
  ctx: ServiceContext,
  key: string,
  propertyId: string
): Promise<BuilderEmailDto> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.builderEmail.findFirst({ where: { key, propertyId } });
    if (existing) return toDto(existing);
    const base = await tx.builderEmail.findFirst({ where: { key, propertyId: null } });
    if (!base) throw new BuilderNotFoundError('BuilderEmail', `default ${key}`);
    const last = await tx.builderEmail.findFirst({
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const created = await tx.builderEmail.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId,
        key,
        name: base.name,
        subject: base.subject,
        preheader: base.preheader,
        draftTree: (base.publishedTree ?? base.draftTree) as Prisma.InputJsonValue,
        position: last ? last.position + 1 : 0,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.email.site_override_created',
      entityType: 'BuilderEmail',
      entityId: created.id,
      diff: { after: { key, propertyId } },
    });
    return toDto(created);
  });
}

/** The DRAFT read for the editor's true-HTML preview (docs/52 §9 Phase 2): the
 *  email's unsaved DRAFT tree by id, or null when it doesn't exist. Mirrors
 *  getPublishedById with no published gate. */
export function getDraftById(ctx: ServiceContext, id: string): Promise<PublishedEmailDto | null> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderEmail.findUnique({ where: { id } });
    if (!row) return null;
    return {
      name: row.name,
      subject: row.subject,
      preheader: row.preheader,
      tree: normalizeEmailTree(row.draftTree as unknown as BuilderNode),
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  });
}
