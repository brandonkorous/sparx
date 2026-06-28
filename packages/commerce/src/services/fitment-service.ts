// fitmentService — generalized "what this product fits" reference data +
// per-product applicability. A domain declares an ordered list of DIMENSIONS
// (each a `level` tier or a `range` axis); a single self-referential NODE tree
// holds the values at any depth; a product fitment names the deepest level node
// it targets (null = the whole domain) plus a numeric window per range axis.
//
// Everything is tenant-scoped — there is NO platform-global domain. The platform
// ships a LIBRARY of installable dictionaries (@sparx/commerce-schemas
// FITMENT_DICTIONARIES); installFitmentDictionary stamps a chosen dictionary as
// the tenant's own domain + node tree via the shared planner
// (planFitmentDictionaryRows), so an installed tree and a seeded tree are
// identical. All fitment tables carry tenant_id NOT NULL + FORCE RLS
// (20260924000000_fitment_dimension_model).

import { randomUUID } from 'node:crypto';

import {
  BulkAssignFitmentInput,
  CreateFitmentDomainInput,
  CreateFitmentNodeInput,
  FitmentLookupQuery,
  getFitmentDictionary,
  InstallFitmentDictionaryParams,
  listFitmentDictionarySummaries,
  planFitmentDictionaryRows,
  ProductFitmentInput,
  ReorderFitmentNodesInput,
  UpdateFitmentDomainInput,
  UpdateFitmentNodeInput,
} from '@sparx/commerce-schemas';
import type { FitmentDictionarySummary, FitmentDimension } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import { Prisma } from '@sparx/db';
import type { FitmentNode, ProductFitment } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { CommerceConflictError, CommerceNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';
import { publishCommerceEvent } from '../events';

// ─── Public shapes ────────────────────────────────────────────────────

export interface FitmentDomainRow {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  iconKey: string | null;
  dimensions: FitmentDimension[];
  position: number;
  /** Top-level (root) node count, e.g. "4 makes". */
  rootCount: number;
}

export interface FitmentNodeRow {
  id: string;
  domainId: string;
  parentId: string | null;
  dimensionKey: string;
  name: string;
  slug: string;
  attributes: Record<string, unknown>;
  depth: number;
  position: number;
  /** Number of direct children (drives the expand affordance). */
  childCount: number;
}

export interface ProductFitmentRangeRow {
  dimensionKey: string;
  min: number | null;
  max: number | null;
}

export interface ProductFitmentRow {
  id: string;
  productId: string;
  domainId: string;
  domainSlug: string;
  nodeId: string | null;
  /** The matched node's name (deepest level), null for a whole-domain rule. */
  nodeName: string | null;
  /** Ancestor names incl. self, root → self (e.g. ["Ford","F-250","6.7L"]). */
  nodePath: string[];
  ranges: ProductFitmentRangeRow[];
  notes: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function dimensionsOf(value: Prisma.JsonValue | null): FitmentDimension[] {
  return Array.isArray(value) ? (value as unknown as FitmentDimension[]) : [];
}

function levelKeysOf(dimensions: FitmentDimension[]): string[] {
  return dimensions.filter((d) => d.kind === 'level').map((d) => d.key);
}

// ─── Domain reads + writes ────────────────────────────────────────────

export async function listDomains(ctx: ServiceContext): Promise<FitmentDomainRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.fitmentDomain.findMany({
      where: { deletedAt: null },
      orderBy: [{ position: 'asc' }, { displayName: 'asc' }],
      include: { _count: { select: { nodes: { where: { parentId: null, deletedAt: null } } } } },
    });
    return rows.map((d) => ({
      id: d.id,
      slug: d.slug,
      displayName: d.displayName,
      description: d.description,
      iconKey: d.iconKey,
      dimensions: dimensionsOf(d.dimensions),
      position: d.position,
      rootCount: d._count.nodes,
    }));
  });
}

