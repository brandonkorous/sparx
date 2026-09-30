// billingTemplateService — the invoice/estimate PRINT TEMPLATE catalog (docs/87
// §10, Phase 5b). The node-tree successor to the code default renderer: one row
// per template (BillingDocumentTemplate), the editor edits the DRAFT tree, and
// publishing snapshots it. The site's `isDefault` template drives the document
// `…/pdf` render once published; until then the built-in code renderer is used, so
// a tenant never *must* design one.
//
// A peer of @wizeworks/builder's emailService in the builder framework — same
// draft/publish lifecycle, same lazy "seed-a-default, edit-a-copy" idiom. The tree
// is stored opaque here (validated structurally by crm-schemas on write); the
// api-rest renderer interprets it. Tenant-scoped via withTenant() — a callsite that
// forgets it sees nothing (FORCE RLS).
//
// ── A letterhead belongs to ONE business ────────────────────────────────────
//
// `propertyId` names the site a template belongs to, and `null` means every site.
// Two tiers, and the resolution order is the whole rule: a document prints on its
// OWN site's default template, and falls back to the shared one only when that
// site has not been given its own. A tenant running a textile studio and a
// wholesale trade counter under one account is the ordinary case here, and
// printing the studio's letterhead on the trade counter's invoices is not a
// cosmetic slip — it is the wrong business's name on a demand for money.
// [[feedback_site_is_the_business]]
//
// Every function below therefore takes the site it is acting for, rather than
// reading one off the context: ServiceContext carries `restrictToPropertyId`,
// which is a CEILING on what a caller may touch, never the site a call TARGETS.
// Conflating the two is how a restriction silently becomes a default.

import {
  CreateBillingTemplateInput,
  UpdateBillingTemplateInput,
  type InvoiceTemplateNodeInput,
} from '@wizeworks/crm-schemas';
import { DEFAULT_INVOICE_TEMPLATE } from '@wizeworks/crm-schemas/builtins';
import { withTenant } from '@wizeworks/db';
import type { BillingDocumentTemplate, Prisma, TxClient } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';

