// Per-message handler. The scope mapping (planRevalidation) is a pure function
// so tests can assert it without a DB or network; handleEvent wires it to the
// tenant lookup + the storefront revalidate POST.
//
// Failure model:
//   - Unmapped event type or unknown tenant → no-op, ack (return, no throw).
//   - Storefront POST non-2xx / network error → throw, so the Cloud Run
//     entrypoint returns 500 and Pub/Sub redelivers (transient storefront
//     unavailability shouldn't drop a cache purge).

import type { Logger } from 'pino';

import { prisma } from '@wizeworks/db';

import { env } from './env.js';

/** The minimal SparxEvent envelope this worker reads (see @wizeworks/events). */
export interface CacheEventEnvelope {
  type: string;
  tenantId: string;
  actorId?: string | null;
  occurredAt?: string;
  data?: unknown;
}

export type RevalidateScope = 'commerce' | 'content' | 'site' | 'builder';

/**
 * Map an event type to the storefront cache scope it invalidates, or null when
 * the event doesn't affect any cached read. Coarse on purpose: a single
 * `commerce:<slug>` purge clears every commerce read (products, collections,
 * Q&A) for the tenant, which is the right blast radius for a catalog edit.
 */
export function planRevalidation(type: string): RevalidateScope | null {
  if (
    type.startsWith('product.') ||
    type.startsWith('variant.') ||
    type.startsWith('inventory.') ||
    type.startsWith('review.') ||
    type.startsWith('question.')
  ) {
    return 'commerce';
  }
  if (
    type.startsWith('content.') ||
    type.startsWith('content_type.') ||
    type.startsWith('redirect.')
  ) {
    return 'content';
  }
  // Site Builder publish events route here once they're on Pub/Sub (Phase 1
  // ships a noop publisher); the scope is wired so it's a one-line follow-up.
  if (type.startsWith('sitebuilder.')) {
    return 'site';
  }
  // Builder / silica publishes (docs/127 §6). Their own scope rather than 'site':
  // `site:` tags the legacy Site Builder snapshot + resolved nav menus, while
  // `builder:` tags the page/layout/frame/style reads in wizeworks/apps/site's builder.ts and
  // silica.ts. Purging one should not evict the other — they change on different
  // events and a page publish is by far the more frequent of the two.
  if (type.startsWith('builder.')) {
    return 'builder';
  }
  // A tenant's PLATFORM subscription moved — trial to paying, a payment failed,
  // a card was added after the site had gone dark. Published by the Stripe
  // billing webhook after reconciliation, so it carries the post-Stripe truth.
  //
  // ── WHY THIS ONE IS HERE AT ALL ────────────────────────────────────
  //
  // The storefront's tenant payload carries `billingPhase`, and the whole site
  // goes dark on it — `app/layout.tsx` serves the "Back soon" overlay as the
  // entire document when it reads 'suspended'. That payload is fetched with
  // `next: { revalidate: 300 }`, so it is up to FIVE MINUTES stale.
  //
  // `lib/suspended.ts` spells out why that is not acceptable, for the headers:
  // "suspension lifts the moment a payment goes through and a cached 'stay out'
  // would keep the shop dark to a crawler after the business has already paid
  // to be visible." It made every dark ANSWER `no-store` and left the thing
  // that DECIDES the answer on a five-minute cache.
  //
  // So an owner whose site has gone dark adds a card, the console tells her she
  // is back, she opens her own website and it still says "Back soon". Nothing
  // on the screen says to wait. She adds the card again.
  //
  // The scope is 'site' because the tag that actually matters is
  // `tenant:<slug>`, which the storefront's revalidate route purges on EVERY
  // call whatever scope it is given — see app/api/revalidate/route.ts. There is
  // no scope of its own to add: this is the tenant payload, not a section of it.
  // [[feedback_a_fix_leaves_its_neighbour_behind]]
  if (type === 'tenant.subscription.changed') {
    return 'site';
  }
  return null;
}

export interface HandleResult {
  revalidated: boolean;
  scope?: RevalidateScope;
  tenant?: string;
  reason?: string;
}

/** POST the storefront's on-demand revalidation endpoint for one tenant+scope. */
async function postRevalidate(slug: string, scope: RevalidateScope): Promise<void> {
  if (!env.SPARX_REVALIDATE_SECRET) {
    // Misconfiguration — without the secret the storefront returns 503. Throw
    // so it's loud (and retried) rather than silently dropping purges.
    throw new Error('SPARX_REVALIDATE_SECRET is not set');
  }
  const res = await fetch(env.SITE_REVALIDATE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-revalidate-secret': env.SPARX_REVALIDATE_SECRET,
    },
    body: JSON.stringify({ tenant: slug, scopes: [scope] }),
  });
  if (!res.ok) {
    throw new Error(`storefront revalidate returned ${res.status}`);
  }
}

export async function handleEvent(
  event: CacheEventEnvelope,
  logger: Logger
): Promise<HandleResult> {
  const scope = planRevalidation(event.type);
  if (!scope) return { revalidated: false, reason: 'unmapped-type' };

  // tenants is the one non-RLS table; a direct lookup by id is safe here.
  const tenant = await prisma.tenant.findUnique({
    where: { id: event.tenantId },
    select: { slug: true },
  });
  if (!tenant) {
    logger.warn({ tenantId: event.tenantId, type: event.type }, 'unknown tenant; skipping');
    return { revalidated: false, reason: 'unknown-tenant' };
  }

  await postRevalidate(tenant.slug, scope);
  return { revalidated: true, scope, tenant: tenant.slug };
}