export async function getDomain(
  ctx: ServiceContext,
  domainId: string
): Promise<FitmentDomainRow | null> {
  return withTenant(ctx, async (tx) => {
    const d = await tx.fitmentDomain.findFirst({
      where: { id: domainId, deletedAt: null },
      include: { _count: { select: { nodes: { where: { parentId: null, deletedAt: null } } } } },
    });
    if (!d) return null;
    return {
      id: d.id,
      slug: d.slug,
      displayName: d.displayName,
      description: d.description,
      iconKey: d.iconKey,
      dimensions: dimensionsOf(d.dimensions),
      position: d.position,
      rootCount: d._count.nodes,
    };
  });
}

export async function createDomain(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ id: string }> {
  const input = CreateFitmentDomainInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const collision = await tx.fitmentDomain.findFirst({
      where: { tenantId: ctx.tenantId, slug: input.slug, deletedAt: null },
      select: { id: true },
    });
    if (collision) {
      throw new CommerceConflictError(
        `Fitment domain "${input.slug}" already exists for this tenant`,
        'slug'
      );
    }

    const created = await tx.fitmentDomain.create({
      data: {
        tenantId: ctx.tenantId,
        slug: input.slug,
        displayName: input.displayName,
        description: input.description ?? null,
        iconKey: input.iconKey ?? null,
        dimensions: input.dimensions,
        position: input.position,
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.fitment.domain_created',
      entityType: 'FitmentDomain',
      entityId: created.id,
      diff: { after: { slug: created.slug, displayName: created.displayName } },
    });

    return created;
  });

  return { id: result.id };
}

export async function updateDomain(
  ctx: ServiceContext,
  domainId: string,
  rawInput: unknown
): Promise<{ id: string }> {
  const input = UpdateFitmentDomainInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const domain = await tx.fitmentDomain.findFirst({
      where: { id: domainId, deletedAt: null },
    });
    if (!domain) throw new CommerceNotFoundError('FitmentDomain', domainId);

    // Guard: removing a `level` dimension that still has nodes would orphan the
    // tree. Adding levels / editing labels / editing range axes is always safe.
    if (input.dimensions) {
      const oldLevels = levelKeysOf(dimensionsOf(domain.dimensions));
      const newLevels = levelKeysOf(input.dimensions);
      const removed = oldLevels.filter((k) => !newLevels.includes(k));
      if (removed.length > 0) {
        const used = await tx.fitmentNode.count({
          where: { domainId, dimensionKey: { in: removed }, deletedAt: null },
        });
        if (used > 0) {
          throw new CommerceConflictError(
            `Can't remove level "${removed.join(', ')}" — ${used} node(s) still use it. Delete those first.`,
            'dimensions'
          );
        }
      }
    }

    const updated = await tx.fitmentDomain.update({
      where: { id: domainId },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
        ...(input.dimensions ? { dimensions: input.dimensions } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.fitment.domain_updated',
      entityType: 'FitmentDomain',
      entityId: domainId,
      diff: { after: { displayName: updated.displayName } },
    });

    return { id: updated.id };
  });
}

/**
 * Uninstall a domain entirely — drops the domain, its whole node tree, and every
 * product fitment that referenced it (the domain FK is Restrict, so the rules
 * are removed first, then the domain cascades its nodes). Returns the count of
 * products whose fitment was affected so the UI can warn before confirming.
 */
export async function deleteDomain(
  ctx: ServiceContext,
  domainId: string
): Promise<{ productsAffected: number }> {
  return withTenant(ctx, async (tx) => {
    const domain = await tx.fitmentDomain.findFirst({
      where: { id: domainId, deletedAt: null },
      select: { id: true, slug: true, displayName: true },
    });
    if (!domain) throw new CommerceNotFoundError('FitmentDomain', domainId);

    const affected = await tx.productFitment.findMany({
      where: { domainId },
      select: { productId: true },
      distinct: ['productId'],
    });

    await tx.productFitment.deleteMany({ where: { domainId } });
    await tx.fitmentDomain.delete({ where: { id: domainId } });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.fitment.domain_deleted',
      entityType: 'FitmentDomain',
      entityId: domainId,
      diff: { before: { slug: domain.slug, displayName: domain.displayName } },
    });

    return { productsAffected: affected.length };
  });
}

// ─── Dictionary library (install a platform fitment dictionary) ───────

