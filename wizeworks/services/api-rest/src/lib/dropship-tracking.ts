// Ask each supplier where the parcel is.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
// `SupplierAdapter.getTrackingUpdate()` is declared on the interface and
// implemented by ALL FOUR adapters — dsers, printful, printify, spocket — and
// **nothing in the repo ever called it.** So a dropshipped order was submitted
// to a supplier and then never asked about again: `dropship_orders` kept
// `status: 'submitted'` and a null tracking number forever, the two events
// `dropship.order.shipped` and `dropship.order.delivered` were declared with no
// publisher, and the customer was never told their parcel was on its way.
//
// That is the whole cost of the gap: on a dropship order — where the merchant
// never touches the goods and the supplier's tracking is the ONLY signal that
// exists — nobody found out anything after checkout.
//
// ── WHAT IT POLLS, AND WHAT IT LEAVES ALONE ──────────────────────────────────
// Only rows that are in flight: `submitted` or `shipped`, with a supplier order
// id to ask about. A `delivered` row is finished, a `pending` one has not been
// sent yet, and a `failed` one needs a human rather than another API call.
//
// One supplier's outage must not stop the sweep. Every adapter call is
// individually guarded: a throw is recorded against that row and the poll moves
// on, because the alternative is that the first unreachable supplier freezes
// tracking for every other order in the account.

import {
  createAdapter,
  type Credentials,
  type SupplierAdapter,
  type TrackingInfo,
} from '@wizeworks/dropship';
import { prisma, withTenant } from '@wizeworks/db';

import { publishDomainEvent } from './staff-events.js';

export interface TrackingPollResult {
  checked: number;
  shipped: number;
  delivered: number;
  failed: number;
}

/**
 * The two things this sweep reaches outside itself for.
 *
 * Injected rather than imported at the call site for the same reason
 * `reconcileSupplierPublishes` takes its adapter as an argument: the rules worth
 * pinning here — poll only what is in flight, publish only on a TRANSITION,
 * survive one supplier being down — are unobservable without a fake supplier and
 * a recording publisher. Both default to the real thing, so production code
 * calls `pollDropshipTracking(tenantId)` and nothing else changes.
 */
export interface TrackingPollDeps {
  makeAdapter?: (type: string, credentials: Credentials) => SupplierAdapter;
  publish?: typeof publishDomainEvent;
}

/** The statuses worth asking about. `delivered` is finished and `pending` has
 *  not been sent, so both are pure cost to poll. */
const IN_FLIGHT = ['submitted', 'shipped'];

/** The adapter's tracking vocabulary mapped onto ours. `in_transit` is still
 *  `shipped` for our purposes — it left, which is the only transition our
 *  status column models — and `exception` deliberately does NOT become
 *  `failed`: a customs hold is not a failed submission, and flipping it there
 *  would put the row in a state whose meaning is "the supplier never accepted
 *  this order". */
function mapStatus(info: TrackingInfo): 'shipped' | 'delivered' | null {
  switch (info.status) {
    case 'shipped':
    case 'in_transit':
      return 'shipped';
    case 'delivered':
      return 'delivered';
    default:
      return null;
  }
}

/**
 * Poll every in-flight dropship order for one tenant.
 *
 * Publishes `dropship.order.shipped` / `dropship.order.delivered` only on a
 * TRANSITION. Re-publishing "shipped" every hour for three days would make the
 * event useless as an automation trigger — a customer would get the same "it has
 * shipped" email on every sweep.
 */
export async function pollDropshipTracking(
  tenantId: string,
  deps: TrackingPollDeps = {}
): Promise<TrackingPollResult> {
  const makeAdapter = deps.makeAdapter ?? createAdapter;
  const publish = deps.publish ?? publishDomainEvent;

  const rows = await withTenant({ tenantId }, (tx) =>
    tx.dropshipOrder.findMany({
      where: { status: { in: IN_FLIGHT }, supplierOrderId: { not: null } },
      select: {
        id: true,
        orderId: true,
        status: true,
        supplierOrderId: true,
        trackingNumber: true,
        supplier: { select: { id: true, type: true, credentials: true } },
      },
      take: 500,
    })
  );

  const result: TrackingPollResult = { checked: 0, shipped: 0, delivered: 0, failed: 0 };

  for (const row of rows) {
    if (!row.supplierOrderId) continue;
    result.checked += 1;

    let info: TrackingInfo;
    try {
      const adapter = makeAdapter(row.supplier.type, row.supplier.credentials as Credentials);
      info = await adapter.getTrackingUpdate(row.supplierOrderId);
    } catch (error) {
      // Recorded, not thrown. One supplier being unreachable must not stop the
      // other orders in this account from being checked.
      result.failed += 1;
      await withTenant({ tenantId }, (tx) =>
        tx.dropshipOrder.update({
          where: { id: row.id },
          data: { errorMessage: error instanceof Error ? error.message : String(error) },
        })
      );
      continue;
    }

    const next = mapStatus(info);
    const trackingChanged =
      info.trackingNumber !== null && info.trackingNumber !== row.trackingNumber;

    // Nothing moved and no new tracking number — leave the row entirely alone
    // rather than bumping `updatedAt` on every sweep for every open order.
    if (next === null && !trackingChanged) continue;

    const advanced = next !== null && next !== row.status;
    const now = new Date();

    await withTenant({ tenantId }, (tx) =>
      tx.dropshipOrder.update({
        where: { id: row.id },
        data: {
          ...(advanced ? { status: next } : {}),
          ...(info.trackingNumber !== null ? { trackingNumber: info.trackingNumber } : {}),
          ...(info.trackingUrl !== null ? { trackingUrl: info.trackingUrl } : {}),
          ...(advanced && next === 'shipped' ? { shippedAt: now } : {}),
          ...(advanced && next === 'delivered' ? { deliveredAt: now } : {}),
          // A successful poll clears a previous transport error.
          errorMessage: null,
        },
      })
    );

    if (!advanced) continue;

    if (next === 'shipped') result.shipped += 1;
    else result.delivered += 1;

    await publish(
      next === 'shipped' ? 'dropship.order.shipped' : 'dropship.order.delivered',
      tenantId,
      null,
      {
        dropshipOrderId: row.id,
        orderId: row.orderId,
        supplierId: row.supplier.id,
        trackingNumber: info.trackingNumber,
        trackingUrl: info.trackingUrl,
        carrier: info.carrier,
      }
    );
  }

  return result;
}

/** Tenants with dropship available. Kept beside the poll rather than shared with
 *  `listTenantsWithModule` because dropship is NOT bundled — the plain settings
 *  flag is the whole truth for it, and reading the derived state would be extra
 *  work for the same answer. */
export async function listDropshipTenants(): Promise<{ id: string; slug: string }[]> {
  return prisma.tenant.findMany({
    where: {
      status: 'active',
      settings: { path: ['modules', 'dropship', 'enabled'], equals: true },
    },
    select: { id: true, slug: true },
  });
}
