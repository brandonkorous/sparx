// pageLayoutService — page layouts (PageLayout) keyed by a layout TARGET, the
// P-B generalization of the old fixed `scope` enum (docs/30 §4, docs/36 §4,
// docs/handoffs/sitebuilder-pb-spec.md).
//
// The surface is (targetId, key) / pageLayoutId: callers resolve-or-create a
// layout, then do section CRUD by pageLayoutId. The legacy `pageKey` mapping
// ("home" ↔ site:home/default, "<slug>" ↔ cms:content-page/<slug>) no longer
// lives here — it survives only in the snapshot read path (publish-internals +
// the storefront), which still reads pre-Phase-3 published SiteVersions.

import {
  CreatePageLayoutInput,
  DEFAULT_TEMPLATES,
  InstantiateLayoutInput,
  MaterializePageLayoutInput,
  RenamePageLayoutInput,
  defaultLayoutName,
  getLayoutTarget,
  getPageTemplate,
  parseSectionConfig,
} from '@wizeworks/sitebuilder-schemas';
import type { PageLayout, Prisma, TxClient } from '@wizeworks/db';
import { withTenant } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { SitebuilderNotFoundError, SitebuilderValidationError } from '../errors';
import { getOrCreatePrimaryConfig } from './_config';

// The transport-facing view of a PageLayout (stable shape across REST/MCP/SA).
export interface PageLayoutView {
  id: string;
  tenantId: string;
  targetId: string;
  key: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

function toView(layout: PageLayout): PageLayoutView {
  return {
    id: layout.id,
    tenantId: layout.tenantId,
    targetId: layout.targetId,
    key: layout.key,
    name: layout.name,
    createdAt: layout.createdAt,
    updatedAt: layout.updatedAt,
  };
}

/** Find-or-create the layout for a (targetId, key); lazily materialized like SiteConfig. */
export async function getOrCreatePageLayout(
  tx: TxClient,
  tenantId: string,
  targetId: string,
  key: string,
  name: string
): Promise<PageLayout> {
  const existing = await tx.pageLayout.findUnique({
    where: { tenantId_targetId_key: { tenantId, targetId, key } },
  });
  if (existing) return existing;
  return tx.pageLayout.create({ data: { tenantId, targetId, key, name } });
}

/** Find (without creating) the layout for a (targetId, key). */
export function findPageLayout(
  tx: TxClient,
  tenantId: string,
  targetId: string,
  key: string
): Promise<PageLayout | null> {
  return tx.pageLayout.findUnique({
    where: { tenantId_targetId_key: { tenantId, targetId, key } },
  });
}

/** All page layouts for a tenant, optionally filtered by target (editor + listing). */
export function list(ctx: ServiceContext, targetId?: string): Promise<PageLayoutView[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.pageLayout.findMany({
      where: targetId ? { targetId } : {},
      orderBy: [{ targetId: 'asc' }, { key: 'asc' }],
    });
    return rows.map(toView);
  });
}

/** Resolve-or-create the (targetId, key) layout (lazily materialized, empty). */
export function getOrCreate(ctx: ServiceContext, rawInput: unknown): Promise<PageLayoutView> {
  const input = CreatePageLayoutInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const layout = await getOrCreatePageLayout(
      tx,
      ctx.tenantId,
      input.targetId,
      input.key,
      input.name ?? defaultLayoutName(input.targetId, input.key)
    );
    return toView(layout);
  });
}

/**
 * "Customize this layout" (docs/36 §3): resolve-or-create the (targetId, key)
 * layout and, if it's still empty, copy the code-defined DEFAULT_TEMPLATES rows
 * into real SiteSection rows. Idempotent — a layout that already has sections is
 * returned untouched, so a second call never duplicates. Targets without a code
 * default (site:home / cms:content-page) just get an empty layout.
 */
export function materializeDefault(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<PageLayoutView> {
  const { targetId, key } = MaterializePageLayoutInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    await getOrCreatePrimaryConfig(tx, ctx.tenantId);
    const layout = await getOrCreatePageLayout(
      tx,
      ctx.tenantId,
      targetId,
      key,
      defaultLayoutName(targetId, key)
    );

    const existing = await tx.siteSection.count({ where: { pageLayoutId: layout.id } });
    const defaults =
      existing === 0 && (targetId === 'commerce:product' || targetId === 'commerce:collection')
        ? DEFAULT_TEMPLATES[targetId]
        : [];

    if (defaults.length > 0) {
      for (const [position, d] of defaults.entries()) {
        const config = parseSectionConfig(d.sectionType, d.config);
        await tx.siteSection.create({
          data: {
            tenantId: ctx.tenantId,
            pageLayoutId: layout.id,
            sectionType: d.sectionType,
            position,
            config: config as Prisma.InputJsonValue,
          },
        });
      }
      await writeAuditLog({
        tx,
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        actorType: 'user',
        action: 'sitebuilder.page_layout.materialized',
        entityType: 'PageLayout',
        entityId: layout.id,
        diff: { after: { targetId, key, sections: defaults.length } },
      });
    }

    return toView(layout);
  });
}

