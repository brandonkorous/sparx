import { describe, expect, it } from 'vitest';

import { planRevalidation, revalidateBody } from '../src/handler.js';
import { EVENTS } from '../src/index.js';

describe('planRevalidation', () => {
  it('maps catalog + review + Q&A events to the commerce scope', () => {
    for (const type of [
      'product.created',
      'product.updated',
      'product.deleted',
      'variant.updated',
      'inventory.adjusted',
      'review.published',
      'question.published',
      'question.answered',
    ]) {
      expect(planRevalidation(type)).toBe('commerce');
    }
  });

  it('purges commerce when a markup rule reprices a variant on its own', () => {
    // `price.recomputed` is the only announcement that a price a shopper is quoted
    // moved without anyone editing the variant. Not a `variant.` or `product.`
    // name, so no prefix catches it.
    expect(planRevalidation('price.recomputed')).toBe('commerce');
  });

  it('maps content + redirect events to the content scope', () => {
    for (const type of [
      'content.entry.published',
      'content.entry.updated',
      'content.entry.unpublished',
      'content_type.upserted',
      'redirect.added',
    ]) {
      expect(planRevalidation(type)).toBe('content');
    }
  });

  it('purges a tenant whose platform subscription moved', () => {
    // SEEN ON SCREEN 2026-09-25: four businesses' sites were dark because their
    // trials had lapsed. Their subscriptions were set active in the database and
    // `robots.txt` answered 200 straight away, while the PAGES went on serving
    // "Back soon" — the storefront's tenant payload carries `billingPhase` and is
    // fetched with `revalidate: 300`.
    //
    // Nothing purged it, because this function had no billing case: an owner who
    // pays watches her own website stay dark with no explanation.
    expect(planRevalidation('tenant.subscription.changed')).toBe('site');
  });

  it('purges the business payload when the tenant renames itself', () => {
    // PATCH /v1/tenant publishes `tenant.updated` for a new name or new social
    // links, and both are fallbacks the business payload serves.
    expect(planRevalidation('tenant.updated')).toBe('site');
  });

  it('purges every scope when a site’s own settings change', () => {
    // MEASURED 2026-10-01 (sparx persona issue 040): a cookie-banner save took 68
    // seconds to reach the live site, because nothing published anything and
    // nothing consumed it. `site.updated` is what those saves publish now; the
    // values it covers are read under `tenant:` AND `content:` (the footer's legal
    // links), so one scope is not enough.
    expect(planRevalidation('site.updated')).toBe('all');
  });

  it('purges every scope when a blueprint is installed', () => {
    expect(planRevalidation('template.installed')).toBe('all');
  });

  it('purges every scope when a module is switched on or off', () => {
    // The flags ride in the business payload (the chat bubble reads one), and a
    // switched-off module's public reads answer 404 from then on.
    expect(planRevalidation('module.activated')).toBe('all');
    expect(planRevalidation('module.deactivated')).toBe('all');
  });

  it('leaves commerce subscriptions alone', () => {
    // `subscription.*` are a SHOP's own customers' commerce subscriptions — a
    // different thing with a confusingly similar name, and nothing about them
    // changes whether the site is served at all. The guard above must not be
    // satisfied by purging on both.
    for (const type of ['subscription.created', 'subscription.renewed', 'subscription.paused']) {
      expect(planRevalidation(type)).toBeNull();
    }
  });

  it('maps Site Builder publish events to the site scope', () => {
    expect(planRevalidation('sitebuilder.published')).toBe('site');
    expect(planRevalidation('sitebuilder.rolled_back')).toBe('site');
  });

  it('maps the two builder events that are REALLY published to the builder scope', () => {
    // `builder.published` / `builder.rolled_back` are the only `builder.*` members of
    // the `EventType` union, and until 2026-07 there were none at all — this branch
    // was written against names nobody emitted, so it was dead code that looked
    // healthy. Both are now published by `POST /v1/builder/site/publish` and
    // `.../releases/:id/restore`. Anything else here is aspirational; keep this list
    // matching `wizeworks/packages/events/src/types.ts` rather than inventing plausible names.
    for (const type of ['builder.published', 'builder.rolled_back']) {
      expect(planRevalidation(type)).toBe('builder');
    }
  });

  it('still maps any future builder.* name by prefix', () => {
    // The branch is a prefix match on purpose: a later `builder.email.published` should
    // purge the same tag without a worker change. This asserts the prefix behaviour
    // WITHOUT implying those names exist today.
    expect(planRevalidation('builder.something.new')).toBe('builder');
  });

  it('keeps builder and site as SEPARATE scopes', () => {
    // They invalidate different reads and fire on different events: `site:` tags the
    // legacy snapshot + nav menus, `builder:` tags the page/layout/frame/style reads.
    // A page publish is the most frequent write in the system and must not evict the
    // snapshot alongside it (docs/127 §6).
    expect(planRevalidation('builder.published')).not.toBe(
      planRevalidation('sitebuilder.published')
    );
  });

  it('returns null for events that touch no cached read', () => {
    for (const type of ['cart.updated', 'order.paid', 'email.send', 'media.uploaded']) {
      expect(planRevalidation(type)).toBeNull();
    }
  });
});

describe('the subscription list', () => {
  it('asks only for events the handler does something with', () => {
    // The list is explicit and the mapping is by prefix, so they can drift: a name
    // here that maps to nothing would be delivered, acked and dropped, which reads
    // exactly like coverage. Every name must purge something.
    const unmapped = EVENTS.filter((type) => planRevalidation(type) === null);
    expect(unmapped).toEqual([]);
  });

  it('carries every save that changes the business payload', () => {
    // The events that purge `tenant:<slug>`, the payload with the site's name,
    // logo, socials, cookie banner, module flags and billing phase. Drop one and
    // that save waits for the five-minute cache again.
    for (const type of [
      'tenant.updated',
      'tenant.subscription.changed',
      'site.updated',
      'template.installed',
      'module.activated',
      'module.deactivated',
    ]) {
      expect(EVENTS).toContain(type);
    }
  });

  it('lists each event once', () => {
    expect(new Set(EVENTS).size).toBe(EVENTS.length);
  });
});

describe('revalidateBody', () => {
  it('names the one scope it purges', () => {
    expect(revalidateBody('thistle', 'commerce')).toEqual({
      tenant: 'thistle',
      scopes: ['commerce'],
    });
  });

  it('sends no scopes for `all`, which the site reads as every scope it has', () => {
    // app/api/revalidate/route.ts: `requested.length ? requested : [...SCOPES]`.
    // Sending the literal 'all' would be filtered out to the same effect, but no
    // scopes is the contract the route documents.
    expect(revalidateBody('thistle', 'all')).toEqual({ tenant: 'thistle' });
  });
});
