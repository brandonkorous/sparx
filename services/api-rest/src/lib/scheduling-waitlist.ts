// Waitlist auto-offer tick (docs/79 §7). When a service has a `waiting` customer
// and a slot opens in their window, offer it (hold with a TTL) + notify them, and
// expire stale offers/windows. Cross-tenant scan via the SECURITY DEFINER
// find_tenants_with_waitlist_work (migration 20260919000000); per-tenant work runs
// under withTenant in the engine. Singleton across pods via an advisory lock —
// mirrors lib/scheduling-calendar-sync.ts. The offer NOTIFICATION is sent here (not
// the BookingNotification ledger, which is bookingId-keyed) — a direct transactional
// send, since there's no booking yet.

import { ADVISORY_LOCKS } from '@sparx/db';
import type { FastifyBaseLogger } from 'fastify';
import { prisma, withTenant } from '@sparx/db';
import {
  expireWaitlistOffers,
  getAvailability,
  listWaitlist,
  offerWaitlistEntry,
  renderWaitlistOfferSms,
} from '@sparx/scheduling';
import { resolveSmsProvider } from '@sparx/sms';

import { env } from '../env.js';
import { resolveActivePropertyName } from './property.js';
import { sendTenantEmailByKey } from './tenant-email.js';

const WAITLIST_LOCK_KEY = ADVISORY_LOCKS.SCHEDULING_WAITLIST;
const DEFAULT_INTERVAL_MS = 300_000; // every 5 min
const SCAN_LIMIT = 200;
const SITE_BASE = process.env.SPARX_SITE_BASE ?? '';

function bookUrl(slug: string, serviceId: string): string {
  const base = SITE_BASE.replace('{slug}', slug);
  return `${base}/book/${serviceId}`;
}

function dateOnly(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Send the offer notification (email via the tenant's waitlist-offer tree, SMS via
 *  the provider) for a freshly-offered entry. Best-effort — never throws. */
export async function sendWaitlistOffer(
  logger: FastifyBaseLogger,
  tenantId: string,
  entryId: string
): Promise<void> {
  const entry = await withTenant({ tenantId }, (tx) =>
    tx.waitlistEntry.findUnique({
      where: { id: entryId },
      select: {
        customerId: true,
        serviceId: true,
        desiredFrom: true,
        desiredTo: true,
        service: { select: { name: true } },
      },
    })
  );
  if (!entry) return;
  const customer = await withTenant({ tenantId }, (tx) =>
    tx.customer.findUnique({
      where: { id: entry.customerId },
      select: { email: true, phone: true },
    })
  );
  if (!customer) return;

  if (customer.email) {
    await sendTenantEmailByKey(logger, tenantId, {
      key: 'waitlist-offer',
      to: customer.email,
      ref: { customerId: entry.customerId, waitlistEntryId: entryId },
    }).catch((err: unknown) => {
      logger.warn({ tenantId, entryId, err }, 'waitlist: offer email failed');
      return undefined;
    });
  }

  if (customer.phone) {
    const [siteName, tenant] = await Promise.all([
      resolveActivePropertyName(tenantId, null),
      withTenant({ tenantId }, (tx) =>
        tx.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } })
      ),
    ]);
    const body = renderWaitlistOfferSms({
      serviceName: entry.service?.name ?? 'a service',
      windowLabel: `${dateOnly(entry.desiredFrom)} – ${dateOnly(entry.desiredTo)}`,
      siteName: siteName || 'Your booking',
      bookUrl: bookUrl(tenant?.slug ?? '', entry.serviceId),
    });
    const result = await resolveSmsProvider(env).send({ to: customer.phone, body, tenantId });
    if (!result.success) logger.warn({ tenantId, entryId }, 'waitlist: offer SMS failed');
  }
}

export interface WaitlistTickResult {
  acquired: boolean;
  tenants: number;
  offered: number;
}

/** Process one tenant: expire stale entries, then offer the oldest waiting customer
 *  per service that currently has an opening in their window. */
async function processTenant(logger: FastifyBaseLogger, tenantId: string): Promise<number> {
  await expireWaitlistOffers(tenantId);
  const waiting = await listWaitlist(tenantId, { status: 'waiting' }); // oldest first
  const offeredServices = new Set<string>();
  const now = Date.now();
  let offered = 0;
  for (const entry of waiting) {
    if (offeredServices.has(entry.serviceId)) continue; // one offer per service per tick
    const fromMs = Math.max(now, entry.desiredFrom.getTime());
    if (fromMs >= entry.desiredTo.getTime()) continue; // window already passed
    const slots = await getAvailability(
      tenantId,
      {
        serviceId: entry.serviceId,
        from: new Date(fromMs).toISOString(),
        to: entry.desiredTo.toISOString(),
      },
      now
    ).catch(() => []);
    if (slots.length === 0) continue;
    await offerWaitlistEntry(tenantId, entry.id);
    await sendWaitlistOffer(logger, tenantId, entry.id);
    offeredServices.add(entry.serviceId);
    offered += 1;
  }
  return offered;
}

export async function runWaitlistTick(logger: FastifyBaseLogger): Promise<WaitlistTickResult> {
  const lock = await prisma.$queryRaw<{ acquired: boolean }[]>`
    SELECT pg_try_advisory_lock(${WAITLIST_LOCK_KEY}::int) AS acquired
  `;
  if (!lock[0]?.acquired) return { acquired: false, tenants: 0, offered: 0 };

  try {
    const rows = await prisma.$queryRaw<{ tenant_id: string }[]>`
      SELECT tenant_id FROM find_tenants_with_waitlist_work(${SCAN_LIMIT}::int)
    `;
    if (rows.length === 0) return { acquired: true, tenants: 0, offered: 0 };

    let offered = 0;
    for (const row of rows) {
      try {
        offered += await processTenant(logger, row.tenant_id);
      } catch (err) {
        logger.warn({ tenantId: row.tenant_id, err }, 'waitlist-tick: tenant failed');
      }
    }
    return { acquired: true, tenants: rows.length, offered };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${WAITLIST_LOCK_KEY}::int)`;
  }
}

export function startWaitlistLoop(
  logger: FastifyBaseLogger,
  intervalMs: number = DEFAULT_INTERVAL_MS
): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      await runWaitlistTick(logger);
    } catch (err) {
      logger.error({ err }, 'waitlist-tick: tick threw — will retry next interval');
    }
    if (stopped) return;
    timer = setTimeout(() => void tick(), intervalMs);
  };

  timer = setTimeout(() => void tick(), intervalMs);
  logger.info({ intervalMs }, 'waitlist-tick: loop started');

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    logger.info('waitlist-tick: loop stopped');
  };
}
