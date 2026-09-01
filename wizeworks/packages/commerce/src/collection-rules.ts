// Collection rule projection.
//
// Rules-driven collections store a `ruleSet` jsonb on ProductCollection.
// The commerce-indexer worker calls projectCollectionRules() whenever a
// product or collection event hints that membership might have changed.
// The function evaluates the rule against current products and writes
// the resulting set into CollectionProduct with addedBy='rule'. Manual
// rows (addedBy='manual') are left alone so the merchant's pinned items
// survive a reprojection.
//
// Rule grammar — the CANONICAL shape authored by the dashboard form, the
// REST create/update routes, collectionService, the presets, and the
// blueprint installer. It is Zod-validated by `CollectionRuleSet` /
// `CollectionPredicate` in @wizeworks/commerce-schemas, and THIS compiler
// consumes that exact same type so the two sides can never drift apart:
//
//   { match: 'all' | 'any', predicates: CollectionPredicate[] }
//
//   match 'all' → AND (every predicate must hold)
//   match 'any' → OR  (at least one predicate holds)
//
// Each predicate is { field, op, value } — one of the discriminated
// members of CollectionPredicate:
//   title        contains | equals | starts_with | ends_with   (string)
//   vendor       equals | in                                    (string | string[])
//   product_type equals | in                                    (string | string[])  → Product.productType
//   tag          equals | any_of | all_of | none_of             (string | string[])   → Product.tags[]
//   price        lt | lte | gt | gte | between                  (cents | [min,max])   → priceMin/MaxCents
//   inventory    in_stock | out_of_stock | low_stock            (boolean, unused)     → Product.inStock / lowStock
//   fitment      matches                                         ({domainId?,categoryId?,itemId?,variantId?,rangeValue?})
//
// Robustness contract (mirrors the storefront read + fitment lookup):
//   • An unknown field or op is SKIPPED with a logged warning — never a
//     silent match-all. If every predicate is skipped, the rule set
//     compiles to "match nothing".
//   • Empty predicates → match nothing (safer than matching every product).
//   • A KNOWN predicate that genuinely cannot be expressed as a Prisma
//     Product where-clause (a fitment predicate with no target) compiles to an
//     explicit no-match `{ id: { in: [] } }` with a warning — an honest, logged
//     gap rather than a silent pass. (inventory `low_stock` is no longer such a
//     gap: it maps to the denormalized `Product.lowStock` column.)
//   • Projection is idempotent and the MAX_PROJECTED_PRODUCTS cap holds.

import { CollectionRuleSet } from '@wizeworks/commerce-schemas';
import type { CollectionPredicate } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { Prisma } from '@wizeworks/db';

import type { ServiceContext } from './errors';

export interface ProjectionDiff {
  collectionId: string;
  added: string[];
  removed: string[];
  unchanged: number;
}

const MAX_PROJECTED_PRODUCTS = 5_000;

/** A where-clause that matches no product. Used as the safe default for an
 *  empty rule set and for a known-but-inexpressible predicate. */
const MATCH_NOTHING: Prisma.ProductWhereInput = { id: { in: [] } };

/** Minimal structural logger — a pino `Logger` satisfies it, so the worker
 *  can pass its own logger straight through; defaults to `console`. */
export interface RuleLogger {
  warn(meta: object, msg?: string): void;
}

const defaultLogger: RuleLogger = {
  warn: (meta, msg) => console.warn(msg ?? 'collection rule warning', meta),
};

/** Resolves a fitment node id to its ancestor-or-self ids (the node's
 *  materialized `path`, root → self). Injected so the compiler stays
 *  unit-testable without a database; production builds it from the tenant tx. */
export type FitmentNodeResolver = (nodeId: string) => Promise<string[]>;

export interface CompileOptions {
  resolveFitmentNode?: FitmentNodeResolver;
  logger?: RuleLogger;
}

/**
 * Recompute the rule-driven membership for one collection. Idempotent.
 * Returns the diff so the worker can log + emit follow-up events.
 */