export interface BillingTemplateDto {
  id: string;
  name: string;
  isDefault: boolean;
  /** The site this letterhead belongs to, or null for every site. */
  propertyId: string | null;
  /** That site's name, for a list that has to say which business this is for.
   *  Null alongside a null `propertyId` — there is no site to name. */
  propertyName: string | null;
  /** The editor's working tree (the draft). */
  tree: InvoiceTemplateNodeInput;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A row with the site name joined on — what `toDto` needs to say which business
 *  a letterhead is for without a second query per row. */
type TemplateRow = BillingDocumentTemplate & { property?: { name: string } | null };

const WITH_PROPERTY = { property: { select: { name: true } } } as const;

const asJson = (tree: InvoiceTemplateNodeInput): Prisma.InputJsonValue =>
  tree as unknown as Prisma.InputJsonValue;

const asTree = (json: Prisma.JsonValue): InvoiceTemplateNodeInput =>
  json as unknown as InvoiceTemplateNodeInput;

function toDto(row: TemplateRow): BillingTemplateDto {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    propertyId: row.propertyId,
    propertyName: row.property?.name ?? null,
    tree: asTree(row.draftTree),
    published: row.publishedTree != null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Which letterheads a read is about.
 *
 * `propertyId` is the business being worked in — its own letterheads plus the
 * shared ones. `null` is the shared tier alone, which is the honest answer for
 * an account with one business, since nothing there is ever narrowed to a site.
 * `everySite` is the deliberate cross-site read (`?property=all`) and is the
 * only thing that sees another business's letterheads.
 */
export interface TemplateScope {
  propertyId: string | null;
  everySite?: boolean;
}

function visibleTo(scope: TemplateScope): Prisma.BillingDocumentTemplateWhereInput {
  if (scope.everySite) return {};
  return scope.propertyId
    ? { OR: [{ propertyId: scope.propertyId }, { propertyId: null }] }
    : { propertyId: null };
}

/** Clear the standing default WITHIN ONE TIER, so promoting the trade counter's
 *  letterhead cannot quietly demote the studio's. The partial-unique index
 *  (tenant_id, property_id) WHERE is_default is the backstop. */
async function clearDefaultIn(tx: TxClient, propertyId: string | null): Promise<void> {
  await tx.billingDocumentTemplate.updateMany({
    where: { isDefault: true, propertyId },
    data: { isDefault: false },
  });
}

/**
 * The letterheads available while working in `propertyId` — that site's own, plus
 * the shared ones. On first use, when the tenant has NO templates at all, seed
 * the built-in default into the SHARED tier (the lazy-materialization idiom, cf.
 * emailService.listOrSeed).
 *
 * The seed condition is deliberately "this tenant has none anywhere", not "this
 * site has none". Per-site would mint a fresh Default the first time anyone
 * opened each of seven sites, and every one of them would claim to be a default.
 *
 * Seeded as DRAFT only (publishedTree null): the code default renderer stays in
 * effect until the tenant publishes a template.
 */
export function listOrSeed(
  ctx: ServiceContext,
  scope: TemplateScope = { propertyId: null, everySite: true }
): Promise<BillingTemplateDto[]> {
  return withTenant(ctx, async (tx) => {
    const anyAtAll = await tx.billingDocumentTemplate.count();
    if (anyAtAll === 0) {
      const seededRow = await tx.billingDocumentTemplate.create({
        data: {
          tenantId: ctx.tenantId,
          name: DEFAULT_INVOICE_TEMPLATE.name,
          isDefault: true,
          propertyId: null,
          draftTree: asJson(DEFAULT_INVOICE_TEMPLATE.tree),
        },
      });
      await writeAuditLog({
        tx,
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'user' : 'system',
        action: 'invoicing.template.seeded',
        entityType: 'BillingDocumentTemplate',
        entityId: seededRow.id,
        diff: { after: { name: DEFAULT_INVOICE_TEMPLATE.name } },
      });
    }

    const rows = await tx.billingDocumentTemplate.findMany({
      where: visibleTo(scope),
      include: WITH_PROPERTY,
      // A site's own letterheads first, then the shared ones: the specific
      // answer above the fallback, which is the order they take effect in.
      orderBy: [{ propertyId: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map(toDto);
  });
}

export function get(ctx: ServiceContext, id: string): Promise<BillingTemplateDto> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.billingDocumentTemplate.findUnique({
      where: { id },
      include: WITH_PROPERTY,
    });
    if (!row) throw new CrmNotFoundError('BillingDocumentTemplate', id);
    return toDto(row);
  });
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<BillingTemplateDto> {
  const input = CreateBillingTemplateInput.parse(rawInput);
  const propertyId = input.propertyId ?? null;
  return withTenant(ctx, async (tx) => {
    // The first template in a TIER becomes that tier's default; an explicit
    // `isDefault` clears the one already there. Counting the tier rather than
    // the tenant is what lets a second business get its own default at all --
    // counting every row meant the first letterhead a new site was given came
    // out not-default, and printed nothing.
    const existingInTier = await tx.billingDocumentTemplate.count({ where: { propertyId } });
    const makeDefault = input.isDefault || existingInTier === 0;
    if (makeDefault) await clearDefaultIn(tx, propertyId);
    const created = await tx.billingDocumentTemplate.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        isDefault: makeDefault,
        propertyId,
        draftTree: asJson(input.tree ?? DEFAULT_INVOICE_TEMPLATE.tree),
      },
      include: WITH_PROPERTY,
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.template.created',
      entityType: 'BillingDocumentTemplate',
      entityId: created.id,
      diff: { after: { name: created.name, propertyId } },
    });
    return toDto(created);
  });
}

/** Rename, move to another business, and/or save the draft tree. Draft-tree
 *  saves are the high-frequency editor autosave path — deliberately NOT
 *  audited. */
export async function update(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<BillingTemplateDto> {
  const input = UpdateBillingTemplateInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const existing = await tx.billingDocumentTemplate.findUnique({
      where: { id },
      select: { id: true, isDefault: true, propertyId: true },
    });
    if (!existing) throw new CrmNotFoundError('BillingDocumentTemplate', id);

    const data: Prisma.BillingDocumentTemplateUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.tree !== undefined) data.draftTree = asJson(input.tree);

    // Moving the DEFAULT letterhead to another business would otherwise land it
    // beside that business's own default and trip the unique index -- so the
    // destination's default is stood down first, exactly as a promotion does.
    // The tier it LEAVES is then left with none, which is honest: that site
    // falls back to the shared letterhead until somebody picks one.
    if (input.propertyId !== undefined && input.propertyId !== existing.propertyId) {
      const moveTo = input.propertyId;
      if (existing.isDefault) await clearDefaultIn(tx, moveTo);
      data.property = moveTo ? { connect: { id: moveTo } } : { disconnect: true };
    }

    const updated = await tx.billingDocumentTemplate.update({
      where: { id },
      data,
      include: WITH_PROPERTY,
    });
    return toDto(updated);
  });
}