/** Fetch one layout by id (RLS scopes to the tenant; a cross-tenant id 404s). */
export function getById(ctx: ServiceContext, id: string): Promise<PageLayoutView> {
  return withTenant(ctx, async (tx) => {
    const layout = await tx.pageLayout.findUnique({ where: { id } });
    if (!layout) throw new SitebuilderNotFoundError('PageLayout', id);
    return toView(layout);
  });
}

// A storefront-safe layout key from a human name: lowercase, non-alphanumerics
// collapsed to hyphens, trimmed. Empty input (all punctuation) → "layout".
function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
  return s || 'layout';
}

/** A key unique within (tenant, targetId): the desired slug, else `<slug>-2`, … */
function uniqueKey(taken: ReadonlySet<string>, desired: string): string {
  if (!taken.has(desired)) return desired;
  for (let n = 2; ; n++) {
    const candidate = `${desired}-${n}`.slice(0, 255);
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Instantiate a NEW page layout for a target from a Page Template (docs/36 §10):
 * create the PageLayout with a unique key, then copy the template's composition
 * into real SiteSection rows. Unlike `materializeDefault` (which is keyed and
 * idempotent on the `default` layout), this always creates a fresh named layout —
 * the tenant can have many per target. A bound template only fits a target of the
 * same binding.
 */
export function instantiate(ctx: ServiceContext, rawInput: unknown): Promise<PageLayoutView> {
  const input = InstantiateLayoutInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const template = getPageTemplate(input.templateId);
    if (!template) {
      throw new SitebuilderValidationError(`Unknown page template "${input.templateId}".`, [
        { field: 'templateId', message: 'no such template' },
      ]);
    }
    // A bound template needs a target of the same binding (a product template
    // can't compose a collection page); a null-binding template fits any target.
    const targetBinding = getLayoutTarget(input.targetId)?.binding ?? null;
    if (template.binding !== null && template.binding !== targetBinding) {
      throw new SitebuilderValidationError(
        `Template "${template.id}" needs a ${template.binding} target, not "${input.targetId}".`,
        [{ field: 'templateId', message: 'template/target binding mismatch' }]
      );
    }

    await getOrCreatePrimaryConfig(tx, ctx.tenantId);
    // Empty-trimmed-string fallbacks (a blank name/key falls back). The explicit
    // length guard keeps `??` semantics off the table — `??` would keep `''`.
    const trimmedName = input.name?.trim();
    const name = trimmedName && trimmedName.length > 0 ? trimmedName : template.name;
    const trimmedKey = input.key?.trim();
    const desiredKey = trimmedKey && trimmedKey.length > 0 ? trimmedKey : slugify(name);
    const existing = await tx.pageLayout.findMany({
      where: { targetId: input.targetId },
      select: { key: true },
    });
    const taken = new Set(existing.map((r) => r.key));
    const key = uniqueKey(taken, desiredKey);

    const layout = await tx.pageLayout.create({
      data: { tenantId: ctx.tenantId, targetId: input.targetId, key, name },
    });

    for (const [position, d] of template.sections.entries()) {
      const config = parseSectionConfig(d.sectionType, d.config);
      await tx.siteSection.create({
        data: {
          tenantId: ctx.tenantId,
          pageLayoutId: layout.id,
          sectionType: d.sectionType,
          position,
          config: config as Prisma.InputJsonValue,
        },
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'sitebuilder.page_layout.instantiated',
      entityType: 'PageLayout',
      entityId: layout.id,
      diff: {
        after: {
          targetId: input.targetId,
          key,
          templateId: template.id,
          sections: template.sections.length,
        },
      },
    });

    return toView(layout);
  });
}

/** Rename a layout (label only; `key` is immutable). */
export function rename(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<PageLayoutView> {
  const input = RenamePageLayoutInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const existing = await tx.pageLayout.findUnique({ where: { id } });
    if (!existing) throw new SitebuilderNotFoundError('PageLayout', id);
    const layout = await tx.pageLayout.update({
      where: { id },
      data: { name: input.name.trim() },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'sitebuilder.page_layout.renamed',
      entityType: 'PageLayout',
      entityId: id,
      diff: { before: { name: existing.name }, after: { name: layout.name } },
    });
    return toView(layout);
  });
}

/** Delete a layout. Cascade removes its sections + any default/per-item
 *  assignment rows that point at it (all FKs are onDelete: Cascade), so the
 *  storefront cleanly falls back to the cascade (→ the seeded code default). */
export function remove(ctx: ServiceContext, id: string): Promise<void> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.pageLayout.findUnique({ where: { id } });
    if (!existing) throw new SitebuilderNotFoundError('PageLayout', id);
    await tx.pageLayout.delete({ where: { id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'sitebuilder.page_layout.removed',
      entityType: 'PageLayout',
      entityId: id,
      diff: { before: { targetId: existing.targetId, key: existing.key, name: existing.name } },
    });
  });
}