export async function projectCollectionRules(
  ctx: ServiceContext,
  collectionId: string,
  logger: RuleLogger = defaultLogger
): Promise<ProjectionDiff> {
  return withTenant(ctx, async (tx) => {
    const collection = await tx.productCollection.findFirst({
      where: { id: collectionId, deletedAt: null, type: 'rules' },
      select: { id: true, ruleSet: true },
    });
    if (!collection) {
      return { collectionId, added: [], removed: [], unchanged: 0 };
    }

    // Validate the stored jsonb through the SAME schema the producers write
    // with. A rule set that no longer parses (legacy/hand-edited/corrupt) is
    // projected as "match nothing" with a warning, never a silent match-all.
    let where: Prisma.ProductWhereInput;
    const parsed = CollectionRuleSet.safeParse(collection.ruleSet);
    if (!parsed.success) {
      logger.warn(
        { collectionId, issues: parsed.error.issues },
        'collection ruleSet failed schema validation; projecting empty membership'
      );
      where = MATCH_NOTHING;
    } else {
      where = await compileRuleSet(parsed.data, {
        logger,
        // ancestor-or-self resolution for fitment predicates, mirroring
        // fitmentService.lookup: a make-level part fits a specific-engine query.
        resolveFitmentNode: async (nodeId) => {
          const node = await tx.fitmentNode.findFirst({
            where: { id: nodeId, deletedAt: null },
            select: { path: true },
          });
          return node?.path ?? [nodeId];
        },
      });
    }

    const matches = await tx.product.findMany({
      where: { ...where, deletedAt: null },
      select: { id: true },
      take: MAX_PROJECTED_PRODUCTS,
    });
    const matchIds = new Set(matches.map((m) => m.id));

    const existing = await tx.collectionProduct.findMany({
      where: { collectionId },
      select: { productId: true, addedBy: true },
    });
    const manualIds = new Set(
      existing.filter((e) => e.addedBy === 'manual').map((e) => e.productId)
    );
    const existingRuleIds = new Set(
      existing.filter((e) => e.addedBy === 'rule').map((e) => e.productId)
    );

    const added: string[] = [];
    const removed: string[] = [];
    for (const id of matchIds) {
      if (!existingRuleIds.has(id) && !manualIds.has(id)) added.push(id);
    }
    for (const id of existingRuleIds) {
      if (!matchIds.has(id)) removed.push(id);
    }

    if (removed.length > 0) {
      await tx.collectionProduct.deleteMany({
        where: {
          collectionId,
          addedBy: 'rule',
          productId: { in: removed },
        },
      });
    }
    if (added.length > 0) {
      await tx.collectionProduct.createMany({
        data: added.map((productId, idx) => ({
          collectionId,
          productId,
          position: existing.length + idx,
          addedBy: 'rule',
        })),
        skipDuplicates: true,
      });
    }

    const unchanged = existingRuleIds.size - removed.length;
    return { collectionId, added, removed, unchanged };
  });
}

/**
 * Project every rules-driven collection in the tenant. Used when a
 * product changes and we don't know which rule-driven collections it
 * might newly match — cheaper than nothing, and the workload stays
 * small (typical tenant has <50 rules-driven collections).
 */
