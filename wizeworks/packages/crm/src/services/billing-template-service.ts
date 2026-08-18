// billingTemplateService — the invoice/estimate PRINT TEMPLATE catalog (docs/87
// §10, Phase 5b). The node-tree successor to the code default renderer: one row
// per template (BillingDocumentTemplate), the editor edits the DRAFT tree, and
// publishing snapshots it. The tenant's `isDefault` template drives the document
// `…/pdf` render once published; until then the built-in code renderer is used, so
// a tenant never *must* design one.
//
// A peer of @wizeworks/builder's emailService in the builder framework — same
// draft/publish lifecycle, same lazy "seed-a-default, edit-a-copy" idiom. The tree
// is stored opaque here (validated structurally by crm-schemas on write); the
// api-rest renderer interprets it. Tenant-scoped via withTenant() — a callsite that
// forgets it sees nothing (FORCE RLS).

import {
  CreateBillingTemplateInput,
  UpdateBillingTemplateInput,
  type InvoiceTemplateNodeInput,
} from '@wizeworks/crm-schemas';
import { DEFAULT_INVOICE_TEMPLATE } from '@wizeworks/crm-schemas/builtins';
import { withTenant } from '@wizeworks/db';
import type { BillingDocumentTemplate, Prisma } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';

export interface BillingTemplateDto {
  id: string;
  name: string;
  isDefault: boolean;
  /** The editor's working tree (the draft). */
  tree: InvoiceTemplateNodeInput;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const asJson = (tree: InvoiceTemplateNodeInput): Prisma.InputJsonValue =>
  tree as unknown as Prisma.InputJsonValue;

const asTree = (json: Prisma.JsonValue): InvoiceTemplateNodeInput =>
  json as unknown as InvoiceTemplateNodeInput;

function toDto(row: BillingDocumentTemplate): BillingTemplateDto {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    tree: asTree(row.draftTree),
    published: row.publishedTree != null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** List the tenant's templates. On first use (zero rows) seed the built-in default
 *  as the tenant's `isDefault` template — the lazy-materialization idiom (cf.
 *  emailService.listOrSeed). Seeded as DRAFT only (publishedTree null): the code
 *  default renderer stays in effect until the tenant publishes a template. */
export function listOrSeed(ctx: ServiceContext): Promise<BillingTemplateDto[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.billingDocumentTemplate.findMany({ orderBy: { createdAt: 'asc' } });
    if (rows.length > 0) return rows.map(toDto);

    const seededRow = await tx.billingDocumentTemplate.create({
      data: {
        tenantId: ctx.tenantId,
        name: DEFAULT_INVOICE_TEMPLATE.name,
        isDefault: true,
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
    const seeded = await tx.billingDocumentTemplate.findMany({ orderBy: { createdAt: 'asc' } });
    return seeded.map(toDto);
  });
}

export function get(ctx: ServiceContext, id: string): Promise<BillingTemplateDto> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.billingDocumentTemplate.findUnique({ where: { id } });
    if (!row) throw new CrmNotFoundError('BillingDocumentTemplate', id);
    return toDto(row);
  });
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<BillingTemplateDto> {
  const input = CreateBillingTemplateInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    // The first template a tenant creates becomes the default; an explicit
    // `isDefault` clears any existing default (one default per tenant — the
    // partial-unique index is the backstop).
    const existingCount = await tx.billingDocumentTemplate.count();
    const makeDefault = input.isDefault || existingCount === 0;
    if (makeDefault) {
      await tx.billingDocumentTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    const created = await tx.billingDocumentTemplate.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        isDefault: makeDefault,
        draftTree: asJson(input.tree ?? DEFAULT_INVOICE_TEMPLATE.tree),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.template.created',
      entityType: 'BillingDocumentTemplate',
      entityId: created.id,
      diff: { after: { name: created.name } },
    });
    return toDto(created);
  });
}

/** Rename and/or save the draft tree. Draft-tree saves are the high-frequency
 *  editor autosave path — deliberately NOT audited. */
export async function update(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<BillingTemplateDto> {
  const input = UpdateBillingTemplateInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const existing = await tx.billingDocumentTemplate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new CrmNotFoundError('BillingDocumentTemplate', id);

    const data: Prisma.BillingDocumentTemplateUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.tree !== undefined) data.draftTree = asJson(input.tree);

    const updated = await tx.billingDocumentTemplate.update({ where: { id }, data });
    return toDto(updated);
  });
}

/** Snapshot the draft tree into the published tree — from then on the tenant's
 *  default template (when this is it) drives `…/pdf` through the tree renderer. */
export async function publish(ctx: ServiceContext, id: string): Promise<BillingTemplateDto> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.billingDocumentTemplate.findUnique({ where: { id } });
    if (!existing) throw new CrmNotFoundError('BillingDocumentTemplate', id);
    const updated = await tx.billingDocumentTemplate.update({
      where: { id },
      data: { publishedTree: existing.draftTree as Prisma.InputJsonValue, publishedAt: new Date() },
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

/** Make this template the tenant's default (the one that drives `…/pdf`). Clears
 *  the prior default first so the partial-unique index never trips. */
export async function setDefault(ctx: ServiceContext, id: string): Promise<BillingTemplateDto> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.billingDocumentTemplate.findUnique({ where: { id } });
    if (!existing) throw new CrmNotFoundError('BillingDocumentTemplate', id);
    if (!existing.isDefault) {
      await tx.billingDocumentTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
      await tx.billingDocumentTemplate.update({ where: { id }, data: { isDefault: true } });
    }
    const fresh = await tx.billingDocumentTemplate.findUniqueOrThrow({ where: { id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.template.set_default',
      entityType: 'BillingDocumentTemplate',
      entityId: id,
      diff: { after: { isDefault: true } },
    });
    return toDto(fresh);
  });
}

export async function remove(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.billingDocumentTemplate.findUnique({ where: { id } });
    if (!existing) throw new CrmNotFoundError('BillingDocumentTemplate', id);
    // A tenant must always have a default template to fall back on — deleting the
    // default is blocked; promote another template first.
    if (existing.isDefault) {
      throw new CrmValidationError(
        'Cannot delete the default template — set another template as default first.'
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

/** The render read (docs/87 §10): the tenant's default template's PUBLISHED tree,
 *  or null when there is none (no default, or the default isn't published yet) —
 *  the `…/pdf` route then falls back to the built-in code renderer. */
export function getActivePublishedTree(
  ctx: ServiceContext
): Promise<{ tree: InvoiceTemplateNodeInput; name: string } | null> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.billingDocumentTemplate.findFirst({ where: { isDefault: true } });
    if (row?.publishedTree == null) return null;
    return { tree: asTree(row.publishedTree), name: row.name };
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
