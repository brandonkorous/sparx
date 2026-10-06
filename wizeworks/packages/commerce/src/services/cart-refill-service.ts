// cartRefillService: put a LIST of items into a cart, and say what happened to
// each one (sparx persona issue 086).
//
// The /b2b page promised "reorder a past order in a click" and "Accounts keep
// named saved carts". Order again and a saved cart's Add to cart both come here.
//
// Every line goes through `cartService.addItem`, the same add-to-cart the
// product page uses, so it is priced at TODAY's price for this shopper and
// account (never the price on the old order or the day the list was saved), and
// the account's quantity rules, today's allowance and the stock check all apply.
// A line one of those refuses is skipped with the shop's own words, and the rest
// still go in. Nothing here writes a cart line itself.

import { withTenant } from '@wizeworks/db';

import { CommerceNotFoundError, CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import * as cartService from './cart-service';

export interface RefillLine {
  /** Null when the item has gone from the catalog since. */
  variantId: string | null;
  quantity: number;
  /** What the buyer calls it, from the order or the saved cart. */
  name: string;
}

/** not_sold: archived or deleted. out_of_stock: none on the shelf. limited: a
 *  rule refused the quantity (a minimum, a maximum, a case pack, today's
 *  allowance), in the shop's own words. */
export type RefillSkipReason = 'not_sold' | 'out_of_stock' | 'limited';

export interface RefillAdded {
  name: string;
  /** What went in. Less than `requested` when only that many were in stock. */
  quantity: number;
  requested: number;
}

export interface RefillSkipped {
  name: string;
  quantity: number;
  reason: RefillSkipReason;
  /** One sentence the buyer can read as it stands. */
  message: string;
}

export interface RefillResult {
  added: RefillAdded[];
  skipped: RefillSkipped[];
}

function isOutOfStock(err: unknown): err is { available: number } {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 'OUT_OF_STOCK' &&
    typeof (err as { available?: unknown }).available === 'number'
  );
}

/** Two lines of one item become one, in the order they first appear. */
function combine(lines: readonly RefillLine[]): RefillLine[] {
  const out: RefillLine[] = [];
  const byVariant = new Map<string, RefillLine>();
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    if (!line.variantId) {
      out.push({ ...line });
      continue;
    }
    const seen = byVariant.get(line.variantId);
    if (seen) {
      seen.quantity += line.quantity;
      continue;
    }
    const copy = { ...line };
    byVariant.set(line.variantId, copy);
    out.push(copy);
  }
  return out;
}

/** The items in `variantIds` the shop sells today: not deleted, on a product
 *  that is live. Add-to-cart prices anything that exists, so this is the one
 *  place an archived product is kept out of a reorder. */
async function sellable(ctx: ServiceContext, variantIds: string[]): Promise<Set<string>> {
  if (variantIds.length === 0) return new Set();
  const rows = await withTenant(ctx, (tx) =>
    tx.productVariant.findMany({
      where: {
        id: { in: variantIds },
        deletedAt: null,
        product: { deletedAt: null, status: 'active' },
      },
      select: { id: true },
    })
  );
  return new Set(rows.map((r) => r.id));
}

export async function refillCart(
  ctx: ServiceContext,
  cartId: string,
  lines: readonly RefillLine[]
): Promise<RefillResult> {
  const result: RefillResult = { added: [], skipped: [] };
  const wanted = combine(lines);
  const onSale = await sellable(
    ctx,
    wanted.map((l) => l.variantId).filter((id): id is string => id !== null)
  );

  for (const line of wanted) {
    const notSold: RefillSkipped = {
      name: line.name,
      quantity: line.quantity,
      reason: 'not_sold',
      message: `${line.name} is no longer sold.`,
    };
    if (!line.variantId || !onSale.has(line.variantId)) {
      result.skipped.push(notSold);
      continue;
    }

    const add = (quantity: number) =>
      cartService.addItem(ctx, { cartId, variantId: line.variantId, quantity });
    try {
      await add(line.quantity);
      result.added.push({ name: line.name, quantity: line.quantity, requested: line.quantity });
    } catch (err) {
      if (isOutOfStock(err)) {
        const available = Math.floor(err.available);
        if (available > 0 && available < line.quantity) {
          // Some is better than none for a reorder: put in what is there and
          // say how much, rather than skipping the whole line.
          try {
            await add(available);
            result.added.push({ name: line.name, quantity: available, requested: line.quantity });
            continue;
          } catch (retryErr) {
            if (!(retryErr instanceof CommerceValidationError) && !isOutOfStock(retryErr)) {
              throw retryErr;
            }
          }
        }
        result.skipped.push({
          name: line.name,
          quantity: line.quantity,
          reason: 'out_of_stock',
          message: `${line.name} is out of stock.`,
        });
      } else if (err instanceof CommerceValidationError) {
        result.skipped.push({
          name: line.name,
          quantity: line.quantity,
          reason: 'limited',
          message: err.message,
        });
      } else if (err instanceof CommerceNotFoundError) {
        result.skipped.push(notSold);
      } else {
        throw err;
      }
    }
  }
  return result;
}
