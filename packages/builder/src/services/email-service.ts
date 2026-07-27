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
  SyncSilicaEmailInput,
  UpdateEmailInput,
  blankEmailTree,
  emailTreeToSilica,
  getDefaultEmailTemplate,
  normalizeEmailTree,
  type BuilderEmailDto,
  type BuilderNode,
  type PublishedEmailDto,
  type SilicaEmailDocument,
} from '@sparx/builder-schemas';
import type { BuilderEmail } from '@sparx/db';
import { Prisma, withTenant } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishBuilderEvent } from '../events';
import type { ServiceContext } from '../errors';
import { BuilderNotFoundError } from '../errors';
import { isPriorDefaultBody } from './email-default-refresh';
import { captureEmailVersionTx } from './email-version-service';
import { canonicalJson } from './artifact-service';

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
    // The silica DRAFT document (docs/120) — what the silica editor mounts. ALWAYS
    // present: a row authored before the cutover has no silica document, so it is
    // converted from its own sparx tree on read (docs/120 slice 7). The repair pass
    // in `provisionDefaultEmails` persists that conversion, after which this branch
    // stops firing and the legacy columns can be dropped.
    silicaDoc: silicaDraft(row),
    // An email is "published" once EITHER the legacy sparx tree OR a silica
    // document has been snapshotted (parallel-run).
    published: row.publishedTree != null || row.silicaPublishedDocument != null,
    hasUnpublishedChanges: hasUnpublishedChanges(row),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    position: row.position,
    key: row.key,
    trackingCampaign: row.trackingCampaign,
    // property_id present ⇒ a per-site override/custom; absent ⇒ tenant-wide.
    scope: row.propertyId ? 'site' : 'tenant',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const asJson = (tree: BuilderNode): Prisma.InputJsonValue =>
  tree as unknown as Prisma.InputJsonValue;

const asDocJson = (doc: SilicaEmailDocument): Prisma.InputJsonValue =>
  doc as unknown as Prisma.InputJsonValue;

// ── The legacy bridge (docs/120 slice 7 — delete with the tree columns) ───────
// The send renders silica and ONLY silica; `renderEmailTree` is gone. A row authored
// on the sparx engine still has only a tree, so these two convert it on read. They
// are the reason `silicaDoc` is never null anywhere downstream — every caller gets a
// document, whether the row was authored on silica or converted into it.

/** This row's silica DRAFT document — stored, else converted from its sparx tree. */
function silicaDraft(row: BuilderEmail): SilicaEmailDocument {
  const stored = row.silicaDraftDocument as SilicaEmailDocument | null;
  if (stored) return stored;
  return emailTreeToSilica(
    normalizeEmailTree(row.draftTree as unknown as BuilderNode),
    row.subject,
    row.preheader
  );
}

/** This row's silica PUBLISHED document — stored, else converted from its published
 *  sparx tree (falling back to the draft, which is what the legacy renderer did). */
function silicaPublished(row: BuilderEmail): SilicaEmailDocument {
  const stored = row.silicaPublishedDocument as SilicaEmailDocument | null;
  if (stored) return stored;
  return emailTreeToSilica(
    normalizeEmailTree((row.publishedTree ?? row.draftTree) as unknown as BuilderNode),
    row.subject,
    row.preheader
  );
}

/** True when a PUBLISHED email's DRAFT has diverged from its live published version —
 *  saved edits recipients aren't getting yet. Compares the resolved silica documents by
 *  CANONICAL form (key-order / round-trip noise doesn't count as a change). False for an
 *  unpublished email — the `published:false` state already says everything there. */
function hasUnpublishedChanges(row: BuilderEmail): boolean {
  const isPublished = row.publishedTree != null || row.silicaPublishedDocument != null;
  if (!isPublished) return false;
  return canonicalJson(silicaDraft(row)) !== canonicalJson(silicaPublished(row));
}

/** The send/preview projection (PublishedEmailDto) of a row, or null when it has
 *  no published snapshot. Shared by getPublishedById / getPublishedByKey. */