export function listFitmentDictionaries(): FitmentDictionarySummary[] {
  return listFitmentDictionarySummaries();
}

/**
 * Stamp a platform dictionary as a tenant-scoped domain + node tree. Conflict is
 * by slug (409). The stamping codepath (planFitmentDictionaryRows) is shared
 * with the demo seed, so an installed tree and a seeded tree are identical.
 */
export async function installFitmentDictionary(
  ctx: ServiceContext,
  rawSlug: unknown
): Promise<{ id: string }> {
  const { slug } = InstallFitmentDictionaryParams.parse({ slug: rawSlug });
  const dict = getFitmentDictionary(slug);
  if (!dict) throw new CommerceNotFoundError('FitmentDictionary', slug);

  return withTenant(ctx, async (tx) => {
    const collision = await tx.fitmentDomain.findFirst({
      where: { tenantId: ctx.tenantId, slug: dict.slug, deletedAt: null },
      select: { id: true },
    });
    if (collision) {
      throw new CommerceConflictError(
        `Fitment domain "${dict.slug}" already exists for this tenant`,
        'slug'
      );
    }

    const planned = planFitmentDictionaryRows(dict, ctx.tenantId, () => randomUUID());

    await tx.fitmentDomain.create({
      data: {
        id: planned.domain.id,
        tenantId: planned.domain.tenantId,
        slug: planned.domain.slug,
        displayName: planned.domain.displayName,
        description: planned.domain.description,
        iconKey: planned.domain.iconKey,
        dimensions: planned.domain.dimensions,
        position: planned.domain.position,
      },
    });
    if (planned.nodes.length > 0) {
      await tx.fitmentNode.createMany({
        data: planned.nodes.map((n) => ({
          id: n.id,
          tenantId: n.tenantId,
          domainId: n.domainId,
          parentId: n.parentId,
          dimensionKey: n.dimensionKey,
          name: n.name,
          slug: n.slug,
          attributes: n.attributes,
          path: n.path,
          pathNames: n.pathNames,
          depth: n.depth,
          position: n.position,
        })),
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.fitment.dictionary_installed',
      entityType: 'FitmentDomain',
      entityId: planned.domain.id,
      diff: {
        after: {
          dictionary: dict.slug,
          displayName: dict.name,
          nodes: planned.nodes.length,
        },
      },
    });

    return { id: planned.domain.id };
  });
}

// ─── Nodes (the value tree, any depth) ────────────────────────────────

/** List the children of `parentId` (or top-level nodes when parentId is null). */
export async function listNodes(
  ctx: ServiceContext,
  domainId: string,
  parentId: string | null
): Promise<FitmentNodeRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.fitmentNode.findMany({
      where: { domainId, parentId, deletedAt: null },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { children: { where: { deletedAt: null } } } } },
    });
    return rows.map(toNodeRow);
  });
}

