// Per-message handler. The scope mapping (planRevalidation) is a pure function
// so tests can assert it without a DB or network; handle() wires it to the
// tenant lookup and the site's revalidate POST.
//
// Failure model (the broker's, see @wizeworks/events consumer.ts):
//   - Off-schema envelope → parseEvent returns null; acked, never retried.
//   - Unmapped event type or unknown tenant → no-op, acked.
//   - Site POST non-2xx / network error / missing secret → THROW, so the
//     consumer naks and the broker redelivers. A site that is restarting must
//     not cost a purge, and a misconfiguration must be loud on every event
//     rather than silently leave every business on a five-minute-old page.

import type { Logger } from 'pino';
import { z } from 'zod';

import { prisma } from '@wizeworks/db';

import { env } from './env.js';

/** The minimal SparxEvent envelope this handler reads (see @wizeworks/events). */
const Envelope = z.object({
  type: z.string().min(1),
  tenantId: z.string().min(1),
  actorId: z.string().nullable().optional(),
  occurredAt: z.string().optional(),
  data: z.unknown().optional(),
});

export type CacheEventEnvelope = z.infer<typeof Envelope>;

export function parseEvent(raw: unknown): CacheEventEnvelope | null {
  const result = Envelope.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * Which of the site's cached reads an event invalidates. Each names a tag family
 * on the site (app/api/revalidate/route.ts); `all` purges every family.
 *
 * Whatever the scope, the site ALSO purges `tenant:<slug>` on every call: the
 * business payload (name, logo, socials, cookie banner, billing phase) and the
 * builder reads that carry the same tag.
 */
export type RevalidateScope = 'commerce' | 'content' | 'site' | 'builder' | 'all';

/**
 * Map an event type to the cache scope it invalidates, or null when the event
 * doesn't affect any cached read. Coarse on purpose: a single `commerce:<slug>`
 * purge clears every commerce read (products, collections, Q&A) for the tenant,
 * which is the right blast radius for a catalog edit.
 *
 * This decides what a message DOES. Which messages arrive at all is the explicit
 * `EVENTS` list in index.ts, and a test asserts every name there maps here.
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
  // A markup rule moved a variant's price on its own (docs/48 §8). The price a
  // shopper is quoted is a commerce read, and nothing else announces the change:
  // `variant.updated` is the owner's edit, this is the machine's.
  if (type === 'price.recomputed') {
    return 'commerce';
  }
  if (
    type.startsWith('content.') ||
    type.startsWith('content_type.') ||
    type.startsWith('redirect.')
  ) {
    return 'content';
  }
  // The legacy Site Builder's own topics (`sitebuilder.published`, …). They live
  // on that package's in-process publisher, not on the bus, so nothing delivers
  // one here today; the branch stays so the day they are bridged needs no change.
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
  // The tenant renamed itself or changed its social links (PATCH /v1/tenant).
  // Both are in the business payload (the name is the fallback a site with no
  // name of its own shows, and the tenant's links are the fallback for a site
  // with none), so, like the billing case above, `tenant:<slug>` is the tag.
  if (type === 'tenant.updated') {
    return 'site';
  }
  // A site's own settings changed without a publish: its name, links, contact
  // details, brand, cookie banner, shop display settings, payment method, footer
  // legal links (see `SiteUpdatedPayload` in @wizeworks/events). EVERY scope,
  // because those values are read in more than one family: the business payload
  // is `tenant:`, the footer's legal links are `content:`, and the rare owner
  // save that causes this is not worth a per-field table that drifts.
  if (type === 'site.updated') {
    return 'all';
  }
  // A blueprint install writes a catalog, pages, a theme and a brand in one go.
  // Nothing smaller than every scope describes it.
  if (type === 'template.installed') {
    return 'all';
  }
  // A module switched on or off. The flags live in the tenant's settings, which
  // the business payload carries (the site reads `modules.chat` to decide
  // whether to draw the chat bubble), and a module's public reads answer 404
  // while it is off. Switching Selling off must take the shop down at once, not
  // after the cached catalog ages out; switching it on must not show "not found".
  if (type === 'module.activated' || type === 'module.deactivated') {
    return 'all';
  }
  return null;
}

export interface HandleResult {
  revalidated: boolean;
  scope?: RevalidateScope;
  tenant?: string;
  reason?: string;
}

/**
 * The POST body for one purge. `all` sends no scopes, which the route reads as
 * every scope it knows, so a family added on the site side is covered without
 * a change here.
 */
export function revalidateBody(
  slug: string,
  scope: RevalidateScope
): { tenant: string; scopes?: string[] } {
  return scope === 'all' ? { tenant: slug } : { tenant: slug, scopes: [scope] };
}

/** POST the site's on-demand revalidation route for one tenant + scope. */
async function postRevalidate(slug: string, scope: RevalidateScope): Promise<void> {
  if (!env.SPARX_REVALIDATE_SECRET) {
    // Misconfiguration — without the secret the site answers 503. Throw so it is
    // loud (and retried) rather than silently dropping purges.
    throw new Error('SPARX_REVALIDATE_SECRET is not set');
  }
  const res = await fetch(env.SITE_REVALIDATE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-revalidate-secret': env.SPARX_REVALIDATE_SECRET,
    },
    body: JSON.stringify(revalidateBody(slug, scope)),
    // A hung site must not hold the consumer: the broker redelivers on a throw.
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`site revalidate returned ${res.status}`);
  }
}

export async function handle(event: CacheEventEnvelope, logger: Logger): Promise<HandleResult> {
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
  logger.debug({ type: event.type, tenant: tenant.slug, scope }, 'site cache purged');
  return { revalidated: true, scope, tenant: tenant.slug };
}
