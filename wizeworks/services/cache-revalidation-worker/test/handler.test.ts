import { describe, expect, it } from 'vitest';

import { planRevalidation } from '../src/handler.js';

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
