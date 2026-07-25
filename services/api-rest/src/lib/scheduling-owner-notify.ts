// Owner-facing new-booking alert (docs/79 §10). The counterpart to the customer
// confirmation: when someone books online, the BUSINESS needs to know without
// watching a dashboard. Sent as the keyed `booking-notification-internal` email,
// rendered through the SAME per-site path the customer confirmation uses — so the
// alert represents the SITE the booking belongs to (its sender identity + brand),
// never the tenant's legal/org identity.
//
// This is a direct transactional send (like sendSeatConfirmation), not a ledger
// row: an owner wants "someone just booked" immediately, and it rides the same
// sanctioned booking-confirmation send path. Best-effort throughout — a failed
// notification must never break the booking the customer just made.

import type { FastifyBaseLogger } from 'fastify';
import { withTenant } from '@sparx/db';

import { resolvePrimaryPropertyId } from './property.js';
import { sendTenantEmailByKey } from './tenant-email.js';

const BOOKING_OWNER_EMAIL_KEY = 'booking-notification-internal';

interface HostTarget {
  recipient: string;
  /** The booking's site — drives the per-site sender identity + brand of the alert. */
  propertyId: string | null;
  /** The booking's own customer (used as the email's `customer.*` unless overridden). */
  customerId: string | null;
}

/**
 * WHERE a new-booking alert goes, in priority order:
 *   1. the assigned staff member's own email — the host who actually has to show up;
 *   2. the booking's site business inbox — reply-to (monitored), else from-address;
 *   3. the tenant owner's login email → any staff → the tenant contact.
 * The layered fallback means the business is never left un-notified. Returns null
 * only when nothing at all is resolvable (a tenant with no users and no site inbox).
 */
async function resolveBookingHostTarget(
  tenantId: string,
  bookingId: string
): Promise<HostTarget | null> {
  return withTenant({ tenantId }, async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: {
        propertyId: true,
        customerId: true,
        resources: { select: { resource: { select: { kind: true, userId: true } } } },
      },
    });
    if (!booking) return null;
    const propertyId = booking.propertyId;
    const base = { propertyId, customerId: booking.customerId };

    // 1) The assigned staff member's own email (a staff resource linked to a user).
    const staffUserId = booking.resources
      .map((r) => r.resource)
      .find((r) => r.kind === 'staff' && r.userId)?.userId;
    if (staffUserId) {
      const user = await tx.user.findFirst({
        where: { id: staffUserId, tenantId },
        select: { email: true },
      });
      if (user?.email) return { recipient: user.email, ...base };
    }

    // 2) The site's monitored business inbox (reply-to preferred, else from-address).
    const siteId = propertyId ?? (await resolvePrimaryPropertyId(tenantId));
    const settings = await tx.emailSettings.findUnique({
      where: { tenantId_propertyId: { tenantId, propertyId: siteId } },
      select: { replyTo: true, fromAddress: true },
    });
    const siteInbox = settings?.replyTo ?? settings?.fromAddress ?? null;
    if (siteInbox) return { recipient: siteInbox, ...base };

    // 3) The tenant owner's login → any staff user → the tenant contact address.
    const owner =
      (await tx.user.findFirst({
        where: { tenantId, role: 'owner' },
        orderBy: { createdAt: 'asc' },
        select: { email: true },
      })) ??
      (await tx.user.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
        select: { email: true },
      }));
    if (owner?.email) return { recipient: owner.email, ...base };

    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { email: true } });
    if (tenant?.email) return { recipient: tenant.email, ...base };

    return null;
  });
}

/**
 * Notify the business that a booking was made online. Best-effort — never throws,
 * so a notification failure can't break the booking. No-op when no recipient
 * resolves. `opts.customerId` overrides whose `customer.*` the email renders — the
 * class-signup path passes the ATTENDEE (the session booking itself has no single
 * customer), while an appointment leaves it undefined to use the booking's own.
 */
export async function sendOwnerBookingNotification(
  logger: FastifyBaseLogger,
  tenantId: string,
  bookingId: string,
  opts: { customerId?: string | null } = {}
): Promise<void> {
  try {
    const target = await resolveBookingHostTarget(tenantId, bookingId);
    if (!target) {
      logger.warn({ tenantId, bookingId }, 'owner-booking-notify: no recipient resolved — skipped');
      return;
    }
    const customerId = opts.customerId !== undefined ? opts.customerId : target.customerId;
    await sendTenantEmailByKey(logger, tenantId, {
      key: BOOKING_OWNER_EMAIL_KEY,
      to: target.recipient,
      propertyId: target.propertyId,
      ref: { customerId, bookingId },
      emailType: 'transactional',
      variables: { source: 'scheduling-owner' },
    });
  } catch (err) {
    logger.warn({ tenantId, bookingId, err }, 'owner-booking-notify: failed');
  }
}
