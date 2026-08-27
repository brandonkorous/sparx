// The clock behind "Baskets left behind".
//
// Everything else about cart abandonment already existed: a per-site
// `cartAbandonmentMinutes` an owner can set in Commerce settings, a
// `findIdleCarts` query whose own docstring reads "Worker sweep",
// `markAbandoned` to write the column and publish `cart.abandoned`, a console
// tab that filters on it, and a report that counts it. Nothing ran them.
//
// `markAbandoned` had exactly one caller — a manual admin endpoint somebody has
// to POST per basket — so `abandoned_at` was non-null on ZERO rows across every
// tenant, all time. The console's "Walked away" tab has never held a row and
// could not, and the owner's threshold was a dial connected to nothing.
//
// The same shape, and the same fix, as the funnels sweep, whose comment says it
// best: the signal fires because a person STOPPED, and an absence has no request
// behind it.

import { cartService, commerceSiteService } from '../services';

export interface CartAbandonmentSweepResult {
  tenantId: string;
  /** Sites looked at, counting the no-site scope as one. */
  scopes: number;
  found: number;
  marked: number;
  failed: number;
}

/**
 * Mark every basket that has gone quiet past its own site's threshold.
 *
 * Per SITE rather than per tenant, because the threshold is a per-site setting
 * and one number for a tenant with two shops would be wrong for at least one of
 * them. `commerceSiteService.getSettings` resolves the primary site's row for a site that has none,
 * which is the same inheritance a basket carrying NO site needs — so it now
 * takes `null` and both go through the one fallback.
 */
export async function sweepAbandonedCarts(input: {
  tenantId: string;
  now?: Date;
}): Promise<CartAbandonmentSweepResult> {
  const ctx = { tenantId: input.tenantId };
  const now = input.now ?? new Date();
  const scopes = await cartService.listCartSiteScopes(ctx);

  let found = 0;
  let marked = 0;
  let failed = 0;

  for (const propertyId of scopes) {
    const settings = await commerceSiteService.getSettings(ctx, propertyId);
    const ids = await cartService.findIdleCarts(
      ctx,
      settings.cartAbandonmentMinutes,
      propertyId,
      now
    );
    found += ids.length;

    for (const cartId of ids) {
      // One at a time, and swallowed, for the reason the funnels sweep gives:
      // each basket is a different person, and one bad row must not cost the
      // rest their follow-up. `markAbandoned` is a no-op on a basket already
      // marked, so a retried run cannot double-announce.
      try {
        await cartService.markAbandoned(ctx, cartId);
        marked += 1;
      } catch {
        failed += 1;
      }
    }
  }

  return { tenantId: input.tenantId, scopes: scopes.length, found, marked, failed };
}