export async function createNode(ctx: ServiceContext, rawInput: unknown): Promise<{ id: string }> {
  const input = CreateFitmentNodeInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const domain = await tx.fitmentDomain.findFirst({
      where: { id: input.domainId, deletedAt: null },
      select: { id: true, dimensions: true },
    });
    if (!domain) throw new CommerceNotFoundError('FitmentDomain', input.domainId);
    const levelKeys = levelKeysOf(dimensionsOf(domain.dimensions));

    const parent = input.parentId
      ? await tx.fitmentNode.findFirst({
          where: { id: input.parentId, domainId: input.domainId, deletedAt: null },
          select: { id: true, path: true, pathNames: true, depth: true },
        })
      : null;
    if (input.parentId && !parent) {
      throw new CommerceNotFoundError('FitmentNode', input.parentId);
    }

    const depth = parent ? parent.depth + 1 : 0;
    const dimensionKey = levelKeys[depth];
    if (!dimensionKey) {
      throw new CommerceConflictError(
        `This domain has ${levelKeys.length} level(s); can't add a node deeper than that. Add a level dimension first.`,
        'parentId'
      );
    }

    const collision = await tx.fitmentNode.findFirst({
      where: {
        domainId: input.domainId,
        parentId: input.parentId ?? null,
        slug: input.slug,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (collision) {
      throw new CommerceConflictError(
        `A node with slug "${input.slug}" already exists here`,
        'slug'
      );
    }

    const id = randomUUID();
    const path = parent ? [...parent.path, id] : [id];
    const pathNames = parent ? [...parent.pathNames, input.name] : [input.name];

    const created = await tx.fitmentNode.create({
      data: {
        id,
        tenantId: ctx.tenantId,
        domainId: input.domainId,
        parentId: input.parentId ?? null,
        dimensionKey,
        name: input.name,
        slug: input.slug,
        attributes: input.attributes as Prisma.InputJsonValue,
        path,
        pathNames,
        depth,
        position: input.position,
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.fitment.node_created',
      entityType: 'FitmentNode',
      entityId: created.id,
      diff: { after: { name: created.name, domainId: created.domainId, depth } },
    });

    return created;
  });

  return { id: result.id };
}

export async function updateNode(
  ctx: ServiceContext,
  nodeId: string,
  rawInput: unknown
): Promise<{ id: string }> {
  const input = UpdateFitmentNodeInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const node = await tx.fitmentNode.findFirst({
      where: { id: nodeId, deletedAt: null },
    });
    if (!node) throw new CommerceNotFoundError('FitmentNode', nodeId);

    if (input.slug && input.slug !== node.slug) {
      const collision = await tx.fitmentNode.findFirst({
        where: {
          domainId: node.domainId,
          parentId: node.parentId,
          slug: input.slug,
          deletedAt: null,
          id: { not: nodeId },
        },
        select: { id: true },
      });
      if (collision) {
        throw new CommerceConflictError(
          `A node with slug "${input.slug}" already exists here`,
          'slug'
        );
      }
    }

    await tx.fitmentNode.update({
      where: { id: nodeId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.attributes !== undefined
          ? { attributes: input.attributes as Prisma.InputJsonValue }
          : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
      },
    });

    // A rename must propagate into the materialized pathNames of this node AND
    // every descendant (their path_names share this node's name at its depth).
    if (input.name !== undefined && input.name !== node.name) {
      const idx = node.depth + 1; // path_names is 1-indexed in Postgres
      await tx.$executeRaw`
        UPDATE commerce_fitment_nodes
        SET path_names[${Prisma.raw(String(idx))}] = ${input.name}, updated_at = now()
        WHERE tenant_id = ${ctx.tenantId}::uuid AND path @> ARRAY[${nodeId}::uuid]
      `;
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.fitment.node_updated',
      entityType: 'FitmentNode',
      entityId: nodeId,
      diff: { after: { name: input.name ?? node.name } },
    });

    return { id: nodeId };
  });
}

/**
 * Delete a node and everything under it — child nodes cascade (parent FK), and
 * every product fitment pointing at this node or a descendant cascades (node
 * FK). Returns the count of products whose fitment was affected for the confirm.
 */
export async function deleteNode(
  ctx: ServiceContext,
  nodeId: string
): Promise<{ productsAffected: number }> {
  return withTenant(ctx, async (tx) => {
    const node = await tx.fitmentNode.findFirst({
      where: { id: nodeId, deletedAt: null },
      select: { id: true, name: true, domainId: true },
    });
    if (!node) throw new CommerceNotFoundError('FitmentNode', nodeId);

    // Products attached at this node OR any descendant (path contains nodeId).
    const subtree = await tx.fitmentNode.findMany({
      where: { domainId: node.domainId, path: { has: nodeId } },
      select: { id: true },
    });
    const subtreeIds = subtree.map((n) => n.id);
    const affected =
      subtreeIds.length > 0
        ? await tx.productFitment.findMany({
            where: { nodeId: { in: subtreeIds } },
            select: { productId: true },
            distinct: ['productId'],
          })
        : [];

    await tx.fitmentNode.delete({ where: { id: nodeId } });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.fitment.node_deleted',
      entityType: 'FitmentNode',
      entityId: nodeId,
      diff: { before: { name: node.name } },
    });

    return { productsAffected: affected.length };
  });
}

