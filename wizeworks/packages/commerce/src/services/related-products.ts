// What to suggest next to what somebody just bought (sparx persona issue 330).
//
// The order emails' "Pairs well with" rail listed the shop's six newest products,
// whatever the order held. A stranger who bought an injector for a 2007.5 to 2018
// Ram 6.7L Cummins was offered exhaust brakes for a 1994 to 1998 5.9L and a GM
// Duramax: parts that cannot go on her truck, under her own receipt. For a shop
// that sets what its parts fit, a suggestion is only worth making when it fits
// the same thing.
//
// THE RULE, in order:
//   1. Never what is already in the order.
//   2. When the order's items say what they fit, only parts that fit it too: a
//      part set to the same vehicle or to a wider one that holds it (a part for
//      every RAM 2500 fits her 2500 6.7L; one for the 2500 6.7L does not fit
//      every RAM 2500), or set to fit everything in that list. A part with no
//      fit set at all is NOT offered here: in a fitment shop that usually means
//      nobody entered it yet, and Gillett's own titles show those parts are
//      engine-specific. Parts from OTHER categories come first: beside an
//      injector, the exhaust brake and the turbo manifold for the same engine
//      go with it, and another injector is a second choice, not a pairing.
//   3. When nothing in the order says what it fits, parts in the same category,
//      then the newest.
//   4. Nothing that fits is an honest answer. The rail drops, rather than fill
//      itself with parts for somebody else's truck.

import { withTenant, type Prisma } from '@wizeworks/db';

import type { ServiceContext } from '../errors';
import { productSiteVisibility } from './site-visibility';

export interface FitWindow {
  dimensionKey: string;
  min: number | null;
  max: number | null;
}

export interface FitEntry {
  domainId: string;
  /** null = fits everything in the domain. */
  nodeId: string | null;
  /** The node and its ancestors, the node last. Empty for a domain-wide entry. */
  path: readonly string[];
  ranges: readonly FitWindow[];
}

const overlaps = (a: FitWindow, b: FitWindow): boolean =>
  (a.min ?? -Infinity) <= (b.max ?? Infinity) && (b.min ?? -Infinity) <= (a.max ?? Infinity);

/** Two windows on the same dimension must overlap; a dimension only one side sets
 *  does not narrow it. */
const windowsAgree = (a: readonly FitWindow[], b: readonly FitWindow[]): boolean =>
  a.every((wa) => b.every((wb) => wa.dimensionKey !== wb.dimensionKey || overlaps(wa, wb)));

/**
 * Whether a part with `candidate` fit entries goes on something a `bought` entry
 * is for. A candidate entry covers a bought one when it is in the same list and
 * is the same node, a node above it, or the whole list, and their windows agree.
 */
export function fitsWhatWasBought(
  candidate: readonly FitEntry[],
  bought: readonly FitEntry[]
): boolean {
  return candidate.some((c) =>
    bought.some((b) => {
      if (c.domainId !== b.domainId) return false;
      const covers = c.nodeId === null || (b.nodeId !== null && b.path.includes(c.nodeId));
      return covers && windowsAgree(c.ranges, b.ranges);
    })
  );
}

const FIT_SELECT = {
  domainId: true,
  nodeId: true,
  node: { select: { path: true, deletedAt: true } },
  ranges: { select: { dimensionKey: true, min: true, max: true } },
} satisfies Prisma.ProductFitmentSelect;

type FitRow = Prisma.ProductFitmentGetPayload<{ select: typeof FIT_SELECT }>;

function toEntries(rows: readonly FitRow[]): FitEntry[] {
  return rows
    .filter((r) => r.nodeId === null || (r.node && r.node.deletedAt === null))
    .map((r) => ({
      domainId: r.domainId,
      nodeId: r.nodeId,
      path: r.node?.path ?? [],
      ranges: r.ranges.map((w) => ({
        dimensionKey: w.dimensionKey,
        min: w.min === null ? null : Number(w.min),
        max: w.max === null ? null : Number(w.max),
      })),
    }));
}

/**
 * The ids of up to `take` live products to suggest beside `productIds`, best
 * first, by the rule at the top of this file. Empty when nothing qualifies.
 * `propertyId` keeps the suggestions to parts that site shows.
 */
export async function relatedProductIds(
  ctx: ServiceContext,
  productIds: readonly string[],
  opts: { take?: number; propertyId?: string | null } = {}
): Promise<string[]> {
  const take = opts.take ?? 6;
  const bought = [...new Set(productIds)];
  return withTenant(ctx, async (tx) => {
    const live: Prisma.ProductWhereInput = {
      status: 'active',
      deletedAt: null,
      ...(bought.length > 0 ? { id: { notIn: bought } } : {}),
      ...(opts.propertyId ? { AND: [productSiteVisibility(opts.propertyId)] } : {}),
    };
    const [boughtFits, categoryLinks] = await Promise.all([
      bought.length > 0
        ? tx.productFitment.findMany({
            where: { productId: { in: bought } },
            select: FIT_SELECT,
          })
        : Promise.resolve([] as FitRow[]),
      bought.length > 0
        ? tx.categoryProduct.findMany({
            where: { productId: { in: bought } },
            select: { categoryId: true },
          })
        : Promise.resolve([] as { categoryId: string }[]),
    ]);
    const boughtEntries = toEntries(boughtFits);
    const categoryIds = [...new Set(categoryLinks.map((l) => l.categoryId))];

    if (boughtEntries.length > 0) {
      // Every part that could fit: anything set to one of the bought nodes, a node
      // above one, or the whole of one of the bought lists. Read wide, then decided
      // here, where the windows are compared.
      const nodeIds = [...new Set(boughtEntries.flatMap((e) => e.path))];
      const domainIds = [...new Set(boughtEntries.map((e) => e.domainId))];
      const candidates = await tx.product.findMany({
        where: {
          ...live,
          fitments: {
            some: {
              domainId: { in: domainIds },
              OR: [{ nodeId: null }, { nodeId: { in: nodeIds } }],
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          fitments: { select: FIT_SELECT },
          categoryLinks: { select: { categoryId: true } },
        },
      });
      const otherCategory = new Set(
        candidates
          .filter((p) => !p.categoryLinks.some((l) => categoryIds.includes(l.categoryId)))
          .map((p) => p.id)
      );
      const fitting = candidates.filter((p) =>
        fitsWhatWasBought(toEntries(p.fitments), boughtEntries)
      );
      return [
        ...fitting.filter((p) => otherCategory.has(p.id)),
        ...fitting.filter((p) => !otherCategory.has(p.id)),
      ]
        .slice(0, take)
        .map((p) => p.id);
    }

    const picked: string[] = [];
    if (categoryIds.length > 0) {
      const rows = await tx.product.findMany({
        where: { ...live, categoryLinks: { some: { categoryId: { in: categoryIds } } } },
        orderBy: { createdAt: 'desc' },
        take,
        select: { id: true },
      });
      picked.push(...rows.map((r) => r.id));
    }
    if (picked.length < take) {
      const rows = await tx.product.findMany({
        where: { ...live, id: { notIn: [...bought, ...picked] } },
        orderBy: { createdAt: 'desc' },
        take: take - picked.length,
        select: { id: true },
      });
      picked.push(...rows.map((r) => r.id));
    }
    return picked;
  });
}