/** Snapshot the draft tree into the published tree — from then on the site's
 *  default template (when this is it) drives `…/pdf` through the tree renderer. */
export async function publish(ctx: ServiceContext, id: string): Promise<BillingTemplateDto> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.billingDocumentTemplate.findUnique({ where: { id } });
    if (!existing) throw new CrmNotFoundError('BillingDocumentTemplate', id);
    const updated = await tx.billingDocumentTemplate.update({
      where: { id },
      data: { publishedTree: existing.draftTree as Prisma.InputJsonValue, publishedAt: new Date() },
      include: WITH_PROPERTY,
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.template.published',
      entityType: 'BillingDocumentTemplate',
      entityId: id,
      diff: { after: { name: updated.name } },
    });
    return toDto(updated);
  });
}

/** Make this template the default FOR ITS OWN BUSINESS (the one that drives
 *  `…/pdf` for that site). Clears that tier's prior default first so the
 *  partial-unique index never trips, and leaves every other business alone. */
export async function setDefault(ctx: ServiceContext, id: string): Promise<BillingTemplateDto> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.billingDocumentTemplate.findUnique({ where: { id } });
    if (!existing) throw new CrmNotFoundError('BillingDocumentTemplate', id);
    if (!existing.isDefault) {
      await clearDefaultIn(tx, existing.propertyId);
      await tx.billingDocumentTemplate.update({ where: { id }, data: { isDefault: true } });
    }
    const fresh = await tx.billingDocumentTemplate.findUniqueOrThrow({
      where: { id },
      include: WITH_PROPERTY,
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.template.set_default',
      entityType: 'BillingDocumentTemplate',
      entityId: id,
      diff: { after: { isDefault: true, propertyId: existing.propertyId } },
    });
    return toDto(fresh);
  });
}

export async function remove(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.billingDocumentTemplate.findUnique({ where: { id } });
    if (!existing) throw new CrmNotFoundError('BillingDocumentTemplate', id);
    // A business must always have a letterhead to fall back on — deleting the
    // one in force is blocked; promote another first.
    if (existing.isDefault) {
      throw new CrmValidationError(
        'Cannot delete the default template. Set another template as default first.'
      );
    }
    await tx.billingDocumentTemplate.delete({ where: { id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.template.deleted',
      entityType: 'BillingDocumentTemplate',
      entityId: id,
      diff: { before: { name: existing.name } },
    });
  });
}

/**
 * The render read (docs/87 §10): the PUBLISHED default letterhead a document
 * printed by `propertyId` should wear — that site's own first, then the shared
 * one, and null when neither exists (the `…/pdf` route then falls back to the
 * built-in code renderer).
 *
 * THE SITE IS THE DOCUMENT'S, NOT THE VIEWER'S. An invoice raised by the trade
 * counter has to print on the trade counter's letterhead whichever site its
 * owner happens to be looking at the console from, so callers pass the
 * document's own `propertyId`.
 *
 * A site's own template wins even when it is UNPUBLISHED-and-default: falling
 * through to the shared one there would print the other business's name on this
 * one's invoices, which is the exact outcome this is scoped to prevent. An
 * unpublished default means "designed, not in force yet", and the honest answer
 * is the built-in renderer.
 */
export function getActivePublishedTree(
  ctx: ServiceContext,
  propertyId?: string | null
): Promise<{ tree: InvoiceTemplateNodeInput; name: string } | null> {
  return withTenant(ctx, async (tx) => {
    if (propertyId) {
      const own = await tx.billingDocumentTemplate.findFirst({
        where: { isDefault: true, propertyId },
      });
      if (own) {
        return own.publishedTree == null
          ? null
          : { tree: asTree(own.publishedTree), name: own.name };
      }
    }
    const shared = await tx.billingDocumentTemplate.findFirst({
      where: { isDefault: true, propertyId: null },
    });
    if (shared?.publishedTree == null) return null;
    return { tree: asTree(shared.publishedTree), name: shared.name };
  });
}

/** The editor's true-render preview read: a template's DRAFT tree by id (so the
 *  author previews unsaved work), or null when it doesn't exist. */
export function getDraftTree(
  ctx: ServiceContext,
  id: string
): Promise<{ tree: InvoiceTemplateNodeInput; name: string } | null> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.billingDocumentTemplate.findUnique({ where: { id } });
    if (!row) return null;
    return { tree: asTree(row.draftTree), name: row.name };
  });
}