/** Reorder siblings (same parent within a domain) to match `orderedIds`. */
export async function reorderNodes(ctx: ServiceContext, rawInput: unknown): Promise<void> {
  const input = ReorderFitmentNodesInput.parse(rawInput);

  await withTenant(ctx, async (tx) => {
    const siblings = await tx.fitmentNode.findMany({
      where: { domainId: input.domainId, parentId: input.parentId ?? null, deletedAt: null },
      select: { id: true },
    });
    const known = new Set(siblings.map((s) => s.id));
    const ordered = input.orderedIds.filter((id) => known.has(id));

    await Promise.all(
      ordered.map((id, position) => tx.fitmentNode.update({ where: { id }, data: { position } }))
    );
  });
}

// ─── Per-product fitment ──────────────────────────────────────────────

export async function listForProduct(
  ctx: ServiceContext,
  productId: string
): Promise<ProductFitmentRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.productFitment.findMany({
      where: { productId },
      orderBy: [{ id: 'asc' }],
      include: {
        domain: { select: { slug: true } },
        node: { select: { name: true, pathNames: true } },
        ranges: { select: { dimensionKey: true, min: true, max: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      productId: r.productId,
      domainId: r.domainId,
      domainSlug: r.domain.slug,
      nodeId: r.nodeId,
      nodeName: r.node?.name ?? null,
      nodePath: r.node?.pathNames ?? [],
      ranges: r.ranges.map((rg) => ({
        dimensionKey: rg.dimensionKey,
        min: rg.min === null ? null : Number(rg.min),
        max: rg.max === null ? null : Number(rg.max),
      })),
      notes: r.notes,
    }));
  });
}

/**
 * Replace all fitment rows for a product. Atomic: existing rows wiped inside the
 * same transaction the new rows insert in, so the catalog never observes a
 * half-written state. Each rule's range windows insert as child rows.
 */
export async function setForProduct(
  ctx: ServiceContext,
  productId: string,
  fitments: Omit<ProductFitmentInput, 'productId'>[]
): Promise<void> {
  const validated = fitments.map((f) => ProductFitmentInput.omit({ productId: true }).parse(f));

  await withTenant(ctx, async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new CommerceNotFoundError('Product', productId);

    await tx.productFitment.deleteMany({ where: { productId } });
    for (const f of validated) {
      await tx.productFitment.create({
        data: {
          tenantId: ctx.tenantId,
          productId,
          domainId: f.domainId,
          nodeId: f.nodeId ?? null,
          notes: f.notes ?? null,
          ranges: {
            create: f.ranges.map((rg) => ({
              tenantId: ctx.tenantId,
              dimensionKey: rg.dimensionKey,
              min: rg.min ?? null,
              max: rg.max ?? null,
            })),
          },
        },
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.fitment.product_set',
      entityType: 'Product',
      entityId: productId,
      diff: { after: { fitmentCount: validated.length } },
    });
  });

  await publishCommerceEvent({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    topic: 'product.updated',
    data: { productId, change: 'fitment' },
  });
}

/**
 * Bulk-apply the same fitment set to a batch of products. Used by catalog
 * importers (AAIA, supplier feed, merchant CSV) that slice the feed into "this
 * set of products fits these things" buckets and fan out one call per bucket.
 */
export async function bulkAssign(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ rowsAffected: number }> {
  const input = BulkAssignFitmentInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const existingProductCount = await tx.product.count({
      where: { id: { in: input.productIds }, deletedAt: null },
    });
    if (existingProductCount !== input.productIds.length) {
      throw new CommerceNotFoundError(
        'Product',
        `${input.productIds.length - existingProductCount} of ${input.productIds.length}`
      );
    }

    let rowsAffected = 0;
    for (const productId of input.productIds) {
      await tx.productFitment.deleteMany({ where: { productId } });
      for (const f of input.fitments) {
        await tx.productFitment.create({
          data: {
            tenantId: ctx.tenantId,
            productId,
            domainId: f.domainId,
            nodeId: f.nodeId ?? null,
            notes: f.notes ?? null,
            ranges: {
              create: f.ranges.map((rg) => ({
                tenantId: ctx.tenantId,
                dimensionKey: rg.dimensionKey,
                min: rg.min ?? null,
                max: rg.max ?? null,
              })),
            },
          },
        });
        rowsAffected += 1;
      }
      await writeAuditLog({
        tx,
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'user' : 'system',
        action: 'commerce.fitment.bulk_assigned',
        entityType: 'Product',
        entityId: productId,
        diff: { after: { fitmentCount: input.fitments.length } },
      });
    }

    return { rowsAffected };
  });

  await Promise.all(
    input.productIds.map((productId) =>
      publishCommerceEvent({
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        topic: 'product.updated',
        data: { productId, change: 'fitment' },
      })
    )
  );

  return result;
}

