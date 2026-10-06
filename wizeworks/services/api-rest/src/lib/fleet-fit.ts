// "Fits your fleet" on the shop's own pages (sparx persona issue 086).
//
// A signed-in buyer whose trade account has a fleet sees, on every listing, a
// badge on the parts that fit one of their vehicles and those parts first; on a
// product page, which of their vehicles it fits, or a warning when it has fitment
// data and fits none of them. A product with no fitment data at all gets
// neither: no data is not "does not fit".
//
// Whose fleet is decided on the server from the session (the same viewer account
// the "your price" read resolves), never from an account id the browser sends.
// Like "your price", this is an ENHANCEMENT on a catalog read and is not allowed
// to fail one: anything that goes wrong here degrades to saying nothing.

import type { FastifyBaseLogger } from 'fastify';
import { fleetFitForProducts, fleetFittedProductIds, getAccountFleet } from '@wizeworks/b2b';
import { type FleetFit, vehicleLabel } from '@wizeworks/commerce-schemas';

/** Attach `fleetFit` to each product. Null on every product when there is no
 *  viewer account, no fleet that can be matched, or no fitment data. */
export async function withFleetFit<T extends { id: string }>(
  tenantId: string,
  products: T[],
  viewerAccountId: string | undefined,
  log?: FastifyBaseLogger
): Promise<(T & { fleetFit: FleetFit | null })[]> {
  const none = () => products.map((p) => ({ ...p, fleetFit: null }));
  if (!viewerAccountId || products.length === 0) return none();
  try {
    const result = await fleetFitForProducts(
      { tenantId },
      viewerAccountId,
      products.map((p) => p.id)
    );
    if (!result) return none();
    const labelById = new Map(result.vehicles.map((v) => [v.id, vehicleLabel(v)]));
    return products.map((p) => {
      const ids = result.fits.get(p.id);
      if (!ids) return { ...p, fleetFit: null };
      return {
        ...p,
        fleetFit: {
          fits: ids.length > 0,
          vehicles: ids.map((id) => ({ id, label: labelById.get(id) ?? 'Vehicle' })),
        },
      };
    });
  } catch (err) {
    log?.warn({ err }, 'could not work out fleet fit: saying nothing about it');
    return none();
  }
}

/** Every product id that fits the viewer's fleet, for ranking them first. Null
 *  when there is nothing to rank by (or it could not be worked out). */
export async function viewerFittedIds(
  tenantId: string,
  viewerAccountId: string | undefined,
  log?: FastifyBaseLogger
): Promise<string[] | null> {
  if (!viewerAccountId) return null;
  try {
    const ids = await fleetFittedProductIds({ tenantId }, viewerAccountId);
    return ids && ids.length > 0 ? ids : null;
  } catch (err) {
    log?.warn({ err }, 'could not rank fitted parts first: keeping the normal order');
    return null;
  }
}

/** The vehicle a "parts that fit Unit 12" listing is for, and the parts that fit
 *  it. `applied: false` when the viewer has no such vehicle on their account, so
 *  the page can say so instead of showing the whole shop under that heading. */
export async function vehicleRestriction(
  tenantId: string,
  viewerAccountId: string | undefined,
  vehicleId: string
): Promise<
  | { applied: true; vehicle: { id: string; label: string }; productIds: string[] }
  | { applied: false }
> {
  if (!viewerAccountId) return { applied: false };
  const fleet = await getAccountFleet({ tenantId }, viewerAccountId);
  const vehicle = fleet.find((v) => v.id === vehicleId);
  if (!vehicle) return { applied: false };
  const productIds =
    (await fleetFittedProductIds({ tenantId }, viewerAccountId, { vehicleId })) ?? [];
  return { applied: true, vehicle: { id: vehicle.id, label: vehicleLabel(vehicle) }, productIds };
}

/**
 * Which slice of the fitted group and which slice of the rest make up one page
 * when the fitted parts come first. `skip`/`take` are the page's window over the
 * whole listing; `fittedCount` is how many of the listing's products fit.
 */
export function fittedFirstWindow(
  skip: number,
  take: number,
  fittedCount: number
): { fitted: { skip: number; take: number }; rest: { skip: number; take: number } } {
  const fittedTake = Math.max(0, Math.min(take, fittedCount - skip));
  return {
    fitted: { skip: Math.min(skip, fittedCount), take: fittedTake },
    rest: { skip: Math.max(0, skip - fittedCount), take: take - fittedTake },
  };
}

/**
 * One page of a database listing with the fitted parts first. `count` and `find`
 * run the listing's own query narrowed to a set of ids (or away from it), so the
 * order inside each group is the listing's normal order and the total is
 * unchanged.
 */
export async function fittedFirstPage<Row>(opts: {
  fittedIds: string[];
  skip: number;
  take: number;
  count: (ids: { in?: string[]; notIn?: string[] }) => Promise<number>;
  find: (ids: { in?: string[]; notIn?: string[] }, skip: number, take: number) => Promise<Row[]>;
}): Promise<Row[]> {
  const fittedCount = await opts.count({ in: opts.fittedIds });
  const w = fittedFirstWindow(opts.skip, opts.take, fittedCount);
  const [fitted, rest] = await Promise.all([
    w.fitted.take > 0 ? opts.find({ in: opts.fittedIds }, w.fitted.skip, w.fitted.take) : [],
    w.rest.take > 0 ? opts.find({ notIn: opts.fittedIds }, w.rest.skip, w.rest.take) : [],
  ]);
  return [...fitted, ...rest];
}
