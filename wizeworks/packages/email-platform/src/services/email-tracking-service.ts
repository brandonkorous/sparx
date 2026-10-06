// emailTrackingService — resolve the link-click attribution context a send tags its
// on-site links with (docs/impl transactional-email Slice 10).
//
// A tenant's email links are rewritten at send so a click lands on the storefront
// carrying `utm_medium=email` + `utm_campaign=<this email>`, which the storefront
// beacon reads to classify the visit (and any order that follows) as `email`. This
// service answers the two send-time questions that turns into:
//
//   · WHICH hosts count as "on-site" (only links to the tenant's own site are tagged
//     — an off-site carrier / social link can't be measured by the tenant's own
//     analytics). That's the tenant's verified custom domains PLUS the site's own
//     public address (`@wizeworks/db/site-origin`), the host every merge-tag link
//     (`{{site.url}}`, order/product URLs) already resolves to.
//   · Under WHICH campaign + source the click reports — the email's own name (or an
//     author override) and its stable key/slug.
//
// It lives here (not in api-rest) so BOTH send paths share one implementation: the
// transactional/automation path (api-rest `renderBuilderEmailDoc`) and the
// render-once broadcast path (`broadcast-service`, same package).
//
// The site's own address used to be `SPARX_SITE_BASE` with the tenant slug, which
// nothing sets, so on a tenant with no custom domain there was no host to tag and
// every email's links shipped untagged: email-driven visits and orders were never
// credited to email (sparx persona issue 064). It is now the same resolver the
// links themselves are built on, so the host tagged is the host they point at.

import { withTenant } from '@wizeworks/db';
import { resolveSiteOrigin } from '@wizeworks/db/site-origin';
import type { EmailLinkTracking } from '@wizeworks/email/silica';

import type { ServiceContext } from '../errors';

/** The bare, `www.`-stripped host of an absolute URL, or null when it isn't one. */
function hostOf(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return host || null;
  } catch {
    return null;
  }
}

/** The first of `vals` that is non-empty once trimmed, else `fallback`. Used instead
 *  of `a || b` so an empty string (a blank override, a name that slugs to nothing)
 *  falls through — which `??` would not do. */
function firstNonEmpty(vals: (string | null | undefined)[], fallback: string): string {
  for (const v of vals) {
    const t = (v ?? '').trim();
    if (t.length > 0) return t;
  }
  return fallback;
}

/** A slug fallback for `utm_source` when an email has no built-in key (a custom
 *  email): the name lower-cased, non-alphanumerics collapsed to single hyphens. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/** The tenant's tracked site hosts for a property: its verified/active domains, the
 *  site's own public address, and `linkOrigin` (the origin the email's links were
 *  actually built on, when the caller knows it: an order email links into the site
 *  the order was placed on). De-duplicated, `www.`-stripped. */
async function resolveTrackedHosts(
  ctx: ServiceContext,
  propertyId: string | null,
  linkOrigin?: string | null
): Promise<string[]> {
  return withTenant(ctx, async (tx) => {
    const [origin, domains] = await Promise.all([
      resolveSiteOrigin(tx, ctx.tenantId, propertyId),
      tx.domain.findMany({
        where: {
          status: { in: ['verified', 'active'] },
          ...(propertyId ? { propertyId } : {}),
        },
        select: { host: true },
      }),
    ]);
    const hosts = new Set<string>();
    for (const d of domains) {
      const h = d.host?.toLowerCase().replace(/^www\./, '');
      if (h) hosts.add(h);
    }
    for (const url of [origin, linkOrigin]) {
      const h = url ? hostOf(url) : null;
      if (h) hosts.add(h);
    }
    return [...hosts];
  });
}

/** The email identity a tracking context is built from — the fields a
 *  `BuilderEmailDto` / `PublishedEmailDto` already carries. */
export interface TrackableEmail {
  key: string | null;
  name: string;
  trackingCampaign: string | null;
}

/**
 * Resolve the {@link EmailLinkTracking} for a send, or `undefined` when there's no
 * on-site host to attribute to (links then ship untagged). `campaign` is the author's
 * override else the email's name; `source` is the built-in key else a slug of the name.
 * `linkOrigin` is the origin the email's links were built on, when the caller has it.
 */
export async function resolveEmailTracking(
  ctx: ServiceContext,
  email: TrackableEmail,
  propertyId: string | null,
  linkOrigin?: string | null
): Promise<EmailLinkTracking | undefined> {
  const hosts = await resolveTrackedHosts(ctx, propertyId, linkOrigin);
  if (hosts.length === 0) return undefined;
  const campaign = firstNonEmpty([email.trackingCampaign, email.name], 'Email').slice(0, 64);
  const source = firstNonEmpty([email.key, slugify(email.name)], 'email').slice(0, 64);
  return { campaign, source, hosts };
}