export async function deleteFitment(ctx: ServiceContext, fitmentId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.productFitment.findFirst({ where: { id: fitmentId } });
    if (!before) throw new CommerceNotFoundError('ProductFitment', fitmentId);

    await tx.productFitment.delete({ where: { id: fitmentId } });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.fitment.row_deleted',
      entityType: 'ProductFitment',
      entityId: fitmentId,
      diff: { before: serializeFitment(before) },
    });

    await publishCommerceEvent({
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      topic: 'product.updated',
      data: { productId: before.productId, change: 'fitment' },
    });
  });
}

// ─── Catalog filter ───────────────────────────────────────────────────

export interface FitmentLookupResult {
  productIds: string[];
  total: number;
}

/**
 * Resolve "what fits this thing?" — returns product IDs with at least one
 * fitment rule matching. A rule matches when its node is an ancestor-or-self of
 * the queried node (a make-level rule fits a specific engine query) OR the rule
 * is whole-domain (nodeId null); and for each queried range value, the rule
 * either has no window for that axis or its [min, max] window contains the value.
 */
export async function lookup(ctx: ServiceContext, rawQuery: unknown): Promise<FitmentLookupResult> {
  const query = FitmentLookupQuery.parse(rawQuery);

  return withTenant(ctx, async (tx) => {
    let nodeMatch: Prisma.ProductFitmentWhereInput = {};
    if (query.nodeId) {
      const node = await tx.fitmentNode.findFirst({
        where: { id: query.nodeId, deletedAt: null },
        select: { path: true },
      });
      // node.path = ancestor ids incl. self → rules attached anywhere on that
      // chain (or whole-domain) match the specific query.
      const ancestorIds = node?.path ?? [query.nodeId];
      nodeMatch = { OR: [{ nodeId: { in: ancestorIds } }, { nodeId: null }] };
    }

    const rangeMatches: Prisma.ProductFitmentWhereInput[] = (query.rangeValues ?? []).map((rv) => ({
      OR: [
        { ranges: { none: { dimensionKey: rv.dimensionKey } } },
        {
          ranges: {
            some: {
              dimensionKey: rv.dimensionKey,
              AND: [
                { OR: [{ min: { lte: rv.value } }, { min: null }] },
                { OR: [{ max: { gte: rv.value } }, { max: null }] },
              ],
            },
          },
        },
      ],
    }));

    const where: Prisma.ProductFitmentWhereInput = {
      ...(query.domainId ? { domainId: query.domainId } : {}),
      ...nodeMatch,
      ...(rangeMatches.length > 0 ? { AND: rangeMatches } : {}),
      product: { deletedAt: null, status: 'active' },
    };

    const rows = await tx.productFitment.findMany({
      where,
      select: { productId: true },
      distinct: ['productId'],
      take: 5000,
    });

    return { productIds: rows.map((r) => r.productId), total: rows.length };
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────

function toNodeRow(n: FitmentNode & { _count: { children: number } }): FitmentNodeRow {
  return {
    id: n.id,
    domainId: n.domainId,
    parentId: n.parentId,
    dimensionKey: n.dimensionKey,
    name: n.name,
    slug: n.slug,
    attributes: (n.attributes ?? {}) as Record<string, unknown>,
    depth: n.depth,
    position: n.position,
    childCount: n._count.children,
  };
}

function serializeFitment(f: ProductFitment): Record<string, unknown> {
  return {
    id: f.id,
    productId: f.productId,
    domainId: f.domainId,
    nodeId: f.nodeId,
  };
}