function toPublished(row: BuilderEmail): PublishedEmailDto | null {
  // Published once EITHER path has a snapshot (a pre-cutover row published its tree;
  // a silica-authored one publishes its document). Unpublished ⇒ nothing to send.
  if (row.publishedTree == null && row.silicaPublishedDocument == null) return null;
  return {
    name: row.name,
    subject: row.subject,
    preheader: row.preheader,
    key: row.key,
    trackingCampaign: row.trackingCampaign,
    silicaDoc: silicaPublished(row),
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
    key,
    // A code-shipped fallback has no author override — clicks report under its name.
    trackingCampaign: null,
    // The code-shipped fallback is a silica document (docs/120) — a tenant with no row
    // for this key renders through the same engine as everyone else.
    silicaDoc: def.doc,
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
    // A cleared campaign ('' or null) resets to the email's name at send.
    if (input.trackingCampaign !== undefined)
      data.trackingCampaign = emptyToNull(input.trackingCampaign);

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

/** Persist a silica-authored email's DRAFT document (docs/120) — the editor's
 *  `<EmailBuilder onChange>` seam. The document carries its own subject/preheader
 *  (silica owns them), which we mirror onto the row so the catalog list, the send
 *  subject, and `{{token}}` interpolation in the subject all read the current
 *  value. NOT audited (high-frequency autosave path, like `update`). */
export async function syncSilica(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<BuilderEmailDto> {
  const { doc } = SyncSilicaEmailInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const existing = await tx.builderEmail.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new BuilderNotFoundError('BuilderEmail', id);
    const updated = await tx.builderEmail.update({
      where: { id },
      data: {
        silicaDraftDocument: asDocJson(doc),
        subject: doc.subject,
        preheader: emptyToNull(doc.preheader),
      },
    });
    return toDto(updated);
  });
}

/** Snapshot a silica email's DRAFT document into its PUBLISHED document (docs/120)
 *  — the silica counterpart of `publish`. The send path (`getPublishedByKey` /
 *  `getPublishedById`) then renders the silica document via `renderSilicaEmail`.
 *  Throws if nothing has been authored on silica yet. Emits builder.email.published. */
export async function publishSilica(ctx: ServiceContext, id: string): Promise<BuilderEmailDto> {
  const dto = await withTenant(ctx, async (tx) => {
    const existing = await tx.builderEmail.findUnique({ where: { id } });
    if (!existing) throw new BuilderNotFoundError('BuilderEmail', id);
    if (existing.silicaDraftDocument == null) {
      throw new BuilderNotFoundError('BuilderEmail', `${id} (no silica draft to publish)`);
    }
    const updated = await tx.builderEmail.update({
      where: { id },
      data: {
        silicaPublishedDocument: existing.silicaDraftDocument,
        publishedAt: new Date(),
      },
    });
    // Snapshot this publish into the append-only version history (Slice 5), inside the
    // same transaction so a rolled-back publish leaves no orphan version. A no-op
    // republish (identical to the last version) is deduped away and adds no row.
    await captureEmailVersionTx(
      tx,
      ctx,
      id,
      existing.silicaDraftDocument as unknown as SilicaEmailDocument,
      ctx.userId ?? null
    );
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.email.published',
      entityType: 'BuilderEmail',
      entityId: id,
      diff: { after: { name: updated.name, silica: true } },
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

/** Restore a published version into the DRAFT (docs/impl transactional-email Slice 5) —
 *  NON-DESTRUCTIVE by design. It loads the chosen version's document back onto the draft
 *  (and mirrors its subject/preheader), leaving the live PUBLISHED document untouched, so
 *  the author reviews the reinstated version in the studio and re-publishes it — an email
 *  goes to real inboxes, so a restore never silently republishes. The returned DTO carries
 *  the restored draft, which the studio remounts on. Audited (a deliberate, low-frequency
 *  act, unlike autosave). */
export async function restoreEmailVersion(
  ctx: ServiceContext,
  emailId: string,
  versionId: string
): Promise<BuilderEmailDto> {
  return withTenant(ctx, async (tx) => {
    const version = await tx.builderEmailVersion.findFirst({
      where: { id: versionId, emailId },
      select: { id: true, document: true },
    });
    if (!version) throw new BuilderNotFoundError('BuilderEmailVersion', versionId);

    const doc = version.document as unknown as SilicaEmailDocument;
    const updated = await tx.builderEmail.update({
      where: { id: emailId },
      data: {
        silicaDraftDocument: version.document as Prisma.InputJsonValue,
        subject: doc.subject ?? '',
        preheader: emptyToNull(doc.preheader),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.email.version.restored',
      entityType: 'BuilderEmail',
      entityId: emailId,
      diff: { after: { versionId, name: updated.name } },
    });
    return toDto(updated);
  });
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
 * Convert every row that predates the silica cutover — one that stores only a sparx
 * tree — into a silica document, IN PLACE (docs/120 slice 7).
 *
 * Each row is converted from its OWN tree, not reset to the code default: a tenant who
 * edited their welcome email keeps those edits, and a CUSTOM-key email (which has no
 * default to fall back to) converts at all. Idempotent — a row that already carries a
 * silica document is skipped, so this is a no-op on every run after the first.
 *
 * `published_at` is untouched: publish state is what it was. A row whose tree was
 * published gets a published document; a draft-only row gets only a draft.
 *
 * This is the LAST reader of `draft_tree` / `published_tree`. Once it has run for every
 * tenant, those columns, `emailTreeToSilica`, and the sparx email node schema go.
 */
async function repairLegacyRows(tx: Prisma.TransactionClient): Promise<number> {
  const stale = await tx.builderEmail.findMany({
    where: { silicaDraftDocument: { equals: Prisma.DbNull } },
  });
  for (const row of stale) {
    await tx.builderEmail.update({
      where: { id: row.id },
      data: {
        silicaDraftDocument: asDocJson(silicaDraft(row)),
        // Only a row that was actually published gets a published document — converting
        // an unpublished draft into one would silently publish it.
        ...(row.publishedTree != null
          ? { silicaPublishedDocument: asDocJson(silicaPublished(row)) }
          : {}),
      },
    });
  }
  return stale.length;
}

/**
 * Refresh every tenant-wide default row that is STILL the untouched shipped default to
 * the CURRENT shipped body (docs/120) — so a tenant provisioned before a default was
 * redesigned picks the new design up, without ever clobbering an edit.
 *
 * A row qualifies only when BOTH its draft and its published body are recognised as a
 * prior shipped default (id-stripped content match, `isPriorDefaultBody`): any tenant
 * edit — or even an unpublished draft change — takes the row out of the set and it is
 * left entirely alone. A row already on the current design isn't a PRIOR default, so it
 * doesn't match and the pass is idempotent. Per-SITE overrides (property_id set) are an
 * explicit "customize for this site" the tenant owns, so they're never touched here.
 *
 * Runs per tenant inside `provisionDefaultEmails`, so it rides both `module.activated`
 * and the 6-hourly reconcile — the same deployable path as `repairLegacyRows`, never a
 * one-off DB script.
 */
async function refreshRedesignedDefaults(tx: Prisma.TransactionClient): Promise<number> {
  const rows = await tx.builderEmail.findMany({
    where: { propertyId: null, key: { not: null } },
  });
  let refreshed = 0;
  for (const row of rows) {
    const key = row.key;
    if (!key) continue;
    const def = getDefaultEmailTemplate(key);
    if (!def) continue; // a custom-keyed row with no code default — nothing to refresh to
    const draftDoc = row.silicaDraftDocument as SilicaEmailDocument | null;
    const publishedDoc = row.silicaPublishedDocument as SilicaEmailDocument | null;
    // Replace ONLY when both sides are still an untouched shipped default.
    if (!isPriorDefaultBody(key, draftDoc) || !isPriorDefaultBody(key, publishedDoc)) continue;
    await tx.builderEmail.update({
      where: { id: row.id },
      data: {
        silicaDraftDocument: asDocJson(def.doc),
        silicaPublishedDocument: asDocJson(def.doc),
        // Keep the mirrored fields in lock-step with the refreshed document, so a
        // future subject/name change on a default lands here too. publishedAt is left
        // as-is: the row stays published, this only swaps its content.
        subject: def.subject,
        preheader: def.preheader,
        name: def.name,
      },
    });
    refreshed += 1;
  }
  return refreshed;
}

/**
 * Provision the tenant's default email templates (docs/91) — the keyed, tenant-wide
 * (`property_id = null`) Builder emails that back the platform automations. Published
 * immediately (draft == published) so they're send-ready. Idempotent: only the keys not
 * already present are created (the `(tenant, key) WHERE property_id IS NULL` partial
 * unique is the backstop), so a re-activation or duplicate `module.activated(email)`
 * event is a safe no-op. Runs alongside the automation module's own seed of the
 * automation rows — different tables, same event.
 *
 * It ALSO repairs (docs/120 slice 7): any row still holding only a sparx tree is
 * converted to a silica document here. This is the reconcile that runs per tenant on
 * activation and on the 6-hourly sweep, which makes it the natural — and only
 * deployable — place to land the backfill. A one-off DB script would do the same thing
 * off the normal path, and leave every future tenant unmigrated.
 */
export function provisionDefaultEmails(
  ctx: ServiceContext
): Promise<{ provisioned: number; repaired: number; refreshed: number }> {
  return withTenant(ctx, async (tx) => {
    const repaired = await repairLegacyRows(tx);
    // Repair FIRST (legacy tree → silica), THEN refresh: refresh matches on the silica
    // body, so a just-converted row is already comparable.
    const refreshed = await refreshRedesignedDefaults(tx);

    const existing = await tx.builderEmail.findMany({
      where: { propertyId: null, key: { not: null } },
      select: { key: true },
    });
    const have = new Set(existing.map((e) => e.key));
    const missing = DEFAULT_EMAIL_TEMPLATES.filter((t) => !have.has(t.key));
    if (missing.length === 0) {
      // Nothing new to create, but a refresh may still have re-designed existing rows —
      // audit that on its own so the redesign rollout is traceable per tenant.
      if (refreshed > 0) {
        await writeAuditLog({
          tx,
          tenantId: ctx.tenantId,
          actorId: ctx.userId ?? null,
          actorType: 'system',
          action: 'builder.emails.refreshed',
          entityType: 'BuilderEmail',
          entityId: null,
          diff: { after: { refreshed, repaired } },
        });
      }
      return { provisioned: 0, repaired, refreshed };
    }

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
          // The silica document IS the email (docs/120 slice 7) — it's what every send
          // renders. Published immediately: a default has to work the moment the module
          // activates, with no visit to the editor. The sparx tree is still written
          // because the column is NOT NULL until the drop migration; nothing reads it.
          draftTree: asJson(t.tree),
          publishedTree: asJson(t.tree),
          silicaDraftDocument: asDocJson(t.doc),
          silicaPublishedDocument: asDocJson(t.doc),
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
      diff: {
        after: { count: missing.length, keys: missing.map((m) => m.key), repaired, refreshed },
      },
    });
    return { provisioned: missing.length, repaired, refreshed };
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
    // Fork the base's published look into the new draft — for BOTH the legacy tree
    // and (docs/120) the silica document, so a fork of a silica-authored default
    // opens with the default's content rather than an empty canvas.
    const baseSilica = base.silicaPublishedDocument ?? base.silicaDraftDocument;
    const created = await tx.builderEmail.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId,
        key,
        name: base.name,
        subject: base.subject,
        preheader: base.preheader,
        draftTree: (base.publishedTree ?? base.draftTree) as Prisma.InputJsonValue,
        ...(baseSilica != null ? { silicaDraftDocument: baseSilica } : {}),
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
 *  email's unsaved DRAFT document by id, or null when it doesn't exist. Mirrors
 *  getPublishedById with no published gate. */
export function getDraftById(ctx: ServiceContext, id: string): Promise<PublishedEmailDto | null> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderEmail.findUnique({ where: { id } });
    if (!row) return null;
    return {
      name: row.name,
      subject: row.subject,
      preheader: row.preheader,
      key: row.key,
      trackingCampaign: row.trackingCampaign,
      // The DRAFT silica document — converted from the sparx tree for a row that
      // predates the cutover, exactly as the published read does.
      silicaDoc: silicaDraft(row),
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  });
}