export async function projectAllCollectionRulesForTenant(
  ctx: ServiceContext,
  logger: RuleLogger = defaultLogger
): Promise<ProjectionDiff[]> {
  const collectionIds = await withTenant(ctx, async (tx) => {
    const rows = await tx.productCollection.findMany({
      where: { type: 'rules', deletedAt: null },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  });
  const out: ProjectionDiff[] = [];
  for (const id of collectionIds) {
    out.push(await projectCollectionRules(ctx, id, logger));
  }
  return out;
}

/**
 * Project only the rules-driven collections that ASK ABOUT STOCK.
 *
 * An inventory write can change exactly two things on the product face —
 * `inStock` and `lowStock` — so re-running every rule in the tenant on every
 * stock movement would be wasted work on a busy shop. This runs the ones that
 * could actually have changed, which for most tenants is none.
 *
 * It exists because the alternative in place was running NOTHING: the indexer
 * reprojected memberships on `product.created/updated` only, on the reasoning
 * that inventory pings are "identity-preserving on the product face". They are
 * not — `inStock` and `lowStock` are product-face fields and they are rule
 * predicates, so a shop could sell its last unit and leave an `out_of_stock`
 * shelf empty, or drop below a reorder point and leave a "Last chance" shelf
 * empty, for as long as nobody edited the product. Observed on a real
 * storefront (issue 370).
 */
export async function projectInventoryCollectionRulesForTenant(
  ctx: ServiceContext,
  logger: RuleLogger = defaultLogger
): Promise<ProjectionDiff[]> {
  const collectionIds = await withTenant(ctx, async (tx) => {
    const rows = await tx.productCollection.findMany({
      where: { type: 'rules', deletedAt: null },
      select: { id: true, ruleSet: true },
    });
    return rows.filter((r) => asksAboutStock(r.ruleSet)).map((r) => r.id);
  });
  const out: ProjectionDiff[] = [];
  for (const id of collectionIds) {
    out.push(await projectCollectionRules(ctx, id, logger));
  }
  return out;
}

/**
 * Does this rule set contain an `inventory` predicate?
 *
 * Reads the stored jsonb defensively rather than through the Zod schema: a rule
 * set that fails validation still needs an answer here, and the honest answer
 * for one we cannot read is "maybe" — a needless reprojection is cheap, and a
 * skipped one is a shelf that silently stops updating.
 */
function asksAboutStock(ruleSet: unknown): boolean {
  if (ruleSet === null || typeof ruleSet !== 'object') return true;
  const predicates = (ruleSet as { predicates?: unknown }).predicates;
  if (!Array.isArray(predicates)) return true;
  return predicates.some(
    (p) => typeof p === 'object' && p !== null && (p as { field?: unknown }).field === 'inventory'
  );
}

// ─── Rule compilation ────────────────────────────────────────────────

/**
 * Compile a validated rule set into a Prisma Product where-clause.
 * Exported for direct unit testing; the compiler references the SAME
 * `CollectionRuleSet` type that the Zod validator produces.
 */
export async function compileRuleSet(
  ruleSet: CollectionRuleSet,
  opts: CompileOptions = {}
): Promise<Prisma.ProductWhereInput> {
  const logger = opts.logger ?? defaultLogger;
  const predicates = ruleSet.predicates ?? [];
  if (predicates.length === 0) {
    // Empty rule set matches nothing — safer default than matching every
    // product. The dashboard editor + Zod both refuse to save an empty one.
    return MATCH_NOTHING;
  }

  const clauses: Prisma.ProductWhereInput[] = [];
  for (const predicate of predicates) {
    const clause = await compileCondition(predicate, opts.resolveFitmentNode, logger);
    if (clause) clauses.push(clause);
  }
  if (clauses.length === 0) return MATCH_NOTHING;

  // match 'any' → OR, 'all' (default) → AND.
  return ruleSet.match === 'any' ? { OR: clauses } : { AND: clauses };
}

async function compileCondition(
  c: CollectionPredicate,
  resolveFitmentNode: FitmentNodeResolver | undefined,
  logger: RuleLogger
): Promise<Prisma.ProductWhereInput | null> {
  switch (c.field) {
    case 'title':
      return titleMatch(c.op, c.value, logger);
    case 'vendor':
      return stringFieldMatch('vendor', c.op, c.value, logger);
    case 'product_type':
      // Predicate field `product_type` maps to the Prisma column `productType`.
      return stringFieldMatch('productType', c.op, c.value, logger);
    case 'tag':
      return tagMatch(c.op, c.value, logger);
    case 'price':
      return priceMatch(c.op, c.value, logger);
    case 'inventory':
      return inventoryMatch(c.op, logger);
    case 'fitment':
      return compileFitment(c.value, resolveFitmentNode, logger);
    default: {
      // Unknown field (data drift / a predicate retired from the schema).
      // Skip it with a warning — never broaden to match-all silently.
      const field = (c as unknown as { field?: unknown }).field;
      logger.warn({ field }, 'unknown collection rule field; skipping predicate');
      return null;
    }
  }
}

// ─── Per-field compilers ─────────────────────────────────────────────

function titleMatch(
  op: Extract<CollectionPredicate, { field: 'title' }>['op'],
  value: string,
  logger: RuleLogger
): Prisma.ProductWhereInput | null {
  const v = asString(value);
  if (v === null) {
    logger.warn({ op, value }, 'title predicate value is not a string; skipping');
    return null;
  }
  // Case-insensitive: merchants think "titles containing X", not exact case.
  switch (op) {
    case 'contains':
      return { title: { contains: v, mode: 'insensitive' } };
    case 'equals':
      return { title: { equals: v, mode: 'insensitive' } };
    case 'starts_with':
      return { title: { startsWith: v, mode: 'insensitive' } };
    case 'ends_with':
      return { title: { endsWith: v, mode: 'insensitive' } };
    default:
      logger.warn({ op }, 'unknown title op; skipping predicate');
      return null;
  }
}

function stringFieldMatch(
  field: 'vendor' | 'productType',
  op: 'equals' | 'in',
  value: string | string[],
  logger: RuleLogger
): Prisma.ProductWhereInput | null {
  if (op === 'equals') {
    const v = asString(value);
    if (v === null) {
      logger.warn({ field, value }, `${field} equals value is not a string; skipping`);
      return null;
    }
    return { [field]: v };
  }
  if (op === 'in') {
    const arr = asStringArray(value);
    if (arr.length === 0) {
      logger.warn({ field, value }, `${field} in value is not a non-empty list; skipping`);
      return null;
    }
    return { [field]: { in: arr } };
  }
  logger.warn({ field, op }, `unknown ${field} op; skipping predicate`);
  return null;
}

function tagMatch(
  op: Extract<CollectionPredicate, { field: 'tag' }>['op'],
  value: string | string[],
  logger: RuleLogger
): Prisma.ProductWhereInput | null {
  const arr = asStringArray(value);
  if (arr.length === 0) {
    logger.warn({ op, value }, 'tag predicate has no usable tag values; skipping');
    return null;
  }
  // Product.tags is a String[] column → Prisma array operators.
  switch (op) {
    case 'equals':
      // Single tag membership: the product carries this tag.
      return { tags: { has: arr[0] } };
    case 'any_of':
      return { tags: { hasSome: arr } };
    case 'all_of':
      return { tags: { hasEvery: arr } };
    case 'none_of':
      return { NOT: { tags: { hasSome: arr } } };
    default:
      logger.warn({ op }, 'unknown tag op; skipping predicate');
      return null;
  }
}

function priceMatch(
  op: Extract<CollectionPredicate, { field: 'price' }>['op'],
  value: number | [number, number],
  logger: RuleLogger
): Prisma.ProductWhereInput | null {
  // Products carry a DENORMALIZED variant price envelope: priceMinCents (the
  // cheapest variant, the storefront "from" price) and priceMaxCents (the
  // dearest). We compile each op as "at least one variant satisfies it", which
  // over a min/max envelope is exact:
  //   • an UPPER bound (lt/lte) holds iff the CHEAPEST variant satisfies it   → priceMinCents
  //   • a LOWER bound (gt/gte) holds iff the DEAREST variant satisfies it     → priceMaxCents
  //   • `between [lo,hi]` = the product's price range OVERLAPS the bracket
  //     (offers something in it): priceMinCents ≤ hi AND priceMaxCents ≥ lo.
  // (Nulls — a product with no priced variants — never satisfy a numeric
  // filter, so price-less products correctly fall out of price collections.)
  if (op === 'between') {
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      typeof value[0] !== 'number' ||
      typeof value[1] !== 'number'
    ) {
      logger.warn({ value }, 'price between value is not a [min,max] tuple; skipping');
      return null;
    }
    const [lo, hi] = value;
    return { priceMinCents: { lte: hi }, priceMaxCents: { gte: lo } };
  }
  if (typeof value !== 'number') {
    logger.warn({ op, value }, 'price value is not a number; skipping');
    return null;
  }
  switch (op) {
    case 'lt':
      return { priceMinCents: { lt: value } };
    case 'lte':
      return { priceMinCents: { lte: value } };
    case 'gt':
      return { priceMaxCents: { gt: value } };
    case 'gte':
      return { priceMaxCents: { gte: value } };
    default:
      logger.warn({ op }, 'unknown price op; skipping predicate');
      return null;
  }
}

function inventoryMatch(
  op: Extract<CollectionPredicate, { field: 'inventory' }>['op'],
  logger: RuleLogger
): Prisma.ProductWhereInput | null {
  // `value` (boolean, default true) is vestigial — the op is the selector.
  switch (op) {
    case 'in_stock':
      // Product.inStock is a denormalized boolean maintained by inventory
      // event consumers — a direct, indexed column filter.
      return { inStock: true };
    case 'out_of_stock':
      return { inStock: false };
    case 'low_stock':
      // Product.lowStock is a denormalized boolean maintained by the SAME
      // inventory event consumer that maintains inStock (syncProductInStock): it
      // is true when the product is still sellable but at least one variant/
      // warehouse level has crossed its reorder point. A direct, indexed column
      // filter — the column-to-column onHand<=reorderPoint comparison lives in
      // the consumer, not this where-clause.
      return { lowStock: true };
    default:
      logger.warn({ op }, 'unknown inventory op; skipping predicate');
      return null;
  }
}

type FitmentValue = Extract<CollectionPredicate, { field: 'fitment' }>['value'];

async function compileFitment(
  value: FitmentValue,
  resolveFitmentNode: FitmentNodeResolver | undefined,
  logger: RuleLogger
): Promise<Prisma.ProductWhereInput> {
  // Mirrors fitmentService.lookup: a product matches when at least one of its
  // ProductFitment rules is ancestor-or-self of the queried node (a make-level
  // "fits any Ford" part fits a specific-engine query) OR is whole-domain
  // (nodeId null); and, when a range value is given, the rule either declares
  // no range window or has one whose [min,max] contains the value.
  const { domainId, categoryId, itemId, variantId, rangeValue } = value;
  // Deepest level provided wins — its materialized `path` already carries every
  // shallower ancestor, so we only resolve the most specific id.
  const deepestNodeId = variantId ?? itemId ?? categoryId;

  if (!domainId && !deepestNodeId && rangeValue === undefined) {
    logger.warn({}, 'fitment predicate names no domain/node/range; matching nothing');
    return MATCH_NOTHING;
  }

  const some: Prisma.ProductFitmentWhereInput = {};
  if (domainId) some.domainId = domainId;

  const andClauses: Prisma.ProductFitmentWhereInput[] = [];

  if (deepestNodeId) {
    if (!resolveFitmentNode) {
      logger.warn(
        { nodeId: deepestNodeId },
        'fitment predicate targets a node but no resolver was provided; matching nothing'
      );
      return MATCH_NOTHING;
    }
    const ancestorIds = await resolveFitmentNode(deepestNodeId);
    andClauses.push({ OR: [{ nodeId: { in: ancestorIds } }, { nodeId: null }] });
  }

  if (rangeValue !== undefined) {
    andClauses.push({
      OR: [
        // The rule declares no range window at all → applies to every value.
        { ranges: { none: {} } },
        // …or has at least one window whose [min,max] contains the value
        // (an open end — min or max null — is treated as unbounded).
        {
          ranges: {
            some: {
              AND: [
                { OR: [{ min: { lte: rangeValue } }, { min: null }] },
                { OR: [{ max: { gte: rangeValue } }, { max: null }] },
              ],
            },
          },
        },
      ],
    });
  }

  if (andClauses.length > 0) some.AND = andClauses;
  return { fitments: { some } };
}

// ─── Value coercion ──────────────────────────────────────────────────

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') return [value];
  return [];
}
